const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('desktop settings is a named modal drawer with grouped vertical tabs and contained focus', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  const drawer = page.locator('#cfg');
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(drawer).toHaveAttribute('aria-labelledby', 'settings-title');
  const width = (await drawer.boundingBox()).width;
  expect(width).toBeGreaterThanOrEqual(600); expect(width).toBeLessThanOrEqual(720);
  const tabs = drawer.getByRole('tab'); await expect(tabs).toHaveCount(6);
  await expect(drawer.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  await expect(drawer.locator('.settings-nav-group')).toHaveCount(3);
  await drawer.locator('button, input, select, textarea, [tabindex="0"]').last().focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#cfg') !== null)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('#gear')).toBeFocused();
});

test('narrow settings becomes a full-width sheet with horizontal roving navigation', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.setViewportSize({ width: 720, height: 720 }); await page.locator('#gear').click();
  const drawer = page.locator('#cfg');
  expect(Math.abs((await drawer.boundingBox()).width - 720)).toBeLessThanOrEqual(1);
  await expect(drawer.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
  const first = drawer.getByRole('tab').first(); await first.focus(); await page.keyboard.press('ArrowRight');
  await expect(drawer.getByRole('tab').nth(1)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('settings rail uses local decorative SVG icons with consistent geometry', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click(); const tabs = page.locator('#cfg [role="tab"]');
  for (const tab of await tabs.all()) {
    const icon = tab.locator('svg.settings-tab-icon'); await expect(icon).toHaveCount(1); await expect(icon).toHaveAttribute('aria-hidden', 'true');
    const box = await icon.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(16); expect(box.width).toBeLessThanOrEqual(18); expect(box.height).toBe(box.width);
  }
});
