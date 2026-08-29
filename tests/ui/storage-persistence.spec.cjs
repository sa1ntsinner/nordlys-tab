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

test('JSON export and import preserve groups and custom CSS across reload', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => { Aurora.config.customCss = '.card { border-width: 3px; }'; Aurora.config.groups[0].label = 'EXPORTED'; Aurora.saveConfig(); });
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Backup' }).click();
  const downloadEvent = page.waitForEvent('download'); await page.locator('#cfg-export').click(); const download = await downloadEvent;
  const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.customCss).toContain('border-width: 3px'); expect(exported.groups[0].label).toBe('EXPORTED');

  const imported = { ...exported, customCss: '.card { opacity: .88; }', groups: [{ label: 'IMPORTED', cols: 2, hidden: false, links: [] }] };
  const navigation = page.waitForEvent('load');
  await page.locator('#cfg-import-universal').setInputFiles({ name: 'nordlys-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await navigation; await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  expect(storageState.aether_tab_config.groups[0].label).toBe('IMPORTED');
  await expect.poll(() => page.locator('#user-custom-css').evaluate(element => element.textContent)).toContain('opacity: .88');
});

test('reset clears current, legacy, and auxiliary persisted settings before reload', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => { localStorage.setItem('aurora_custom_themes', '[{"id":"old"}]'); chrome.storage.local.set({ aether_tab_config: { ...Aurora.defaultConfig, theme: 'cyberpunk-neon' }, aurora_tab_config: { theme: 'old' }, nordlys_legacy_config: { old: true } }); });
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Backup' }).click(); await page.locator('#cfg-reset').click();
  const resetDialog = page.getByRole('alertdialog', { name: /Reset everything/i }); await expect(resetDialog).toBeVisible();
  const navigation = page.waitForEvent('load'); await resetDialog.getByRole('button', { name: 'Reset' }).click(); await navigation; await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  expect(storageState).toEqual({}); expect(await page.evaluate(() => localStorage.getItem('aurora_custom_themes'))).toBeNull();
});
