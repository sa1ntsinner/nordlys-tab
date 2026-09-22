/* global NORDLYS_REST_PHASE -- read inside page.evaluate, where background.js declares it */
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

  const demo = require('../tests/helpers/demo-board.cjs');
  await page.evaluate(board => {
    window.Nordlys.config.groups = board;
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  }, demo.DEMO_BOARD.groups);

  /* Every scene is a function of engine time, so each is photographed at its
     own rest phase — the frame a still sky holds — rather than at whatever
     moment the shutter happened to fall. */
  for (const mode of process.argv.slice(2).length ? process.argv.slice(2) : ['aurora', 'halo', 'silk', 'frost', 'drift', 'horizon']) {
    await page.evaluate(async scene => {
      window.Nordlys.config.bgMode = scene;
      window.Nordlys.config.bgMotion = 0;
      window.Nordlys.config.bgIntensity = 1;
      window.Nordlys.config.bgPalette = 'polar';
      await window.Nordlys.updateBackgroundMode();
      const engine = window.Nordlys.bgEngine;
      engine.t = NORDLYS_REST_PHASE[scene];
      engine.render(0);
    }, mode);
    await page.waitForTimeout(140);
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
