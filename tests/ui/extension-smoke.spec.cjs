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
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
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
