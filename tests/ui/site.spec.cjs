const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
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
const phoneContext = browser => browser.newContext({ userAgent: PHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function open(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.origin}/index.html`);
  return errors;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) {
      window.scrollTo({ top: y, behavior: 'instant' });
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

test('the opening says what Nordlys is, in its own font, before anything moves', async ({ page }) => {
  await open(page);
  await expect(page.locator('h1')).toHaveText('Nordlys');
  await expect(page.locator('.hero-line')).toHaveText('A new tab page for the sites you open every day.');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 88px Geist'))).toBe(true);
  // A section heading names its section, on one line and in one colour.
  for (const heading of await page.locator('main h2').all()) {
    await expect(heading.locator('.dim, br')).toHaveCount(0);
    expect((await heading.textContent()).trim().split(/\s+/).length).toBeLessThanOrEqual(5);
  }
});

/* The words of the opening sit over the extension's own sky, drawn live in
   its light theme. They keep 4.5:1 against the darkest of it under them: the
   words are hidden, the page photographed, and each one's box read. */
test('the words of the opening keep 4.5:1 over the sky drawn behind them', async ({ page }) => {
  await open(page);
  await expect(page.locator('#hero-sky')).toHaveClass(/is-live/);
  await page.waitForTimeout(1500);
  const words = await page.evaluate(() => [...document.querySelectorAll('.hero h1, .hero p, .bar-links a, .bar .brand span')].map(element => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent.trim().slice(0, 30), box: [box.x, box.y, box.width, box.height], color: getComputedStyle(element).color.match(/\d+/g).slice(0, 3).map(Number) };
  }));
  await page.addStyleTag({ content: '.hero h1, .hero p, .bar a, .bar span { color: transparent !important; transition: none !important; }' });
  const shot = (await page.screenshot()).toString('base64');
  const worst = await page.evaluate(async ({ shot, words }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${shot}`;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const channel = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    return words.map(({ text, box: [x, y, w, h], color }) => {
      const { data } = context.getImageData(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
      const ink = luminance(color);
      let low = Infinity;
      for (let i = 0; i < data.length; i += 4 * 3) {
        const ground = luminance([data[i], data[i + 1], data[i + 2]]);
        low = Math.min(low, (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05));
      }
      return `${text}: ${low.toFixed(2)}`;
    }).filter(line => Number(line.split(': ').pop()) < 4.5);
  }, { shot, words });
  expect(worst).toEqual([]);
});

test('the main button names this browser and goes to its store', async ({ page }) => {
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText("Add to Chrome, it's free");
  await expect(primary).toHaveAttribute('href', CHROME_STORE);
  await expect(page.locator('[data-try-here]')).toBeVisible();
  await expect(page.locator('.bar [data-get]')).toHaveText('Get Nordlys');
  await expect(page.locator('.bar [data-get]')).toHaveAttribute('href', CHROME_STORE);
});

test('in Edge it says Edge, and installs from the Chrome Web Store until its own listing is up', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: EDGE });
  const page = await context.newPage();
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText('Add to Edge');
  await expect(primary).toHaveAttribute('href', CHROME_STORE);
  await expect(page.locator('[data-get-note]').first()).toHaveText('In Edge, it installs from the Chrome Web Store.');
  await context.close();
});

test('in a browser whose store is not ready yet, the button offers the demo instead, and says so once', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: FIREFOX });
  const page = await context.newPage();
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText('Try it here');
  await expect(primary).toHaveAttribute('href', '#demo');
  await expect(page.locator('[data-try-here]')).toBeHidden();
  await expect(page.locator('[data-get-note]').first()).toContainText("The Firefox version is in the store's review.");
  // The header offers what the page can give here, not an install.
  await expect(page.locator('.bar [data-get]')).toHaveText('Try it');
  await expect(page.locator('.bar [data-get]')).toHaveAttribute('href', '#demo');
  await context.close();
});

test('the opening shows the product in the visitor\'s own light or dark, and asks for no click', async ({ browser }) => {
  for (const [scheme, picture, paper] of [['light', 'light.webp', 'rgb(245, 244, 242)'], ['dark', 'board.webp', 'rgb(13, 13, 12)']]) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await open(page);
    await expect.poll(() => page.locator('.hero .shot img').evaluate(img => img.currentSrc)).toContain(picture);
    // The first new tab in the steps to install it follows the same setting.
    await page.locator('.first').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.first img').evaluate(img => img.currentSrc)).toContain(`first-${scheme}.webp`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(paper);
    await expect(page.locator('.hero button')).toHaveCount(0);
    await context.close();
  }
});

