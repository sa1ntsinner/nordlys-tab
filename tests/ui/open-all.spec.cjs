const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A middle click on a browser bookmark folder opens the lot. People say they
   miss it in a start page more often than almost anything else, and it is the
   cheapest of the requests to grant. */

async function openFolderMenu(page, index = 0) {
  const header = page.locator('#board .cat').nth(index);
  await header.click({ button: 'right' });
  await expect(page.locator('#folder-ctx-menu.open')).toBeVisible();
}

test('a small folder opens without ceremony', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.groups = [{
      label: 'SHORT', cols: 3, hidden: false, links: [
        { name: 'One', url: 'https://one.test/', icon: 'globe', color: '#7c9cff' },
        { name: 'Two', url: 'https://two.test/', icon: 'globe', color: '#7c9cff' }
      ]
    }];
    window.Aurora.saveConfig();
    window.Aurora.grid.render();
    // Count the openings without actually opening anything.
    window.__opened = [];
    window.open = url => { window.__opened.push(url); return null; };
  });

  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await expect.poll(() => page.evaluate(() => window.__opened)).toEqual([
    'https://one.test/', 'https://two.test/'
  ]);
});

/* Opening twenty tabs is not something a page should be able to do quietly on
   one click of a menu item the user may have hit by accident. */
test('a large folder asks first, and takes no for an answer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.groups = [{
      label: 'MANY', cols: 4, hidden: false,
      links: Array.from({ length: 9 }, (unused, index) => ({
        name: `Link ${index}`, url: `https://many-${index}.test/`, icon: 'globe', color: '#7c9cff'
      }))
    }];
    window.Aurora.saveConfig();
    window.Aurora.grid.render();
    window.__opened = [];
    window.open = url => { window.__opened.push(url); return null; };
  });

  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await expect(page.getByText(/Open 9 tabs\?/)).toBeVisible();
  await page.getByRole('button', { name: /Cancel/i }).click();
  expect(await page.evaluate(() => window.__opened), 'declining opens nothing').toEqual([]);

  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await page.getByRole('button', { name: /Open them/i }).click();
  await expect.poll(() => page.evaluate(() => window.__opened.length)).toBe(9);
});

test('an empty folder does nothing at all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.groups = [{ label: 'EMPTY', cols: 3, hidden: false, links: [] }];
    window.Aurora.saveConfig();
    window.Aurora.grid.render();
    window.__opened = [];
    window.open = url => { window.__opened.push(url); return null; };
  });
  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
  // And no dialog was raised for a folder with nothing in it.
  await expect(page.locator('.confirm-backdrop.open')).toHaveCount(0);
});
