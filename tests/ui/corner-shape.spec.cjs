const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Corners: round, or smooth like the icons on a phone home screen (a
   squircle, drawn with CSS corner-shape), and rounder than before. */

const shapeOf = (page, selector) => page.locator(selector).first().evaluate(node => getComputedStyle(node).getPropertyValue('corner-top-left-shape') || getComputedStyle(node).getPropertyValue('corner-shape'));

test('smooth corners reach the folders, the dashboard cards and the search box, and stay after a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  test.skip(!(await page.evaluate(() => CSS.supports('corner-shape: squircle'))), 'this engine has no corner-shape, and the choice is not offered');
  expect(await shapeOf(page, '#board .card')).not.toMatch(/squircle|superellipse/);
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  // Corner style and radius sit with the other geometry, under Advanced.
  await page.locator('#advanced-glass-settings > summary').click();
  // The settings draw their own list over the native select.
  await page.locator('#cfg-corner-shape + .nl-select').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.locator('#cfg-corner-shape + .nl-select').click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: 'Smooth, like app icons' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-corners', 'smooth');
  expect(await shapeOf(page, '#board .card')).toMatch(/squircle|superellipse/);
  expect(await shapeOf(page, '#search')).toMatch(/squircle|superellipse/);
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { window.Nordlys.dashboard.setOn(true); await window.Nordlys.dashboard.render(); });
  expect(await shapeOf(page, '#dash .dash-card')).toMatch(/squircle|superellipse/);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('html')).toHaveAttribute('data-corners', 'smooth');
});

test('the corner radius goes far enough for a card as round as an app icon', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  // Corner style and radius sit with the other geometry, under Advanced.
  await page.locator('#advanced-glass-settings > summary').click();
  await expect(page.locator('#cfg-card-radius')).toHaveAttribute('max', '48');
  await page.locator('#cfg-card-radius').evaluate(input => {
    input.value = '44';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.Nordlys.config.cardRadius)).toBe(44);
  expect(await page.locator('#board .card').first().evaluate(node => getComputedStyle(node).borderTopLeftRadius)).toBe('44px');
});

test('a shared look carries the corner style', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const kept = await page.evaluate(() => window.NordlysLook.clean({ cornerShape: 'smooth', cardRadius: 44 }));
  expect(kept).toMatchObject({ cornerShape: 'smooth', cardRadius: 44 });
});
