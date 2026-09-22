const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function load() {
  const window = {};
  const context = vm.createContext({ window, document: { createElement() { return { dataset: {}, style: { setProperty() {} }, append() {}, setAttribute() {} }; } } });
  vm.runInContext(readFileSync('src/js/colour-tools.js', 'utf8'), context);
  vm.runInContext(readFileSync('src/js/icon-presentation.js', 'utf8'), context);
  return window.NordlysIcons;
}

test('classifies built-in, favicon, raster, and monogram sources', () => {
  const icons = load();
  assert.equal(icons.classifyIcon({ icon: 'github' }), 'builtin');
  assert.equal(icons.classifyIcon({ customImg: 'chrome-extension://id/_favicon/?pageUrl=x' }), 'favicon');
  assert.equal(icons.classifyIcon({ customImg: 'data:image/png;base64,AAAA' }), 'raster');
  assert.equal(icons.classifyIcon({ customImg: 'https://example.com/logo.png' }), 'raster');
  assert.equal(icons.classifyIcon({ monogram: 'N' }), 'monogram');
});

test('clamps optical scale and chooses readable monochrome tone', () => {
  const icons = load();
  assert.equal(icons.resolvePresentation({ source: { icon: 'x' }, metadata: { opticalScale: 8 }, isLight: true }).opticalScale, 1.12);
  assert.equal(icons.resolvePresentation({ source: { icon: 'x' }, metadata: { opticalScale: 'bad' }, isLight: false }).opticalScale, 1);
  assert.equal(icons.resolvePresentation({ source: { icon: 'x' }, metadata: { monochrome: true }, isLight: true }).tone, 'dark');
});

/* A library glyph wears the bookmark's own colour, so it may be shown lighter or
   darker — never another hue — until it reads at 3:1 on its plate. */
const lum = ([r, g, b]) => [r, g, b].map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const parse = value => value.match(/\d+/g).slice(0, 3).map(Number);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

test('a pale glyph on a white plate is shown darker, in its own hue, until it reads', () => {
  const icons = load();
  const shown = icons.readableAgainst([134, 239, 172], 1, 3); // Kleinanzeigen's #86efac
  assert.ok(shown, 'a colour should be offered');
  const rgb = parse(shown);
  assert.ok(ratio(lum(rgb), 1) >= 3, `${shown} reads at ${ratio(lum(rgb), 1).toFixed(2)}`);
  assert.ok(rgb[1] > rgb[0] && rgb[1] > rgb[2], `${shown} is still green`);
});

test('a dark glyph on a dark plate is shown lighter', () => {
  const icons = load();
  const plate = lum([15, 28, 50]);
  const shown = icons.readableAgainst([30, 58, 138], plate, 3); // navy on Aurora Void's card
  const rgb = parse(shown);
  assert.ok(ratio(lum(rgb), plate) >= 3);
  assert.ok(rgb[2] > rgb[0], `${shown} is still blue`);
});

test('a glyph that already reads keeps the colour it was given', () => {
  const icons = load();
  assert.equal(icons.readableAgainst([239, 68, 68], lum([15, 28, 50]), 3), null);
});
