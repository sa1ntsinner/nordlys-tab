const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The cards a tab reads in only when one is on its dashboard (dash-cards.js):
   feeds, a value out of any JSON, the open tabs and the tabs closed lately.
   Sites are stood in for with page.route; the browser's tabs and sessions
   with the fixture's shims. */

const card = (page, type) => page.locator(`#dash .dash-card[data-type="${type}"]`).first();
const addCard = (page, type) => page.evaluate(async (t) => { const d = window.Nordlys.dashboard; d.setOn(true); d.add(t); await d.render(); }, type);
const save = page => page.locator('.dash-dialog').getByRole('button', { name: 'Save' }).click();
const hoursAgo = hours => new Date(Date.now() - hours * 3600e3);

test('the cards few people add are read in only once one is on the page', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const read = () => page.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).filter(src => /dash-cards|feeds\.js/.test(src || '')));
  await page.evaluate(async () => { const d = window.Nordlys.dashboard; d.setOn(true); await d.render(); });
  expect(await read()).toEqual([]);
  await addCard(page, 'feeds');
  await expect(card(page, 'feeds').getByRole('button', { name: 'Add feeds' })).toBeVisible();
  expect(await read()).toEqual(['src/js/feeds.js', 'src/js/dash-cards.js']);
  expect(runtimeErrors).toEqual([]);
});

