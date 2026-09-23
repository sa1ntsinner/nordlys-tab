const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function type(page, text) {
  await page.locator('#q').click();
  await page.locator('#q').fill(text);
  await page.waitForTimeout(220);
}
const rows = page => page.locator('#sugg .sugg-command');

test('a bare > lists every command, as options of the one listbox', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '>');
  await expect(rows(page)).toHaveCount(12);
  await expect(rows(page).first()).toHaveAttribute('role', 'option');
  await expect(rows(page).first()).toContainText('theme nord');
  const results = await new AxeBuilder({ page }).include('#searchwrap').analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id)).toEqual([]);
});

test('a theme is shown before it is chosen, kept with Enter, and one undo away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const stored = JSON.stringify(nordlysPage.storageState.nordlys_config);
  await type(page, '>theme nord');
  await expect(rows(page).first()).toContainText('Nord Frost');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord-frost');
  expect(JSON.stringify(nordlysPage.storageState.nordlys_config), 'a preview writes nothing').toBe(stored);
  await page.keyboard.press('Enter');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.theme).toBe('nord-frost');
  await expect(page.locator('#toast-dock .toast')).toContainText('Nord Frost');
  await page.locator('#toast-dock .toast-action').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aurora-void');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.theme).toBe('aurora-void');
});

test('Escape puts a previewed sky back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '>sky frost');
  await expect.poll(() => page.evaluate(() => window.Nordlys.bgEngine.mode)).toBe('frost');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.Nordlys.bgEngine.mode)).toBe('aurora');
  expect(await page.evaluate(() => window.Nordlys.config.bgMode)).toBe('aurora');
});

test('a bookmark moves between folders by name, and back with undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '>move youtube to dev');
  await expect(rows(page).first()).toContainText('YouTube');
  await expect(page.locator('#board .tile.command-target')).toHaveCount(1);
  await page.keyboard.press('Enter');
  const names = () => page.evaluate(() => window.Nordlys.config.groups.map(group => group.links.map(link => link.name)));
  await expect.poll(async () => (await names())[1].includes('YouTube')).toBe(true);
  expect((await names())[0]).not.toContain('YouTube');
  await page.locator('#toast-dock .toast-action').click();
  await expect.poll(async () => (await names())[0][0]).toBe('YouTube');
});

test('a folder is made, and a folder is hidden, by saying so', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '>new folder Reading');
  await page.keyboard.press('Enter');
  await expect(page.locator('#board .card .cat b', { hasText: 'Reading' })).toHaveCount(1);
  await type(page, '>hide shopping');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.groups.find(group => group.label === 'Shopping').hidden)).toBe(true);
});

test('the commands answer to the language the page is in', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  await type(page, '>тема nord');
  await expect(rows(page).first()).toContainText('Nord Frost');
  await expect(rows(page).first()).toContainText('Тема');
  await type(page, '>переместить youtube в dev');
  await expect(rows(page).first()).toContainText('YouTube');
});

/* Typed and entered faster than the list redraws, a command used to find no
   list, and nothing happened. */
test('a command entered before its list appears still runs', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#q').click();
  await page.locator('#q').evaluate(input => {
    input.value = '>arrange';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await expect(page.locator('#arrange-bar')).toBeVisible();
});

test('"> size" opens size and spacing on the board', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await type(page, '>size');
  await page.keyboard.press('Enter');
  await expect(page.locator('#arrange-size-panel')).toBeVisible();
});
