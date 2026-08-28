const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function load() {
  const window = {};
  const context = vm.createContext({ window, document: { createElement() { return { dataset: {}, style: { setProperty() {} }, append() {}, setAttribute() {} }; } } });
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
