const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { themeKeys, measurePage, failing, setLook } = require('../helpers/contrast.cjs');

/* The contrast gate. Axe reads colour pairs out of CSS, and on this page the
   pair in the CSS is rarely the pair a reader sees: text sits on translucent,
   blurred glass over a sky a scene paints and a mood tints. So this measures
   the page itself — photographed with and without its text — using the same
   instrument as tools/qa-contrast.cjs, which sweeps every theme, scene, mood
   and moment and writes the hardest looks it found per theme into
   tests/fixtures/contrast-worst.json. The gate re-measures those, the default
   look and the everyday surfaces, and fails the build on any text under AA:
   4.5:1, or 3:1 for large text. */
const WORST = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/contrast-worst.json'), 'utf8'));
const describe = runs => runs.map(run => `${run.where} "${run.text}" ${run.nominal.toFixed(2)} < ${run.required}`);

test('the instrument reproduces ratios that are known exactly', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  await page.goto(`${origin}/tests/fixtures/contrast-calibration.html`);
  const { runs } = await measurePage(page);
  const ratio = id => runs.find(run => run.where === `#${id}`)?.nominal;
  const expected = { black: 21, 'grey-aa': 4.54, 'grey-large': 3.03, half: 3.95, 'split-text': 4.48, 'night-text': 7.23 };
  for (const [id, value] of Object.entries(expected)) {
    expect(ratio(id), `#${id}`).toBeGreaterThan(value - 0.06);
    expect(ratio(id), `#${id}`).toBeLessThan(value + 0.06);
  }
});

/* Frosted Glass declared its own colours and rendered Aurora Void's: its token
   block tied with the :root defaults and lost on load order. */
test('every theme renders the colours it declares', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const css = ['themes.css', 'liquid-glass.css'].map(name => readFileSync(resolve(__dirname, '../../src/css', name), 'utf8')).join('\n');
  const wrong = [];
  for (const [, theme, body] of css.matchAll(/\[data-theme="([a-z0-9-]+)"\][^{]*\{([^}]*--theme-name:[^}]*)\}/g)) {
    const applied = await page.evaluate(key => {
      window.Nordlys.config.theme = key;
      window.Nordlys.applyThemeTokens();
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(['ink', 'dim', 'faint', 'accent', 'void'].map(token => [token, style.getPropertyValue(`--${token}`).trim().toLowerCase()]));
    }, theme);
    for (const [token, value] of Object.entries(applied)) {
      const declared = (new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(body) || [])[1];
      if (declared && declared.toLowerCase() !== value) wrong.push(`${theme} --${token}: declares ${declared}, renders ${value}`);
    }
  }
  expect(wrong).toEqual([]);
});

test('the gate knows the hardest skies of every theme there is', async () => {
  expect(Object.keys(WORST).sort()).toEqual((await themeKeys()).sort());
});

for (const theme of Object.keys(WORST)) {
  test(`${theme}: every word is readable on its hardest skies`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    const looks = [{ scene: 'aurora', mood: 'theme', phase: 12, intensity: 1 }, ...WORST[theme]];
    for (const look of looks) {
      await setLook(page, { theme, ...look });
      const { runs } = await measurePage(page);
      expect(runs.length, 'the board was measured').toBeGreaterThan(20);
      expect(describe(failing(runs)), `${look.scene} / ${look.mood} / ${look.phase}`).toEqual([]);
    }

    // The suggestions, over the brightest look.
    await setLook(page, { theme, ...(WORST[theme][0] || looks[0]) });
    await page.locator('#q').fill('g');
    await expect(page.locator('#sugg')).toBeVisible();
    expect(describe(failing((await measurePage(page)).runs)), 'search').toEqual([]);
    await page.locator('#q').fill('');
    await page.keyboard.press('Escape');

    // Two settings tabs that carry every kind of control.
    await page.locator('#gear').click();
    for (const tab of ['general', 'background']) {
      await page.locator(`.ctab[data-tab="${tab}"]`).click();
      await page.waitForTimeout(80);
      expect(describe(failing((await measurePage(page, '#cfg')).runs)), `settings / ${tab}`).toEqual([]);
    }
  });
}

/* A personal wallpaper is the one sky the engine does not paint, so it is
   measured instead: the dimmer rises to the least that lets the text read.
   Three pictures made here, not shipped: bright snow, busy leaves, dark night. */
const WALLPAPERS = {
  snow: 'bright',
  leaves: 'busy',
  night: 'dark'
};
for (const theme of ['aurora-void', 'porcelain-light']) {
  test(`${theme}: a wallpaper of any brightness leaves every word readable`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    for (const kind of Object.values(WALLPAPERS)) {
      await page.evaluate(async ({ kind, theme }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 480; canvas.height = 300;
        const context = canvas.getContext('2d');
        let seed = 7;
        const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        if (kind === 'bright') {
          context.fillStyle = '#f4f7fb'; context.fillRect(0, 0, 480, 300);
          for (let i = 0; i < 900; i++) { context.fillStyle = `rgba(210, 222, 236, ${random()})`; context.fillRect(random() * 480, random() * 300, 8, 8); }
        } else if (kind === 'busy') {
          for (let i = 0; i < 1500; i++) { context.fillStyle = `hsl(${90 + random() * 60} ${40 + random() * 50}% ${20 + random() * 70}%)`; context.fillRect(random() * 480, random() * 300, 14, 14); }
        } else {
          context.fillStyle = '#060913'; context.fillRect(0, 0, 480, 300);
          for (let i = 0; i < 120; i++) { context.fillStyle = '#9fb4d8'; context.fillRect(random() * 480, random() * 300, 1, 1); }
        }
        const blob = await new Promise(done => canvas.toBlob(done, 'image/png'));
        await MediaVault.saveMedia('custom_bg', blob, 'image/png');
        const app = window.Nordlys;
        app.config.theme = theme;
        app.config.bgMode = 'custom-image';
        app.config.bgDim = 0;
        app.applyThemeTokens();
        await app.updateBackgroundMode();
        const image = document.getElementById('bg-media');
        if (!image.complete) await new Promise(done => image.addEventListener('load', done, { once: true }));
        await window.NordlysUI.settled();
        app.measureWallpaper();
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      }, { kind, theme });
      const { runs } = await measurePage(page);
      expect(describe(failing(runs)), `${theme} over a ${kind} wallpaper`).toEqual([]);
      // The picture is shaded only where it must be: behind light words on snow,
      // never behind them on a dark night.
      const shades = await page.locator('#wallpaper-scrims .wallpaper-scrim').count();
      if (kind === 'dark' && theme === 'aurora-void') expect(shades, 'a dark picture needs no shade under light text').toBe(0);
      if (kind === 'bright' && theme === 'aurora-void') expect(shades, 'snow under light text is shaded').toBe(1);
    }
  });
}
