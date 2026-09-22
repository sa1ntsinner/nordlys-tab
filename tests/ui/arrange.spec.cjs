const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

test.use({ nordlysBoard: NINE_FOLDERS, viewport: { width: 2000, height: 1115 } });

// The board as drawn: each row's folder names, top to bottom.
const rows = page => page.evaluate(() => [...document.querySelectorAll('#board > .board-row')]
  .map(row => [...row.querySelectorAll('.card .cat b')].map(b => b.textContent)));
const boxes = page => page.evaluate(() => [...document.querySelectorAll('#board > .board-row')]
  .map(row => [...row.querySelectorAll('.card')].map(card => {
    const r = card.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  })));
const card = (page, name) => page.locator('#board .card', { has: page.locator('.cat b', { hasText: new RegExp(`^${name}$`) }) });
const said = page => page.evaluate(() => document.getElementById('nl-live-region')?.textContent || '');

async function arrange(page) {
  await page.mouse.click(40, 1000, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  await expect(page.locator('#arrange-bar')).toBeVisible();
}

/* Picks a folder up by its name and lets go at a point, the way a hand does:
   press, a small move to lift it, then the journey. */
async function carry(page, locator, x, y) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2 + 12, { steps: 3 });
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(420);
}

test('rows that have to wrap come out even, not a full row and a stub', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const drawn = await rows(page);
  expect(drawn.map(row => row.length)).toEqual([5, 4]);
  const widths = (await boxes(page)).map(row => row[row.length - 1].right - row[0].left);
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(160);
});

test('Fitted runs every row edge to edge, with folders of one height', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.boardLayout = 'fitted'; window.Nordlys.grid.render(); });
  const board = await page.locator('#board').boundingBox();
  for (const row of await boxes(page)) {
    expect(Math.abs(row[0].left - board.x)).toBeLessThan(1.5);
    expect(Math.abs(row[row.length - 1].right - (board.x + board.width))).toBeLessThan(1.5);
    for (const box of row) expect(Math.abs((box.bottom - box.top) - (row[0].bottom - row[0].top))).toBeLessThan(1.5);
  }
  // A folder with a single bookmark centres it rather than leaving it in a corner.
  const read = await card(page, 'Read').boundingBox();
  const tile = await card(page, 'Read').locator('.tile').boundingBox();
  expect(Math.abs((tile.x + tile.width / 2) - (read.x + read.width / 2))).toBeLessThan(3);
});

test('arranging shows the board as rows and takes the tiles out of the way', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await arrange(page);
  await expect(page.locator('body')).toHaveClass(/arranging/);
  await expect(page.locator('.arrange-layout[aria-checked="true"]')).toHaveAttribute('data-layout', 'natural');
  expect(await page.evaluate(() => [...document.querySelectorAll('#board .tile')].every(tile => tile.tabIndex === -1))).toBe(true);
  // A tile does not open while arranging.
  const url = page.url();
  await card(page, 'Work').locator('.tile').first().click();
  expect(page.url()).toBe(url);
  // The hint says what the control under the pointer does.
  await page.locator('.arrange-layout[data-layout="fitted"]').hover();
  await expect(page.locator('#arrange-hint')).toContainText(/edge to edge/);
  const results = await new AxeBuilder({ page }).include('#arrange-bar').analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#arrange-bar')).toBeHidden();
  expect(await page.evaluate(() => document.querySelectorAll('#board .tile[tabindex="0"]').length)).toBeGreaterThan(0);
});

