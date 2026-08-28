const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('loads the default canvas without runtime errors', async ({ nordlysPage }) => {
  await expect(nordlysPage.page.locator('#page')).toBeVisible();
  await expect(nordlysPage.page.locator('.card')).toHaveCount(5);
  await expect(nordlysPage.page.locator('.tile')).toHaveCount(22);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
test('persists a changed setting through chrome.storage.local', async ({ nordlysPage }) => {
  await nordlysPage.page.locator('#gear').click();
  await nordlysPage.page.locator('[data-mode="light"]').click();
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.colorMode).toBe('light');
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
