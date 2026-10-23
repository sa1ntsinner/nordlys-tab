/* A link dragged onto a folder from a page or the address bar, or an
   address pasted with nothing else in hand, becomes a bookmark there, with
   a way back. Tiles move by arranging, so only addresses come in this way. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

const links = (page, index) => page.evaluate((index) => window.Nordlys.config.groups[index].links.map((link) => link.name), index);

test('a link dropped on a folder goes in where it was dropped, named by its words', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await links(page, 0);
  await page.evaluate(() => {
    const tile = document.querySelectorAll('#board .card')[0].querySelectorAll('.tile')[1];
    const data = new DataTransfer();
    data.setData('text/uri-list', 'https://dropped.example/page');
    data.setData('text/html', '<a href="https://dropped.example/page">Dropped page</a>');
    tile.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
    window.__dropping = tile.closest('.card').classList.contains('dropping');
    tile.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  expect(await page.evaluate(() => window.__dropping)).toBe(true);
  expect(await links(page, 0)).toEqual([before[0], 'Dropped page', ...before.slice(1)]);
  await expect(page.locator('#board .card').first().locator('.tile .lbl', { hasText: 'Dropped page' })).toBeVisible();
  await expect(page.locator('#board .card.dropping')).toHaveCount(0);
  await page.locator('#toast-dock button', { hasText: 'Undo' }).click();
  expect(await links(page, 0)).toEqual(before);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('an address pasted goes into the folder in hand; in a text field it is only text', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Pasted where the keyboard is, as Ctrl+V does.
  const paste = (text) => page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, text);
  const second = await links(page, 1);
  await page.locator('#board .card').nth(1).locator('.tile').first().focus();
  await paste('https://www.pasted.example/');
  expect(await links(page, 1)).toEqual([...second, 'pasted.example']);
  await expect(page.locator('#board .card').nth(1).locator('.tile').last()).toBeFocused();
  // Not an address, or not one that opens a page: nothing.
  await paste('just some words');
  await paste('javascript:alert(1)');
  // In the search box it is what the box gets.
  await page.locator('#q').focus();
  await paste('https://typed.example/');
  expect(await links(page, 1)).toEqual([...second, 'pasted.example']);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
