const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('current and legacy storage survive reload and storage.clear resets both', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => chrome.storage.local.set({
    aether_tab_config: { ...Aurora.defaultConfig, colorMode: 'light', customCss: '.card { opacity: .91; }' },
    nordlys_legacy_config: { migratedTheme: 'aurora-void' }
  }));
  await page.reload(); await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  await expect.poll(() => page.locator('#user-custom-css').evaluate(element => element.textContent)).toBe('.card { opacity: .91; }');
  expect(storageState.nordlys_legacy_config).toEqual({ migratedTheme: 'aurora-void' });
  await page.evaluate(() => chrome.storage.local.clear());
  await expect.poll(() => Object.keys(storageState)).toEqual([]);
});

test('stored 50-55px tile sizes migrate once to the supported 56px floor', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => chrome.storage.local.set({ aether_tab_config: { ...Aurora.defaultConfig, tileSize: 52 } }));
  await page.reload(); await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await expect.poll(() => storageState.aether_tab_config?.tileSize).toBe(56);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tw').trim())).toContain('56px');
});
