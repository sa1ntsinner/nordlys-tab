const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('Appearance uses selectable two-column theme cards and a shared live tile preview', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  const cards = page.locator('.theme-card[data-theme]'); await expect(cards).toHaveCount(21);
  await expect(cards.filter({ has: page.locator('[aria-hidden="true"]') })).toHaveCount(0);
  await expect(page.locator('.theme-card[aria-pressed="true"]')).toHaveCount(1);
  const columns = await page.locator('#theme-dark-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  await expect(page.locator('#advanced-glass-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('#appearance-shared-preview .card .tile .box')).toBeVisible();
  await expect(page.locator('#appearance-shared-preview .lbl')).toHaveText('Nordlys Studio');
});

test('all built-in themes retain semantic colors and identical component geometry', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  const ids = await page.locator('.theme-card[data-theme]').evaluateAll(nodes => nodes.map(node => node.dataset.theme));
  const results = await page.evaluate(idsToCheck => {
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;color:var(--nl-text-primary);background:var(--nl-surface-card);border-color:var(--nl-border);outline-color:var(--nl-focus)'; document.body.append(probe);
    const output = idsToCheck.map(id => {
      window.Aurora.setTheme(id); const css = getComputedStyle(probe), tile = document.querySelector('.tile .box').getBoundingClientRect(), card = document.querySelector('.card').getBoundingClientRect();
      return { id, colors: [css.color, css.backgroundColor, css.borderColor, css.outlineColor], geometry: [Math.round(tile.width), Math.round(tile.height), Math.round(card.style?.borderRadius || 0)] };
    }); probe.remove(); return output;
  }, ids);
  expect(results).toHaveLength(21);
  for (const result of results) expect(result.colors.every(value => value && value !== 'rgba(0, 0, 0, 0)')).toBe(true);
  expect(new Set(results.map(result => result.geometry.slice(0, 2).join('x'))).size).toBe(1);
});
