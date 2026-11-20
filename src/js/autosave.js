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
   whatever their age. And held to ROOM in all: a board heavy with icon
   pictures is megabytes a copy, and the older copies give way, down to
   the newest three made as it changed and the newest of each cause.

   Two stores: the copies themselves (copies), and a line about each
   (about: when, why, how much it holds, how large it is). Everything but
   putting a copy back or saving it as a file reads the lines only. */
(function (root) {
  "use strict";

  const DATABASE = "nordlys_autosaves";
  const STORE = "copies";
  const RECENT = 10;
  const DAYS = 30;
  const DAY = 86400000;
  const OF_A_CAUSE = 3;
  const ABOUT = "about";
  // Characters of JSON, which is near enough to bytes: about 200 MB.
  const ROOM = 200e6;
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

  /* What a card fetched (it says when: at) and the running focus timer are
     not the setup: a feed read again, or a minute gone by, is no change to
     keep a copy of. */
  const fetched = (id, data) => id === "focus-timer" || typeof data?.at === "number";

  // A backup file without the moment it was written: two of these alike are the same setup.
  function mark(file) {
    const copy = Object.assign({}, file);
    if (copy[EXTRAS]) {
      copy[EXTRAS] = Object.assign({}, copy[EXTRAS]);
      delete copy[EXTRAS].savedAt;
      const cards = copy[EXTRAS].dashboardData;
      if (cards && typeof cards === "object") {
        copy[EXTRAS].dashboardData = Object.fromEntries(Object.entries(cards).filter(([id, data]) => !fetched(id, data)));
      }
    }
    return JSON.stringify(copy);
  }

  /* A mark in a few characters, kept in the line about a copy, so that "is
     this the setup the newest copy holds" is answered without reading that
     copy. Two 32-bit sums and the length: alike by chance is not a thing
     that happens to one person's board. */
  function sum(text) {
    let a = 0x811c9dc5, b = 0x01000193;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      a = Math.imul(a ^ code, 0x01000193);
      b = Math.imul(b + code, 0x85ebca6b) ^ (b >>> 13);
    }
    return `${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}-${text.length}`;
  }

  /* The ids that stay once the copies are held to ROOM: from the ones the
     rules keep (stay), the oldest made as the setup changed go first, never
     the newest three of them. Still too much, and the copies with a cause
     follow, oldest first, never the newest of each cause. What stays then
     stays, whatever its size: the last ways back are worth more than the
     room. lines: what is known about each copy ({ id, cause, size }). */
  function roomFor(lines, stay, room = ROOM) {
    const held = lines.filter((line) => stay.has(line.id));
    let total = held.reduce((all, line) => all + (line.size || 0), 0);
    const plain = held.filter((line) => !line.cause).sort((x, y) => x.id - y.id);
    const out = new Set(stay);
    for (const line of plain.slice(0, Math.max(0, plain.length - 3))) {
      if (total <= room) break;
      out.delete(line.id);
      total -= line.size || 0;
    }
    const newest = {};
    for (const line of held) if (line.cause && !(newest[line.cause] > line.id)) newest[line.cause] = line.id;
    for (const line of held.filter((each) => each.cause).sort((x, y) => x.id - y.id)) {
      if (total <= room) break;
      if (newest[line.cause] === line.id) continue;
      out.delete(line.id);
      total -= line.size || 0;
    }
    return out;
  }

  // How much a file holds: the folders and bookmarks of the space in use, and how many spaces.
  function count(file) {
    const groups = Array.isArray(file?.groups) ? file.groups : [];
    const spaces = Array.isArray(file?.[EXTRAS]?.spaces?.list) ? file[EXTRAS].spaces.list.length : 1;
    return { folders: groups.length, links: groups.reduce((sum, group) => sum + (Array.isArray(group?.links) ? group.links.length : 0), 0), spaces };
  }

  // The line about a copy: everything but the file.
  const line = (copy) => { const about = Object.assign({}, copy); delete about.file; return about; };

  function open() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("no IndexedDB")); return; }
      const request = root.indexedDB.open(DATABASE, 3);
      /* Version 1 and 2 had the copies alone, each with its line inside it;
         3 keeps the lines apart, and writes one for every copy there is. */
      request.onupgradeneeded = () => {
        const database = request.result;
        const copies = database.objectStoreNames.contains(STORE) ? request.transaction.objectStore(STORE) : database.createObjectStore(STORE, { keyPath: "id" });
        if (database.objectStoreNames.contains(ABOUT)) return;
        const about = database.createObjectStore(ABOUT, { keyPath: "id" });
        const walk = copies.openCursor();
        walk.onsuccess = () => {
          const at = walk.result;
          if (!at) return;
          const text = mark(at.value.file);
          about.put(Object.assign(line(at.value), count(at.value.file), { sum: sum(text), size: text.length }));
          at.continue();
        };
      };
      /* A tab still open on the build before this one holds the database at
         its older version, and this request waits for it. Whoever asked is
         told at once that there is no copy to be had, and does not wait on a
         tab that may stay open all day; the database is let go of when it
         does open. */
      let refused = false;
      request.onblocked = () => { refused = true; reject(new Error("the copies are open in an older tab")); };
      request.onsuccess = () => { if (refused) request.result.close(); else resolve(request.result); };
      request.onerror = () => reject(request.error);
    });
  }

  async function run(mode, work) {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE, ABOUT], mode);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
        work({ copies: transaction.objectStore(STORE), about: transaction.objectStore(ABOUT) }, (value) => { result = value; });
      });
    } finally { database.close(); }
  }

  /* The lines about the copies, newest first. files: each with its file as
     well, which is every copy read whole; nothing in the product asks for
     that (the tests do). */
  const list = (files = false) => run("readonly", ({ copies, about }, give) => {
    const lines = about.getAll();
    lines.onsuccess = () => {
      const found = (lines.result || []).sort((a, b) => b.id - a.id);
      if (!files) { give(found); return; }
      const all = copies.getAll();
      all.onsuccess = () => {
        const held = new Map((all.result || []).map((copy) => [copy.id, copy.file]));
        give(found.map((each) => Object.assign({}, each, { file: held.get(each.id) })));
      };
    };
  }).catch(() => []);

  // The file of one copy, to put back or to save; null when it is not there.
  const file = (id) => run("readonly", ({ copies }, give) => {
    const one = copies.get(id);
    one.onsuccess = () => give(one.result ? one.result.file : null);
  }).catch(() => null);

  /* Keeps the file. A copy with no cause is not kept when it is the setup
     the newest copy already holds; one with a cause always is. Answers the
     line about the copy that was kept, or null for a setup already held.
     Fails (rejects) when the copy could not be written: whoever is about to
     replace the setup must know that it has no way back.

     No copy is read to do this, only the lines about them: a new tab does
     it, and the copies can be megabytes each. */
  function keep(given, { cause = "", now = Date.now(), at, note = {} } = {}) {
    const text = mark(given);
    const fresh = sum(text);
    return run("readwrite", ({ copies, about }, give) => {
      const all = about.getAll();
      all.onsuccess = () => {
        const lines = (all.result || []).sort((a, b) => b.id - a.id);
        const last = lines[0];
        if (!cause && last && last.sum === fresh) { give(null); return; }
        // at: the time of a copy made earlier, moved here from an older store.
        const id = at || (last && last.id >= now ? last.id + 1 : now);
        const about_ = Object.assign({}, note, { id, savedAt: new Date(id).toISOString(), sum: fresh, size: text.length }, count(given));
        if (CAUSES.includes(cause)) about_.cause = cause;
        copies.put({ id, file: given });
        about.put(about_);
        give(about_);
        const known = [about_, ...lines.filter((each) => each.id !== id)];
        const caused = {};
        for (const each of known) if (each.cause) (caused[each.cause] ||= []).push(each.id);
        const stay = roomFor(known, kept(known.map((each) => each.id), now, caused));
        for (const each of known) if (!stay.has(each.id)) { copies.delete(each.id); about.delete(each.id); }
      };
    });
  }

  const remove = (id) => run("readwrite", ({ copies, about }) => { copies.delete(id); about.delete(id); }).catch(() => null);

  // Fails (rejects) when the copies could not be deleted: they are then still there, and that is said.
  const clear = () => run("readwrite", ({ copies, about }) => { copies.clear(); about.clear(); });

  const api = { kept, roomFor, mark, sum, fetched, count, list, file, keep, remove, clear, RECENT, DAYS, OF_A_CAUSE, CAUSES, ROOM };
  root.NordlysAutosave = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
