const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Earlier versions: the setup is kept with the time whenever it changes, on
   this device, and any of the copies can be put back from Settings → Backup. */

const list = page => page.evaluate(() => window.NordlysAutosave.list());
const setFolders = (page, labels) => page.evaluate((names) => {
  window.Nordlys.config.groups = names.map((label) => ({ label, cols: 2, links: [{ name: label, url: `https://${label.toLowerCase()}.test/` }] }));
  window.Nordlys.saveConfig();
  return window.Nordlys.keepAutosave();
}, labels);

test.beforeEach(async ({ nordlysPage }) => {
  await nordlysPage.page.evaluate(() => window.NordlysAutosave.clear());
});

test('a change is kept once, with what it holds; the same setup is not kept twice', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await setFolders(page, ['One']);
  await setFolders(page, ['One']);
  expect((await list(page)).length).toBe(1);
  await setFolders(page, ['One', 'Two']);
  const copies = await list(page);
  expect(copies.map((copy) => [copy.folders, copy.links])).toEqual([[2, 2], [1, 1]]);
  expect(Date.parse(copies[0].savedAt)).toBeGreaterThan(Date.parse(copies[1].savedAt) - 1);
  expect(runtimeErrors).toEqual([]);
});

test('opening new tabs without changing anything keeps nothing more', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['One']);
  for (let i = 0; i < 2; i += 1) {
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.settings));
    await page.evaluate(() => window.Nordlys.keepAutosave());
  }
  expect((await list(page)).length).toBe(1);
});

test('an earlier version is put back from Settings, and what it replaced is kept too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Before']);
  await setFolders(page, ['After']);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#autosaves > summary').click();
  await expect(page.locator('.autosave-copy')).toHaveCount(2);
  await expect(page.locator('.autosave-copy').first()).toContainText('Bookmarks: 1, folders: 1');
  await page.locator('.autosave-copy').nth(1).getByRole('button', { name: 'Put it back' }).click();
  await page.locator('#confirm-modal').getByRole('button', { name: 'Put it back' }).click();
  await page.waitForFunction(() => window.Nordlys?.config?.groups?.[0]?.label === 'Before');
  expect((await list(page)).some((copy) => copy.file.groups[0].label === 'After')).toBe(true);
});

test('Forget them all deletes the copies and leaves the setup', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await setFolders(page, ['Stays']);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-backup').click();
  await page.locator('#autosaves > summary').click();
  await page.locator('#autosaves-forget').click();
  await page.locator('#confirm-modal').getByRole('button', { name: 'Forget them all' }).click();
  await expect(page.locator('#autosaves')).toBeHidden();
  expect(await list(page)).toEqual([]);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].label)).toBe('Stays');
});
