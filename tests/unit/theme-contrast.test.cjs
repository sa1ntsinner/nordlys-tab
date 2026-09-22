const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Twenty themes live in themes.css; Frosted Glass lives beside its material.
const THEMES_CSS = ['themes.css', 'liquid-glass.css']
  .map(name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'css', name), 'utf8'))
  .join('\n');

/* Every theme names its text in three tiers — ink, dim, faint — and its ground
   in three surfaces — the card, the deep card and the page. A tier is only a
   tier if it can be read on every surface it will be put on, so each one is
   held to a floor against all three.

   The floors sit above WCAG's 4.5:1 on purpose. These are the opaque surfaces;
   the real ones are glass over a sky that a scene lights and a colour mood
   tints, and tools/qa-contrast.cjs measured that lift at up to half a point
   of ratio. Eleven of the twenty-one themes shipped a faint tier under 4.5:1
   against their own card before this test existed. */
const FLOORS = { ink: 7, dim: 5, faint: 4.8 };
const SURFACES = ['card-tint', 'card-tint-deep', 'void'];

// A theme is the block that names itself; the rest are rules scoped to one.
function themes() {
  return [...THEMES_CSS.matchAll(/\[data-theme="([a-z0-9-]+)"\][^{]*\{([^}]*--theme-name:[^}]*)\}/g)].map(([, name, body]) => {
    const token = key => (new RegExp(`--${key}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(body) || [])[1];
    return { name, token };
  });
}

const channel = value => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('every theme declares its three text tiers and three surfaces as colours', () => {
  const list = themes();
  assert.strictEqual(list.length, 21);
  for (const theme of list) {
    for (const key of ['ink', 'dim', 'faint', 'accent', ...SURFACES]) {
      assert.ok(theme.token(key), `${theme.name} has no --${key} colour`);
    }
  }
});

test('every text tier is readable on every surface of its theme', () => {
  const failures = [];
  for (const theme of themes()) {
    for (const [tier, floor] of Object.entries(FLOORS)) {
      for (const surface of SURFACES) {
        const value = ratio(theme.token(tier), theme.token(surface));
        if (value < floor) failures.push(`${theme.name}: --${tier} on --${surface} is ${value.toFixed(2)}:1, floor ${floor}`);
      }
    }
  }
  assert.deepStrictEqual(failures, []);
});

/* A tier is a promise about emphasis as well as legibility: faint must never
   out-shout dim. One light theme had them inverted, so its quietest text was
   louder than its secondary text. */
test('the tiers are ordered: ink, then dim, then faint', () => {
  const failures = [];
  for (const theme of themes()) {
    const on = tier => ratio(theme.token(tier), theme.token('card-tint'));
    if (!(on('ink') > on('dim') && on('dim') > on('faint'))) {
      failures.push(`${theme.name}: ink ${on('ink').toFixed(2)}, dim ${on('dim').toFixed(2)}, faint ${on('faint').toFixed(2)}`);
    }
  }
  assert.deepStrictEqual(failures, []);
});

/* Filled controls (the active mode switch, chosen chips) put --nl-on-accent on
   the theme's accent. */
test('text on the accent is readable in every theme', () => {
  const onAccent = /--nl-on-accent:\s*(#[0-9a-fA-F]{6})/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'css', 'foundations.css'), 'utf8'))[1];
  const failures = themes()
    .map(theme => ({ theme: theme.name, value: ratio(onAccent, theme.token('accent')) }))
    .filter(entry => entry.value < 4.5)
    .map(entry => `${entry.theme}: ${entry.value.toFixed(2)}:1`);
  assert.deepStrictEqual(failures, []);
});

/* The accent is a fill colour first. Where it is also text — a menu's heading,
   the Undo in a toast, a slider's value — the theme's --accent-ink carries it
   instead, and every light theme's accent needed one: as text they measured
   2.6 to 3.6 to one on their own panels. */
test('the accent as text is readable on every surface', () => {
  const failures = [];
  for (const theme of themes()) {
    const ink = theme.token('accent-ink') || theme.token('accent');
    for (const surface of SURFACES) {
      const value = ratio(ink, theme.token(surface));
      if (value < 4.5) failures.push(`${theme.name}: accent text on --${surface} is ${value.toFixed(2)}:1`);
    }
  }
  assert.deepStrictEqual(failures, []);
});
