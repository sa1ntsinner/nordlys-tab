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
