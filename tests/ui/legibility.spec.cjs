const { test, expect } = require('../helpers/nordlys-fixture.cjs');

const state = page => page.evaluate(() => ({
  legibility: document.documentElement.dataset.legibility,
  intensity: window.Nordlys.bgEngine.intensity,
  card: getComputedStyle(document.querySelector('#board .card')).backgroundImage,
  targets: window.Nordlys.bgEngine.quietZones.flatMap(zone => zone.inks.map(ink => ink[1]))
}));

/* One switch for everyone who finds glass over a moving sky hard to read:
   solid surfaces, a sky held at a whisper, stronger text, stricter quiet zones. */
test('High legibility makes the glass solid, the sky quiet and the text stronger', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.bgIntensity = 1.5; window.Nordlys.updateBackgroundMode(); });
  const before = await state(page);
  expect(before.legibility).toBe('standard');

  await page.locator('#gear').click();
  await page.locator('#advanced-glass-settings > summary').click();
  await page.locator('label.tg:has(#cfg-high-legibility)').click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.highLegibility).toBe(true);
  await expect.poll(async () => (await state(page)).legibility).toBe('high');

  const after = await state(page);
  expect(after.intensity).toBeLessThanOrEqual(0.6);
  // Both stops of the card's glass are solid colour now, not a percentage of one.
  expect(after.card).not.toBe(before.card);
  expect(after.card).not.toMatch(/rgba\([^)]*,\s*0\.\d+\)/);
  await expect.poll(async () => Math.max(...(await state(page)).targets)).toBeGreaterThanOrEqual(7);
});

test('a system that asks for more contrast gets it without touching a setting', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ contrast: 'more' });
  await expect.poll(async () => (await state(page)).legibility).toBe('high');
  expect(await page.evaluate(() => window.Nordlys.config.highLegibility)).toBe(false);
  await page.emulateMedia({ contrast: 'no-preference' });
  await expect.poll(async () => (await state(page)).legibility).toBe('standard');
});

/* Forced colours recolour everything except a painted canvas, which would sit
   under the system's own text colours unchanged; so the sky steps aside. */
test('forced colours hide the painted sky', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('#bg-canvas')).toBeHidden();
  await page.emulateMedia({ forcedColors: 'none' });
  await expect(page.locator('#bg-canvas')).toBeVisible();
});
