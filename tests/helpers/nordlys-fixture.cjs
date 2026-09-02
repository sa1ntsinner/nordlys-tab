const { test: base, expect } = require('@playwright/test');
const { resolve } = require('node:path');
const { startStaticServer } = require('./static-server.cjs');
const test = base.extend({
  nordlysPage: async ({ page }, use) => {
    const storageState = {}, runtimeErrors = [];
    const server = await startStaticServer(resolve(__dirname, '../..'));
    await page.exposeFunction('__nordlysStorageSet', values => Object.assign(storageState, values));
    await page.exposeFunction('__nordlysStorageRemove', keys => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete storageState[key];
    });
    page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    await page.addInitScript(state => {
      const saved = localStorage.getItem('__nordlys_test_storage');
      if (saved) Object.assign(state, JSON.parse(saved));
      const persist = () => localStorage.setItem('__nordlys_test_storage', JSON.stringify(state));
      const pick = keys => keys == null ? { ...state } : typeof keys === 'string' ? { [keys]: state[keys] } : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, state[key]])) : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]));
      window.chrome = { storage: { local: {
        get(keys, callback) { callback(pick(keys)); },
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
          contains(request, callback) { callback(Boolean(window.__bookmarks?.granted)); },
          request(request, callback) {
            if (window.__bookmarks) window.__bookmarks.granted = window.__bookmarks.grantOnRequest !== false;
            callback(Boolean(window.__bookmarks?.granted));
          }
        },
        bookmarks: {
          getTree(callback) { callback(window.__bookmarks?.tree || []); },
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
    }, storageState);
    await page.goto(`${server.origin}/newtab.html`);
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
    await use({ page, storageState, runtimeErrors, origin: server.origin });
    await server.close();
  }
});
module.exports = { test, expect };
