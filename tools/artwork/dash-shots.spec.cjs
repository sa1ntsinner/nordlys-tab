const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');
const { BOARDS } = require('./store-board.cjs');
const { seedDashboard } = require('./dashboard-seed.cjs');

/* The store pictures of the dashboard: the day's cards over the folders,
   Focus mode, and the apps it connects to. Same rules as store-shots.spec.cjs:
   the real product, set up the way a person would, nothing drawn by hand. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/store-assets');
const SCRATCH = path.join(ROOT, 'tools/artwork/.scratch');
const WARMUP = 9000;
const STILL = '*,*::before,*::after{transition:none!important}#q{caret-color:transparent!important}';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
test.setTimeout(240000);

const shot = name => `/tools/artwork/.scratch/${name}`;
async function frame(page, name, warmup = 700) {
  await page.waitForTimeout(warmup);
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SCRATCH, name), animations: 'disabled' });
  return shot(name);
}
async function render(context, origin, name, html) {
  fs.writeFileSync(path.join(SCRATCH, 'compose.html'), html);
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1280, height: 800 });
  await sheet.goto(`${origin}/tools/artwork/.scratch/compose.html`);
  await sheet.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode().catch(() => {}))]));
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(OUT, name), scale: 'css' });
  await sheet.close();
  console.log(`  ${name} ${Math.round(fs.statSync(path.join(OUT, name)).size / 1024)}KB`);
}
/* A weekday morning in Berlin. Only the date is held; the frame timer runs. */
const morning = (page, iso = '2026-09-22T07:40:00Z') => page.evaluate(iso => {
  const Real = window.__RealDate ||= Date;
  window.__fixed = new Real(iso).getTime();
  window.Date = class extends Real { constructor(...args) { super(...(args.length ? args : [window.__fixed])); } static now() { return window.__fixed; } };
  window.Nordlys.widgets?.updateClock?.();
}, iso);
const quiet = page => page.evaluate(() => { document.querySelectorAll('#toast-dock > *').forEach(t => t.remove()); document.activeElement?.blur(); });

const scene = (key, run) => test.describe(key, () => {
  test.use({ nordlysBoard: BOARDS[key] });
  test(`screenshot: ${key}`, async ({ nordlysPage }) => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(SCRATCH, { recursive: true });
    await nordlysPage.page.evaluate(() => document.getElementById('board')?.classList.add('board-loaded'));
    await run(nordlysPage);
  });
});

scene('dashboard', async ({ page, origin }) => {
  await morning(page);
  await page.evaluate(seedDashboard, { preset: 'planner', withBoard: true });
  await expect(page.locator('#dash .dash-card').first()).toBeVisible();
  await quiet(page);
  const image = await frame(page, 'dashboard.png', WARMUP);
  await render(page.context(), origin, 'screenshot-1-dashboard.png', compose.slide({
    title: 'A dashboard for your day',
    subtitle: 'Tasks, focus, habits, a timer and more. Move and resize the cards with the mouse. Free.',
    image
  }));
});

scene('focus', async ({ page, origin }) => {
  await morning(page);
  await page.evaluate(seedDashboard, { preset: 'planner', withBoard: true });
  await page.evaluate(() => window.Nordlys.focusMode.show());
  await expect(page.locator('#focus-mode')).toBeVisible();
  // Six minutes into a session, rain on, the day's first task in hand.
  await page.locator('#focus-mode .fm-intent').fill('Write the release notes');
  await page.locator('#focus-mode .fm-intent').press('Enter');
  await page.locator('#focus-mode .fm-chip[data-sound="rain"]').click();
  await page.evaluate(() => { window.__fixed += (6 * 60 + 18) * 1000; });
  await page.waitForTimeout(1500);
  await quiet(page);
  const image = await frame(page, 'focus.png', WARMUP);
  await render(page.context(), origin, 'screenshot-3-focus.png', compose.slide({
    title: 'Focus mode',
    subtitle: 'One task, a large timer and quiet sounds made in the browser. Your tasks stay at the side.',
    image
  }));
});

scene('connect', async ({ page, origin }) => {
  await page.evaluate(seedDashboard, { preset: 'planner', withBoard: true });
  await morning(page);
  await quiet(page);
  const back = await frame(page, 'connect-back.png', WARMUP);
  // The apps as Settings → Dashboard lists them.
  await page.locator('#gear').click();
  await page.locator('#settings-tab-dashboard').click();
  const block = page.locator('.dash-connections');
  await block.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: STILL });
  await page.evaluate(() => document.activeElement?.blur());
  await block.screenshot({ path: path.join(SCRATCH, 'connect-picker.png'), animations: 'disabled' });
  await render(page.context(), origin, 'screenshot-5-connect.png', compose.feature({
    title: 'Your tasks from the apps you use',
    subtitle: 'Tasks from the tools you already use, and events from any calendar link. Your token stays on your device.',
    back, detail: shot('connect-picker.png'), detailWidth: 470
  }));
});

/* The website's two pictures (site-assets.cjs makes dashboard.webp and
   focus.webp from them): the dashboard alone, then Focus mode over it. */
scene('site', async ({ page }) => {
  await morning(page);
  await page.evaluate(seedDashboard, 'video');
  await expect(page.locator('#dash .dash-card').first()).toBeVisible();
  await quiet(page);
  await frame(page, 'site-dashboard.png', WARMUP);
  await page.evaluate(() => window.Nordlys.focusMode.show());
  await page.locator('#focus-mode .fm-intent').fill('Write the release notes');
  await page.locator('#focus-mode .fm-intent').press('Enter');
  await page.locator('#focus-mode .fm-chip[data-sound="rain"]').click();
  await page.evaluate(() => { window.__fixed += (6 * 60 + 18) * 1000; });
  await page.waitForTimeout(1500);
  await quiet(page);
  await frame(page, 'site-focus.png', 300);
});
