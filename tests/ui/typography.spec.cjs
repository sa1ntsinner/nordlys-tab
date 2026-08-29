const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* A missing or misnamed font file degrades silently to a system stack, which
   looks almost right — so assert the faces actually loaded, not that a rule
   mentioning them exists. */
test('both bundled faces load and drive the default stacks', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => ({
    outfit: document.fonts.check('400 16px "Outfit"'),
    instrument: document.fonts.check('400 16px "Instrument Sans"'),
    display: getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim(),
    main: getComputedStyle(document.documentElement).getPropertyValue('--font-main').trim(),
    clock: getComputedStyle(document.getElementById('clock')).fontFamily
  }));
  expect(loaded.outfit, 'Outfit did not load from src/fonts').toBe(true);
  expect(loaded.instrument, 'Instrument Sans did not load from src/fonts').toBe(true);
  expect(loaded.display).toContain('Outfit');
  expect(loaded.main).toContain('Instrument Sans');
  expect(loaded.clock, 'the clock must render in the display face').toContain('Outfit');
});

test('a chosen family reaches its slot token and survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.fonts = { display: 'Georgia', interface: 'Arial', mono: 'Consolas' };
    window.Aurora.saveConfig(); window.Aurora.applyThemeTokens();
  });
  const applied = () => page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      display: root.getPropertyValue('--font-display').trim(),
      main: root.getPropertyValue('--font-main').trim(),
      mono: root.getPropertyValue('--font-mono').trim()
    };
  });
  const before = await applied();
  expect(before.display.startsWith('"Georgia"')).toBe(true);
  expect(before.main.startsWith('"Arial"')).toBe(true);
  expect(before.mono.startsWith('"Consolas"')).toBe(true);
  // A chosen family always keeps a real fallback behind it for scripts it lacks.
  expect(before.main).toContain('Segoe UI');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  expect(await applied()).toEqual(before);
});

test('a font stored on a custom theme migrates into the interface slot once', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const result = await page.evaluate(() => {
    const config = { customTheme: { bg: '#0a0f1d', font: '"Georgia", serif' } };
    const first = window.NordlysType.migrate(config);
    const second = window.NordlysType.migrate(config);
    return { first, second, fonts: config.fonts, leftover: 'font' in config.customTheme };
  });
  expect(result.first, 'the legacy value should migrate').toBe(true);
  expect(result.fonts.interface).toBe('Georgia');
  expect(result.leftover, 'the theme must stop carrying a font').toBe(false);
  expect(result.second, 'migration must not run twice').toBe(false);
});

/* Chrome answers a refused device-font request with an empty list rather than an
   error, so "no fonts" must read as "not granted" and never as a granted-but-empty
   inventory that would hide the user's own faces behind a broken list. */
test('a refused device font list degrades instead of emptying the picker', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const outcome = await page.evaluate(async () => {
    const original = window.queryLocalFonts;
    const results = {};
    window.queryLocalFonts = async () => [];
    results.refused = await window.NordlysType.listLocalFonts();
    window.queryLocalFonts = async () => [{ family: 'Satoshi' }, { family: 'MonoLisa' }, { family: 'Satoshi' }];
    results.granted = await window.NordlysType.listLocalFonts();
    window.queryLocalFonts = async () => { throw new DOMException('denied', 'SecurityError'); };
    results.threw = await window.NordlysType.listLocalFonts();
    window.queryLocalFonts = original;
    results.optionsWhenRefused = window.NordlysType.optionsFor('interface', []).length;
    return results;
  });
  expect(outcome.refused).toEqual({ granted: false, families: [] });
  expect(outcome.threw).toEqual({ granted: false, families: [] });
  expect(outcome.granted.granted).toBe(true);
  expect(outcome.granted.families, 'duplicates collapse to one entry per family').toEqual(['MonoLisa', 'Satoshi']);
  expect(outcome.optionsWhenRefused, 'bundled and common faces remain choosable').toBeGreaterThan(5);
});

test('monospace and proportional slots never offer each other the wrong faces', async ({ nordlysPage }) => {
  const offered = await nordlysPage.page.evaluate(() => ({
    display: window.NordlysType.optionsFor('display').map(row => row.value),
    mono: window.NordlysType.optionsFor('mono').map(row => row.value)
  }));
  expect(offered.display).toContain('Outfit');
  expect(offered.display).not.toContain('Consolas');
  expect(offered.mono).toContain('Consolas');
  expect(offered.mono).not.toContain('Outfit');
});
