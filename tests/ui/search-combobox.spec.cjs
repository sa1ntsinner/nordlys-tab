const { test, expect } = require('../helpers/nordlys-fixture.cjs');
test('search keeps focus in an active-descendant combobox', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const input = page.locator('#q');
  await expect(input).toHaveAttribute('role', 'combobox'); await expect(input).toHaveAttribute('aria-autocomplete', 'list'); await expect(input).toHaveAttribute('aria-controls', 'sugg');
  await input.fill('you'); await expect(page.locator('#sugg')).toHaveAttribute('role', 'listbox'); await expect(page.locator('#sugg [role="option"]').first()).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(input).toBeFocused(); await expect(input).not.toHaveAttribute('aria-activedescendant', '');
  const typed = await input.inputValue(); await page.keyboard.press('Escape'); await expect(input).toBeFocused(); await expect(input).toHaveValue(typed); await expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('Delete removes the active history option and Escape restores the input state with announcements', async ({ nordlysPage }) => {
  const { page } = nordlysPage; const input = page.locator('#q');
  await page.evaluate(() => localStorage.setItem('nordlys_search_history', JSON.stringify(['first query', 'second query'])));
  await input.focus(); await expect(page.locator('#sugg [role="option"]')).toHaveCount(2);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Delete');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_search_history')))).toEqual(['second query']);
  await expect(page.locator('#nl-live-region')).toContainText('first query'); await expect(input).toBeFocused();
  await page.keyboard.press('Escape'); await expect(input).toBeFocused(); await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#nl-live-region')).toContainText(/closed/i);
});
