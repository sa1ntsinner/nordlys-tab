const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('folder resize steppers share the stored column bounds and announce changes', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const card = page.locator('#board > .card').first();
  const decrement = card.getByRole('button', { name: /Decrease columns/ }); const increment = card.getByRole('button', { name: /Increase columns/ });
  await expect(decrement).toBeVisible(); await increment.click();
  await expect(card.locator('.grid')).toHaveAttribute('data-cols', '5');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.cols).toBe(5);
  await expect(page.locator('#nl-live-region')).toContainText('5 columns');
});
