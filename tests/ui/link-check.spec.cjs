const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Settings → Bookmarks → Check the bookmarks: the ones on the board twice,
   and the pages that are gone, with leave to read the sites asked in the
   click and handed back afterwards. The sites are stood in for with
   page.route. */

test('the check finds a bookmark there twice and the pages that are gone, and each can go with a way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://docs.test/**', route => route.fulfill({ status: 200, body: '' }));
  await page.route('https://mail.test/**', route => route.fulfill({ status: 200, body: '' }));
  await page.route('https://old.test/**', route => route.fulfill({ status: 404, body: 'gone' }));
  await page.route('https://err.test/**', route => route.fulfill({ status: 503, body: 'down' }));
  await page.route('https://down.test/**', route => route.abort('connectionrefused'));
  await page.evaluate(() => {
    window.Nordlys.config.groups = [
      { label: 'Work', cols: 3, hidden: false, links: [{ name: 'Docs', url: 'https://docs.test/' }, { name: 'Mail', url: 'https://mail.test/' }] },
      { label: 'Read', cols: 3, hidden: false, links: [{ name: 'Mail', url: 'https://mail.test/#inbox' }, { name: 'Old post', url: 'https://old.test/post' }, { name: 'Broken', url: 'https://err.test/' }, { name: 'Gone server', url: 'https://down.test/' }] }
    ];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await page.locator('#link-check summary').click();
  await page.locator('#check-run').click();
  await expect(page.locator('#check-state')).toHaveText('Checked 6 pages.');
  expect(await page.evaluate(() => window.__origins.asked)).toEqual(['https://docs.test/*', 'https://mail.test/*', 'https://old.test/*', 'https://err.test/*', 'https://down.test/*']);
  expect(await page.evaluate(() => window.__origins.removed)).toEqual(['https://docs.test/*', 'https://mail.test/*', 'https://old.test/*', 'https://err.test/*', 'https://down.test/*']);

  const rows = page.locator('#check-results .check-row');
  await expect(page.locator('#check-results .check-title')).toHaveText(['On the board more than once', 'Pages that are not there']);
  await expect(rows.locator('small')).toHaveText(['Work · Read', 'Read · Not there any more (404)', 'Read · The site has an error (503)', 'Read · Does not answer']);

  await rows.first().getByRole('button', { name: 'Keep the first' }).click();
  expect(await page.evaluate(() => window.Nordlys.config.groups[1].links.map(link => link.name))).toEqual(['Old post', 'Broken', 'Gone server']);
  await expect(page.locator('#check-results .check-title')).toHaveText(['Pages that are not there']);

  await page.locator('#check-results .check-row', { hasText: 'Old post' }).getByRole('button', { name: 'Remove' }).click();
  expect(await page.evaluate(() => window.Nordlys.config.groups[1].links.map(link => link.name))).toEqual(['Broken', 'Gone server']);
  await page.locator('#toast-dock .toast-action').last().click();
  expect(await page.evaluate(() => window.Nordlys.config.groups[1].links.map(link => link.name))).toEqual(['Old post', 'Broken', 'Gone server']);
});

test('with nothing wrong the check says so, and without leave it says what it could not tell', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://docs.test/**', route => route.fulfill({ status: 200, body: '' }));
  await page.evaluate(() => {
    window.__origins = { grant: false };
    window.Nordlys.config.groups = [{ label: 'Work', cols: 3, hidden: false, links: [{ name: 'Docs', url: 'https://docs.test/' }] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await page.locator('#link-check summary').click();
  await page.locator('#check-run').click();
  await expect(page.locator('#check-results .check-clear')).toHaveText('Nothing to fix: every page answered, and none is on the board twice.');
  await expect(page.locator('#check-results .row-hint')).toContainText('without leave to read them');
});