test('a folder dropped between two rows starts a row of its own', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await arrange(page);
  const [top, bottom] = await page.evaluate(() => [...document.querySelectorAll('#board > .board-row')].map(row => row.getBoundingClientRect()).map(r => ({ top: r.top, bottom: r.bottom })));
  const coding = card(page, 'Coding').locator('.cat b');
  const box = await coding.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 20, { steps: 3 });
  await page.mouse.move(1000, (top.bottom + bottom.top) / 2, { steps: 10 });
  await page.waitForTimeout(120);
  // While it is in hand the board holds still and says where it will go.
  await expect(page.locator('.board-marker.is-row')).toBeVisible();
  await expect(page.locator('.board-marker-label')).toHaveText('New row');
  await page.mouse.up();
  await page.waitForTimeout(420);
  expect(await rows(page)).toEqual([['Watch', 'Studies', 'AI', 'Work', 'Gaming'], ['Coding'], ['Read', 'Shopping', 'Misc']]);
  const stored = await page.evaluate(() => window.Nordlys.config.groups.map(g => [g.label, g.row]));
  expect(stored.map(([, row]) => row)).toEqual([0, 0, 0, 0, 0, 1, 2, 2, 2]);
  // The arrangement's own Undo puts it back.
  await page.locator('#arrange-undo').click();
  await page.waitForTimeout(300);
  expect((await rows(page)).map(row => row.length)).toEqual([5, 4]);
});

test('a folder dropped into a gap joins that row there', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const ai = await card(page, 'AI').boundingBox();
  const work = await card(page, 'Work').boundingBox();
  // Outside arranging too: the header picks the folder up.
  await carry(page, card(page, 'Misc').locator('.cat b'), (ai.x + ai.width + work.x) / 2, ai.y + ai.height / 2);
  expect((await rows(page))[0]).toEqual(['Watch', 'Studies', 'AI', 'Misc', 'Work', 'Gaming']);
  await expect(page.locator('#toast-dock')).toContainText('Misc moved');
  await page.locator('#toast-dock button', { hasText: 'Undo' }).click();
  await page.waitForTimeout(300);
  expect((await rows(page))[0]).toEqual(['Watch', 'Studies', 'AI', 'Work', 'Gaming']);
});

test('Escape while carrying a folder puts it back where it was', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await rows(page);
  const box = await card(page, 'Gaming').locator('.cat b').boundingBox();
  await page.mouse.move(box.x + 6, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 300, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await rows(page)).toEqual(before);
  await expect(page.locator('.drag-lift')).toHaveCount(0);
});

test('from the keyboard: the grip opens the arrangement and the arrows move the folder', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await card(page, 'Misc').locator('.groupGrip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveClass(/arranging/);
  await expect(card(page, 'Misc').locator('.groupGrip')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  expect((await rows(page))[0]).toContain('Misc');
  await expect(card(page, 'Misc').locator('.groupGrip')).toBeFocused();
  expect(await said(page)).toMatch(/Misc: row 1, position \d of 6/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  expect((await rows(page)).at(-1)).toEqual(['Misc']);
  expect(await said(page)).toMatch(/row 3, position 1 of 1/);
});

test('Tidy up puts folders of one height on one row', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await arrange(page);
  await page.locator('.arrange-layout[data-layout="fitted"]').click();
  await page.locator('#arrange-tidy').click();
  await page.waitForTimeout(400);
  expect(await rows(page)).toEqual([['Watch', 'Studies', 'AI', 'Gaming', 'Coding'], ['Work', 'Read', 'Shopping', 'Misc']]);
  const heights = (await boxes(page)).map(row => row.map(box => Math.round(box.bottom - box.top)));
  for (const row of heights) expect(new Set(row).size).toBe(1);
  // Rows made this way are the user's; handing them back is one button.
  await expect(page.locator('#arrange-auto')).toBeVisible();
  await page.locator('#arrange-auto').click();
  expect(await page.evaluate(() => window.Nordlys.config.groups.some(g => 'row' in g))).toBe(false);
  // Done leaves a way back to the board as it was before arranging.
  await page.locator('#arrange-done').click();
  await expect(page.locator('#toast-dock')).toContainText('Board arranged');
  await page.locator('#toast-dock button', { hasText: 'Undo' }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [window.Nordlys.config.boardLayout, window.Nordlys.config.groups.map(g => g.label).join()]))
    .toEqual(['natural', 'Watch,Studies,AI,Work,Gaming,Read,Shopping,Misc,Coding']);
});

