const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const boot = fs.readFileSync(path.join(ROOT, 'src', 'js', 'boot.js'), 'utf8');

function themeBackgrounds() {
  const css = ['themes.css', 'liquid-glass.css']
    .map(name => fs.readFileSync(path.join(ROOT, 'src', 'css', name), 'utf8'))
    .join('\n');
  const found = new Map();
  for (const block of css.matchAll(/\[data-theme="([a-z-]+)"\][^{]*\{([^}]*)\}/gs)) {
    const [, key, body] = block;
    const declared = /--void:\s*([^;]+);/.exec(body);
    if (declared && !found.has(key)) found.set(key, declared[1].trim().toLowerCase());
  }
  return found;
}

function bootBackgrounds() {
  const table = /var BASE = \{([\s\S]*?)\};/.exec(boot);
  assert.ok(table, 'boot.js should declare a BASE table');
  const found = new Map();
  for (const entry of table[1].matchAll(/"([a-z-]+)":\s*"([^"]+)"/g)) {
    found.set(entry[1], entry[2].toLowerCase());
  }
  return found;
}

/* boot.js copies each theme's base colour so it can paint before the stylesheet
   that owns it has loaded. The copy is the point; the drift is the risk. */
test('the first-frame colours match the stylesheets they duplicate', () => {
  const css = themeBackgrounds();
  const declared = bootBackgrounds();
  const wrong = [];
  for (const [theme, colour] of css) {
    if (!declared.has(theme)) wrong.push(`${theme}: missing from boot.js`);
    else if (declared.get(theme) !== colour) wrong.push(`${theme}: boot says ${declared.get(theme)}, css says ${colour}`);
  }
  for (const theme of declared.keys()) {
    if (!css.has(theme)) wrong.push(`${theme}: in boot.js but no such theme in css`);
  }
  assert.deepStrictEqual(wrong, [], `first-frame colours out of step:\n${wrong.join('\n')}`);
});

/* Everything about this file is timing. If it stops being the first thing in the
   head, or gains a dependency, it stops working and nothing else notices. */
test('the boot script runs before any stylesheet and depends on nothing', () => {
  const markup = fs.readFileSync(path.join(ROOT, 'newtab.html'), 'utf8');
  const script = markup.indexOf('src/js/boot.js');
  const firstSheet = markup.indexOf('<link rel="stylesheet"');
  assert.ok(script > 0, 'boot.js should be loaded from newtab.html');
  assert.ok(script < firstSheet, 'boot.js must come before the first stylesheet');
  assert.ok(!/\bdefer\b|\basync\b/.test(markup.slice(script - 80, script + 40)),
    'boot.js must be synchronous, or it no longer beats the first paint');
  assert.ok(!/window\.(Nordlys|NordlysUI|I18N)/.test(boot), 'boot.js must not depend on the app');
});

/* A light theme opening dark is the same defect as a dark theme opening white. */
test('every light theme is listed as light in the first frame', () => {
  const list = /var LIGHT = \[([\s\S]*?)\];/.exec(boot);
  assert.ok(list, 'boot.js should declare a LIGHT list');
  const declared = [...list[1].matchAll(/"([a-z-]+)"/g)].map(entry => entry[1]).sort();
  const app = fs.readFileSync(path.join(ROOT, 'src', 'js', 'app.js'), 'utf8');
  const source = /const LIGHT_THEMES = \[([\s\S]*?)\];/.exec(app);
  assert.ok(source, 'app.js should declare LIGHT_THEMES');
  const expected = [...source[1].matchAll(/"([a-z-]+)"/g)].map(entry => entry[1]).sort();
  assert.deepStrictEqual(declared, expected, 'boot.js and app.js disagree about which themes are light');
});
