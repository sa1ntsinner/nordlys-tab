const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The first version of this feature shipped a control that changed nothing.
   Three separate causes stacked: the four old keys were still in DEFAULT_CONFIG
   so the migration could never observe them missing; the app wrote the glass
   variables inline on <html>, which outranks every selector; and each theme
   declared --glass-blur at a specificity the level could not beat.

   Every assertion below measures the rendered surface rather than the stored
   value, because the stored value was right the whole time. */

async function chooseGlass(page, level) {
  await page.locator('#cfg-glass-level').evaluate((select, value) => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, level);
  await page.waitForTimeout(150);
}

function blurOf(filter) {
  const found = /blur\(([\d.]+)px\)/.exec(filter || '');
  return found ? Number(found[1]) : 0;
}

async function cardFilter(page) {
  return page.evaluate(() => {
    const card = document.querySelector('#board .card');
    const style = getComputedStyle(card);
    return style.backdropFilter || style.webkitBackdropFilter || '';
  });
}

test('each glass level renders a different surface', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();

  await chooseGlass(page, 'full');
  const full = blurOf(await cardFilter(page));
  await chooseGlass(page, 'subtle');
  const subtle = blurOf(await cardFilter(page));
  await chooseGlass(page, 'off');
  const off = blurOf(await cardFilter(page));

  expect(full, 'the frosted level must actually blur').toBeGreaterThan(16);
  expect(subtle, 'subtle sits between the two').toBeGreaterThan(0);
  expect(subtle, 'subtle must be less than frosted').toBeLessThan(full);
  expect(off, 'none means none, on every theme').toBe(0);
});

/* A theme carries colour. When it also declared the blur radius it outranked
   the level, so "None" could not turn glass off on any built-in theme. */
test('no theme can override the chosen glass level', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await chooseGlass(page, 'off');

  for (const theme of ['aurora-void', 'porcelain-light', 'gruvbox-dark', 'mint-breeze', 'oled-obsidian']) {
    await page.evaluate(key => window.Nordlys.setTheme(key), theme);
    await page.waitForTimeout(120);
    expect(blurOf(await cardFilter(page)), `${theme} must respect None`).toBe(0);
  }
});

test('the level survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await chooseGlass(page, 'subtle');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'subtle');
  expect(blurOf(await cardFilter(page)), 'and still renders as subtle').toBeGreaterThan(0);
});

/* Someone who had turned the old blur slider to zero had made a choice. It has
   to survive the four sliders being replaced by three levels. */
test('a configuration from the four old sliders lands on the right level', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const [blur, expected] of [[0, 'off'], [10, 'subtle'], [28, 'full'], [48, 'full']]) {
    await page.evaluate(value => {
      const config = window.Nordlys.config;
      delete config.glassLevel;
      config.glassBlur = value;
      config.glassSaturate = 190;
      config.glassOpacity = 0.7;
      config.glassSheen = 0.45;
      window.Nordlys.saveConfig();
    }, blur);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    expect(await page.evaluate(() => window.Nordlys.config.glassLevel), `blur ${blur}`).toBe(expected);
    // And the keys it replaced are gone rather than left as litter.
    expect(await page.evaluate(() => 'glassBlur' in window.Nordlys.config)).toBe(false);
  }
});

/* The clock is the page's typographic subject. It was said to have lost its
   clipped-gradient fill and coloured halo, and had — on eleven themes. */
test('the clock is plain type on every theme', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const theme of ['aurora-void', 'porcelain-light', 'warm-ivory', 'sage-light', 'nordic-snow', 'oled-obsidian']) {
    await page.evaluate(key => window.Nordlys.setTheme(key), theme);
    await page.waitForTimeout(120);
    const clock = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('clock'));
      return { clip: style.webkitBackgroundClip || style.backgroundClip, colour: style.color, filter: style.filter };
    });
    expect(clock.clip, `${theme}: no clipped gradient`).not.toBe('text');
    expect(clock.colour, `${theme}: real ink, not transparent`).not.toBe('rgba(0, 0, 0, 0)');
    expect(clock.filter, `${theme}: no coloured halo`).toBe('none');
  }
});

/* Cards were caught in the clock's selector list and given background-clip:text
   with transparent ink on the light themes. */
test('cards are surfaces, not clipped text', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const theme of ['porcelain-light', 'sage-light', 'warm-ivory']) {
    await page.evaluate(key => window.Nordlys.setTheme(key), theme);
    await page.waitForTimeout(120);
    const card = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('#board .card'));
      return { clip: style.webkitBackgroundClip || style.backgroundClip, colour: style.color };
    });
    expect(card.clip, `${theme}: a card paints its whole box`).not.toBe('text');
    expect(card.colour, `${theme}: a card has ink`).not.toBe('rgba(0, 0, 0, 0)');
  }
});
