const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* One affordance for both input methods. The two stepper buttons are gone, so the
   drag handle itself has to carry the keyboard path — otherwise removing them
   would quietly drop column resizing for anyone not using a mouse. */
test('the folder resize handle is a single control for pointer and keyboard', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const card = page.locator('#board > .card').first();
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
  const card = page.locator('#board > .card').first();
  await card.locator('[role="slider"]').focus();

  const moved = await page.evaluate(async () => {
    const grid = document.querySelector('#board > .card .grid');
    document.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    document.querySelector('#board > .card [role="slider"]')
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
