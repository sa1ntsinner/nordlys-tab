/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SAVED PAGES, WAITING FOR A BOARD
   ═══════════════════════════════════════════════════════════════════

   The toolbar button, the right-click item and every open board share one
   queue, nordlys_inbox. Each used to read the list and write it back, so two
   saves at once kept one page, and a new tab emptied the list before the
   board that should hold the pages was saved.

   Now one of them at a time holds the queue (a lock the browser keeps
   across the popup, the worker and the tabs), and holds it until the
   browser has answered the write: for a new tab, the write of the board as
   well. A page leaves the queue only when it is on a saved board. Closing a
   tab lets go of its lock. */
(() => {
  "use strict";
  const key = "nordlys_inbox";
  function local(method, value) {
    return new Promise((resolve, reject) => chrome.storage.local[method](value, (result) => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message)); else resolve(result);
    }));
  }
  function locked(change) {
    // A browser without locks takes its turn unguarded, as every one did before.
    const turn = navigator.locks ? (work) => navigator.locks.request(key, work) : (work) => work();
    return turn(async () => {
      const data = await local("get", key);
      const items = Array.isArray(data?.[key]) ? data[key] : [];
      // Older saves waited here without ids. Keep their order and contents.
      if (items.some((item) => !item?.id)) {
        for (let i = 0; i < items.length; i++) {
          if (!items[i]?.id) items[i] = { ...items[i], id: crypto.randomUUID() };
        }
        await local("set", { [key]: items });
      }
      return change(items);
    });
  }
  globalThis.NordlysInbox = {
    add(page) {
      return locked((items) => local("set", { [key]: [...items, { ...page, id: crypto.randomUUID(), at: Date.now() }] }));
    },
    take(commit) {
      return locked(async (items) => {
        if (!items.length) return;
        const taken = await commit(items);
        if (!taken?.size) return;
        const waiting = items.filter((item) => !taken.has(item.id));
        if (waiting.length) await local("set", { [key]: waiting });
        else await local("remove", key);
      });
    }
  };
})();
