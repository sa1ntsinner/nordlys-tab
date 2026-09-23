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

/* Choosing a folder for a group that already holds bookmarks asks first,
   because the browser's list replaces them. The tests answer yes. */
async function chooseFolder(page, menu, name) {
  await menu.getByRole('menuitem', { name, exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: 'Follow' }).click();
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

  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  // The picker lists folders by path, so two folders named the same are apart.
  await expect(menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading', exact: true })).toBeVisible();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');

  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.source?.folderId).toBe('10');
  const links = await page.evaluate(() => window.Nordlys.config.groups[0].links);
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
  await chooseFolder(page, menu, 'Bookmarks bar / Work');

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
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);

  menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Stop following the browser/ }).click();
  expect(await page.evaluate(() => Boolean(window.Nordlys.config.groups[0].source))).toBe(false);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);
  expect(await page.evaluate(() => 'fromBrowser' in window.Nordlys.config.groups[0].links[0])).toBe(false);
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
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
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
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);

  // The folder goes away in the browser.
  await page.evaluate(() => { window.__bookmarks.tree = []; });
  const changed = await page.evaluate(() => window.NordlysBookmarks.refresh(window.Nordlys.config));
  expect(changed).toBe(true);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].source.missing)).toBe(true);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.length),
    'the bookmarks stay on screen').toBe(2);
});

test('refusing the permission leaves the folder alone', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page, { granted: false, grantOnRequest: false });
  await openManager(page);
  const before = await page.evaluate(() => window.Nordlys.config.groups[0].links.length);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean(window.Nordlys.config.groups[0].source))).toBe(false);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(before);
});

/* Following a browser folder is a promise that the folder shows what the
   browser has. That promise was only half kept: the watch that carries browser
   changes into the page was started at load, so the first folder linked in a
   session was never watched until the next open. */
test('the first folder linked in a session is watched from that moment', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);

  expect(await page.evaluate(() => (window.__bookmarks.listeners || []).length), 'a listener is registered without a reload').toBeGreaterThan(0);

  // The browser gains a bookmark; the page notices.
  await page.evaluate(() => {
    window.__bookmarks.tree[0].children[0].children[0].children.push({ id: '105', title: 'Third', url: 'https://article.test/three' });
    (window.__bookmarks.listeners || []).forEach(listener => listener());
  });
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length), 'the change arrives').toBe(3);
});

/* A folder that follows the browser cannot also take local edits: anything
   added here vanishes on the next refresh, which is loss dressed up as a save.
   The button already refused; the menu and the drop target did not. */
test('every way of adding to a linked folder is closed, not just the button', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  let menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);

  // The folder's own menu.
  menu = await folderMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Add bookmark' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // Moving a bookmark from another folder: the linked one is not offered.
  const second = page.locator('.bookmark-folder-accordion').nth(1);
  await second.locator('summary').click();
  await second.locator('.bookmark-summary-row').first().getByRole('button', { name: /More actions for/ }).click();
  await page.locator('.nl-overflow-menu').getByRole('menuitem', { name: 'Move to folder' }).click();
  const targets = await page.locator('.nl-overflow-menu [role="menuitem"]').allTextContents();
  const linkedLabel = await page.evaluate(() => window.Nordlys.config.groups[0].label);
  expect(targets, 'a folder that follows the browser is not a destination').not.toContain(linkedLabel);
  await page.keyboard.press('Escape');

  // Dropping a tile onto the board's linked card is refused too: the carry
  // refuses it on the way (arrange.spec), and the move itself refuses it here.
  const outcome = await page.evaluate(() => {
    const groups = window.Nordlys.config.groups;
    const before = groups.map(group => group.links.length);
    window.Nordlys.grid.moveLink(groups[1], 0, groups[0], 0);
    return { before, after: groups.map(group => group.links.length) };
  });
  expect(outcome.after, 'nothing moved').toEqual(outcome.before);
});

/* The folder picker cut the list at forty and said nothing. People with large
   bookmark trees are the ones this feature exists for. */
test('the folder picker lists every folder and narrows as you type', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const many = Array.from({ length: 60 }, (_, index) => ({ id: `f${index}`, title: index === 41 ? 'Reading list' : `Folder ${index}`, children: [] }));
  await withBookmarks(page, { tree: [{ id: '0', title: '', children: [{ id: '1', title: 'Bookmarks bar', children: many }] }] });
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();

  // Sixty folders plus the bar that holds them: every one is offered.
  await expect(menu.getByRole('menuitem')).toHaveCount(61);
  const filter = menu.getByRole('searchbox');
  await expect(filter).toBeFocused();
  await filter.fill('reading');
  await expect(menu.getByRole('menuitem')).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: 'Bookmarks bar / Reading list' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // The folder has bookmarks of its own, so the replacement is confirmed first.
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Follow' }).click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.source?.folderId).toBe('f41');
});

