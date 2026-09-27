/* The live demo on the website is the extension's own new tab page. This
   stands in for the Chrome APIs it would have as an extension. Everything is
   kept in this browser tab's session storage, so nothing leaves the visitor's
   machine and every visit starts from the same demo board. */
(function () {
  "use strict";
  const NS = "nordlys-demo";
  const LOCAL_KEYS = /^(nordlys|aurora|aether)/;

  // A fresh board per visit, kept across reloads of the same tab.
  try {
    if (!sessionStorage.getItem(`${NS}:seeded`)) {
      for (const key of Object.keys(localStorage)) if (LOCAL_KEYS.test(key)) localStorage.removeItem(key);
      localStorage.setItem("nordlys_config", JSON.stringify(window.__NORDLYS_DEMO_BOARD || { groups: [] }));
      sessionStorage.setItem(`${NS}:seeded`, "1");
    }
  } catch (error) { /* storage blocked: the page still opens on its defaults */ }

  const listeners = [];
  const later = (fn) => setTimeout(fn, 0);
  function area(name) {
    const key = `${NS}:${name}`;
    const load = () => { try { return JSON.parse(sessionStorage.getItem(key) || "{}"); } catch (error) { return {}; } };
    const save = (state) => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch (error) { /* full: kept in memory for this page */ } };
    const tell = (changes) => later(() => listeners.forEach((fn) => fn(changes, name)));
    return {
      get(keys, callback) {
        const state = load();
        const pick = keys == null ? state : Object.fromEntries([].concat(typeof keys === "object" && !Array.isArray(keys) ? Object.keys(keys) : keys).filter((k) => k in state).map((k) => [k, state[k]]));
        later(() => callback?.(JSON.parse(JSON.stringify(pick))));
      },
      set(values, callback) {
        const state = load();
        const changes = {};
        for (const [k, v] of Object.entries(values)) { state[k] = v; changes[k] = { newValue: v }; }
        save(state);
        tell(changes);
        later(() => callback?.());
      },
      remove(keys, callback) {
        const state = load();
        const changes = {};
        for (const k of [].concat(keys)) { delete state[k]; changes[k] = { newValue: undefined }; }
        save(state);
        tell(changes);
        later(() => callback?.());
      },
      clear(callback) { save({}); later(() => callback?.()); }
    };
  }

  const nothing = { addListener() {}, removeListener() {} };
  window.chrome = {
    storage: { local: area("local"), sync: area("sync"), onChanged: { addListener: (fn) => listeners.push(fn), removeListener() {} } },
    runtime: {
      getURL: (path) => new URL(String(path).replace(/^\//, ""), location.href).href,
      getManifest: () => ({ name: "Nordlys", version: window.__NORDLYS_DEMO_VERSION || "" })
    },
    search: {
      query({ text }) {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(text || "")}`, "_blank", "noopener");
        return Promise.resolve();
      }
    },
    permissions: { contains: (request, callback) => callback(false), request: (request, callback) => callback(false) },
    bookmarks: {
      getTree: (callback) => callback([]), getChildren: (id, callback) => callback([]),
      onCreated: nothing, onRemoved: nothing, onChanged: nothing, onMoved: nothing, onChildrenReordered: nothing
    }
  };

  /* A bookmark opens outside the demo: the sites it points at refuse to be
     shown inside another page. */
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    const href = link?.getAttribute("href") || "";
    if (!/^https?:/i.test(href)) return;
    event.preventDefault();
    window.open(href, "_blank", "noopener");
  }, true);
})();