test('feeds: a feed and a site that names its own, newest first, and one at a time by its tab', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const rss = `<rss version="2.0"><channel><title>Sky News</title><item><title>Aurora tonight</title><link>https://news.test/aurora</link><pubDate>${hoursAgo(2).toUTCString()}</pubDate></item></channel></rss>`;
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A quiet blog</title><entry><title>On fjords</title><link href="/fjords"/><updated>${hoursAgo(1).toISOString()}</updated></entry></feed>`;
  await page.route('https://news.test/rss', route => route.fulfill({ body: rss, headers: { 'content-type': 'application/rss+xml' } }));
  await page.route('https://blog.test/', route => route.fulfill({ body: '<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>', headers: { 'content-type': 'text/html' } }));
  await page.route('https://blog.test/atom.xml', route => route.fulfill({ body: atom, headers: { 'content-type': 'application/atom+xml' } }));
  await addCard(page, 'feeds');
  await card(page, 'feeds').getByRole('button', { name: 'Add feeds' }).click();
  await page.locator('#dash-field-feeds').fill('https://news.test/rss\nblog.test');
  await save(page);
  expect(await page.evaluate(() => window.__origins.asked)).toEqual(['https://news.test/*', 'https://blog.test/*']);
  await expect(card(page, 'feeds').locator('.dash-feed-title')).toHaveText(['On fjords', 'Aurora tonight']);
  await expect(card(page, 'feeds').locator('.dash-feed-row').first()).toHaveAttribute('href', 'https://blog.test/fjords');
  await card(page, 'feeds').getByRole('tab', { name: 'Sky News' }).click();
  await expect(card(page, 'feeds').locator('.dash-feed-title')).toHaveText(['Aurora tonight']);
  expect(runtimeErrors).toEqual([]);
});

test('feeds: a site Nordlys may not read yet says so, and asks from the click', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let open = false;
  await page.route('https://closed.test/rss', route => (open
    ? route.fulfill({ body: '<rss><channel><title>Closed</title><item><title>Now readable</title><link>https://closed.test/1</link></item></channel></rss>' })
    : route.abort()));
  await page.evaluate(() => { window.__origins = { grant: false }; });
  await addCard(page, 'feeds');
  await card(page, 'feeds').getByRole('button', { name: 'Add feeds' }).click();
  await page.locator('#dash-field-feeds').fill('https://closed.test/rss');
  await save(page);
  const allow = card(page, 'feeds').getByRole('button', { name: 'Allow reading closed.test' });
  await expect(allow).toBeVisible();
  open = true;
  await page.evaluate(() => { window.__origins.grant = true; });
  await allow.click();
  await expect(card(page, 'feeds').locator('.dash-feed-title')).toHaveText(['Now readable']);
});

test('a value: one number out of a JSON answer, with its unit, and a line once it has moved', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  let price = '67012.5';
  await page.route('https://api.test/price', route => route.fulfill({ json: { data: { price } } }));
  await addCard(page, 'value');
  await card(page, 'value').getByRole('button', { name: 'Choose the address' }).click();
  await page.locator('#dash-field-title').fill('Bitcoin');
  await page.locator('#dash-field-url').fill('https://api.test/price');
  await page.locator('#dash-field-path').fill('data.price');
  await page.locator('#dash-field-unit').fill('$');
  await save(page);
  await expect(card(page, 'value').locator('h2')).toHaveText('Bitcoin');
  await expect(card(page, 'value').locator('.dash-value')).toHaveText('67,012.5$');
  price = '68000';
  await card(page, 'value').getByRole('button', { name: 'Refresh' }).click();
  await expect(card(page, 'value').locator('.dash-value-now')).toHaveText('68,000');
  await expect(card(page, 'value').locator('.dash-spark polyline')).toHaveCount(1);
});

test('a value that is not there says where it looked', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://api.test/other', route => route.fulfill({ json: { data: {} } }));
  await addCard(page, 'value');
  await card(page, 'value').getByRole('button', { name: 'Choose the address' }).click();
  await page.locator('#dash-field-url').fill('https://api.test/other');
  await page.locator('#dash-field-path').fill('data.price');
  await save(page);
  await expect(card(page, 'value').locator('.dash-inbox-error')).toHaveText('api.test: The answer has nothing at data.price.');
});

test('open tabs: the copies closed in one go, and tabs left for days closed with a way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate((origin) => {
    const day = 86400e3;
    const now = Date.now();
    window.__tabs = { granted: true, list: [
      { id: 1, windowId: 1, url: `${origin}/newtab.html`, title: 'New Tab', active: true, lastAccessed: now },
      { id: 2, windowId: 1, url: 'https://docs.test/a', title: 'Docs', lastAccessed: now - 1000 },
      { id: 3, windowId: 2, url: 'https://docs.test/a#part', title: 'Docs', lastAccessed: now - 5000 },
      { id: 4, windowId: 2, url: 'https://old.test/', title: 'Old read', lastAccessed: now - 5 * day },
      { id: 5, windowId: 2, url: 'https://pinned.test/', title: 'Pinned', pinned: true, lastAccessed: now - 9 * day }
    ] };
  }, nordlysPage.origin);
  await addCard(page, 'tabs');
  await expect(card(page, 'tabs').locator('.dash-tidy-sum')).toHaveText('5 tabs in 2 windows');
  await card(page, 'tabs').getByRole('button', { name: 'Close the copies (1)' }).click();
  expect(await page.evaluate(() => window.__tabs.removed)).toEqual([3]);
  await expect(card(page, 'tabs').locator('.dash-tidy-sum')).toHaveText('4 tabs in 2 windows');
  await card(page, 'tabs').getByRole('button', { name: 'Close them all' }).click();
  expect(await page.evaluate(() => window.__tabs.removed)).toEqual([3, 4]);
  await page.locator('#toast-dock .toast-action').last().click();
  expect(await page.evaluate(() => window.__tabs.created)).toEqual(['https://old.test/']);
  await expect(card(page, 'tabs').locator('.dash-tasks-empty')).toContainText('Nothing to tidy');
});

test('recently closed: asked for once, then the tabs and windows closed lately, each back with a click', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.evaluate((origin) => {
    const now = Math.floor(Date.now() / 1000);
    window.__sessions = { grantOnRequest: true, list: [
      { lastModified: now - 120, tab: { sessionId: 's1', url: 'https://read.test/story', title: 'A long story' } },
      { lastModified: now - 300, tab: { sessionId: 's2', url: `${origin}/newtab.html`, title: 'New Tab' } },
      { lastModified: now - 3600, window: { sessionId: 'w1', tabs: [{ url: 'https://a.test/', title: 'A' }, { url: 'https://b.test/', title: 'B' }] } }
    ] };
  }, nordlysPage.origin);
  await addCard(page, 'closed');
  await card(page, 'closed').getByRole('button', { name: 'Show them' }).click();
  await expect(card(page, 'closed').locator('.dash-tab-row > span:not(.dash-stash-icon)')).toHaveText(['A long story', 'A window of 2 tabs']);
  await card(page, 'closed').getByRole('button', { name: /A long story/ }).click();
  expect(await page.evaluate(() => window.__sessions.restored)).toEqual(['s1']);
  await expect(card(page, 'closed').locator('.dash-tab-row')).toHaveCount(1);
  expect(runtimeErrors).toEqual([]);
});
