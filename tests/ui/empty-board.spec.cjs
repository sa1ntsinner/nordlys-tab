const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Deleting the last folder used to leave a beautiful, unusable page: no folders,
   no hint, and the only way forward buried three clicks deep in settings. */
test('an emptied board offers the way back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.groups = [];
    window.Aurora.saveConfig(); window.Aurora.grid.render();
  });

  const empty = page.locator('#board .board-empty');
  await expect(empty, 'an empty board must say so').toBeVisible();

  const add = empty.getByRole('button');
  await expect(add).toBeVisible();
  await add.click();

  await expect(page.locator('#board > .card')).toHaveCount(1);
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.length).toBe(1);
  await expect(empty, 'the prompt clears once there is something to show').toHaveCount(0);
});

test('the prompt stays away while folders exist, even hidden ones', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await expect(page.locator('#board .board-empty')).toHaveCount(0);
  await page.evaluate(() => {
    window.Aurora.config.groups.forEach(group => { group.hidden = true; });
    window.Aurora.saveConfig(); window.Aurora.grid.render();
  });
  // Everything is folded into the dock, which is a state the user chose — not
  // an empty board.
  await expect(page.locator('#board .board-empty')).toHaveCount(0);
  await expect(page.locator('#hiddenDock')).toBeVisible();
});
