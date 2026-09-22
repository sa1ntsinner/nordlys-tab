const { chromium } = require('@playwright/test');
const { mkdir } = require('node:fs/promises');
const { resolve } = require('node:path');
const { startStaticServer } = require('../tests/helpers/static-server.cjs');

async function main() {
  const root = resolve(__dirname, '..');
  const output = resolve(root, 'test-screenshots', 'atmospheres');
  await mkdir(output, { recursive: true });
  const server = await startStaticServer(root);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await page.addInitScript(() => {
    const state = {};
    window.chrome = {
      storage: { local: {
        get(keys, callback) { callback(typeof keys === 'object' && !Array.isArray(keys) ? { ...keys, ...state } : { ...state }); },
        set(values, callback) { Object.assign(state, values); callback?.(); },
        remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; callback?.(); },
        clear(callback) { for (const key of Object.keys(state)) delete state[key]; callback?.(); }
      } },
      runtime: { getURL: path => `${location.origin}/${path}` },
      search: { query: () => Promise.resolve() }
    };
  });
  await page.goto(`${server.origin}/newtab.html`);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  for (const mode of ['aurora', 'halo', 'drift', 'horizon']) {
    await page.evaluate(async scene => {
      window.Nordlys.config.bgMode = scene;
      window.Nordlys.config.bgMotion = 0;
      window.Nordlys.config.bgIntensity = 1;
      window.Nordlys.config.bgPalette = 'polar';
      await window.Nordlys.updateBackgroundMode();
    }, mode);
    await page.waitForTimeout(120);
    await page.screenshot({ path: resolve(output, `${mode}.png`) });
  }

  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await page.screenshot({ path: resolve(output, 'settings.png') });
  await browser.close();
  await server.close();
  process.stdout.write(`${output}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
