const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The mirror as the only copy left, which is what Chrome clearing site data
   leaves behind: localStorage is emptied first so the page has to adopt what it
   finds in chrome.storage rather than reading its own. */
test('current and legacy storage survive reload and storage.clear resets both', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => chrome.storage.local.set({
    nordlys_config: { ...window.Nordlys.defaultConfig, colorMode: 'light', customCss: '.card { opacity: .91; }' },
    nordlys_legacy_config: { migratedTheme: 'aurora-void' }
  }));
  await page.evaluate(() => localStorage.removeItem('nordlys_config'));
  await page.reload(); await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  await expect.poll(() => page.locator('#user-custom-css').evaluate(element => element.textContent)).toBe('.card { opacity: .91; }');
  expect(storageState.nordlys_legacy_config).toEqual({ migratedTheme: 'aurora-void' });
  await page.evaluate(() => chrome.storage.local.clear());
  await expect.poll(() => Object.keys(storageState)).toEqual([]);
});

test('stored 50-55px tile sizes migrate once to the supported 56px floor', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => chrome.storage.local.set({ nordlys_config: { ...window.Nordlys.defaultConfig, tileSize: 52 } }));
  // Again the mirror on its own, so the migration runs on what is adopted.
  await page.evaluate(() => localStorage.removeItem('nordlys_config'));
  await page.reload(); await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect.poll(() => storageState.nordlys_config?.tileSize).toBe(56);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tw').trim())).toContain('56px');
});

/* A board grown past localStorage lives only in the mirror, with a newer
   saved-at than the fast copy. A fast copy that needed a migration used to be
   written straight into the mirror on load, over that newer board. */
test('a migration on load never writes an older board over a newer one in the mirror', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => new Promise((done) => {
    localStorage.setItem('nordlys_config', JSON.stringify({ ...window.Nordlys.defaultConfig, bgMode: 'drift', groups: [{ id: 'old', label: 'OLDER', links: [] }] }));
    localStorage.setItem('nordlys_config_saved_at', '1000');
    chrome.storage.local.set({ nordlys_config: { ...window.Nordlys.defaultConfig, groups: [{ id: 'new', label: 'NEWER', links: [] }] }, nordlys_config_saved_at: 2000 }, done);
  }));
  await page.reload(); await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0]?.label)).toBe('NEWER');
  expect(storageState.nordlys_config.groups[0].label).toBe('NEWER');
});

test('JSON export and import preserve groups, and custom CSS once it is read and saved', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.customCss = '.card { border-width: 3px; }'; window.Nordlys.config.groups[0].label = 'EXPORTED'; window.Nordlys.saveConfig(); });
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Backup' }).click();
  const downloadEvent = page.waitForEvent('download'); await page.locator('#cfg-export').click(); const download = await downloadEvent;
  const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.customCss).toContain('border-width: 3px'); expect(exported.groups[0].label).toBe('EXPORTED');

  const imported = { ...exported, customCss: '.card { opacity: .88; }', groups: [{ label: 'IMPORTED', cols: 2, hidden: false, links: [] }] };
  const navigation = page.waitForEvent('load');
  await page.locator('#cfg-import-universal').setInputFiles({ name: 'nordlys-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await navigation; await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(storageState.nordlys_config.groups[0].label).toBe('IMPORTED');
  // A style sheet from a file can load addresses: it is shown, not used, until it is saved.
  expect(await page.evaluate(() => document.getElementById('user-custom-css')?.textContent || '')).not.toContain('opacity: .88');
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Custom CSS' }).click();
  await expect(page.locator('#css-waiting')).toBeVisible();
  await expect(page.locator('#css-editor')).toHaveValue(/opacity: \.88/);
  await page.locator('#cfg-inject-css').click();
  await expect(page.locator('#css-waiting')).toBeHidden();
  await expect.poll(() => page.locator('#user-custom-css').evaluate(element => element.textContent)).toContain('opacity: .88');
  expect(storageState.nordlys_config.customCss).toContain('opacity: .88');
});

test('reset clears current, legacy, and auxiliary persisted settings before reload', async ({ nordlysPage }) => {
  const { page, storageState } = nordlysPage;
  await page.evaluate(() => { localStorage.setItem('nordlys_custom_themes', '[{"id":"old"}]'); chrome.storage.local.set({ nordlys_config: { ...window.Nordlys.defaultConfig, theme: 'cyberpunk-neon' }, aurora_tab_config: { theme: 'old' }, nordlys_legacy_config: { old: true } }); });
  await page.locator('#gear').click(); await page.getByRole('tab', { name: 'Backup' }).click(); await page.locator('#cfg-reset').click();
  const resetDialog = page.getByRole('alertdialog', { name: /Reset everything/i }); await expect(resetDialog).toBeVisible();
  const navigation = page.waitForEvent('load'); await resetDialog.getByRole('button', { name: 'Reset' }).click(); await navigation; await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  // A reset keeps the copies made before updates (update-copies.spec.cjs), and what its undo puts back (reset-recovery.spec.cjs).
  delete storageState.nordlys_update_copies;
  expect(Object.keys(storageState.nordlys_reset_copy.items).sort()).toEqual(['aurora_tab_config', 'nordlys_legacy_config']);
  delete storageState.nordlys_reset_copy;
  expect(storageState).toEqual({}); expect(await page.evaluate(() => localStorage.getItem('nordlys_custom_themes'))).toBeNull();
});

/* A save that fails used to fail in silence: saveConfig returned false and
   nearly every caller carried on, so the change was simply gone on the next
   new tab. Now it is said — once, not per keystroke — with a way out that does
   not depend on the storage that refused. */
test('a save the browser refuses is said once, with a backup offered', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Both stores refuse: localStorage is full, and so is the mirror.
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'nordlys_config') throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
    const local = window.chrome.storage.local;
    const set = local.set.bind(local);
    local.set = (values, callback) => {
      if (!('nordlys_config' in values)) { set(values, callback); return; }
      window.chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
      callback?.();
      delete window.chrome.runtime.lastError;
    };
  });
  await page.evaluate(() => { window.Nordlys.config.showSeconds = true; window.Nordlys.saveConfig(); });
  const warning = page.locator('#toast-dock .toast', { hasText: 'not enough room' });
  await expect(warning).toHaveCount(1);
  await expect(warning.locator('.toast-action')).toHaveText('Export a backup');
  // A second refusal a moment later does not stack another notice.
  await page.evaluate(() => { window.Nordlys.config.showSeconds = false; window.Nordlys.saveConfig(); });
  await page.waitForTimeout(200);
  await expect(warning).toHaveCount(1);
  // And the way out is real: it starts the backup download.
  const download = page.waitForEvent('download');
  await warning.locator('.toast-action').click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

/* A board that has outgrown localStorage is still saved: the mirror in
   chrome.storage.local takes it, and the next tab shows the newer copy. */
test('a save localStorage has no room for is kept in the mirror and comes back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'nordlys_config' && String(value).includes('Too big here')) throw new DOMException('quota', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    window.Nordlys.config.groups.push({ label: 'Too big here', cols: 2, hidden: false, links: [{ name: 'Kept', url: 'https://kept.example/' }] });
    return window.Nordlys.saveConfig();
  });
  await expect(page.locator('#toast-dock')).toContainText('too big for the quick store');
  expect(await page.evaluate(() => localStorage.getItem('nordlys_config').includes('Too big here'))).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.Nordlys?.config?.groups?.some(g => g.label === 'Too big here'));
  await expect(page.locator('#board .card', { hasText: 'Too big here' })).toBeVisible();
});
