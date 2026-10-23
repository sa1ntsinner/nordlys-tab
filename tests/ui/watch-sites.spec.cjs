const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A bookmark can say whether its site answers: a dot on the tile, from a
   HEAD request that needs no permission, asked at most every five minutes
   for all tabs together. The sites are stood in for with page.route. */

const tile = (page, name) => page.locator('#board .tile', { hasText: name });

test('a watched site shows whether it answers, and is asked only once in five minutes', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  const asked = [];
  await page.route('https://up.test/**', route => { asked.push(route.request().method()); route.fulfill({ status: 200, body: '' }); });
  await page.route('https://down.test/**', route => route.abort('connectionrefused'));
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{ label: 'WORK', cols: 3, hidden: false, links: [
      { name: 'Status', url: 'https://up.test/', icon: 'globe', color: '#7c9cff' },
      { name: 'Staging', url: 'https://down.test/', icon: 'globe', color: '#7c9cff' }
    ] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await expect(tile(page, 'Status').locator('.tile-status')).toHaveCount(0);

  for (const name of ['Status', 'Staging']) {
    await tile(page, name).click({ button: 'right' });
    await page.locator('#tile-ctx-menu [data-action="watch"]').click();
  }
  await expect(tile(page, 'Status').locator('.tile-status')).toHaveAttribute('data-state', 'up');
  await expect(tile(page, 'Staging').locator('.tile-status')).toHaveAttribute('data-state', 'down');
  await expect(tile(page, 'Status')).toHaveAttribute('title', /^Answers in \d+ ms$/);
  await expect(tile(page, 'Staging')).toHaveAccessibleName(/Staging\s*Not answering/);
  expect(asked).toEqual(['HEAD']);

  // Drawn again within the five minutes, nothing is asked again.
  await page.evaluate(() => window.Nordlys.grid.render());
  await expect(tile(page, 'Status').locator('.tile-status')).toHaveAttribute('data-state', 'up');
  expect(asked).toEqual(['HEAD']);

  await tile(page, 'Status').click({ button: 'right' });
  await expect(page.locator('#tile-ctx-menu [data-action="watch"]')).toHaveText('Stop showing if it is up');
  await page.locator('#tile-ctx-menu [data-action="watch"]').click();
  await expect(tile(page, 'Status').locator('.tile-status')).toHaveCount(0);
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.map(link => Boolean(link.watch)))).toEqual([false, true]);
  // The browser itself logs the site that refused; nothing else may go wrong.
  expect(runtimeErrors.filter(error => !/ERR_CONNECTION_REFUSED/.test(error))).toEqual([]);
});
