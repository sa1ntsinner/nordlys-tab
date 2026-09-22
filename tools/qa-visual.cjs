const { chromium } = require('@playwright/test');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { startStaticServer } = require('../tests/helpers/static-server.cjs');
const { DEMO_BOARD } = require('../tests/helpers/demo-board.cjs');

/* Hoisted out of main so the failure path can close them too. Leaking a headless
   browser is not a quiet mistake: the shell keeps rasterising through swiftshader
   with nobody watching. Two orphaned sweeps once held ~1.7 cores for three hours. */
let browser, server;

async function main() {
  const root = resolve(__dirname, '..');
  const output = resolve(root, 'test-screenshots', 'qa-sweep');
  await mkdir(output, { recursive: true });
  server = await startStaticServer(root);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  /* A control that never becomes actionable -- #gear at 320px wide, say -- should
     fail the sweep, not stall it. Shorter than Playwright's 30 s default because
     every step here is local and instant when it works. */
  page.setDefaultTimeout(15_000);
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
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
  await page.route('https://api.iconify.design/search?**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ icons: ['simple-icons:github', 'simple-icons:githubactions', 'simple-icons:githubcopilot'] })
  }));
  await page.route('https://api.iconify.design/simple-icons.json?**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ prefix: 'simple-icons', width: 24, height: 24, icons: {
      github: { body: '<path d="M12 2L22 22H2Z"/>' },
      githubactions: { body: '<path d="M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12"/>' },
      githubcopilot: { body: '<path d="M4 5H20V19H4Z"/>' }
    } })
  }));
  /* The static harness has no chrome://favicon store. Supply a local inert pixel
     so exercising the Website icon pane cannot hide real console errors. */
  await page.route('**/_favicon/**', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwO+WQAAAABJRU5ErkJggg==', 'base64')
  }));
  await page.goto(`${server.origin}/newtab.html`);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
  const inspect = async label => checks.push(await page.evaluate(name => {
    const visible = [...document.querySelectorAll('button,input,select,textarea,a,[tabindex]')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const insideHorizontalScroller = node => {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth) return true;
      }
      return false;
    };
    const clipped = visible.filter(node => {
      const r = node.getBoundingClientRect();
      return (r.right > innerWidth + 1 || r.left < -1) && !insideHorizontalScroller(node);
    });
    const overflowElements = [...document.querySelectorAll('body *')]
      .filter(node => node.getClientRects().length && node.scrollWidth > node.clientWidth + 1)
      .map(node => ({
        element: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflowX: getComputedStyle(node).overflowX
      }))
      .slice(0, 12);
    const viewportEscapes = [...document.querySelectorAll('body *')]
      .filter(node => {
        const r = node.getBoundingClientRect();
        return node.getClientRects().length && (r.right > innerWidth + 1 || r.left < -1) && !insideHorizontalScroller(node);
      })
      .map(node => {
        const r = node.getBoundingClientRect();
        return { element: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), position: getComputedStyle(node).position };
      })
      .slice(0, 12);
    const search = document.getElementById('searchwrap');
    const searchRect = search?.getBoundingClientRect();
    return {
      label: name,
      viewport: { innerWidth, clientWidth: document.documentElement.clientWidth, visualWidth: Math.round(visualViewport?.width || 0) },
      viewportOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      unnamedButtons: visible.filter(node => node.tagName === 'BUTTON' && !(node.textContent || '').trim() && !node.getAttribute('aria-label') && !node.getAttribute('title')).length,
      clippedControls: clipped.length,
      overflowElements,
      viewportEscapes,
      searchDebug: search ? { width: Math.round(searchRect.width), computedWidth: getComputedStyle(search).width, transform: getComputedStyle(search).transform, animation: getComputedStyle(search).animationName } : null,
      clipped: clipped.map(node => {
        const r = node.getBoundingClientRect();
        return { element: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      })
    };
  }, label));

  /* First, the page as it actually arrives: nothing in storage, so this is the
     invitation a new install opens on. Shot at both ends of the range, because
     the whole point of the empty state is that it has to carry the page on its
     own — there is no board behind it to fall back on. Captured before anything
     else touches storage, since it can only be seen once. */
  await inspect('first-run');
  await shot('00-first-run');
  await page.setViewportSize({ width: 320, height: 568 });
  await inspect('first-run-320');
  await shot('00-first-run-320');
  await page.setViewportSize({ width: 1440, height: 900 });

  /* From here the sweep needs tiles to open menus on and icons to pick, so it
     installs the same test board the UI specs use. It is a fixture, never a
     product default — see tests/helpers/demo-board.cjs. */
  await page.evaluate(board => {
    window.Nordlys.config.groups = board.groups;
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
    window.Nordlys.settings.renderBookmarksManager();
  }, DEMO_BOARD);

  await shot('01-main');
  await page.locator('#gear').click();
  const tabs = ['appearance', 'background', 'bookmarks', 'general', 'support', 'custom-css', 'backup'];
  for (const id of tabs) {
    await page.locator(`#settings-tab-${id}`).click();
    await inspect(`settings-${id}`);
    if (id === 'background' || id === 'bookmarks') await shot(`02-${id}`);
  }

  await page.locator('#settings-tab-background').click();
  for (const scene of ['aurora', 'halo', 'drift', 'horizon']) {
    await page.locator(`.scene-card[data-scene="${scene}"]`).click();
    await page.locator('.palette-chip[data-palette="polar"]').click();
    await inspect(`scene-${scene}`);
  }
  await shot('03-background-selected');
  await page.locator('#cfgx').click();

  const tile = page.locator('#board .tile').first();
  await tile.focus();
  await page.keyboard.press('Shift+F10');
  /* The menu opens on a later tick and then fades in. Shooting straight after
     the keypress caught it at opacity 0, and the sweep's own screenshot was
     read for months as "Shift+F10 does nothing". Wait for the transition to
     have finished, not merely for the element to exist. */
  await page.locator('#tile-ctx-menu').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const menu = document.getElementById('tile-ctx-menu');
    const style = menu && getComputedStyle(menu);
    return Boolean(style) && style.visibility === 'visible' && Number(style.opacity) === 1 && style.transform === 'none';
  });
  await shot('04-context-menu');
  await page.keyboard.press('Enter');
  await page.locator('#quick-icon-preview').click();
  await page.locator('#icon-search').fill('GitHub');
  await page.locator('#icon-search-btn').click();
  await page.locator('#modal-icon-grid .icon-item').first().waitFor();
  await inspect('icon-search-results');
  await shot('05-icon-search');
  await page.locator('.icon-tab-btn[data-tab="favicon"]').click();
  await shot('06-website-icon');
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await shot('07-custom-icon');
  await page.locator('#modal-x').click();
  /* #modal-x only closes the icon picker. The quick-edit modal it was opened from
     is still up, and its backdrop swallows every click aimed at #gear below. */
  await page.locator('#quick-modal-x').click();
  await page.locator('#quick-edit-modal').waitFor({ state: 'hidden' });

  await page.setViewportSize({ width: 320, height: 568 });
  await inspect('mobile-main');
  await shot('08-mobile-main');
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await inspect('mobile-background');
  await shot('09-mobile-background');

  /* Support last, and clipped to the drawer. The section itself never moves,
     but the aurora behind the glass does and its star field is seeded at
     random, so a full-page shot of it differs from run to run for reasons that
     have nothing to do with this panel. Stilling the atmosphere at a fixed
     phase and framing only #cfg leaves two shots that are comparable between
     runs -- and doing it here means nothing captured earlier saw a frozen sky.
     The shortcut legend is opened first: a collapsed disclosure photographs as
     a single row, which is the one thing these shots are not for. */
  const stillAtmosphere = () => page.evaluate(() => {
    const engine = window.Nordlys?.bgEngine;
    if (!engine) return;
    engine.setAtmosphere({ motion: 0 });
    engine.t = 0;
    engine.repaint();
  });
  const drawerShot = name => page.locator('#cfg').screenshot({ path: resolve(output, `${name}.png`) });
  const openSupport = async () => {
    await page.locator('#settings-tab-support').click();
    await page.locator('#sec-support').waitFor({ state: 'visible' });
    // The section renders once, so the legend is still open on the second visit.
    const legend = page.locator('.support-shortcuts');
    if (!await legend.evaluate(node => node.open)) await page.locator('.support-shortcuts > summary').click();
    const lastRow = page.locator('.support-shortcut').last();
    await lastRow.waitFor({ state: 'visible' });
    // At 320px the legend sits below the fold, and a shot of the empty space
    // above it proves nothing about how five key rows wrap into 320 pixels.
    await lastRow.scrollIntoViewIfNeeded();
  };

  await stillAtmosphere();
  await openSupport();
  await inspect('mobile-support');
  await drawerShot('10-mobile-support');

  await page.setViewportSize({ width: 1440, height: 900 });
  await openSupport();
  await inspect('support');
  await drawerShot('11-support');

  /* The Backup panel with both recovery rows showing at once. It is the one
     state a person only ever reaches just after doing something destructive, so
     it is also the one nobody looks at until it matters — the rows, the note
     about what the export file cannot carry, and the danger zone together. */
  await page.evaluate(() => {
    const point = cause => JSON.stringify({
      savedAt: new Date().toISOString(), cause, version: '2.2.3',
      config: { theme: 'aurora-void', groups: [] }
    });
    localStorage.setItem('nordlys_restore_point', point('migration'));
    localStorage.setItem('nordlys_undo_point', point('reset'));
    window.Nordlys.settings.renderRecoveryRows();
  });
  await page.locator('#settings-tab-backup').click();
  await page.locator('#undo-point-row').waitFor({ state: 'visible' });
  await inspect('backup-recovery');
  await drawerShot('12-backup-recovery');

  const report ={ errors, checks, passed: errors.length === 0 && checks.every(check => check.viewportOverflow <= 1 && check.clippedControls === 0 && check.unnamedButtons === 0) };
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await server.close();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n${output}\n`);
  if (!report.passed) process.exitCode = 1;
}

/* The static server keeps the event loop alive, so an unclosed browser means a
   process that never exits. Release both however main ends. */
main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
  });

/* Last resort, for the case where a close() is itself what wedged. */
setTimeout(() => {
  console.error('qa:visual watchdog fired -- forcing exit');
  process.exit(1);
}, 5 * 60_000).unref();
