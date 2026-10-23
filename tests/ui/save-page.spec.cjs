/* The toolbar button (popup.html) saves the page in view into a folder, and
   the right-click item does the same without one. Neither writes the board:
   what they save waits in nordlys_inbox until a new tab takes it, so a board
   open in another tab is never written over. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openPopup(page, origin, tab) {
  await page.addInitScript((tab) => {
    window.__tabs = { list: [tab] };
    // A popup closes itself when it is done; here it only says so.
    window.close = () => { window.__closed = true; };
  }, tab);
  await page.goto(`${origin}/popup.html`);
}

test('the page in view is saved to a chosen folder and lands there on the next new tab', async ({ nordlysPage }) => {
  const { page, origin, storageState } = nordlysPage;
  const folders = await page.evaluate(() => window.Nordlys.config.groups.filter((group) => !group.source?.folderId).map((group) => group.label));
  await openPopup(page, origin, { id: 3, active: true, title: 'A page worth keeping', url: 'https://keep.example/article', favIconUrl: '' });
  await expect(page.locator('#save-name')).toHaveValue('A page worth keeping');
  await expect(page.locator('#save-host')).toHaveText('keep.example');
  await expect(page.locator('#save-folder option')).toHaveText(folders);
  await page.locator('#save-folder').selectOption({ label: folders[1] });
  await page.locator('#save-name').fill('Worth keeping');
  await page.locator('#save-go').click();
  await expect(page.locator('#save-said')).toHaveText(`Saved to ${folders[1]}.`);
  await expect.poll(() => page.evaluate(() => window.__closed)).toBe(true);
  expect(storageState.nordlys_inbox.map(({ url, name }) => ({ url, name }))).toEqual([{ url: 'https://keep.example/article', name: 'Worth keeping' }]);

  await page.goto(`${origin}/newtab.html`);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect.poll(() => page.evaluate((label) => window.Nordlys.config.groups.find((group) => group.label === label).links.at(-1)?.name, folders[1])).toBe('Worth keeping');
  await expect(page.locator('#toast-dock')).toContainText(`Saved pages added to ${folders[1]}`);
  expect(storageState.nordlys_inbox).toBeUndefined();
  // Taken once: the next new tab finds nothing waiting and adds nothing.
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate((label) => window.Nordlys.config.groups.find((group) => group.label === label).links.filter((link) => link.url === 'https://keep.example/article').length, folders[1])).toBe(1);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('a page already in the folder, or not a web page, is not saved', async ({ nordlysPage }) => {
  const { page, origin, storageState } = nordlysPage;
  const first = await page.evaluate(() => window.Nordlys.config.groups[0]);
  await openPopup(page, origin, { id: 3, active: true, title: first.links[0].name, url: first.links[0].url });
  await page.locator('#save-folder').selectOption({ label: first.label });
  await page.locator('#save-go').click();
  await expect(page.locator('#save-said')).toHaveText(`Already in ${first.label}.`);
  expect(storageState.nordlys_inbox).toBeUndefined();

  // The later init script is the one that counts.
  await openPopup(page, origin, { id: 4, active: true, title: 'Settings', url: 'chrome://settings/' });
  await expect(page.locator('#save-form')).toBeHidden();
  await expect(page.locator('#save-said')).toHaveText('Only a web page can go on the board.');
});

test('what the right-click item saved goes to the first folder, once, with the address as its name if it has none', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const first = await page.evaluate(() => window.Nordlys.config.groups.find((group) => !group.source?.folderId).label);
  await page.evaluate(() => new Promise((done) => chrome.storage.local.set({ nordlys_inbox: [
    { url: 'https://www.cited.example/', name: '', folder: null, at: 1 },
    { url: 'https://www.cited.example/', name: 'Twice', folder: null, at: 2 },
    { url: 'javascript:alert(1)', name: 'Bad', folder: null, at: 3 }
  ] }, done)));
  // Taken when a new tab comes into view.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => page.evaluate((label) => window.Nordlys.config.groups.find((group) => group.label === label).links.filter((link) => link.url.includes('cited.example')).map((link) => link.name), first)).toEqual(['cited.example']);
  expect(await page.evaluate(() => JSON.stringify(window.Nordlys.config.groups).includes('javascript:'))).toBe(false);
});
