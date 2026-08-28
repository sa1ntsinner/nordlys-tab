const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('search keeps focus in an active-descendant combobox', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const input = page.locator('#q');
  await expect(input).toHaveAttribute('role', 'combobox'); await expect(input).toHaveAttribute('aria-autocomplete', 'list'); await expect(input).toHaveAttribute('aria-controls', 'sugg');
  await input.fill('you'); await expect(page.locator('#sugg')).toHaveAttribute('role', 'listbox'); await expect(page.locator('#sugg [role="option"]').first()).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(input).toBeFocused(); await expect(input).not.toHaveAttribute('aria-activedescendant', '');
  const typed = await input.inputValue(); await page.keyboard.press('Escape'); await expect(input).toBeFocused(); await expect(input).toHaveValue(typed); await expect(input).toHaveAttribute('aria-expanded', 'false');
});
