const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The store rejected the extension for doing two things: replacing the new tab
   page and changing search settings. It was right. The page carried its own
   table of ten engines, a bang syntax to pick one per query, and a template for
   a custom one — a search-settings product bolted onto a start page. Choosing
   an engine is Chrome's job, and Chrome has a setting for it. The box now hands
   its text to that setting through chrome.search and never learns which engine
   answered. These tests hold that line. */

async function submit(page, text) {
  await page.locator('#q').fill(text);
  await page.locator('#q').press('Enter');
  await page.waitForTimeout(150);
}

test('a search goes to the engine Chrome has, in this tab', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await submit(page, 'northern lights forecast');
  const sent = await page.evaluate(() => window.__searches || []);
  expect(sent).toEqual([{ text: 'northern lights forecast', disposition: 'CURRENT_TAB' }]);
});

test('the open-in-new-tab preference applies to searches too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.openNewTab = true; window.Nordlys.saveConfig(); });
  await submit(page, 'aurora');
  const sent = await page.evaluate(() => window.__searches || []);
  expect(sent[0]?.disposition).toBe('NEW_TAB');
});

/* Typing an address is navigation, not search; it must not be sent to an engine
   as if it were a query. */
test('an address navigates instead of being searched for', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const navigated = page.waitForRequest(request => request.url().startsWith('https://example.test/'), { timeout: 3000 })
    .then(() => true).catch(() => false);
  await page.route('https://example.test/**', route => route.fulfill({ status: 200, body: '' }));
  await submit(page, 'example.test');
  expect(await navigated, 'a bare domain is navigated to').toBe(true);
  expect(await page.evaluate(() => (window.__searches || []).length), 'and nothing is sent to search').toBe(0);
});

/* The page decides nothing about which engine is used, so it must offer nothing
   that decides. No switch on the bar, no setting in the drawer, no table in the
   source to choose from. */
test('nothing on the page chooses a search engine', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  expect(await page.locator('#engine-selector').count(), 'no engine switch on the bar').toBe(0);
  expect(await page.locator('#search-icon').count(), 'a plain magnifier stands where it was').toBe(1);
  expect(await page.locator('#search-icon').evaluate(node => node.tagName), 'and it is not a control').toBe('SPAN');

  await page.locator('#gear').click();
  await page.locator('#settings-tab-general').click();
  expect(await page.locator('#cfg-default-engine, #cfg-custom-engine, #cfg-show-suggestions').count(),
    'no engine or suggestion setting in the drawer').toBe(0);
});

/* Live suggestions were the one thing the privacy page needed a caveat for:
   every keystroke went to a third party. Typing now reaches nothing outside
   the page. */
test('typing in the search box sends nothing anywhere', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const outbound = [];
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(nordlysPage.origin)) outbound.push(url);
  });
  await page.locator('#q').click();
  await page.keyboard.type('what is the weather like', { delay: 20 });
  await page.waitForTimeout(500);
  expect(outbound, 'no request may leave the page while typing').toEqual([]);
});

/* What remains of the dropdown is local: the calculator, the user's own tiles,
   and what they searched before. */
test('the dropdown still offers the calculator and the user\'s own bookmarks', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#q').click();
  await page.keyboard.type('12 * 12');
  await expect(page.locator('#sugg .sugg-calc')).toContainText('144');

  await page.locator('#q').fill('');
  await page.keyboard.type('you');
  await expect(page.locator('#sugg .sugg-bookmark').first()).toContainText(/YouTube/i);
  expect(await page.locator('#sugg .sugg-web').count(), 'and no web rows').toBe(0);
});

/* A stored engine choice has nothing to drive any more, and a config that keeps
   carrying it is a config that will confuse the next reader. */
test('an old engine choice is dropped on upgrade and the restore point keeps it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    localStorage.removeItem('nordlys_restore_point');
    const config = { ...window.Nordlys.config, defaultEngine: 'duckduckgo', customEngineUrl: 'https://x.test/?q=%s', showSuggestions: false };
    localStorage.setItem('nordlys_config', JSON.stringify(config));
    window.chrome.storage.local.set({ nordlys_config: config }, () => {});
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  const after = await page.evaluate(() => ({
    keys: ['defaultEngine', 'customEngineUrl', 'showSuggestions'].filter(key => key in window.Nordlys.config),
    restored: JSON.parse(localStorage.getItem('nordlys_restore_point') || 'null')?.config?.defaultEngine
  }));
  expect(after.keys, 'nothing about engines survives in the live config').toEqual([]);
  expect(after.restored, 'but the state before the migration is kept').toBe('duckduckgo');
});
