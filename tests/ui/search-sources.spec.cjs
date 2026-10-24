/* Where the search box looks besides the web (search-sources.js): the place
   in Settings that does a thing, a task to add, and, once the person turned
   them on and the browser gave its leave, open tabs, the browser's own
   bookmarks and its history. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function type(page, text) {
  await page.locator('#q').click();
  await page.locator('#q').fill(text);
}
const row = (page, kind) => page.locator(`#sugg .sugg-${kind}`);

// A browser with an open tab, a bookmark and a visited page, none of them readable yet.
async function browserLists(page, { history = {} } = {}) {
  await page.evaluate((history) => {
    window.__tabs = { list: [{ id: 7, windowId: 3, title: 'Kanban board', url: 'https://kanban.example/board' }, { id: 8, windowId: 3, title: 'GitHub', url: 'https://github.com/' }] };
    window.__bookmarks = { tree: [{ id: '0', children: [{ id: '1', title: 'Bookmarks bar', children: [{ id: '5', parentId: '1', title: 'Kanban tips', url: 'https://tips.example/kanban' }] }] }] };
    window.__history = { list: [{ title: 'Kanban guide', url: 'https://guide.example/kanban', visitCount: 3 }], ...history };
  }, history);
}

test('a setting is found by what it is called, and the search goes there', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, 'remember recent');
  const found = row(page, 'setting');
  await expect(found.locator('.bm-name')).toHaveText('Remember recent searches');
  await expect(found.locator('.bm-url')).toHaveText('General');
  await expect(found.locator('.sugg-badge')).toHaveText('Settings');
  await found.dispatchEvent('mousedown');
  await expect(page.locator('#cfg')).toBeVisible();
  await expect(page.locator('#cfg-remember-searches')).toBeFocused();
  await expect(page.locator('#sec-general .row:has(#cfg-remember-searches)')).toHaveClass(/setting-found/);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('"+" and some words make a task, by its row or by Enter', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '+ buy milk');
  await expect(row(page, 'capture').locator('.bm-name')).toHaveText('Add a task: buy milk');
  await page.locator('#q').press('Enter');
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#toast-dock')).toContainText('Added to your tasks');
  await expect(page.locator('#dash .dash-card[data-type="tasks"] .dash-task-text')).toContainText(['buy milk']);
  await type(page, '+ water the plants');
  await row(page, 'capture').dispatchEvent('mousedown');
  await expect(page.locator('#dash .dash-card[data-type="tasks"] .dash-task-text')).toContainText(['buy milk', 'water the plants']);
  expect(await page.evaluate(() => (window.__searches || []).length), 'a task is not searched for').toBe(0);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('the browser\'s lists are read only once turned on, each with the browser\'s leave', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await browserLists(page);
  await type(page, 'kanban');
  await page.waitForTimeout(400);
  await expect(page.locator('#sugg .sugg-tab, #sugg .sugg-browser-bookmark, #sugg .sugg-page')).toHaveCount(0);
  await page.locator('#q').press('Escape');

  await page.locator('#gear').click();
  await page.locator('#cfg .ctab[data-tab="general"]').click();
  for (const source of ['tabs', 'bookmarks', 'history']) await page.locator(`label.tg:has(#cfg-search-${source})`).click();
  for (const source of ['tabs', 'bookmarks', 'history']) await expect(page.locator(`#cfg-search-${source}`)).toBeChecked();
  expect(await page.evaluate(() => [window.__tabs.granted, window.__bookmarks.granted, window.__history.granted])).toEqual([true, true, true]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).searchFrom)).toEqual(['tabs', 'bookmarks', 'history']);
  await page.keyboard.press('Escape');

  await type(page, 'kanban');
  await expect(row(page, 'tab').locator('.bm-name')).toHaveText('Kanban board');
  await expect(row(page, 'tab').locator('.sugg-badge')).toHaveText('Switch to tab');
  await expect(row(page, 'browser-bookmark').locator('.bm-name')).toHaveText('Kanban tips');
  await expect(row(page, 'browser-bookmark').locator('.sugg-badge')).toHaveText('Bookmarks bar');
  await expect(row(page, 'page').locator('.bm-name')).toHaveText('Kanban guide');
  await expect(row(page, 'page').locator('.sugg-badge')).toHaveText('History');
  await expect(row(page, 'page').locator('.bm-url')).toHaveText('guide.example');

  await row(page, 'tab').dispatchEvent('mousedown');
  expect(await page.evaluate(() => [window.__tabs.updated, window.__tabs.focused])).toEqual([[{ id: 7, active: true }], [3]]);

  // A page on the board that is open already is offered both ways.
  await type(page, 'github');
  await expect(row(page, 'bookmark').first().locator('.bm-name')).toHaveText('GitHub');
  await expect(row(page, 'tab').locator('.bm-name')).toHaveText('GitHub');
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

/* Chrome puts the bookmarks and the history on the page only once their
   leave is given, so a fresh install has neither: a switch is offered by what
   this build may ask for, and left out only by a build that cannot (Safari's). */
