/* Settings → Appearance → Page (layouts.css): the same page drawn six ways.
   Each layout is chosen, kept and marked on the page; each draws what it
   says it draws; arranging still happens on the board; and a command
   chooses one, with the page shown before Enter. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { DEMO_BOARD } = require('../helpers/demo-board.cjs');

const saved = nordlysPage => nordlysPage.storageState.nordlys_config || {};
const box = (locator) => locator.evaluate((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; });

async function choose(page, layout) {
  if (!(await page.locator('#cfg').isVisible())) await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await page.locator(`.page-layout-option[data-page-layout="${layout}"]`).click();
}

test('a layout is chosen in Appearance, kept, and marked on the page; the board has no mark', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await choose(page, 'columns');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'columns');
  await expect.poll(() => saved(nordlysPage).pageLayout).toBe('columns');
  await expect(page.locator('.page-layout-option[data-page-layout="columns"]')).toHaveAttribute('aria-checked', 'true');
  // The arrow keys move along the choices, and moving chooses.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'dock');
  await expect(page.locator('.page-layout-option[data-page-layout="dock"]')).toBeFocused();
  await choose(page, 'board');
  await expect(page.locator('html')).not.toHaveAttribute('data-page', /.*/);
  await expect.poll(() => saved(nordlysPage).pageLayout).toBe('board');
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test.describe('drawn', () => {
  test.describe('as columns', () => {
    test.use({ nordlysBoard: { ...DEMO_BOARD, pageLayout: 'columns' } });
    test('every bookmark is a row with its whole name, and a folder has no columns to resize', async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await expect(page.locator('html')).toHaveAttribute('data-page', 'columns');
      const tile = page.locator('#board .tile', { hasText: 'Kleinanzeigen' });
      const icon = await box(tile.locator('.box'));
      const name = await box(tile.locator('.lbl'));
      expect(icon.height).toBeLessThanOrEqual(26);
      expect(name.left, 'the name follows the icon on the same line').toBeGreaterThan(icon.right);
      expect(Math.abs((name.top + name.bottom) / 2 - (icon.top + icon.bottom) / 2)).toBeLessThan(4);
      expect(await tile.locator('.lbl').evaluate((node) => node.scrollWidth <= node.clientWidth), 'the whole name').toBe(true);
      await expect(page.locator('#board .card-resize-handle').first()).toBeHidden();
      // Names turned off under the icons still name the rows.
      await page.evaluate(() => { window.Nordlys.config.tileLabels = false; window.Nordlys.applyGeometryTokens(); });
      expect((await box(tile.locator('.lbl'))).width).toBeGreaterThan(40);
      expect(nordlysPage.runtimeErrors).toEqual([]);
    });
  });

  test.describe('as a dock', () => {
    test.use({ nordlysBoard: { ...DEMO_BOARD, pageLayout: 'dock' } });
    test('the bookmarks are one shelf at the foot of the page, and a name comes up at the pointer', async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      const shelf = await box(page.locator('#board'));
      expect(900 - shelf.bottom, 'at the foot of the window').toBeLessThan(80);
      expect(shelf.top, 'below the search').toBeGreaterThan((await box(page.locator('#searchwrap'))).bottom);
      await expect(page.locator('#board .cat').first()).toBeHidden();
      const tile = page.locator('#board .tile', { hasText: 'GitHub' });
      await expect(tile.locator('.lbl')).toHaveCSS('opacity', '0');
      await expect(page.getByRole('link', { name: 'GitHub' }), 'still named for a screen reader').toBeVisible();
      await tile.hover();
      await expect(tile.locator('.lbl')).toHaveCSS('opacity', '1');
      expect((await box(tile.locator('.lbl'))).bottom, 'over its icon').toBeLessThan((await box(tile.locator('.box'))).top);
      expect(nordlysPage.runtimeErrors).toEqual([]);
    });
  });

  for (const layout of ['prompt', 'poster']) {
    test.describe(`as ${layout}`, () => {
      test.use({ nordlysBoard: { ...DEMO_BOARD, pageLayout: layout } });
      test(`${layout} draws no board, and the bookmarks are a keystroke away`, async ({ nordlysPage }) => {
        const { page } = nordlysPage;
        await expect(page.locator('#board')).toBeHidden();
        await expect(page.locator('#hiddenDock')).toBeHidden();
        await expect(page.locator('#searchwrap')).toBeVisible();
        await page.keyboard.press('/');
        await expect(page.locator('#q')).toBeFocused();
        await page.keyboard.type('kleinanz');
        await expect(page.locator('#sugg')).toContainText('Kleinanzeigen');
        expect(nordlysPage.runtimeErrors).toEqual([]);
      });
    });
  }
});

test('Today turns the dashboard on and puts the folders beside it, in two columns', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await choose(page, 'today');
  await expect(page.locator('html')).toHaveAttribute('data-dashboard', '');
  await page.locator('#cfgx').click();
  await expect(page.locator('#dash')).toBeVisible();
  const dash = await box(page.locator('#dash'));
  const board = await box(page.locator('#board'));
  expect(board.left, 'beside the dashboard').toBeGreaterThan(dash.right);
  expect(Math.abs(board.top - dash.top)).toBeLessThan(2);
  expect(await page.locator('#board').evaluate((node) => getComputedStyle(node).columnCount)).toBe('2');
  // Narrow, it is Columns under the dashboard.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => (await box(page.locator('#board'))).top).toBeGreaterThan((await box(page.locator('#dash'))).bottom - 1);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test.describe('arranged', () => {
  test.use({ nordlysBoard: { ...DEMO_BOARD, pageLayout: 'poster' } });
  test('arranging is done on the board, and the layout comes back after', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await expect(page.locator('html')).toHaveAttribute('data-page', 'poster');
    await page.evaluate(() => window.Nordlys.grid.arrange.enter());
    await expect(page.locator('html')).not.toHaveAttribute('data-page', /.*/);
    await expect(page.locator('#board .card').first()).toBeVisible();
    await page.locator('#arrange-done').click();
    await expect(page.locator('html')).toHaveAttribute('data-page', 'poster');
    await expect(page.locator('#board')).toBeHidden();
    expect(saved(nordlysPage).pageLayout ?? 'poster', 'arranging never changed the choice').toBe('poster');
  });
});

test('a command shows the page before Enter keeps it, and Undo puts it back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const type = async (text) => { await page.locator('#q').click(); await page.locator('#q').fill(text); await page.waitForTimeout(220); };
  await type('>page dock');
  await expect(page.locator('#sugg .sugg-command').first()).toContainText('Dock');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'dock');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-page', /.*/);
  await type('>view col');
  await page.keyboard.press('Enter');
  await expect.poll(() => saved(nordlysPage).pageLayout).toBe('columns');
  await expect(page.locator('html')).toHaveAttribute('data-page', 'columns');
  await page.locator('#toast-dock .toast-action').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-page', /.*/);
  await expect.poll(() => saved(nordlysPage).pageLayout ?? 'board').toBe('board');
  expect(nordlysPage.runtimeErrors).toEqual([]);
});
