const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

test.use({ nordlysBoard: NINE_FOLDERS, viewport: { width: 1600, height: 1000 } });

/* Size and spacing live where arranging happens, with the board itself as the
   preview: a few measures, each named for what it changes, and one Undo. */
async function openSize(page) {
  await page.mouse.click(40, 960, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await page.locator('#arrange-size').click();
  await expect(page.locator('#arrange-size-panel')).toBeVisible();
}
const config = page => page.evaluate(() => {
  const { tileSize, cardGap, boardGap, boardWidth, tileLabels } = window.Nordlys.config;
  return { tileSize, cardGap, boardGap, boardWidth, tileLabels };
});
const tileWidth = page => page.evaluate(() => document.querySelector('#board .tile .box').getBoundingClientRect().width);
const slide = (page, id, value) => page.evaluate(([id, value]) => {
  const input = document.getElementById(id);
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, value]);

test('the panel opens from the bar, says what the board is, and closes with Escape', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSize(page);
  await expect(page.locator('#arrange-size')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-tile="78"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-width="standard"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#arrange-size-reset')).toBeDisabled();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/claude-1000/-home-sa1ntsinner-Projects-nordlys-tab/8971dff3-53c0-4589-a4cb-ed204b0b21e6/scratchpad/size-panel.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#arrange-size-panel')).toBeHidden();
  await expect(page.locator('#arrange-bar')).toBeVisible();
  await expect(page.locator('#arrange-size')).toBeFocused();
});

test('bookmark size changes the board at once, and one Undo takes a whole drag back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSize(page);
  const before = await tileWidth(page);
  await page.locator('[data-tile="96"]').click();
  await expect.poll(() => tileWidth(page)).toBeGreaterThan(before + 8);
  expect((await config(page)).tileSize).toBe(96);

  // A drag through many values is one step back.
  const drag = await page.evaluate(() => {
    const input = document.getElementById('arrange-tile-size');
    for (const value of [90, 80, 70, 64]) { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return window.Nordlys.config.tileSize;
  });
  expect(drag).toBe(64);
  await expect(page.locator('.arrange-size-presets [data-tile][aria-checked="true"]')).toHaveCount(0);
  await page.locator('#arrange-undo').click();
  await expect.poll(async () => (await config(page)).tileSize).toBe(96);
  await page.locator('#arrange-undo').click();
  await expect.poll(async () => (await config(page)).tileSize).toBe(78);
});

test('spacing, width and names each do what they say, and Back to defaults undoes them all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSize(page);
  const gapOf = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#board .grid')).columnGap));
  const boardWidth = () => page.evaluate(() => document.getElementById('board').getBoundingClientRect().width);

  await slide(page, 'arrange-tile-gap', 24);
  expect(await gapOf()).toBeGreaterThan(20);
  await slide(page, 'arrange-folder-gap', 40);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('board')).getPropertyValue('--board-gap').trim())).toBe('40px');

  const standard = await boardWidth();
  await page.locator('[data-width="narrow"]').click();
  await expect.poll(boardWidth).toBeLessThan(standard - 100);

  await page.locator('label.tg:has(#arrange-names)').click();
  await expect(page.locator('#board .tile .lbl').first()).toHaveCSS('position', 'absolute');
  // Hidden from sight, not from a screen reader.
  await expect(page.locator('#board .tile').first()).toHaveAccessibleName(/YouTube/);

  expect(await config(page)).toEqual({ tileSize: 78, cardGap: 24, boardGap: 40, boardWidth: 'narrow', tileLabels: false });
  await page.locator('#arrange-size-reset').click();
  await expect.poll(() => config(page)).toEqual({ tileSize: 78, cardGap: 12, boardGap: undefined, boardWidth: 'standard', tileLabels: true });
  await expect(page.locator('#arrange-size-reset')).toBeDisabled();
  await page.locator('#arrange-undo').click();
  await expect.poll(async () => (await config(page)).boardWidth).toBe('narrow');
});

test('the Appearance sliders follow what was set while arranging', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openSize(page);
  await page.locator('[data-tile="60"]').click();
  await page.locator('#arrange-done').click();
  expect(await page.locator('#cfg-tile-size').inputValue()).toBe('60');
});