test('the demo is the real extension, showing its views by itself in the visitor\'s theme', async ({ browser }) => {
  for (const [scheme, theme] of [['light', 'porcelain-light'], ['dark', 'aurora-void']]) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await open(page);
    await page.locator('#deck').scrollIntoViewIfNeeded();
    await expect(page.locator('#deck')).toHaveClass(/is-live/, { timeout: 20000 });
    const frame = page.locator('#demo-frame');
    await expect.poll(() => frame.evaluate(node => node.contentWindow.Nordlys.config.theme)).toBe(theme);
    // A picture to the pointer and the keyboard: nothing in it can be pressed or reached.
    await expect(frame).toHaveJSProperty('inert', true);
    if (scheme === 'dark') {
      // While it is on screen it moves on to the dashboard, and the line under it says so.
      await expect(page.locator('[data-now]')).toHaveText('the dashboard', { timeout: 15000 });
      await expect.poll(() => frame.evaluate(node => Boolean(node.contentWindow.Nordlys.dashboard?.on))).toBe(true);
    }
    await expect(page.getByRole('link', { name: 'Open the demo in a new tab' })).toHaveAttribute('href', 'demo/index.html');
    await context.close();
  }
});

test('the skies are drawn on this page by the extension\'s own engine, and the picker changes them', async ({ page }) => {
  await open(page);
  await page.locator('#skies').scrollIntoViewIfNeeded();
  await expect(page.locator('#window')).toHaveClass(/is-live/);
  const painted = () => page.evaluate(() => {
    const canvas = document.querySelector('#window canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) lit++;
    return lit;
  });
  await expect.poll(painted).toBeGreaterThan(100);
  await page.getByRole('radio', { name: 'Polaris' }).click();
  await expect(page.getByRole('radio', { name: 'Polaris' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-sky-name]')).toHaveText('Polaris');
  await expect(page.locator('.window-still')).toHaveAttribute('src', /skies\/polaris\.webp$/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--shader-1').trim())).toBe('#7aa2f7');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Halo' })).toBeFocused();
  await expect(page.locator('[data-sky-name]')).toHaveText('Halo');
  // A sky drawn from the real one brings its stars: the catalogue is borrowed with the engine.
  await page.getByRole('radio', { name: 'Star map' }).click();
  await expect(page.locator('.window-still')).toHaveAttribute('src', /skies\/starmap\.webp$/);
  expect(await page.evaluate(() => (window.NORDLYS_STARS?.stars?.length || 0) / 4)).toBeGreaterThan(500);
  await expect.poll(painted).toBeGreaterThan(100);
});

test('text, names and roles hold up to an accessibility check', async ({ page }) => {
  await open(page);
  await scrollThrough(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page }).exclude('#demo-frame').analyze();
  const serious = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  expect(serious, serious.map(item => `${item.id}: ${item.help} (${item.nodes.length})`).join('\n')).toEqual([]);
});

test('the keyboard reaches the page first through the skip link, and focus shows', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip');
  await expect(skip).toBeFocused();
  await expect.poll(() => skip.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== 'none'; });
  expect(outline).toBe(true);
});

test('on a phone the demo waits to be asked for', async ({ browser }) => {
  const context = await phoneContext(browser);
  const page = await context.newPage();
  const demoRequests = [];
  page.on('request', request => { if (request.url().includes('/demo/')) demoRequests.push(request.url()); });
  await open(page);
  await scrollThrough(page);
  expect(demoRequests).toEqual([]);
  // It shows a picture instead, and a tab of its own on request.
  await expect(page.locator('.deck-still')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the demo in a new tab' })).toHaveAttribute('target', '_blank');
  await context.close();
});

test('on a phone the page offers the demo, talks about tapping, and fits without sideways scroll', async ({ browser }) => {
  const context = await phoneContext(browser);
  const page = await context.newPage();
  await open(page);
  const primary = page.locator('a[data-primary]').first();
  await expect(primary).toContainText('Try it here');
  await expect(primary).toHaveAttribute('href', '#demo');
  await expect(page.locator('[data-get-note]').first()).toHaveText('Nordlys is for the browser on your computer. You can try it right here.');
  await expect(page.getByText('It shows you its folders, the dashboard and focus mode in turn')).toBeHidden();
  await expect(page.getByText('Open it in a tab of its own to try it.')).toBeVisible();
  await scrollThrough(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
});

test('with reduced motion nothing moves on its own, and every part is there at once', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = await open(page);
  // Nothing waits for the scroll to arrive.
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(part => Number(getComputedStyle(part).opacity) < 1).length);
  expect(hidden).toBe(0);
  // The demo stays on its folders.
  await page.locator('#deck').scrollIntoViewIfNeeded();
  await expect(page.locator('#deck')).toHaveClass(/is-live/, { timeout: 20000 });
  await page.waitForTimeout(10000);
  await expect(page.locator('[data-now]')).toHaveText('the folders');
  await scrollThrough(page);
  for (const id of ['demo', 'skies', 'features', 'privacy', 'get', 'questions']) await expect(page.locator(`#${id}`)).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
