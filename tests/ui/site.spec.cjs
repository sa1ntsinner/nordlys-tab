const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { startStaticServer } = require('../helpers/static-server.cjs');

/* The website (site/, assembled into .site-dist by tools/site-build.cjs): what
   it promises a visitor. Built once for the file, and every test is its own
   page on its own server. */
const ROOT = path.resolve(__dirname, '../..');
test.describe.configure({ mode: 'serial' });
let server;
test.beforeAll(async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/site-build.cjs')], { cwd: ROOT, stdio: 'ignore' });
  server = await startStaticServer(path.join(ROOT, '.site-dist'));
});
test.afterAll(async () => { await server?.close(); });

const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_STORE = 'https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc';

async function open(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.origin}/index.html`);
  return errors;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise(done => setTimeout(done, 60));
    }
  });
}

test('the page asks nothing of any other host', async ({ page }) => {
  const elsewhere = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) elsewhere.push(request.url());
  });
  const errors = await open(page);
  await scrollThrough(page);
  expect(elsewhere).toEqual([]);
  expect(errors).toEqual([]);
});

test('the hour ring turns the sky, and says what hour it shows', async ({ page }) => {
  await open(page);
  const ring = page.getByRole('slider', { name: 'Hour of the sky' });
  await expect(ring).toBeVisible();
  const before = await ring.getAttribute('aria-valuenow');
  await ring.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  const after = await ring.getAttribute('aria-valuenow');
  expect(after).not.toBe(before);
  const shown = await ring.getAttribute('aria-valuetext');
  expect(shown).toMatch(/\d{2}:\d{2}/);
  await expect(page.locator('#sky-time')).toHaveText(shown.match(/\d{2}:\d{2}/)[0]);
});

test('the main button names this browser and goes to its store', async ({ page }) => {
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText("Add to Chrome, it's free");
  await expect(primary).toHaveAttribute('href', CHROME_STORE);
  await expect(page.locator('.index [data-get]')).toHaveText('Get Nordlys');
  await expect(page.locator('.index [data-get]')).toHaveAttribute('href', CHROME_STORE);
});

test('in Edge it says Edge, and installs from the Chrome Web Store until its own listing is up', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: EDGE });
  const page = await context.newPage();
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText('Add to Edge');
  await expect(primary).toHaveAttribute('href', CHROME_STORE);
  await context.close();
});

test('in a browser whose store is not ready yet, the button offers the demo instead, and says so once', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: FIREFOX });
  const page = await context.newPage();
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText('Try it here');
  await expect(primary).toHaveAttribute('href', '#observe');
  await expect(page.locator('[data-try-here]')).toBeHidden();
  // The index offers what the page can give here, not an install.
  await expect(page.locator('.index [data-get]')).toHaveText('Try it');
  await expect(page.locator('.index [data-get]')).toHaveAttribute('href', '#observe');
  await context.close();
});

test('every plate of the atlas can be reached by its number', async ({ page }) => {
  await open(page);
  await page.locator('#plates').scrollIntoViewIfNeeded();
  await page.locator('[data-plate-link="3"]').click();
  await expect(page).toHaveURL(/#plate-3$/);
  await expect(page.locator('[data-plate-link="3"]')).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('5');
  await expect(page.locator('[data-plate-link="5"]')).toHaveAttribute('aria-current', 'true');
});

// Scrolls to a point, then waits for the scrubbed animations to catch up with the page.
async function scrollAndSettle(page, where) {
  await page.evaluate(async where => {
    const frame = () => new Promise(done => requestAnimationFrame(done));
    window.scrollTo(0, where);
    const started = performance.now();
    let last = '';
    for (;;) {
      await frame();
      const now = window.ScrollTrigger.getAll().map(t => (t.animation ? t.animation.progress().toFixed(3) : '')).join();
      if (now === last && performance.now() - started > 700) break;
      if (performance.now() - started > 8000) break;
      last = now;
    }
  }, where);
}

test('the first screen has one lamp-red button, and so does the opening as it goes', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1800);
  const lamps = () => page.evaluate(() => [...document.querySelectorAll('a, button')].filter(el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    let seen = Number(style.opacity);
    for (let up = el.parentElement; up; up = up.parentElement) seen *= Number(getComputedStyle(up).opacity);
    return style.visibility !== 'hidden' && seen > 0.3 && box.width > 0 && box.bottom > 0 && box.top < innerHeight && style.backgroundColor === 'rgb(255, 106, 77)';
  }).map(el => el.textContent.trim()));
  expect(await lamps()).toEqual(["Add to Chrome, it's free"]);
  // A little way into the opening's scroll: the header is solid, the opening's button is fading.
  const { start, end } = await page.evaluate(() => { const t = window.ScrollTrigger.getAll().find(t => t.pin === document.querySelector('#top')); return { start: t.start, end: t.end }; });
  await scrollAndSettle(page, start + (end - start) * 0.25);
  expect((await lamps()).length).toBeLessThanOrEqual(1);
});

test('the window opens onto the whole sky as the page scrolls', async ({ page }) => {
  await open(page);
  const end = await page.evaluate(() => window.ScrollTrigger.getAll().find(t => t.pin === document.querySelector('#top')).end);
  await scrollAndSettle(page, end - 2);
  const { mask, diagonal } = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('.plate-dim'));
    return { mask: style.maskImage || style.webkitMaskImage, diagonal: Math.hypot(innerWidth, innerHeight) };
  });
  const radius = Number(/radial-gradient\((?:circle\s+)?([\d.]+)px/.exec(mask)?.[1]);
  expect(radius).toBeGreaterThan(diagonal);
});

for (const [width, height] of [[1440, 900], [1280, 720]]) test(`the stars fly into their sites, and the new tab they make settles into the deck (${width} x ${height})`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await open(page);
  await expect(page.locator('#deck')).toHaveClass(/is-live/, { timeout: 20000 });
  const { start, end } = await page.evaluate(() => { const t = window.ScrollTrigger.getAll().find(t => t.pin === document.querySelector('#chart')); return { start: t.start, end: t.end }; });
  // The chart's words are still there as the pin begins.
  await scrollAndSettle(page, start + (end - start) * 0.08);
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.chart-copy')).opacity))).toBeGreaterThan(0.99);
  await scrollAndSettle(page, end - 2);
  const landed = await page.evaluate(() => {
    const frame = document.querySelector('#viewport').getBoundingClientRect();
    const doc = document.querySelector('#demo').contentDocument;
    const k = Math.min(innerWidth / 1440, innerHeight / 900);
    const left = (innerWidth - 1440 * k) / 2;
    const offset = (innerHeight - 900 * k) / 2;
    const misses = [];
    for (const star of document.querySelectorAll('.constellations .star[data-site]')) {
      const tile = [...doc.querySelectorAll('.tile[data-group-idx]')].find(t => t.textContent.trim() === star.dataset.site);
      if (!tile) continue;
      const icon = (tile.querySelector('img, svg, .icon') || tile).getBoundingClientRect();
      const want = [(icon.x + icon.width / 2) * k + left, (icon.y + icon.height / 2) * k + offset];
      const got = star.getBoundingClientRect();
      const miss = Math.hypot(got.x + got.width / 2 - want[0], got.y + got.height / 2 - want[1]);
      if (miss > 6) misses.push(`${star.dataset.site} is ${Math.round(miss)}px off`);
    }
    return {
      full: [frame.x - left, frame.y - offset, frame.width - 1440 * k].map(v => Math.round(v)),
      nav: Math.round(document.querySelector('#nav').getBoundingClientRect().bottom),
      misses, count: document.querySelectorAll('.constellations .star[data-site]').length
    };
  });
  expect(landed.count).toBeGreaterThan(10);
  expect(landed.misses).toEqual([]);
  // The whole new tab fits the screen, and the index is out of its way.
  for (const off of landed.full) expect(Math.abs(off)).toBeLessThanOrEqual(2);
  expect(landed.nav).toBeLessThanOrEqual(1);
  // While the frame shrinks past it, the demo's heading waits.
  const hand = await page.evaluate(() => { const t = window.ScrollTrigger.getAll().find(t => t.trigger === document.querySelector('#observe')); return { start: t.start, end: t.end }; });
  await scrollAndSettle(page, hand.start + (hand.end - hand.start) * 0.35);
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.observe-head')).opacity))).toBeLessThan(0.01);
  // Once the demo's section is up, the new tab is back in its frame.
  const settled = await page.evaluate(() => document.querySelector('#observe').getBoundingClientRect().top + scrollY);
  await scrollAndSettle(page, settled);
  await expect(page.locator('#viewport')).not.toHaveClass(/is-full/);
  const sizes = await page.evaluate(() => [document.querySelector('#viewport').getBoundingClientRect().width, document.querySelector('#viewport').offsetWidth]);
  expect(Math.abs(sizes[0] - sizes[1])).toBeLessThanOrEqual(1);
});

test('the ring says it can be turned, until it has been', async ({ page }) => {
  await open(page);
  const hint = page.locator('#ring-hint');
  await expect(hint).toBeVisible();
  await page.getByRole('slider', { name: 'Hour of the sky' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(hint).toBeHidden();
});

test('once, on arrival, the ring shows the other half of the day and comes back', async ({ page }) => {
  await open(page);
  const ring = page.getByRole('slider', { name: 'Hour of the sky' });
  const start = Number(await ring.getAttribute('aria-valuenow'));
  const away = async () => { const now = Number(await ring.getAttribute('aria-valuenow')); const d = Math.abs(now - start) % 1440; return Math.min(d, 1440 - d); };
  await expect.poll(away, { timeout: 8000 }).toBeGreaterThan(120);
  await expect.poll(away, { timeout: 10000 }).toBeLessThan(3);
  await expect(page.locator('#sky-now')).toBeHidden();
});

test('the words of a plate show only over its own sky', async ({ page }) => {
  await open(page);
  const wrong = await page.evaluate(async () => {
    const plates = document.querySelector('#plates');
    const nav = document.querySelector('#nav');
    const settle = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const start = plates.getBoundingClientRect().top + scrollY;
    const end = start + plates.offsetHeight - innerHeight;
    const wrongNow = () => {
      const sky = document.querySelector('.plate-rail a[aria-current="true"]').dataset.plateLink;
      return [...document.querySelectorAll('.plate h3, .plate p')].filter(words => {
        const box = words.getBoundingClientRect();
        return box.bottom > nav.getBoundingClientRect().bottom && box.top < innerHeight && words.closest('.plate').dataset.plate !== sky;
      }).map(words => `plate ${words.closest('.plate').dataset.plate} over sky ${sky}`);
    };
    const found = [];
    // Without a GPU the sky is drawn in software and frames are slow, so each
    // step waits one frame, and a mismatch is counted only if it is still
    // there a frame later (the observer reports a frame after the scroll).
    for (let y = start; y <= end; y += 90) {
      window.scrollTo(0, y);
      await settle();
      if (!wrongNow().length) continue;
      await settle();
      for (const problem of wrongNow()) found.push(`${Math.round(y)}: ${problem}`);
    }
    return found;
  });
  expect(wrong).toEqual([]);
});

test('the list of skies leaves with the last sky', async ({ page }) => {
  await open(page);
  const over = await page.evaluate(async () => {
    const catalogue = document.querySelector('#catalogue');
    const settle = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const top = catalogue.getBoundingClientRect().top + scrollY;
    const found = [];
    for (let y = top - innerHeight; y <= top; y += 30) {
      window.scrollTo(0, y);
      await settle();
      const edge = catalogue.getBoundingClientRect().top;
      for (const link of document.querySelectorAll('.plate-rail a')) {
        const box = link.getBoundingClientRect();
        if (box.bottom > edge + 1 && box.top < innerHeight) found.push(`${Math.round(y)}: ${link.textContent.trim()}`);
      }
    }
    return found;
  });
  expect(over).toEqual([]);
});

test('on a phone, a swipe that starts on the hour ring still scrolls the page', async ({ browser }) => {
  // Headless Chromium scrolls for no synthesized touch, not even on a bare page, so
  // this checks what decides it: the ring lets the page pan up and down, and only a
  // touch that lands on its band is kept for turning it.
  const context = await browser.newContext({ userAgent: PHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  const result = await page.evaluate(() => {
    const ring = document.querySelector('#hour-ring');
    const kept = (x, y) => {
      const touch = new Touch({ identifier: 1, target: ring, clientX: x, clientY: y });
      const event = new TouchEvent('touchstart', { touches: [touch], targetTouches: [touch], changedTouches: [touch], cancelable: true, bubbles: true });
      ring.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const box = ring.getBoundingClientRect();
    const knob = ring.querySelector('.knob').getBoundingClientRect();
    return {
      panning: getComputedStyle(ring).touchAction,
      centre: kept(box.left + box.width / 2, box.top + box.height / 2),
      band: kept(knob.left + knob.width / 2, knob.top + knob.height / 2)
    };
  });
  expect(result).toEqual({ panning: 'pan-y', centre: false, band: true });
  await context.close();
});

test('on a phone, the page does not talk about keys it has not got', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: PHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  await expect(page.getByText('Press 1 to 9, or pick one.')).toBeHidden();
  await expect(page.getByText('Scroll through them.')).toBeVisible();
  await expect(page.getByText('running on this page')).toBeHidden();
  await context.close();
});

test('on a phone the demo waits to be asked for', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: PHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const demoRequests = [];
  page.on('request', request => { if (request.url().includes('/demo/')) demoRequests.push(request.url()); });
  await open(page);
  await scrollThrough(page);
  expect(demoRequests).toEqual([]);
  await page.locator('#observe').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Open the live demo' }).click();
  await expect(page.locator('#demo')).toHaveAttribute('src', /demo\/index\.html/);
  await context.close();
});

test('with reduced motion nothing is pinned, and every part reads in order', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = await open(page);
  await scrollThrough(page);
  expect(await page.locator('.pin-spacer').count()).toBe(0);
  for (const id of ['observe', 'plates', 'catalogue', 'get']) await expect(page.locator(`#${id}`)).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
