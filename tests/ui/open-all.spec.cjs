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
    window.Nordlys.config.groups = [{
      label: 'SHORT', cols: 3, hidden: false, links: [
        { name: 'One', url: 'https://one.test/', icon: 'globe', color: '#7c9cff' },
        { name: 'Two', url: 'https://two.test/', icon: 'globe', color: '#7c9cff' }
      ]
    }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });

  // The fixture's chrome.tabs counts the openings without opening anything.
  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await expect.poll(() => page.evaluate(() => window.__tabs?.created)).toEqual([
    'https://one.test/', 'https://two.test/'
  ]);
});

/* Opening twenty tabs is not something a page should be able to do quietly on
   one click of a menu item the user may have hit by accident. */
test('a large folder asks first, and takes no for an answer', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{
      label: 'MANY', cols: 4, hidden: false,
      links: Array.from({ length: 9 }, (unused, index) => ({
        name: `Link ${index}`, url: `https://many-${index}.test/`, icon: 'globe', color: '#7c9cff'
      }))
    }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });

  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await expect(page.getByText(/Open 9 tabs\?/)).toBeVisible();
  await page.getByRole('button', { name: /Cancel/i }).click();
  expect(await page.evaluate(() => window.__tabs?.created || []), 'declining opens nothing').toEqual([]);

  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await page.getByRole('button', { name: /Open them/i }).click();
  await expect.poll(() => page.evaluate(() => window.__tabs?.created?.length)).toBe(9);
});

test('an empty folder does nothing at all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{ label: 'EMPTY', cols: 3, hidden: false, links: [] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
    window.__opened = [];
    window.open = url => { window.__opened.push(url); return null; };
  });
  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [window.__tabs?.created || [], window.__opened])).toEqual([[], []]);
  // And no dialog was raised for a folder with nothing in it.
  await expect(page.locator('.confirm-backdrop.open')).toHaveCount(0);
});

/* Where the browser has tab groups, the folder opens as one, under its name. */
test('with tab groups, the folder opens as a group named after it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{
      label: 'READING', cols: 3, hidden: false, links: [
        { name: 'One', url: 'https://one.test/', icon: 'globe', color: '#7c9cff' },
        { name: 'Two', url: 'https://two.test/', icon: 'globe', color: '#7c9cff' }
      ]
    }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
    window.__opened = [];
    window.open = url => { window.__opened.push(url); return null; };
    let next = 40;
    window.chrome.tabs.create = (details) => { (window.__created ||= []).push(details); return Promise.resolve({ id: next++, ...details }); };
    window.chrome.tabs.group = ({ tabIds }) => { window.__grouped = tabIds; return Promise.resolve(7); };
    window.chrome.tabGroups = { update: (id, details) => { window.__named = [id, details.title]; return Promise.resolve(); } };
  });
  await openFolderMenu(page);
  await page.locator('#folder-ctx-menu [data-action="open-all"]').click();
  await expect.poll(() => page.evaluate(() => window.__named)).toEqual([7, 'READING']);
  expect(await page.evaluate(() => [window.__created.map((tab) => [tab.url, tab.active]), window.__grouped, window.__opened])).toEqual([
    [['https://one.test/', true], ['https://two.test/', false]], [40, 41], []
  ]);
});
