const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test.use({ timezoneId: 'Europe/Berlin' });

/* Holds the sky at a moment: an equinox day in Berlin, where sunset is at
   about 17:07 UTC and noon at 10:59. */
const at = (page, iso) => page.evaluate(iso => {
  const engine = window.Nordlys.bgEngine;
  engine.now = () => new Date(iso);
  engine.followSun();
  return { phase: engine.sky?.phase ?? null, palette: engine.palette.join(' '), day: engine.sky?.day ?? null };
}, iso);

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#cfg-bg-daylight')).toBeAttached();
}

test('the switch sits with the colour moods and starts off', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  expect(await page.evaluate(() => Boolean(document.getElementById('cfg-bg-daylight').closest('.atmosphere-palette')))).toBe(true);
  await expect(page.locator('#cfg-bg-daylight')).not.toBeChecked();
  await expect(page.locator('#bg-daylight-now')).toBeHidden();
  await expect(page.locator('#bg-daylight-play')).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.bgEngine.sky)).toBeNull();
});

test('turned on, every atmosphere is lit by the hour, and says which hour it is', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const asMixed = await page.evaluate(() => window.Nordlys.bgEngine.palette.join(' '));
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  expect(await page.evaluate(() => window.Nordlys.config.bgDaylight)).toBe(true);
  const night = await at(page, '2026-09-22T00:00:00Z');
  const noon = await at(page, '2026-09-22T11:00:00Z');
  const sunset = await at(page, '2026-09-22T17:05:00Z');
  expect([night.phase, noon.phase, sunset.phase]).toEqual(['night', 'afternoon', 'sunset']);
  expect(noon.day).toBe(1);
  expect(new Set([asMixed, night.palette, noon.palette, sunset.palette]).size, 'each hour lights the mood differently').toBe(4);
  await expect(page.locator('#bg-daylight-now')).toHaveText('Now: sunset');
  await expect(page.locator('#bg-daylight-play')).toBeVisible();
  for (const scene of ['aurora', 'polaris', 'halo', 'pillars', 'nacre', 'silk', 'baikal', 'drift', 'horizon']) {
    const lit = await page.evaluate(scene => { window.Nordlys.config.bgMode = scene; window.Nordlys.updateBackgroundMode(); return window.Nordlys.bgEngine.sky?.phase; }, scene);
    expect(lit, `${scene} follows the sun too`).toBe('sunset');
  }
});

test('turned off, the mood is exactly as it was mixed', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const asMixed = await page.evaluate(() => window.Nordlys.bgEngine.palette.join(' '));
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  await at(page, '2026-09-22T17:05:00Z');
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  expect(await page.evaluate(() => window.Nordlys.bgEngine.palette.join(' '))).toBe(asMixed);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.sky)).toBeNull();
});

test('the choice survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => [window.Nordlys.config.bgDaylight, window.Nordlys.bgEngine.daylight, Boolean(window.Nordlys.bgEngine.sky)])).toEqual([true, true, true]);
});

test('a day plays through in seconds and hands the sky back to the clock', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  const clock = await page.evaluate(() => window.Nordlys.bgEngine.now().getTime());
  await page.locator('#bg-daylight-play').click();
  await expect(page.locator('#bg-daylight-play')).toBeDisabled();
  // Mid-play the line shows the simulated hour as well as the light.
  await page.waitForTimeout(1500);
  await expect(page.locator('#bg-daylight-now')).toHaveText(/^\d{2}:\d{2}: /);
  await expect(page.locator('#bg-daylight-play')).toBeEnabled({ timeout: 20000 });
  const after = await page.evaluate(() => window.Nordlys.bgEngine.now().getTime());
  expect(Math.abs(after - clock)).toBeLessThan(60000);
  await expect(page.locator('#bg-daylight-now')).toHaveText(/^Now: /);
});

test('the light is named in the language of the page', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  await openBackground(page);
  await page.locator('label.tg:has(#cfg-bg-daylight)').click();
  await at(page, '2026-09-22T17:05:00Z');
  await expect(page.locator('#bg-daylight-now')).toHaveText('Сейчас: закат');
  await expect(page.locator('#cfg-bg-daylight').locator('xpath=ancestor::div[contains(@class,"row")]')).toContainText('Следовать времени суток');
});
