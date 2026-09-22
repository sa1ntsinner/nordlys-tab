const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* An import replaces the whole setup, so it is the one place a bad file can do
   lasting harm. The rule: nothing is written until the file has been checked,
   what was there before is kept in the restore point, and a file that cannot be
   used is refused with the reason rather than saved and discovered on the next
   open as a page that no longer starts. */

async function importFile(page, name, body) {
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Backup' }).click();
  await page.locator('#cfg-import-universal').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
}

test('a file whose groups is not a list is refused before anything is written', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.evaluate(() => ({
    live: JSON.stringify(window.Nordlys.config.groups.map(group => group.label)),
    // A fresh page has written nothing yet; whatever is there, it must stay so.
    stored: localStorage.getItem('nordlys_config')
  }));
  await importFile(page, 'broken.json', JSON.stringify({ theme: 'aurora-void', groups: {} }));

  // The refusal is said out loud, with what is wrong.
  await expect(page.locator('.toast, [role="status"], [role="alert"]').filter({ hasText: /groups should be a list/ }).first()).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config.groups.map(group => group.label))), 'the live setup is untouched').toBe(before.live);
  expect(await page.evaluate(() => localStorage.getItem('nordlys_config')), 'and nothing was written').toBe(before.stored);
  expect('nordlys_config' in nordlysPage.storageState && nordlysPage.storageState.nordlys_config?.groups?.constructor === Object, 'the mirror never received the broken shape').toBe(false);
});

test('a file that is not even an object is refused', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await importFile(page, 'list.json', JSON.stringify([1, 2, 3]));
  await expect(page.locator('.toast, [role="status"], [role="alert"]').filter({ hasText: /does not contain a settings object/ }).first()).toBeVisible();
  expect(await page.evaluate(() => Array.isArray(window.Nordlys.config.groups))).toBe(true);
});

test('a sound import keeps what it replaced in the restore point', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    window.Nordlys.config.groups[0].label = 'BEFORE IMPORT';
    window.Nordlys.saveConfig();
  });
  const loaded = page.waitForEvent('load');
  await importFile(page, 'ok.json', JSON.stringify({ theme: 'nordic-snow', groups: [{ label: 'AFTER IMPORT', cols: 2, hidden: false, links: [] }] }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('AFTER IMPORT');
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point?.config?.groups?.[0]?.label, 'the previous setup can be brought back').toBe('BEFORE IMPORT');
});

test('a 2.0 backup with numeric range values stored as text still imports', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const loaded = page.waitForEvent('load');
  await importFile(page, 'nordlys-2.0.json', JSON.stringify({
    version: '2.0.0', theme: 'aurora-void', cardRadius: '22', tileSize: '86',
    groups: [{ label: 'FROM 2.0', cols: 2, hidden: false, links: [] }]
  }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => ({
    label: window.Nordlys.config.groups[0]?.label,
    cardRadius: window.Nordlys.config.cardRadius,
    tileSize: window.Nordlys.config.tileSize
  }))).toEqual({ label: 'FROM 2.0', cardRadius: 22, tileSize: 86 });
});

/* Defence in depth: a config that is already broken in storage must not stop the
   page from starting. It is held as well as it can be, and the original is kept. */
test('a stored config with groups that is not a list still starts the page', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    const broken = { ...window.Nordlys.config, groups: {} };
    localStorage.setItem('nordlys_config', JSON.stringify(broken));
    window.chrome.storage.local.set({ nordlys_config: broken }, () => {});
  });
  runtimeErrors.length = 0;
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid), null, { timeout: 5000 });
  expect(runtimeErrors.filter(text => text.startsWith('pageerror')), 'no uncaught error on start').toEqual([]);
  expect(await page.evaluate(() => Array.isArray(window.Nordlys.config.groups))).toBe(true);
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point, 'what was stored is kept for inspection').toBeTruthy();
});

/* There is one restore-point slot. An import took a snapshot of the setup being
   replaced — and then, if the imported file needed a migration, the reload took
   a second snapshot of the imported file over it. Every export from 2.1.0 to
   2.2.1 needs a migration, so the files people actually import were exactly the
   ones that lost the setup they replaced. */
test('importing a file that needs migrating still keeps the setup it replaced', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    window.Nordlys.config.groups[0].label = 'MY REAL SETUP';
    window.Nordlys.saveConfig();
  });
  const loaded = page.waitForEvent('load');
  // A 2.2.1-era export: glass sliders and an engine choice that no longer exist.
  await importFile(page, 'old-backup.json', JSON.stringify({
    version: '2.2.1', theme: 'liquid-glass', glassBlur: 0, defaultEngine: 'duckduckgo', bgMode: 'particles',
    groups: [{ label: 'FROM FILE', cols: 2, hidden: false, links: [] }]
  }));
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('FROM FILE');
  expect(await page.evaluate(() => window.Nordlys.config.theme), 'the import arrived migrated').toBe('frosted-glass');
  const point = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null'));
  expect(point?.config?.groups?.[0]?.label, 'the setup being replaced is the one kept').toBe('MY REAL SETUP');
});
