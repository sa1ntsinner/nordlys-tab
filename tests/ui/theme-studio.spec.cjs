const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The studio asked for seven colours, and the one with an actual correctness
   requirement — text you can read on the surfaces you just chose — was left to
   taste like the other six. Three colours are asked for now and the rest follow.

   The first version of this file only ever set card equal to bg, so it could not
   see that the derivation ignored the card entirely. It also wrote its expected
   answers in by hand, and one of them was false. Both are fixed below: every
   case uses a card that differs from the page, and the assertion is the rule
   rather than a precomputed result. */

async function openStudio(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await page.locator('#btn-create-custom-theme').click();
}

async function setBase(page, { bg, card, accent = '#35d6c0' }) {
  for (const [id, value] of [['thm-bg-hex', bg], ['thm-card-hex', card], ['thm-accent-hex', accent]]) {
    await page.locator(`#${id}`).fill(value);
    await page.locator(`#${id}`).dispatchEvent('input');
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const value = id => document.getElementById(id).value;
    const toRgb = hex => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const channel = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const lum = rgb => 0.2126 * channel(rgb[0] / 255) + 0.7152 * channel(rgb[1] / 255) + 0.0722 * channel(rgb[2] / 255);
    const ratio = (a, b) => {
      const la = lum(toRgb(a)), lb = lum(toRgb(b));
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const bg = value('thm-bg-hex'), card = value('thm-card-hex');
    const text = value('thm-text-hex'), dim = value('thm-dim-hex');
    return {
      text, dim, glow: value('thm-glow-hex'),
      textWorst: Math.min(ratio(text, bg), ratio(text, card)),
      dimWorst: Math.min(ratio(dim, bg), ratio(dim, card)),
      warningVisible: !document.getElementById('custom-theme-contrast-warning').hidden
    };
  });
}

/* The best worst-case contrast any greyscale colour can reach against the two
   surfaces. Above 4.5 the theme must comply; below it, it must warn. Some pairs
   genuinely have no answer: a mid grey page with mid grey cards tops out around
   4.2:1, and a black page with white cards at 4.58:1 only in theory. */
async function bestAchievable(page, bg, card) {
  return page.evaluate(([one, two]) => {
    const toRgb = hex => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const channel = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const lum = rgb => 0.2126 * channel(rgb[0] / 255) + 0.7152 * channel(rgb[1] / 255) + 0.0722 * channel(rgb[2] / 255);
    const ratio = (a, b) => {
      const la = lum(a), lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const surfaces = [toRgb(one), toRgb(two)];
    let best = 0;
    for (let step = 0; step <= 32; step++) {
      const value = Math.round((step / 32) * 255);
      const worst = Math.min(...surfaces.map(surface => ratio([value, value, value], surface)));
      if (worst > best) best = worst;
    }
    return best;
  }, [bg, card]);
}

const CASES = [
  { name: 'dark page, slightly lighter cards', bg: '#0a0f1d', card: '#16213a' },
  { name: 'light page, white cards', bg: '#f4f7fb', card: '#ffffff' },
  { name: 'mid grey page, darker cards', bg: '#7a7a7a', card: '#5e5e5e' },
  { name: 'warm sand page, cream cards', bg: '#c8b48a', card: '#e8dcc0' },
  { name: 'near-black page, charcoal cards', bg: '#050505', card: '#1c1c1c' },
  { name: 'dark page, light cards', bg: '#101018', card: '#e9edf5' },
  { name: 'black page, white cards', bg: '#000000', card: '#ffffff' }
];

for (const scenario of CASES) {
  test(`text obeys the contrast rule: ${scenario.name}`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await openStudio(page);
    await setBase(page, scenario);
    const reachable = await bestAchievable(page, scenario.bg, scenario.card);
    const derived = await measure(page);

    if (reachable >= 4.5) {
      expect(derived.textWorst, 'primary text, worst of page and card').toBeGreaterThanOrEqual(4.5);
      expect(derived.dimWorst, 'subdued text, worst of page and card').toBeGreaterThanOrEqual(4.5);
      expect(derived.warningVisible, 'a compliant theme should not trip its own warning').toBe(false);
    } else {
      /* No colour serves both surfaces. The product must say so and still pick
         the best compromise rather than an extreme that vanishes on one. */
      expect(derived.warningVisible, `only ${reachable.toFixed(2)}:1 is reachable here`).toBe(true);
      expect(derived.textWorst, 'still the best available compromise').toBeGreaterThan(reachable - 0.2);
    }
  });
}

test('subdued text stays below primary text without dropping under AA', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openStudio(page);
  await setBase(page, { bg: '#0a0f1d', card: '#16213a' });
  const derived = await measure(page);
  expect(derived.dimWorst, 'subdued sits closer to the bar').toBeLessThanOrEqual(derived.textWorst);
  expect(derived.dimWorst, 'subdued is still text, so AA applies to it too').toBeGreaterThanOrEqual(4.5);
});

test('the three base colours drive the four that follow', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openStudio(page);
  await setBase(page, { bg: '#0a0f1d', card: '#111c35', accent: '#ff5500' });
  const derived = await measure(page);
  expect(derived.glow, 'the glow follows the accent').toBe('#ff5500');

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
