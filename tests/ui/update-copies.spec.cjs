const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The first new tab after an update keeps the whole setup as it was, as a
   backup file in chrome.storage.local, before anything is migrated. It can
   be put back or saved from Settings → Backup, and a reset keeps it. */

const copies = page => page.evaluate(() => new Promise(r => chrome.storage.local.get('nordlys_update_copies', i => r(i.nordlys_update_copies || []))));

/* The fixture's own first load already counts as an update from a build
   that kept no version, so its copy is cleared first. */
const clearCopies = page => page.evaluate(() => new Promise(r => chrome.storage.local.remove('nordlys_update_copies', r)));

async function seedOlderVersion(page) {
  await clearCopies(page);
  await page.evaluate(() => {
    localStorage.setItem('nordlys_seen_version', '2.4.0');
    localStorage.setItem('nordlys_config', JSON.stringify({ theme: 'gruvbox-dark', bgMode: 'pillars', groups: [{ label: 'Before', cols: 2, hidden: false, links: [{ name: 'Old', url: 'https://old.test/', icon: 'globe', color: '#fabd2f' }] }] }));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.settings));
}

test('a new version keeps a copy of the setup as it was, once', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await seedOlderVersion(page);
  await expect.poll(async () => (await copies(page)).length).toBe(1);
  const [copy] = await copies(page);
  expect(copy.from).toBe('2.4.0');
  // As stored, before the retired sky was moved on.
  expect(JSON.stringify(copy.file)).toContain('pillars');
  expect(await page.evaluate(() => window.Nordlys.config.bgMode)).toBe('meteors');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.settings));
  expect((await copies(page)).length).toBe(1);
  expect(runtimeErrors).toEqual([]);
});

test('a new tab of the same version keeps no copy, and Backup shows none', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await clearCopies(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.settings));
  expect(await copies(page)).toEqual([]);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await expect(page.locator('#update-copies')).toBeHidden();
});

test('the copy is put back from Settings, and survives a reset', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedOlderVersion(page);
  await expect.poll(async () => (await copies(page)).length).toBe(1);
  await page.evaluate(() => { window.Nordlys.config.groups = [{ label: 'After', cols: 2, links: [] }]; window.Nordlys.saveConfig(); });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await expect(page.locator('#update-copies')).toBeVisible();
  await expect(page.locator('.update-copy')).toContainText('Before');
  await page.locator('.update-copy').getByRole('button', { name: 'Put it back' }).click();
  await page.getByRole('button', { name: 'Put it back' }).last().click();
  await page.waitForFunction(() => window.Nordlys?.config?.groups?.[0]?.label === 'Before');
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#cfg-reset').click();
  await page.getByRole('button', { name: 'Reset' }).last().click();
  await page.waitForFunction(() => Boolean(window.Nordlys?.settings) && !window.Nordlys.config.groups.some(g => g.label === 'Before'));
  expect((await copies(page)).length).toBe(1);
});
