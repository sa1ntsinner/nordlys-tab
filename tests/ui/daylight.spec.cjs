const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test.use({ timezoneId: 'Europe/Berlin' });

/* Holds the sky at a moment: an equinox day in Berlin, where sunset is at
   about 17:07 UTC and noon at 10:59. */
const at = (page, iso) => page.evaluate(iso => {
  const engine = window.Nordlys.bgEngine;
  engine.now = () => new Date(iso);
  engine.followSun();
  return { phase: engine.sky?.phase ?? null, palette: engine.palette.join(' ') };
}, iso);

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#bg-palette-grid [data-palette="daylight"]')).toBeAttached();
}
const chooseDaylight = page => page.locator('#bg-palette-grid [data-palette="daylight"]').click();

test('Time of day is a colour mood of its own, and not the one chosen at first', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await expect(page.locator('#bg-palette-grid [data-palette="daylight"]')).toHaveText('Time of day');
  await expect(page.locator('#bg-palette-grid [data-palette="daylight"]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#bg-daylight')).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.bgEngine.sky)).toBeNull();
});

test('chosen, the sky takes the colours of the hour on every atmosphere, and says which hour it is', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await chooseDaylight(page);
  expect(await page.evaluate(() => window.Nordlys.config.bgPalette)).toBe('daylight');
  const hours = [];
  for (const iso of ['2026-09-22T00:00:00Z', '2026-09-22T07:30:00Z', '2026-09-22T11:00:00Z', '2026-09-22T14:30:00Z', '2026-09-22T17:05:00Z']) hours.push(await at(page, iso));
  expect(hours.map(hour => hour.phase)).toEqual(['night', 'morning', 'afternoon', 'afternoon', 'sunset']);
  expect(new Set(hours.map(hour => hour.palette)).size, 'every hour has colours of its own').toBe(5);
  await expect(page.locator('#bg-daylight-now')).toHaveText('Now: sunset');
  await expect(page.locator('#bg-daylight-play')).toBeVisible();
  for (const scene of ['aurora', 'polaris', 'starmap', 'meteors', 'silk', 'blackhole', 'contour', 'fjord']) {
    const lit = await page.evaluate(scene => { window.Nordlys.config.bgMode = scene; window.Nordlys.updateBackgroundMode(); return window.Nordlys.bgEngine.sky?.phase; }, scene);
    expect(lit, `${scene} follows the sun too`).toBe('sunset');
  }
});

test('any other mood holds still, exactly as it was mixed', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await page.locator('#bg-palette-grid [data-palette="polar"]').click();
  const polar = await page.evaluate(() => window.Nordlys.bgEngine.palette.join(' '));
  expect(polar).toBe('#68e1d1 #6ea8fe #9d8cff');
  await chooseDaylight(page);
  await at(page, '2026-09-22T17:05:00Z');
  await page.locator('#bg-palette-grid [data-palette="polar"]').click();
  expect(await page.evaluate(() => window.Nordlys.bgEngine.palette.join(' '))).toBe(polar);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.sky)).toBeNull();
  await expect(page.locator('#bg-daylight')).toBeHidden();
});

test('the choice survives a reload, and the old switch becomes the mood', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await chooseDaylight(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => [window.Nordlys.config.bgPalette, window.Nordlys.bgEngine.daylight, Boolean(window.Nordlys.bgEngine.sky)])).toEqual(['daylight', true, true]);
  const migrated = await page.evaluate(() => {
    const on = { bgPalette: 'polar', bgDaylight: true, bgRealSky: false, bgMode: 'halo' };
    const off = { bgPalette: 'polar', bgDaylight: false };
    window.Nordlys.normalizeStoredConfig(on);
    window.Nordlys.normalizeStoredConfig(off);
    return [on, off];
  });
  expect(migrated).toEqual([{ bgPalette: 'daylight', bgMode: 'starmap' }, { bgPalette: 'polar' }]);
});

test('a day plays through in seconds and hands the sky back to the clock', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await chooseDaylight(page);
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

test('the mood and the light are named in the language of the page', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  await openBackground(page);
  await expect(page.locator('#bg-palette-grid [data-palette="daylight"]')).toHaveText('Время суток');
  await chooseDaylight(page);
  await at(page, '2026-09-22T17:05:00Z');
  await expect(page.locator('#bg-daylight-now')).toHaveText('Сейчас: закат');
});
