const { test, expect, chromium } = require('@playwright/test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

test('loads the real unpacked MV3 extension with its derived id and no CSP errors', async () => {
  const extensionPath = resolve(__dirname, '../..');
  const profile = mkdtempSync(join(tmpdir(), 'nordlys-extension-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });
    const page = context.pages()[0] || await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('chrome://newtab');
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    const match = /^chrome-extension:\/\/([a-p]{32})\/newtab\.html$/.exec(page.url());
    expect(match, `unexpected unpacked URL: ${page.url()}`).not.toBeNull();
    expect(match[1]).toHaveLength(32);
    await page.locator('#gear').click();
    await expect(page.locator('#cfg')).toBeVisible();
    const extensionUrl = page.url();
    await page.locator('#appearance-shared-preview .tile').evaluate(element => element.click());
    await expect(page).toHaveURL(extensionUrl);
    expect(errors.filter(message => /content security policy|refused to execute inline/i.test(message))).toEqual([]);
  } finally {
    await context?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

/* The manifest no longer exposes anything to websites. The new tab page is an
   extension page, so Chrome's favicon store is still its to read: the list was
   only ever needed by content scripts, and Nordlys has none. */
test('favicons still load from the extension page with nothing web-accessible', async () => {
  const extensionPath = resolve(__dirname, '../..');
  const profile = mkdtempSync(join(tmpdir(), 'nordlys-extension-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto('chrome://newtab');
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    // What a tile does: point an image at the favicon store and let it decode.
    const width = await page.evaluate(() => new Promise(done => {
      const image = new Image();
      image.onload = () => done(image.naturalWidth);
      image.onerror = () => done(0);
      image.src = chrome.runtime.getURL('/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F&size=64');
    }));
    expect(width).toBeGreaterThan(0);
  } finally {
    await context?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

/* "nl" in the address bar is a service worker (omnibox.js). It has to start
   in the real browser with the two scripts it borrows from the page. */
test('the address bar keyword starts as a worker with what it reads by', async () => {
  const extensionPath = resolve(__dirname, '../..');
  const profile = mkdtempSync(join(tmpdir(), 'nordlys-extension-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    expect(worker.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\/src\/js\/omnibox\.js$/);
    expect(await worker.evaluate(() => [typeof globalThis.NordlysSearchSources.keyword, typeof globalThis.NordlysCommands.score, typeof chrome.omnibox.onInputEntered])).toEqual(['function', 'function', 'object']);
  } finally {
    await context?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
