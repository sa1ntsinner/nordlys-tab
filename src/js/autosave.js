/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - EARLIER VERSIONS
   ═══════════════════════════════════════════════════════════════════

   Whenever the setup changes, a copy of it is kept on this device with the
   time it was made, so a change can be taken back days later and not only in
   the moment. The copies are backup files (config-schema.js) in a small
   IndexedDB of their own: they are too large to sit in storage beside the
   setup, which is read whole on every new tab.

   This is the one place a way back is kept. A copy made because something
   was about to replace the whole setup says why (its cause): an update of
   the extension, an import, a reset, an older copy put back. Those are
   written before the thing they guard against, and it does not happen
   unless they landed.

   Kept: of the copies made as the setup changed, the newest ten, then the
   last of each day for thirty days; of each cause, the newest three,
   whatever their age. */
(function (root) {
  "use strict";

  const DATABASE = "nordlys_autosaves";
  const STORE = "copies";
  const RECENT = 10;
  const DAYS = 30;
  const DAY = 86400000;
  const OF_A_CAUSE = 3;
  const CAUSES = ["update", "import", "reset", "restore"];
  const EXTRAS = "nordlysBackup";

  /* The ids to keep, from ids that are the times the copies were made.
     caused: the ids of the copies that have a cause, by cause; they are
     counted apart, so a week of small changes never pushes out the copy
     made before an update. */
  function kept(ids, now, caused = {}) {
    const keep = new Set();
    const apart = new Set();
    for (const list of Object.values(caused)) {
      const sorted = [...list].sort((a, b) => b - a);
      for (const id of sorted) apart.add(id);
      for (const id of sorted.slice(0, OF_A_CAUSE)) keep.add(id);
    }
    const sorted = [...ids].filter((id) => !apart.has(id)).sort((a, b) => b - a);
    for (const id of sorted.slice(0, RECENT)) keep.add(id);
    const days = new Set();
    for (const id of sorted) {
      if (now - id > DAYS * DAY) break;
      const date = new Date(id);
      const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!days.has(day)) { days.add(day); keep.add(id); }
    }
    return keep;
  }

  /* A backup file without the moment it was written: two of these alike are
     the same setup. What a card fetched (it says when: at) and the running
     focus timer are not the setup either: a feed read again, or a minute
     gone by, is no change to keep a copy of. */
  function mark(file) {
    const copy = Object.assign({}, file);
    if (copy[EXTRAS]) {
      copy[EXTRAS] = Object.assign({}, copy[EXTRAS]);
      delete copy[EXTRAS].savedAt;
      const cards = copy[EXTRAS].dashboardData;
      if (cards && typeof cards === "object") {
        copy[EXTRAS].dashboardData = Object.fromEntries(Object.entries(cards).filter(([id, data]) => id !== "focus-timer" && typeof data?.at !== "number"));
      }
    }
    return JSON.stringify(copy);
  }

  // How much a file holds: the folders and bookmarks of the space in use, and how many spaces.
  function count(file) {
    const groups = Array.isArray(file?.groups) ? file.groups : [];
    const spaces = Array.isArray(file?.[EXTRAS]?.spaces?.list) ? file[EXTRAS].spaces.list.length : 1;
    return { folders: groups.length, links: groups.reduce((sum, group) => sum + (Array.isArray(group?.links) ? group.links.length : 0), 0), spaces };
  }

  function open() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("no IndexedDB")); return; }
      const request = root.indexedDB.open(DATABASE, 2);
      // Version 1 had the copies alone; 2 can ask for those of one cause without reading any.
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(STORE) ? request.transaction.objectStore(STORE) : database.createObjectStore(STORE, { keyPath: "id" });
        if (!store.indexNames.contains("cause")) store.createIndex("cause", "cause");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function run(mode, work) {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
        work(transaction.objectStore(STORE), (value) => { result = value; });
      });
    } finally { database.close(); }
  }

  // Newest first. The whole of every copy: asked only when the list is shown.
  const list = () => run("readonly", (store, give) => {
    const request = store.getAll();
    request.onsuccess = () => give((request.result || []).sort((a, b) => b.id - a.id));
  }).catch(() => []);

  /* Keeps the file. A copy with no cause is not kept when it is the setup
     the newest copy already holds; one with a cause always is. Answers the
     copy that was kept, or null for a setup already held. Fails (rejects)
     when the copy could not be written: whoever is about to replace the
     setup must know that it has no way back.

     Only the newest copy is read, and the ids of the rest: a new tab does
     this, and the copies can be megabytes each. */
  function keep(file, { cause = "", now = Date.now(), at, note = {} } = {}) {
    const fresh = cause ? "" : mark(file);
    return run("readwrite", (store, give) => {
      const newest = store.openCursor(null, "prev");
      newest.onsuccess = () => {
        const last = newest.result ? newest.result.value : null;
        if (!cause && last && mark(last.file) === fresh) { give(null); return; }
        // at: the time of a copy made earlier, moved here from an older store.
        const id = at || (last && last.id >= now ? last.id + 1 : now);
        const copy = Object.assign({}, note, { id, savedAt: new Date(id).toISOString(), file }, count(file));
        if (CAUSES.includes(cause)) copy.cause = cause;
        store.put(copy);
        give(copy);
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const caused = {};
          const walk = store.index("cause").openKeyCursor();
          walk.onsuccess = () => {
            const at = walk.result;
            if (at) { (caused[at.key] ||= []).push(at.primaryKey); at.continue(); return; }
            const stay = kept(keys.result || [], now, caused);
            for (const each of keys.result || []) if (!stay.has(each)) store.delete(each);
          };
        };
      };
    });
  }

  const remove = (id) => run("readwrite", (store) => { store.delete(id); }).catch(() => null);

  const clear = () => run("readwrite", (store) => { store.clear(); }).catch(() => null);

  const api = { kept, mark, count, list, keep, remove, clear, RECENT, DAYS, OF_A_CAUSE, CAUSES };
  root.NordlysAutosave = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
