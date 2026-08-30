const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The wall at the beginning is what people actually complain about: a new board
   is empty and their bookmarks are already somewhere else. "I'm not going to
   add them one by one, I have about two thousand" is a real review, and
   variations of it outnumber every feature request in this category.

   A linked folder mirrors a browser folder one way. The browser keeps
   ownership, which also means the thing that ends these products — losing
   somebody's setup — cannot happen here: the durable copy is the one the
   browser already syncs and backs up. */

const TREE = [{
  id: '0', title: '', children: [
    { id: '1', title: 'Bookmarks bar', children: [
      { id: '10', title: 'Reading', children: [
        { id: '101', title: 'Some article', url: 'https://article.test/one' },
        { id: '102', title: 'Another', url: 'https://article.test/two' },
        { id: '103', title: 'A nested folder', children: [] },
        { id: '104', title: 'Not a web link', url: 'javascript:void(0)' }
      ] },
      { id: '11', title: 'Work', children: [
        { id: '111', title: 'Dashboard', url: 'https://work.test/dash' }
      ] }
    ] }
  ]
}];

async function withBookmarks(page, { granted = true, grantOnRequest = true, tree = TREE } = {}) {
  await page.evaluate(state => { window.__bookmarks = state; }, { granted, grantOnRequest, tree });
}

async function openManager(page) {
  await page.locator('#gear').click();
  await page.getByRole('tab', { name: 'Bookmarks' }).click();
}

async function folderMenu(page, index = 0) {
  await page.locator('.bookmark-folder-accordion').nth(index)
    .locator('.bookmark-folder-head').getByRole('button', { name: /More actions for/ }).click();
  return page.locator('.nl-overflow-menu');
}

test('a folder can be pointed at a browser folder and fills itself', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);

  let menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  // The picker lists folders by path, so two folders named the same are apart.
  await expect(menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading', exact: true })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading', exact: true }).click();

  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.source?.folderId).toBe('10');
  const links = await page.evaluate(() => window.Aurora.config.groups[0].links);
  // Two web links; the nested folder and the javascript: entry are left out.
  expect(links.map(link => link.url)).toEqual(['https://article.test/one', 'https://article.test/two']);
  await expect(page.locator('#board .cat b').first()).toBeVisible();
});

test('a linked folder says whose bookmarks these are and does not offer to add', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await menu.getByRole('menuitem', { name: 'Bookmarks bar / Work', exact: true }).click();

  const folder = page.locator('.bookmark-folder-accordion').first();
  await expect(folder.locator('.bookmark-folder-linked')).toHaveText('Work');
  await folder.locator('summary').click();
  await expect(folder.getByRole('button', { name: /Add bookmark to/ })).toBeDisabled();
});

/* Unlinking must keep the bookmarks. Taking them away would be exactly the loss
   this feature exists to prevent. */
test('unlinking keeps what was on screen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  let menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.Aurora.config.groups[0].links.length)).toBe(2);

  menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Stop following the browser/ }).click();
  expect(await page.evaluate(() => Boolean(window.Aurora.config.groups[0].source))).toBe(false);
  expect(await page.evaluate(() => window.Aurora.config.groups[0].links.length)).toBe(2);
  expect(await page.evaluate(() => 'fromBrowser' in window.Aurora.config.groups[0].links[0])).toBe(false);
});

test('nothing is asked for, or read, until a folder is linked', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.__bookmarks = { granted: false, grantOnRequest: true, tree: [] };
    window.__asked = 0;
    const real = window.chrome.permissions.request;
    window.chrome.permissions.request = (request, callback) => { window.__asked++; return real(request, callback); };
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__asked || 0), 'a board with no linked folder asks for nothing').toBe(0);
});

/* A folder the user deletes in the browser must not silently empty the group. */
test('a folder that disappears is reported, not erased', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.Aurora.config.groups[0].links.length)).toBe(2);

  // The folder goes away in the browser.
  await page.evaluate(() => { window.__bookmarks.tree = []; });
  const changed = await page.evaluate(() => window.NordlysBookmarks.refresh(window.Aurora.config));
  expect(changed).toBe(true);
  expect(await page.evaluate(() => window.Aurora.config.groups[0].source.missing)).toBe(true);
  expect(await page.evaluate(() => window.Aurora.config.groups[0].links.length),
    'the bookmarks stay on screen').toBe(2);
});

test('refusing the permission leaves the folder alone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page, { granted: false, grantOnRequest: false });
  await openManager(page);
  const before = await page.evaluate(() => window.Aurora.config.groups[0].links.length);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean(window.Aurora.config.groups[0].source))).toBe(false);
  expect(await page.evaluate(() => window.Aurora.config.groups[0].links.length)).toBe(before);
});