/* The browser owns what a followed bookmark is; Nordlys owns how it looks.
   Every refresh rebuilt the links from the browser alone, so an icon or a
   colour chosen for a followed bookmark was gone by the next new tab. */
test('a look chosen for a followed bookmark survives the next refresh', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);

  await page.evaluate(() => {
    const [first, second] = window.Nordlys.config.groups[0].links;
    first.customImg = 'data:image/png;base64,iVBORw0KGgo=';
    first.iconUrl = 'https://cdn.test/a.png';
    first.iconUrls = [{ url: 'https://cdn.test/a.png', thumb: '', at: 1 }];
    second.monogram = 'AN';
    second.color = '#ff8800';
  });
  // The browser renames one and reorders them.
  await page.evaluate(() => {
    const reading = window.__bookmarks.tree[0].children[0].children[0];
    reading.children = [
      { id: '102', title: 'Another, renamed', url: 'https://article.test/two' },
      { id: '101', title: 'Some article', url: 'https://article.test/one' }
    ];
  });
  await page.evaluate(() => window.NordlysBookmarks.refresh(window.Nordlys.config));
  const links = await page.evaluate(() => window.Nordlys.config.groups[0].links);
  expect(links.map(link => link.name)).toEqual(['Another, renamed', 'Some article']);
  expect(links[0]).toMatchObject({ monogram: 'AN', color: '#ff8800' });
  expect(links[1]).toMatchObject({ customImg: 'data:image/png;base64,iVBORw0KGgo=', iconUrl: 'https://cdn.test/a.png' });
  // Nothing moved, so a second refresh changes nothing and saves nothing.
  expect(await page.evaluate(() => window.NordlysBookmarks.refresh(window.Nordlys.config))).toBe(false);
});

/* Anything the next refresh would undo is not offered as an edit: the name,
   the address, the folder, the order and deleting belong to the browser.
   What the bookmark looks like is still set here. */
test('a followed bookmark offers only what will last', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);
  await page.keyboard.press('Escape');

  // Quick edit: the fields say where they are changed, and the folder is fixed.
  await page.evaluate(() => window.Nordlys.grid.openQuickEditModal(0, 0));
  await expect(page.locator('#quick-title-input')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#quick-url-input')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#quick-edit-linked-note')).toBeVisible();
  await page.evaluate(() => { document.getElementById('quick-color-input').value = '#123456'; });
  await page.locator('#quick-save-btn').click();
  const link = await page.evaluate(() => window.Nordlys.config.groups[0].links[0]);
  expect(link).toMatchObject({ name: 'Some article', url: 'https://article.test/one', color: '#123456' });

  // Another folder's bookmark cannot be moved into this one from quick edit.
  const disabled = await page.evaluate(() => {
    window.Nordlys.grid.openQuickEditModal(1, 0);
    return [...document.querySelectorAll('#quick-folder-select option')].filter(option => option.disabled).map(option => Number(option.value));
  });
  expect(disabled).toEqual([0]);
  await page.keyboard.press('Escape');

  // The tile's menu does not offer to delete what the browser would bring back.
  await page.locator('#board .card').first().locator('.tile').first().click({ button: 'right' });
  await expect(page.locator('#tile-ctx-menu [data-action="delete"]')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.Nordlys.grid.deleteBookmarkWithUndo(0, 0));
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);
});

/* Matched by address alone, a look was lost the moment the address changed
   in the browser. The browser's own id carries it now. */
test('a look follows a followed bookmark whose address changes in the browser', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await withBookmarks(page);
  await openManager(page);
  const menu = await folderMenu(page);
  await menu.getByRole('menuitem', { name: /Follow a browser folder/ }).click();
  await chooseFolder(page, menu, 'Bookmarks bar / Reading');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups[0].links.length)).toBe(2);
  await page.evaluate(() => { window.Nordlys.config.groups[0].links[0].monogram = 'SA'; });
  await page.evaluate(() => {
    const reading = window.__bookmarks.tree[0].children[0].children[0];
    reading.children[0].url = 'https://article.test/one-moved';
  });
  await page.evaluate(() => window.NordlysBookmarks.refresh(window.Nordlys.config));
  const first = await page.evaluate(() => window.Nordlys.config.groups[0].links[0]);
  expect(first.url).toBe('https://article.test/one-moved');
  expect(first.monogram).toBe('SA');
});
