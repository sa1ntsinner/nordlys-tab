const { test: base, expect } = require('@playwright/test');
const { resolve } = require('node:path');
const { startStaticServer } = require('./static-server.cjs');
const { DEMO_BOARD } = require('./demo-board.cjs');
const test = base.extend({
  /* What the page finds in storage when it opens. The product ships an empty
     board, so a spec that needs tiles to drag installs one the way a returning
     user has one — see demo-board.cjs. Set to null for first-run behaviour and
     for anything asserting how storage is adopted. */
  nordlysBoard: [DEMO_BOARD, { option: true }],
  nordlysPage: async ({ page, nordlysBoard }, use) => {
    const storageState = {}, runtimeErrors = [];
    const server = await startStaticServer(resolve(__dirname, '../..'));
    await page.exposeFunction('__nordlysStorageSet', values => Object.assign(storageState, values));
    await page.exposeFunction('__nordlysStorageRemove', keys => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete storageState[key];
    });
    page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    await page.addInitScript(([state, board]) => {
      /* Once per context, not once per navigation: a spec that removes the
         config and reloads is testing what an empty store does, and a fixture
         that put it back would answer its own question. */
      if (board && !localStorage.getItem('__nordlys_test_board')) {
        localStorage.setItem('__nordlys_test_board', '1');
        localStorage.setItem('nordlys_config', JSON.stringify(board));
      }
      const saved = localStorage.getItem('__nordlys_test_storage');
      if (saved) Object.assign(state, JSON.parse(saved));
      const persist = () => localStorage.setItem('__nordlys_test_storage', JSON.stringify(state));
      const pick = keys => keys == null ? { ...state } : typeof keys === 'string' ? { [keys]: state[keys] } : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, state[key]])) : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]));
      /* Chrome sync, in memory and kept across reloads like the local area.
         window.__syncRemote(items) writes as another device would. */
      const syncState = JSON.parse(localStorage.getItem('__nordlys_test_sync') || '{}');
      const persistSync = () => localStorage.setItem('__nordlys_test_sync', JSON.stringify(syncState));
      const changeListeners = [];
      const announce = (values, area, removed = []) => {
        const changes = {};
        for (const [key, value] of Object.entries(values)) changes[key] = { newValue: JSON.parse(JSON.stringify(value)) };
        for (const key of removed) changes[key] = { newValue: undefined };
        setTimeout(() => changeListeners.forEach(fn => fn(changes, area)), 0);
      };
      const pickSync = keys => keys == null ? JSON.parse(JSON.stringify(syncState)) : Object.fromEntries([].concat(keys).filter(key => key in syncState).map(key => [key, JSON.parse(JSON.stringify(syncState[key]))]));
      const syncArea = {
        get(keys, callback) { const answer = pickSync(keys); setTimeout(() => callback(answer), 0); },
        set(values, callback) { Object.assign(syncState, JSON.parse(JSON.stringify(values))); persistSync(); announce(values, 'sync'); setTimeout(() => callback?.(), 0); },
        remove(keys, callback) { for (const key of [].concat(keys)) delete syncState[key]; persistSync(); announce({}, 'sync', [].concat(keys)); setTimeout(() => callback?.(), 0); }
      };
      window.__syncRemote = values => new Promise(resolve => syncArea.set(values, resolve));
      window.__syncState = () => JSON.parse(JSON.stringify(syncState));
      window.chrome = { storage: { onChanged: { addListener(fn) { changeListeners.push(fn); }, removeListener(fn) { const i = changeListeners.indexOf(fn); if (i >= 0) changeListeners.splice(i, 1); } }, sync: syncArea, local: {
        /* Answers on a later tick with what was there when asked, as chrome.storage
           does. A synchronous answer here hid a real ordering bug, and answering
           with the state at delivery time hid a second one: a write that lands
           between the request and the answer is exactly the case that matters. */
        get(keys, callback) { const answer = pick(keys); setTimeout(() => callback(answer), 0); },
        set(values, callback) { Object.assign(state, values); persist(); window.__nordlysStorageSet(values); callback?.(); },
        remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; persist(); window.__nordlysStorageRemove(keys); callback?.(); },
        clear(callback) { const keys = Object.keys(state); for (const key of keys) delete state[key]; persist(); window.__nordlysStorageRemove(keys); callback?.(); }
      } }, runtime: { getURL: path => `${location.origin}/${String(path).replace(/^\//, '')}` },
        /* A bookmark tree the tests can shape, plus the optional-permission
           dance Chrome requires before any of it is readable. Tests drive both
           through window.__bookmarks. */
        /* The search box hands its text to Chrome. The shim records the call so a
           test can see what was sent and where, without a navigation happening. */
        search: {
          query(details) {
            (window.__searches ||= []).push(details);
            return Promise.resolve();
          }
        },
        permissions: {
          // Leave handed back: recorded, and no longer held.
          remove(request, callback) {
            const origins = (window.__origins ||= {});
            origins.removed = [...(origins.removed || []), ...(request?.origins || [])];
            origins.held = (origins.held || []).filter(origin => !(request?.origins || []).includes(origin));
            callback?.(true);
          },
          contains(request, callback) {
            if (request?.origins?.length) { const held = window.__origins?.held || []; callback(request.origins.every(origin => held.includes(origin))); return; }
            if (request?.permissions?.includes("sessions")) { callback(Boolean(window.__sessions?.granted)); return; }
            if (request?.permissions?.includes("tabs")) { callback(Boolean(window.__tabs?.granted)); return; }
            if (request?.permissions?.includes("history")) { callback(Boolean(window.__history?.granted)); return; }
            callback(Boolean(window.__bookmarks?.granted));
          },
          request(request, callback) {
            /* Leave to reach a site (a connected app): given unless a test says
               otherwise with window.__origins = { grant: false }. */
            if (request?.origins?.length) {
              const origins = (window.__origins ||= {});
              origins.asked = [...(origins.asked || []), ...request.origins];
              if (origins.grant !== false) origins.held = [...(origins.held || []), ...request.origins];
              callback(origins.grant !== false);
              return;
            }
            if (request?.permissions?.includes("sessions")) {
              const sessions = (window.__sessions ||= {});
              sessions.granted = sessions.grantOnRequest !== false;
              callback(sessions.granted);
              return;
            }
            if (request?.permissions?.includes("tabs")) {
              if (window.__tabs) window.__tabs.granted = window.__tabs.grantOnRequest !== false;
              callback(Boolean(window.__tabs?.granted));
              return;
            }
            if (request?.permissions?.includes("history")) {
              if (window.__history) window.__history.granted = window.__history.grantOnRequest !== false;
              callback(Boolean(window.__history?.granted));
              return;
            }
            if (window.__bookmarks) window.__bookmarks.granted = window.__bookmarks.grantOnRequest !== false;
            callback(Boolean(window.__bookmarks?.granted));
          }
        },
        /* Open tabs the tests can shape: window.__tabs = { list, granted,
           grantOnRequest }; created, removed and switched-to ones are recorded. */
        tabs: {
          query(query, callback) { setTimeout(() => callback((window.__tabs?.list || []).map(tab => ({ ...tab }))), 0); },
          remove(ids, callback) { const gone = new Set([].concat(ids)); if (window.__tabs) { window.__tabs.list = (window.__tabs.list || []).filter(tab => !gone.has(tab.id)); (window.__tabs.removed ||= []).push(...gone); } callback?.(); },
          create(details) { (window.__tabs ||= {}); (window.__tabs.created ||= []).push(details.url); return Promise.resolve({ id: Date.now(), ...details }); },
          update(id, details, callback) { (window.__tabs ||= {}); (window.__tabs.updated ||= []).push({ id, ...details }); callback?.(); },
          getCurrent(callback) { callback(window.__tabs?.current); }
        },
        windows: {
          update(id, details, callback) { (window.__tabs ||= {}); (window.__tabs.focused ||= []).push(id); callback?.(); }
        },
        /* Tabs and windows closed lately: window.__sessions = { list, granted,
           grantOnRequest }; restored ones are recorded, and changed() tells the
           page as Chrome would. */
        sessions: {
          getRecentlyClosed(filter, callback) { setTimeout(() => callback((window.__sessions?.list || []).slice(0, filter?.maxResults || 25)), 0); },
          restore(id, callback) { const sessions = (window.__sessions ||= {}); (sessions.restored ||= []).push(id); sessions.list = (sessions.list || []).filter(entry => (entry.tab || entry.window).sessionId !== id); callback?.(); for (const listener of sessions.listeners || []) listener(); },
          onChanged: { addListener(listener) { const sessions = (window.__sessions ||= {}); (sessions.listeners ||= []).push(listener); } }
        },
        /* History the tests can shape: window.__history = { list, granted,
           grantOnRequest }. Searched by title and address as Chrome does. */
        history: {
          search(query, callback) {
            const text = String(query.text || '').toLowerCase();
            const found = (window.__history?.list || []).filter(page => `${page.title} ${page.url}`.toLowerCase().includes(text));
            setTimeout(() => callback(found.slice(0, query.maxResults || 100)), 0);
          }
        },
        bookmarks: {
          getTree(callback) { callback(window.__bookmarks?.tree || []); },
          search(query, callback) {
            const text = String(query).toLowerCase();
            const found = [];
            const walk = nodes => { for (const node of nodes || []) { if (node.url && `${node.title} ${node.url}`.toLowerCase().includes(text)) found.push({ ...node, children: undefined }); walk(node.children); } };
            walk(window.__bookmarks?.tree);
            setTimeout(() => callback(found), 0);
          },
          get(ids, callback) {
            const wanted = new Set([].concat(ids).map(String));
            const found = [];
            const walk = nodes => { for (const node of nodes || []) { if (wanted.has(String(node.id))) found.push({ ...node, children: undefined }); walk(node.children); } };
            walk(window.__bookmarks?.tree);
            callback(found);
          },
          getChildren(id, callback) {
            const find = nodes => {
              for (const node of nodes || []) {
                if (String(node.id) === String(id)) return node.children || [];
                const deeper = find(node.children);
                if (deeper) return deeper;
              }
              return null;
            };
            const children = find(window.__bookmarks?.tree || []);
            if (children === null) {
              window.chrome.runtime.lastError = { message: 'No bookmark with id: ' + id };
              callback(undefined);
              delete window.chrome.runtime.lastError;
              return;
            }
            callback(children);
          },
          onCreated: { addListener(fn) { (window.__bookmarks.listeners ||= []).push(fn); }, removeListener() {} },
          onRemoved: { addListener() {}, removeListener() {} },
          onChanged: { addListener() {}, removeListener() {} },
          onMoved: { addListener() {}, removeListener() {} },
          onChildrenReordered: { addListener() {}, removeListener() {} }
        } };
    }, [storageState, nordlysBoard]);
    await page.goto(`${server.origin}/newtab.html`);
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    await use({ page, storageState, runtimeErrors, origin: server.origin });
    await server.close();
  }
});
module.exports = { test, expect };
