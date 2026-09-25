const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

/* The chrome used now and then — the folders somebody folded away, the notice
   that offers an Undo — sat in the middle of the page in an older kind of
   glass: a pill of blurred chips under the board, and a notice that came up on
   top of it. Folded folders now wait as one quiet mark under the board and
   open into chips of the same glass as the gear and the fit switch; notices
   come up in the bottom left corner, where nothing else is. */

async function fold(page, count = 2) {
  await page.evaluate((count) => {
    window.Nordlys.config.groups.slice(-count).forEach((group) => { group.hidden = true; });
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  }, count);
}

const look = (page) => page.evaluate(() => {
  const dock = document.getElementById('hiddenDock');
  const mark = dock.querySelector('.dock-fold');
  const chips = [...dock.querySelectorAll('.restoreFolder')];
  const style = (node) => getComputedStyle(node);
  return {
    mark: mark ? { opacity: Number(style(mark).opacity), text: mark.textContent.trim(), shown: mark.getClientRects().length > 0 } : null,
    chips: chips.map((chip) => Number(style(chip).opacity)),
    glass: style(dock).backgroundColor,
    blur: style(dock).backdropFilter,
    chip: chips[0] ? { radius: style(chips[0]).borderRadius, background: style(chips[0]).backgroundColor } : null,
    gear: { radius: style(document.getElementById('gear')).borderRadius },
    hidden: window.Nordlys.config.groups.filter((group) => group.hidden).length
  };
});
const transparent = (colour) => colour === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(colour);
// The mark sits in the middle of the dock; only there does the closed dock answer the pointer.
async function atMark(page, how = 'hover') {
  const dock = page.locator('#hiddenDock');
  const box = await dock.boundingBox();
  await dock[how]({ position: { x: box.width / 2, y: box.height / 2 } });
}

test.describe('folded folders', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  test('wait as one quiet mark under the board, with no glass of their own', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await fold(page);
    await page.mouse.move(5, 5);
    await expect(page.locator('#hiddenDock')).toBeVisible();
    await expect.poll(async () => Math.max(...(await look(page)).chips)).toBe(0);
    const rest = await look(page);
    expect(rest.mark?.shown, 'the mark is there').toBe(true);
    expect(rest.mark.text, 'it says how many are folded').toContain('2');
    expect(rest.mark.opacity).toBeGreaterThan(0.3);
    expect(rest.mark.opacity).toBeLessThan(0.85);
    expect(transparent(rest.glass), `the dock has no pill of its own: ${rest.glass}`).toBe(true);
    expect(rest.blur === 'none' || rest.blur === '', `nothing is blurred behind it: ${rest.blur}`).toBe(true);
  });

  test('open at a pointer into chips of the chrome\'s own glass, and a chip brings its folder back', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await fold(page);
    await atMark(page);
    await expect.poll(async () => Math.min(...(await look(page)).chips)).toBe(1);
    const open = await look(page);
    expect(open.mark.opacity, 'the mark gives way to the chips').toBeLessThan(0.05);
    expect(open.chip.radius, 'shaped like the gear and the switch').toBe(open.gear.radius);
    expect(transparent(open.chip.background)).toBe(false);
    await page.locator('#hiddenDock .restoreFolder').first().click();
    await expect.poll(async () => (await look(page)).hidden).toBe(1);
  });

  test('open for the keyboard as they do for a pointer', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await fold(page);
    await page.locator('#hiddenDock .restoreFolder').first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(async () => Math.min(...(await look(page)).chips)).toBe(1);
  });
});

test.describe('folded folders on a touch screen', () => {
  test.use({ nordlysBoard: NINE_FOLDERS, hasTouch: true });

  test('the first tap opens the mark and brings nothing back', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await fold(page);
    await atMark(page, 'tap');
    await expect.poll(async () => Math.min(...(await look(page)).chips)).toBe(1);
    expect((await look(page)).hidden, 'still folded').toBe(2);
    await page.locator('#hiddenDock .restoreFolder').first().tap();
    await expect.poll(async () => (await look(page)).hidden).toBe(1);
  });
});

test.describe('an Undo', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  for (const [width, height] of [[1440, 900], [1024, 700], [390, 844]]) {
    test(`comes up in the bottom left corner, clear of the dock and the gear, at ${width}×${height}`, async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await page.setViewportSize({ width, height });
      await fold(page);
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
      await page.evaluate(() => window.NordlysUI.showUndoToast({ message: 'Board arranged', duration: 60000, onAction() {} }));
      const toast = page.locator('#toast-dock .toast').first();
      await expect(toast).toBeVisible();
      const box = await toast.boundingBox();
      expect(box.x, 'at the left').toBeLessThanOrEqual(32);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, 'at the bottom').toBeGreaterThan(height - 48);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const meets = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      const gear = await page.locator('#gear').boundingBox();
      expect(meets(box, gear), 'on the gear').toBe(false);
      const dock = await page.locator('#hiddenDock .dock-fold').boundingBox();
      if (dock) expect(meets(box, dock), 'on the folded folders').toBe(false);
    });
  }
});