test('a fresh install offers every list this build may ask for, and no other', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const fresh = async (optional) => {
    await page.addInitScript((optional) => {
      delete window.chrome.bookmarks;
      delete window.chrome.history;
      window.chrome.runtime.getManifest = () => ({ optional_permissions: optional });
    }, optional);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    await page.locator('#gear').click();
    await page.locator('#cfg .ctab[data-tab="general"]').click();
  };
  const offered = (source) => page.locator(`label.tg:has(#cfg-search-${source})`);
  await fresh(['bookmarks', 'tabs', 'topSites', 'history', 'sessions']);
  for (const source of ['tabs', 'bookmarks', 'history']) await expect(offered(source), source).toBeVisible();
  await fresh(['tabs']);
  await expect(offered('tabs')).toBeVisible();
  for (const source of ['bookmarks', 'history']) await expect(offered(source), source).toBeHidden();
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('refused leave leaves the switch off and the list unread', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await browserLists(page, { history: { grantOnRequest: false } });
  await page.locator('#gear').click();
  await page.locator('#cfg .ctab[data-tab="general"]').click();
  await page.locator('label.tg:has(#cfg-search-history)').click();
  await expect(page.locator('#cfg-search-history')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).searchFrom || [])).toEqual([]);
  await page.keyboard.press('Escape');
  await type(page, 'kanban');
  await page.waitForTimeout(400);
  await expect(row(page, 'page')).toHaveCount(0);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('a keyword set up in Settings goes to its address, with the words where %s is', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#cfg .ctab[data-tab="general"]').click();
  await page.getByRole('button', { name: 'Add a keyword' }).click();
  await expect(page.getByRole('textbox', { name: 'Keyword' })).toBeFocused();
  await page.keyboard.type('gh');
  await page.keyboard.press('Tab');
  await page.keyboard.type('github.com/search?q=%s');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue('https://github.com/search?q=%s');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).golinks)).toEqual([{ key: 'gh', url: 'https://github.com/search?q=%s' }]);
  // One word only, and each once: a second "gh" waits, marked.
  await page.getByRole('button', { name: 'Add a keyword' }).click();
  await page.keyboard.type('GH');
  await page.keyboard.press('Tab');
  await page.keyboard.type('https://gitlab.com');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Keyword' }).nth(1)).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).golinks.length)).toBe(1);
  await page.getByRole('button', { name: 'Remove this keyword' }).nth(1).click();
  await page.keyboard.press('Escape');

  await type(page, 'gh');
  await expect(page.locator('#sugg .sugg-item').first()).toHaveClass(/sugg-golink/);
  await expect(row(page, 'golink').locator('.bm-name')).toHaveText('github.com');
  await type(page, 'gh nordlys tab');
  await expect(row(page, 'golink').locator('.bm-name')).toHaveText('nordlys tab');
  await expect(row(page, 'golink').locator('.bm-url')).toHaveText('github.com/search?q=nordlys%20tab');
  await expect(row(page, 'golink').locator('.sugg-badge')).toHaveText('gh');
  await page.route('https://github.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>here</title>' }));
  await Promise.all([page.waitForURL('https://github.com/search?q=nordlys%20tab'), page.locator('#q').press('Enter')]);
});
