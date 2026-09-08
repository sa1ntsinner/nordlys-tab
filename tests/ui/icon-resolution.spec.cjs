const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A bookmark that names no icon still has an address, and the address is
   usually enough: github.com is GitHub. The resolver knew this, but the tile
   only checked whether an icon key was written on the bookmark, so imported and
   browser-mirrored bookmarks — which never carry one — drew a monogram over a
   perfectly good vector. */

test('a bookmark recognised by its address draws the built-in mark, not a monogram', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].links = [
      { name: 'GitHub', url: 'https://github.com/nordlys' },
      { name: 'Gmail', url: 'https://mail.google.com/' },
      { name: 'Somewhere', url: 'https://unknown-site.example/' }
    ];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  const tiles = page.locator('#board .card').first().locator('.tile');
  await expect(tiles).toHaveCount(3);

  const kinds = await tiles.evaluateAll(nodes => nodes.map(node => node.querySelector('.nl-icon')?.dataset.iconKind));
  expect(kinds, 'GitHub and Gmail are drawn from the library; the unknown site gets a monogram').toEqual(['builtin', 'builtin', 'monogram']);

  expect(await tiles.nth(0).locator('.nl-icon svg path').count(), 'a vector, not a letter').toBe(1);
  expect(await tiles.nth(2).locator('.nl-icon .mono').textContent()).toBe('S');
});

test('the icon picker preview agrees with the tile', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].links = [{ name: 'GitHub', url: 'https://github.com/' }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
    window.Nordlys.settings.openIconModal(0, 0);
  });
  await expect(page.locator('#icon-live-preview .nl-icon')).toHaveAttribute('data-icon-kind', 'builtin');
});
