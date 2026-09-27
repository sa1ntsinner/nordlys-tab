const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Safari has no search API for extensions. There the person picks an engine
   once in Settings → General, and the box sends them to it. Where the browser
   has one (Chrome, Edge, Firefox), the choice is not offered at all. */

test('with the browser\'s search API the engine is not offered', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
  await expect(page.locator('#cfg-search-engine-row')).toBeHidden();
});

test('without a search API the box asks for an engine once, then uses it', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.addInitScript(() => { if (window.chrome) delete window.chrome.search; });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  await page.locator('#q').fill('northern lights');
  await page.locator('#q').press('Enter');
  // No engine yet: Settings → General opens on the choice.
  await expect(page.locator('#cfg-search-engine-row')).toBeVisible();
  // The settings draw their own list over the native select.
  await page.locator('#cfg-search-engine + .nl-select').click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: 'DuckDuckGo' }).click();
  expect(await page.evaluate(() => window.Nordlys.config.searchEngine)).toBe('duckduckgo');
  await page.keyboard.press('Escape');
  // The choice is kept like any other setting.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.searchEngine)).toBe('duckduckgo');

  await page.route('https://duckduckgo.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ddg</title>' }));
  await page.locator('#q').fill('northern lights');
  await Promise.all([page.waitForURL(/duckduckgo\.com\/\?q=northern%20lights/), page.locator('#q').press('Enter')]);
  expect(runtimeErrors).toEqual([]);
});
