const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* One affordance for both input methods. The two stepper buttons are gone, so the
   drag handle itself has to carry the keyboard path — otherwise removing them
   would quietly drop column resizing for anyone not using a mouse. */
test('the folder resize handle is a single control for pointer and keyboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const card = page.locator('#board .card').first();
  expect(await card.locator('.card-resize-controls').count(), 'the stepper buttons are gone').toBe(0);

  const handle = card.locator('[role="slider"]');
  await expect(handle).toHaveAttribute('aria-valuenow', '4');
  await expect(handle).toHaveAttribute('aria-valuemin', '1');
  await expect(handle).toHaveAttribute('aria-valuemax', '8');
  expect(await handle.getAttribute('aria-label')).toMatch(/DAILY/i);

  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(card.locator('.grid')).toHaveAttribute('data-cols', '5');
  await expect(handle).toHaveAttribute('aria-valuenow', '5');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.[0]?.cols).toBe(5);
  await expect(page.locator('#nl-live-region')).toContainText('5 columns');

  await page.keyboard.press('Home');
  await expect(card.locator('.grid')).toHaveAttribute('data-cols', '1');
  await page.keyboard.press('End');
  await expect(card.locator('.grid')).toHaveAttribute('data-cols', '8');
  // The stored bounds hold: pressing past the end must not run away.
  await page.keyboard.press('ArrowRight');
  await expect(card.locator('.grid')).toHaveAttribute('data-cols', '8');
});

test('resizing a folder animates the tiles to their new places', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const card = page.locator('#board .card').first();
  await card.locator('[role="slider"]').focus();

  const moved = await page.evaluate(async () => {
    const grid = document.querySelector('#board .card .grid');
    document.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    document.querySelector('#board .card [role="slider"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const running = grid.getAnimations({ subtree: true });
    return running.map(animation => ({
      properties: animation.effect.getKeyframes().flatMap(frame => Object.keys(frame))
        .filter(key => !['offset', 'composite', 'computedOffset', 'easing'].includes(key)),
      duration: animation.effect.getTiming().duration
    }));
  });

  expect(moved.length, 'tiles should animate rather than jump').toBeGreaterThan(0);
  for (const animation of moved) {
    // Reflow rides on the compositor only, and stays inside the panel budget.
    expect(animation.properties.filter(property => property !== 'transform')).toEqual([]);
    expect(animation.duration).toBeLessThanOrEqual(280);
  }
});

/* Alt+1 to Alt+9 are the first nine tiles on the board in reading order, not
   the first nine of the first folder: a board that opens with a two-bookmark
   folder used to leave seven chords doing nothing. */
test('Alt+digit reaches past the first folder, and holding Alt shows the numbers', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const numbered = await page.locator('#board .tile[data-shortcut]').evaluateAll(tiles => tiles.map(tile => ({
    n: tile.dataset.shortcut, name: tile.querySelector('.lbl')?.textContent, keys: tile.getAttribute('aria-keyshortcuts')
  })));
  expect(numbered.map(tile => tile.n)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  // The demo board's first folder holds eight, so nine is the second folder's first.
  expect(numbered[8]).toEqual({ n: '9', name: 'GitHub', keys: 'Alt+9' });

  await page.keyboard.down('Alt');
  await expect(page.locator('body')).toHaveClass(/alt-held/);
  const badge = await page.locator('#board .tile[data-shortcut="9"]').evaluate(tile => getComputedStyle(tile, '::after').content);
  expect(badge).toBe('"9"');
  await page.keyboard.up('Alt');
  await expect(page.locator('body')).not.toHaveClass(/alt-held/);

  // The chord is the tile's own click.
  await page.evaluate(() => {
    window.__opened = [];
    document.querySelector('#board .tile[data-shortcut="9"]').addEventListener('click', event => {
      event.preventDefault();
      window.__opened.push(event.currentTarget.getAttribute('href'));
    });
  });
  await page.keyboard.press('Alt+Digit9');
  expect(await page.evaluate(() => window.__opened)).toEqual(['https://github.com/']);
});

/* The board from the keyboard: each folder is one stop for Tab, arrows move by
   where the tiles sit, and Alt+Shift+Arrow carries a bookmark the way a drag
   would. Twenty-two tiles used to be twenty-two presses of Tab to get past. */
test('each folder is one Tab stop, arrows walk its tiles, and Alt+Shift carries one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const focused = () => page.evaluate(() => document.activeElement?.querySelector?.('.lbl')?.textContent || document.activeElement?.className);
  const stops = await page.locator('#board .card').evaluateAll(cards => cards.map(card => card.querySelectorAll('.tile[tabindex="0"]').length));
  expect(stops.every(count => count === 1), `one tabbable tile per folder: ${stops}`).toBe(true);

  // The skip link is the first thing Tab reaches on the page, and lands on the
  // first bookmark.
  const first = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .find(node => node.tabIndex >= 0 && !node.disabled)?.className);
  expect(first).toBe('skip-link');
  await page.locator('.skip-link').focus();
  await expect(page.locator('.skip-link')).toBeVisible();
  await page.keyboard.press('Enter');
  expect(await focused()).toBe('YouTube');

  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('Notion');
  await page.keyboard.press('ArrowDown');
  expect(await focused()).toBe('Spotify'); // the Daily folder is four across
  await page.keyboard.press('End');
  expect(await focused()).toBe('Netflix');
  await page.keyboard.press('Home');
  expect(await focused()).toBe('YouTube');

  // Carrying YouTube one place right swaps it with Notion, and focus goes with it.
  await page.keyboard.press('Alt+Shift+ArrowRight');
  expect(await focused()).toBe('YouTube');
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links.slice(0, 2).map(link => link.name))).toEqual(['Notion', 'YouTube']);
  await expect(page.locator('#nl-live-region')).toHaveText(/YouTube.*2/);
});
