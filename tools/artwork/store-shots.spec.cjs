const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const compose = require('./compose.cjs');

/* Regenerates the five Chrome Web Store screenshots. Each is a headline over
   the real product: the extension is opened at a desktop size, captured at
   twice its pixels, and the capture is set into a layout from compose.cjs.
   Nothing in a screenshot is drawn by hand. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/store-assets');
const SCRATCH = path.join(ROOT, 'tools/artwork/.scratch');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
test.setTimeout(420000);

/* The scene animates on a slow clock: in the first second the aurora is still a
   flat wash, and only after roughly a dozen does it draw the ribbons that make
   it worth showing. */
const CANVAS_WARMUP = 14000;
const STILL = '*,*::before,*::after{transition:none!important}#q{caret-color:transparent!important}';

async function frame(page, name, warmup = 700) {
  await page.waitForTimeout(warmup);
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(200);
  const file = path.join(SCRATCH, name);
  await page.screenshot({ path: file, animations: 'disabled' });
  return `/tools/artwork/.scratch/${name}`;
}

/* Lays a composition out in a page of its own, at the store's size. */
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

/* Three pictures for one bookmark, as if taken from three addresses over
   time: the same mark, drawn three ways. */
async function iconVersions(page) {
  return page.evaluate(() => [['#ff4d4d', '#b3122e'], ['#2b2f3a', '#12141a'], ['#ffffff', '#e8ebf2']].map(([top, bottom], index) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
    const g = canvas.getContext('2d');
    const fill = g.createLinearGradient(0, 0, 0, 128);
    fill.addColorStop(0, top); fill.addColorStop(1, bottom);
    g.fillStyle = fill;
    g.beginPath(); g.roundRect(8, 24, 112, 80, 24); g.fill();
    g.fillStyle = index === 2 ? '#e0253a' : '#ffffff';
    g.beginPath(); g.moveTo(52, 44); g.lineTo(86, 64); g.lineTo(52, 84); g.closePath(); g.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }));
}

test('regenerate the store screenshots', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const context = page.context();
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SCRATCH, { recursive: true });

  // The board as it opens: a few folders out, the rest in the dock, and the
  // aurora a little stronger than default so it reads in a still frame.
  await page.evaluate(() => {
    window.Nordlys.config.groups.slice(4).forEach(group => { group.hidden = true; });
    window.Nordlys.config.bgIntensity = 1.4;
    window.Nordlys.saveConfig();
    window.Nordlys.bgEngine?.setAtmosphere({ motion: 1, intensity: 1.4 });
    window.Nordlys.grid.render();
    document.getElementById('board')?.classList.add('board-loaded');
  });
  const sky = await frame(page, 'sky.png', CANVAS_WARMUP);

  // Arrange, with the size panel open over the board it changes.
  await page.mouse.click(40, 880, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await page.locator('#arrange-size').click();
  await expect(page.locator('#arrange-size-panel')).toBeVisible();
  await page.mouse.move(720, 20);
  const arrange = await frame(page, 'arrange.png', 900);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#arrange-bar')).toBeHidden();

  // The icon picker, with the addresses this icon has come from.
  const pictures = await iconVersions(page);
  await page.route('https://icons.example/**', route => {
    const index = Number(/v(\d)/.exec(route.request().url())?.[1] || 1) - 1;
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(pictures[index], 'base64') });
  });
  const openCustom = async () => {
    await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
    await expect(page.locator('#icon-modal')).toBeVisible();
    await page.locator('.icon-tab-btn[data-tab="custom"]').click();
    await expect(page.locator('#modal-pane-custom')).toBeVisible();
  };
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  for (const version of [3, 2, 1]) {
    await openCustom();
    await page.locator('#icon-url-input').fill(`https://icons.example/play-v${version}.png`);
    await page.locator('#icon-url-input').press('Enter');
    await expect(page.locator('#icon-url-status')).toHaveText('Image ready');
    await page.locator('#icon-url-apply-btn').click();
    await expect(page.locator('#icon-modal')).toBeHidden();
  }
  await openCustom();
  await expect(page.locator('.icon-url-version')).toHaveCount(3);
  await page.evaluate(() => document.activeElement?.blur());
  const source = page.locator('#icon-url-source');
  await source.scrollIntoViewIfNeeded();
  await page.locator('.icon-url-version').nth(1).hover();
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: STILL });
  const box = await source.boundingBox();
  await page.screenshot({ path: path.join(SCRATCH, 'icons.png'), animations: 'disabled', clip: { x: box.x - 22, y: box.y - 18, width: box.width + 44, height: box.height + 30 } });
  const icons = '/tools/artwork/.scratch/icons.png';
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur());

  // A light theme on the board, and a dark one with the theme grid open.
  await page.evaluate(() => window.Nordlys.setTheme('nordic-snow'));
  const light = await frame(page, 'light.png', CANVAS_WARMUP);
  await page.evaluate(() => window.Nordlys.setTheme('aurora-void'));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await expect(page.locator('#sec-appearance')).toBeVisible();
  await page.evaluate(() => document.activeElement?.blur());
  const themes = await frame(page, 'themes.png', CANVAS_WARMUP);

  // The sky alone at four hours of an equinox day in Berlin, the clock
  // saying which. Last, because the page's date stays where it was set.
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.getElementById('board').style.visibility = 'hidden';
    document.getElementById('hiddenDock')?.style.setProperty('visibility', 'hidden');
    window.Nordlys.config.bgDaylight = true;
    window.Nordlys.saveConfig();
    window.Nordlys.bgEngine.setDaylight(true);
  });
  const hours = [['Dawn', '2026-09-22T04:50:00Z'], ['Day', '2026-09-22T11:00:00Z'], ['Sunset', '2026-09-22T17:05:00Z'], ['Night', '2026-09-22T21:30:00Z']];
  const daylight = [];
  for (const [label, iso] of hours) {
    // Only the date is held: Playwright's clock would also stop the frame
    // timer, and the sky with it.
    await page.evaluate(iso => {
      const Real = window.__RealDate ||= Date, fixed = new Real(iso).getTime();
      window.Date = class extends Real { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
      window.Nordlys.bgEngine.followSun();
    }, iso);
    daylight.push({ label, image: await frame(page, `daylight-${label.toLowerCase()}.png`, 6000) });
  }

  await render(context, origin, 'screenshot-1-sky.png', compose.slide({
    title: 'A new tab under a living sky',
    subtitle: 'Six moving scenes, drawn on your own machine, with your bookmarks in folders on top.',
    image: sky
  }));
  await render(context, origin, 'screenshot-2-arrange.png', compose.slide({
    title: 'Arrange it the way you think',
    subtitle: 'Move folders, set size and spacing, and watch the board change as you go. One Undo takes it back.',
    image: arrange, backdropImage: sky
  }));
  await render(context, origin, 'screenshot-3-icons.png', compose.feature({
    title: 'Every bookmark, the icon you want',
    subtitle: 'A site’s own icon, a letter, or a picture from any address — and the ones you used before stay in reach.',
    back: sky, detail: icons
  }));
  await render(context, origin, 'screenshot-4-daylight.png', compose.mosaic({
    title: 'Lit by the time of day',
    subtitle: 'Turn on daylight and every scene follows the sun where you are. No location asked, nothing sent.',
    frames: daylight, backdropImage: daylight[3].image
  }));
  await render(context, origin, 'screenshot-5-themes.png', compose.pair({
    title: 'Light or dark, always readable',
    subtitle: '21 themes, light and dark, each checked for contrast on every panel it paints.',
    back: light, front: themes, backdropImage: sky
  }));
});
