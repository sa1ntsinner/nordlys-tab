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
      const pick = keys => keys == null ? { ...state } : typeof keys === 'string' ? { [keys]: state[keys] } : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, state[key]])) : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]));
      window.chrome = { storage: { local: {
        get(keys, callback) { callback(pick(keys)); },
        set(values, callback) { Object.assign(state, values); window.__nordlysStorageSet(values); callback?.(); },
        remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; window.__nordlysStorageRemove(keys); callback?.(); }
      } }, runtime: { getURL: path => `${location.origin}/${String(path).replace(/^\//, '')}` } };
    }, storageState);
    await page.goto(`${server.origin}/newtab.html`);
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
    await use({ page, storageState, runtimeErrors, origin: server.origin });
    await server.close();
  }
});
module.exports = { test, expect };
