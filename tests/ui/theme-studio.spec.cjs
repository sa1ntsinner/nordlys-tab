const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The studio asked for seven colours, and the one with a correctness
   requirement — text you can read on the background you just chose — was left
   to taste like the other six. Three colours are asked for now and the rest
   follow; this pins the part that is not a matter of taste. */

async function openStudio(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await page.locator('#btn-create-custom-theme').click();
}

async function setBase(page, { bg, card, accent }) {
  for (const [id, value] of [['thm-bg-hex', bg], ['thm-card-hex', card], ['thm-accent-hex', accent]]) {
    if (!value) continue;
    await page.locator(`#${id}`).fill(value);
    await page.locator(`#${id}`).dispatchEvent('input');
  }
}

async function readDerived(page) {
  return page.evaluate(() => {
    const value = id => document.getElementById(id).value;
    const toRgb = hex => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const channel = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const lum = ([r, g, b]) => 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
    const ratio = (a, b) => {
      const la = lum(toRgb(a)), lb = lum(toRgb(b));
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const bg = value('thm-bg-hex');
    return {
      text: value('thm-text-hex'),
      dim: value('thm-dim-hex'),
      glow: value('thm-glow-hex'),
      accent: value('thm-accent-hex'),
      textRatio: ratio(value('thm-text-hex'), bg),
      dimRatio: ratio(value('thm-dim-hex'), bg)
    };
  });
}

/* A near-white page, a near-black one, and the mid grey that defeats a naive
   "just use white text" rule. */
for (const background of ['#ffffff', '#0a0f1d', '#7a7a7a', '#c8b48a']) {
  test(`derived text clears WCAG AA on ${background}`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await openStudio(page);
    await setBase(page, { bg: background, card: background, accent: '#35d6c0' });
    const derived = await readDerived(page);
    expect(derived.textRatio, `primary text on ${background}`).toBeGreaterThanOrEqual(4.5);
    expect(derived.dimRatio, `subdued text on ${background}`).toBeGreaterThanOrEqual(3);
  });
}

test('the three base colours drive the four that follow', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openStudio(page);
  await setBase(page, { bg: '#0a0f1d', card: '#111c35', accent: '#ff5500' });
  const derived = await readDerived(page);
  expect(derived.glow, 'the glow follows the accent').toBe('#ff5500');

  // The four live behind a disclosure rather than in the main list.
  const advanced = page.locator('.theme-advanced');
  await expect(advanced).toHaveCount(1);
  await expect(page.locator('#thm-text-hex')).toBeHidden();
  await advanced.locator('summary').click();
  await expect(page.locator('#thm-text-hex')).toBeVisible();
});

test('a theme built from three colours saves and applies', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openStudio(page);
  await setBase(page, { bg: '#101820', card: '#16212c', accent: '#ffcc00' });
  await page.locator('#thm-name-input').fill('Three Colours');
  await page.locator('#thm-save-btn').click();
  await expect.poll(() => page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase()
  )).toContain('ffcc00');
});