test('a bookmark carried to another folder makes room as it goes, and lands', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const netflix = page.locator('#board .tile', { hasText: 'Netflix' });
  const x = card(page, 'Read').locator('.tile').first();
  const from = await netflix.boundingBox();
  const to = await x.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 30);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 42, { steps: 3 });
  await page.mouse.move(to.x + to.width + 30, to.y + 30, { steps: 14 });
  await page.waitForTimeout(150);
  // The hole is already in the folder under the pointer.
  expect(await page.evaluate(() => document.querySelector('.tile.drag-source')?.closest('.card')?.querySelector('.cat b')?.textContent)).toBe('Read');
  await page.mouse.up();
  await page.waitForTimeout(400);
  const links = await page.evaluate(() => Object.fromEntries(window.Nordlys.config.groups.map(g => [g.label, g.links.map(l => l.name)])));
  expect(links.Watch).toEqual(['YouTube', 'Vimeo']);
  expect(links.Read).toEqual(['X', 'Netflix']);
  await expect(page.locator('#toast-dock')).toContainText('Netflix moved to Read');
  // A plain click still opens a bookmark once the drag is over.
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.Nordlys.grid.justDragged)).toBe(false);
});

test('a folder that follows the browser refuses a carried bookmark', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.groups[5].source = { type: 'browser', folderId: '9', title: 'Read' }; window.Nordlys.grid.render(); });
  const vimeo = await page.locator('#board .tile', { hasText: 'Vimeo' }).boundingBox();
  const target = await card(page, 'Read').boundingBox();
  await page.mouse.move(vimeo.x + 30, vimeo.y + 30);
  await page.mouse.down();
  await page.mouse.move(vimeo.x + 44, vimeo.y + 44, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.waitForTimeout(120);
  await expect(card(page, 'Read')).toHaveClass(/drop-refused/);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const links = await page.evaluate(() => window.Nordlys.config.groups.map(g => g.links.length));
  expect(links).toEqual([3, 4, 4, 2, 6, 1, 2, 1, 7]);
});

test('Settings shows the layout and opens the arrangement on the board', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await expect(page.locator('#board-rows-state')).toContainText('chosen by the board');
  await page.locator('.board-layout-option[data-layout="fitted"]').click();
  expect(await page.evaluate(() => [window.Nordlys.config.boardLayout, document.getElementById('board').dataset.layout])).toEqual(['fitted', 'fitted']);
  await page.locator('#cfg-arrange').click();
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await expect(page.locator('#cfg')).not.toHaveClass(/open/);
  await expect(page.locator('.arrange-layout[data-layout="fitted"]')).toHaveAttribute('aria-checked', 'true');
});

test('"> arrange" opens the arrangement', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#q').click();
  await page.locator('#q').fill('>arrange');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/searching/);
});

test('the Spacing setting moves the tiles and the folders apart', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const measure = () => page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#board .card')][0].querySelectorAll('.tile');
    const cards = [...document.querySelectorAll('#board .board-row')][0].querySelectorAll('.card');
    return { tiles: tiles[1].getBoundingClientRect().left - tiles[0].getBoundingClientRect().right, folders: cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().right };
  });
  const before = await measure();
  await page.evaluate(() => { window.Nordlys.config.cardGap = 24; window.Nordlys.applyGeometryTokens(); window.Nordlys.grid.relayout(); });
  const after = await measure();
  expect(after.tiles - before.tiles).toBeCloseTo(12, 0);
  expect(after.folders - before.folders).toBeCloseTo(12, 0);
});

test('while arranging, a wider folder and a folded one are each one step of Undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await arrange(page);
  const handle = card(page, 'Work').locator('.card-resize-handle');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.Nordlys.config.groups.find(g => g.label === 'Work').cols)).toBe(3);
  await card(page, 'Misc').locator('.foldBtn').click();
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.Nordlys.config.groups.find(g => g.label === 'Misc').hidden)).toBe(true);
  await page.locator('#arrange-undo').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.Nordlys.config.groups.find(g => g.label === 'Misc').hidden)).toBeFalsy();
  await page.locator('#arrange-undo').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.Nordlys.config.groups.find(g => g.label === 'Work').cols)).toBe(2);
  await expect(page.locator('#arrange-undo')).toBeDisabled();
});
