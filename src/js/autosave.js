/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - EARLIER VERSIONS
   ═══════════════════════════════════════════════════════════════════

   Whenever the setup changes, a copy of it is kept on this device with the
   time it was made, so a change can be taken back days later and not only in
   the moment. The copies are backup files (config-schema.js) in a small
   IndexedDB of their own: they are too large to sit in storage beside the
   setup, which is read whole on every new tab.

   Kept: the newest ten, then the last copy of each day for thirty days. */
(function (root) {
  "use strict";

  const DATABASE = "nordlys_autosaves";
  const STORE = "copies";
  const RECENT = 10;
  const DAYS = 30;
  const DAY = 86400000;
  const EXTRAS = "nordlysBackup";

  // The ids to keep, from ids that are the times the copies were made.
  function kept(ids, now) {
    const sorted = [...ids].sort((a, b) => b - a);
    const keep = new Set(sorted.slice(0, RECENT));
    const days = new Set();
    for (const id of sorted) {
      if (now - id > DAYS * DAY) break;
      const date = new Date(id);
      const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!days.has(day)) { days.add(day); keep.add(id); }
    }
    return keep;
  }

  // A backup file without the moment it was written: two of these alike are the same setup.
  function mark(file) {
    const copy = Object.assign({}, file);
    if (copy[EXTRAS]) { copy[EXTRAS] = Object.assign({}, copy[EXTRAS]); delete copy[EXTRAS].savedAt; }
    return JSON.stringify(copy);
  }

  function count(file) {
    const groups = Array.isArray(file?.groups) ? file.groups : [];
    return { folders: groups.length, links: groups.reduce((sum, group) => sum + (Array.isArray(group?.links) ? group.links.length : 0), 0) };
  }

  function open() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("no IndexedDB")); return; }
      const request = root.indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
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

  // Newest first.
  const list = () => run("readonly", (store, give) => {
    const request = store.getAll();
    request.onsuccess = () => give((request.result || []).sort((a, b) => b.id - a.id));
  }).catch(() => []);

  /* Keeps the file unless it is the setup the newest copy already holds.
     Answers the copy that was kept, or null. */
  async function keep(file, now = Date.now()) {
    const fresh = mark(file);
    return run("readwrite", (store, give) => {
      const all = store.getAll();
      all.onsuccess = () => {
        const copies = (all.result || []).sort((a, b) => b.id - a.id);
        if (copies[0] && mark(copies[0].file) === fresh) { give(null); return; }
        const id = copies[0] && copies[0].id >= now ? copies[0].id + 1 : now;
        const copy = Object.assign({ id, savedAt: new Date(id).toISOString(), file }, count(file));
        store.put(copy);
        const stay = kept([id, ...copies.map((each) => each.id)], now);
        for (const each of copies) if (!stay.has(each.id)) store.delete(each.id);
        give(copy);
      };
    }).catch(() => null);
  }

  const clear = () => run("readwrite", (store) => { store.clear(); }).catch(() => null);

  const api = { kept, mark, count, list, keep, clear, RECENT, DAYS };
  root.NordlysAutosave = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
