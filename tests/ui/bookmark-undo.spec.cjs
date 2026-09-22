const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Deleting a bookmark from the board was the one destructive act in the product
   with nothing behind it: no confirm, no toast, no undo, nothing said out loud.
   The same act one tab away, in the bookmark manager, has offered an undo for
   releases. A destructive action that behaves differently depending on which
   door you came through is the thing that teaches people not to experiment.

   One seam: NordlysUI.showUndoToast. Not a second one. */

const TOAST = '#toast-dock .toast';
const UNDO = '#toast-dock .toast-action';

async function deleteFirstTile(page) {
  const tile = page.locator('#board .tile').first();
  const name = await tile.locator('.lbl').innerText();
  await tile.click({ button: 'right' });
  await page.locator('#tile-ctx-menu .ctx-item[data-action="delete"]').click();
  return name;
}

test('a bookmark deleted from the board can be brought back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await page.locator('#board .tile').count();
  const name = await deleteFirstTile(page);

  await expect(page.locator('#board .tile')).toHaveCount(before - 1);
  await expect(page.locator(UNDO)).toBeVisible();
  await expect(page.locator(TOAST).filter({ hasText: name })).toBeVisible();

  await page.locator(UNDO).click();
  await expect(page.locator('#board .tile')).toHaveCount(before);
  expect(await page.locator('#board .tile').first().locator('.lbl').innerText()).toBe(name);
});

/* Persisted before the toast is shown, so a reload during the five seconds
   keeps the deletion; taken back, it is persisted again. Either way what is on
   screen and what is in storage agree. */
test('undo puts the bookmark back in storage, not only on screen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const name = await deleteFirstTile(page);
  const gone = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups[0].links.map(link => link.name));
  expect(gone).not.toContain(name);

  await page.locator(UNDO).click();
  const back = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).groups[0].links.map(link => link.name));
  expect(back[0]).toBe(name);
});

test('the deletion and the recovery are both said out loud', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const name = await deleteFirstTile(page);
  await expect(page.locator('#nl-live-region')).toHaveText(new RegExp(name));
  await page.locator(UNDO).click();
  await expect(page.locator('#nl-live-region')).toHaveText(new RegExp(name));
});

/* The menu hands focus back to the tile it was opened from, and that tile is
   the one being removed — so without this, focus lands on <body> and a keyboard
   user has to start the board again from the top. */
test('focus lands on the next bookmark after a delete, and on the restored one after undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const second = await page.locator('#board .tile').nth(1).locator('.lbl').innerText();
  await deleteFirstTile(page);
  expect(await page.evaluate(() => document.activeElement?.closest('.tile')?.querySelector('.lbl')?.textContent)).toBe(second);

  await page.evaluate(() => document.querySelector('#toast-dock .toast-action').click());
  expect(await page.evaluate(() => document.activeElement?.classList.contains('tile'))).toBe(true);
});

test('deleting the last bookmark in a folder leaves focus on the folder, not on nothing', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups = [{ label: 'ONLY', cols: 2, hidden: false, links: [{ name: 'Alone', url: 'https://alone.test/', color: '#79bd03', icon: 'globe' }] }];
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await deleteFirstTile(page);
  await expect(page.locator('#board .tile')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.closest('.card') !== null)).toBe(true);
});

/* Recovery is a control, so it has to be reachable by the two things people
   use: a pointer and the Tab key. The dock sets pointer-events: none so a toast
   never blocks the board behind it, which for five releases also meant the one
   button in the product that undoes a deletion could not be pressed. */
test('the undo control can actually be pressed', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await deleteFirstTile(page);
  const undo = page.locator(UNDO);
  expect(await undo.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('auto');
  const box = await undo.boundingBox();
  const hit = await page.evaluate(([x, y]) => {
    const node = document.elementFromPoint(x, y);
    return node?.classList.contains('toast-action') || Boolean(node?.closest('.toast-action'));
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit, 'the point at the centre of the button belongs to the button').toBe(true);
  await undo.focus();
  expect(await page.evaluate(() => document.activeElement?.classList.contains('toast-action'))).toBe(true);
});

/* Three ordinary notices used to evict it before its five seconds were up, and
   a long bookmark name used to ellipsise it away — both on the only path back. */
test('ordinary notices cannot push the undo out of the dock', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await deleteFirstTile(page);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) NordlysToast.show(`Notice ${i}`, 'info', 4000); });
  await expect(page.locator(UNDO)).toBeVisible();
  await expect(page.locator('#toast-dock > *')).toHaveCount(3);
});

test('a long name cannot squeeze the undo control away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.groups[0].links[0].name = 'A bookmark with a name long enough to run past the whole width of the toast and then some';
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  });
  await deleteFirstTile(page);
  const width = await page.locator(UNDO).evaluate(node => node.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(30);
});

test('at 320px the undo stays inside the viewport', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 640 });
  await deleteFirstTile(page);
  const box = await page.locator(UNDO).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});
