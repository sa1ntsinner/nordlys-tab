/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FOLDERS THAT FOLLOW THE BROWSER
   ═══════════════════════════════════════════════════════════════════

   The most repeated complaint about start pages is not about looks, it is the
   wall at the beginning: a new board is empty and the bookmarks are already
   somewhere else. "I'm not going to add them one by one, I have about two
   thousand" is a real review, and variations of it outnumber every feature
   request in the category.

   A linked folder mirrors a browser bookmark folder. The browser stays the
   owner of the data, which is the second reason to do it this way: the thing
   that turns a five-star user into an uninstall is losing their setup, and a
   mirror cannot lose anything — the durable copy is the one the browser
   already syncs, backs up and shows in every other window.

   The mirror is one-way on purpose. Two-way editing means conflict resolution,
   and conflict resolution done casually is exactly what destroyed the largest
   competitor in this category: it shipped sync with, in the maintainer's own
   words, "no conflict resolution logic, which can cause overriding/losing
   settings between browsers", and never recovered its rating.

   The permission is optional and asked for at the moment somebody links a
   folder, so installing Nordlys never shows a prompt about reading bookmarks. */

(function () {
  "use strict";

  const PERMISSION = { permissions: ["bookmarks"] };

  function api() {
    return (typeof chrome !== "undefined" && chrome.bookmarks) ? chrome.bookmarks : null;
  }

  function permissionsApi() {
    return (typeof chrome !== "undefined" && chrome.permissions) ? chrome.permissions : null;
  }

  /* Chrome's bookmark APIs are callback-based and set chrome.runtime.lastError
     rather than throwing, so every call is wrapped once here. */
  function call(method, ...args) {
    const bookmarks = api();
    if (!bookmarks || typeof bookmarks[method] !== "function") {
      return Promise.reject(new Error("bookmarks unavailable"));
    }
    return new Promise((resolve, reject) => {
      try {
        bookmarks[method](...args, (result) => {
          const failure = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError;
          if (failure) reject(new Error(failure.message));
          else resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  const NordlysBookmarks = {
    /* Whether the browser has already granted the permission. Never asks. */
    granted() {
      const permissions = permissionsApi();
      if (!permissions) return Promise.resolve(false);
      return new Promise((resolve) => {
        try { permissions.contains(PERMISSION, (has) => resolve(Boolean(has))); }
        catch (error) { resolve(false); }
      });
    },

    /* Must be called from a user gesture: Chrome refuses otherwise. */
    request() {
      const permissions = permissionsApi();
      if (!permissions) return Promise.resolve(false);
      return new Promise((resolve) => {
        try { permissions.request(PERMISSION, (granted) => resolve(Boolean(granted))); }
        catch (error) { resolve(false); }
      });
    },

    /* Every folder in the browser's tree, flattened, with a readable path so
       "Work" and "Reading/Work" can be told apart in a list. */
    async folders() {
      const tree = await call("getTree");
      const found = [];
      const walk = (nodes, trail) => {
        for (const node of nodes || []) {
          if (!node.children) continue;
          // The unnamed roots exist in the tree but are not places to pick.
          const named = node.title && node.title.trim();
          const path = named ? trail.concat(node.title) : trail;
          if (named) found.push({ id: node.id, title: node.title, path: path.join(" / ") });
          walk(node.children, path);
        }
      };
      walk(tree, []);
      return found;
    },

    /* The bookmarks directly inside one folder, in the browser's own order.
       Nested folders are left alone: a tile grid is one level deep, and
       flattening a tree into it silently invents an order nobody chose. */
    async linksIn(folderId) {
      const children = await call("getChildren", String(folderId));
      return (children || [])
        .filter((child) => child.url && /^https?:/i.test(child.url))
        .map((child) => ({
          name: child.title || child.url,
          url: child.url,
          icon: "",
          color: "",
          fromBrowser: true
        }));
    },

    /* Refreshes every linked group in place. Returns true when anything moved,
       so the caller can decide whether a re-render and a save are warranted. */
    async refresh(config) {
      const linked = (config.groups || []).filter((group) => group.source && group.source.folderId);
      if (!linked.length) return false;
      if (!(await this.granted())) return false;

      let changed = false;
      for (const group of linked) {
        let links;
        try {
          links = await this.linksIn(group.source.folderId);
        } catch (error) {
          /* A folder the user deleted in the browser. Keep what is on screen
             and mark it, rather than emptying the group under them. */
          if (!group.source.missing) { group.source.missing = true; changed = true; }
          continue;
        }
        if (group.source.missing) { group.source.missing = false; changed = true; }
        if (JSON.stringify(links) !== JSON.stringify(group.links || [])) {
          group.links = links;
          changed = true;
        }
      }
      return changed;
    },

    /* Watching costs nothing until a folder is actually linked. */
    watch(handler) {
      const bookmarks = api();
      if (!bookmarks || !bookmarks.onChanged) return () => {};
      const events = ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered"];
      const listeners = [];
      for (const name of events) {
        const event = bookmarks[name];
        if (!event || typeof event.addListener !== "function") continue;
        event.addListener(handler);
        listeners.push([event, handler]);
      }
      return () => { for (const [event, fn] of listeners) event.removeListener?.(fn); };
    }
  };

  window.NordlysBookmarks = NordlysBookmarks;
})();
