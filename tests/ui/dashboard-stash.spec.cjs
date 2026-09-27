const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The tab stash: the tabs of a window put away in one click, and brought
   back all at once or one by one. The fixture stands in for chrome.tabs. */

const stash = page => page.locator('#dash .dash-card[data-type="stash"]').first();

test.beforeEach(async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(async origin => {
    window.__tabs = { grantOnRequest: true, list: [
      { id: 1, url: `${origin}/newtab.html`, title: 'New Tab' },
      { id: 2, url: 'https://github.com/sa1ntsinner/nordlys-tab', title: 'Nordlys on GitHub' },
      { id: 3, url: 'https://news.ycombinator.com/', title: 'Hacker News', pinned: true },
      { id: 4, url: 'https://en.wikipedia.org/wiki/Aurora', title: 'Aurora - Wikipedia' }
    ] };
    const d = window.Nordlys.dashboard; d.setOn(true); d.add('stash'); await d.render();
  }, nordlysPage.origin);
});

test('the tabs of the window are put away and closed, and only web pages that are not pinned', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await stash(page).getByRole('button', { name: 'Stash the tabs of this window' }).click();
  await expect(stash(page).locator('.dash-stash-count')).toHaveText('2 tabs');
  expect(await page.evaluate(() => window.__tabs.removed.sort())).toEqual([2, 4]);
  await stash(page).locator('.dash-stash-toggle').click();
  await expect(stash(page).locator('.dash-stash-tab')).toHaveText(['Nordlys on GitHub', 'Aurora - Wikipedia']);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(stash(page).locator('.dash-stash-count')).toHaveText('2 tabs');
  expect(runtimeErrors).toEqual([]);
});

test('one tab opened from the stash leaves it; Open all brings back the rest and clears the group', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await stash(page).getByRole('button', { name: 'Stash the tabs of this window' }).click();
  await stash(page).locator('.dash-stash-toggle').click();
  await stash(page).locator('.dash-stash-tab', { hasText: 'Aurora' }).click();
  await expect(stash(page).locator('.dash-stash-count')).toHaveText('1 tabs');
  await stash(page).getByRole('button', { name: 'Open all' }).click();
  expect(await page.evaluate(() => window.__tabs.created)).toEqual(['https://en.wikipedia.org/wiki/Aurora', 'https://github.com/sa1ntsinner/nordlys-tab']);
  await expect(stash(page).locator('.dash-stash-group')).toHaveCount(0);
});

test('Undo right after stashing opens the tabs again', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await stash(page).getByRole('button', { name: 'Stash the tabs of this window' }).click();
  await page.locator('#toast-dock .toast-action').last().click();
  expect(await page.evaluate(() => window.__tabs.created.length)).toBe(2);
  await expect(stash(page).locator('.dash-stash-group')).toHaveCount(0);
});

test('without the permission nothing is closed and the card says why', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.__tabs.grantOnRequest = false; });
  await stash(page).getByRole('button', { name: 'Stash the tabs of this window' }).click();
  await expect(page.locator('#toast-dock')).toContainText('needs to see your tabs');
  expect(await page.evaluate(() => window.__tabs.removed || [])).toEqual([]);
});
