const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* What a new tab reads before it can show anything: every script and sheet
   newtab.html names, and the one locale boot.js adds. A page opened dozens of
   times a day pays for each kilobyte dozens of times a day, so growth has to
   be a decision someone made, not a side effect nobody saw.

   The ceilings sit below what 2.5.2 loaded (1,666 KB of script with all eight
   languages in one file): a feature that needs more than the room left belongs
   in a file loaded when it is used, the way settings fetch another language. */
const ROOT = path.join(__dirname, '..', '..');
const BUDGET = { script: 1600 * 1024, style: 400 * 1024, locale: 90 * 1024 };

const markup = fs.readFileSync(path.join(ROOT, 'newtab.html'), 'utf8');
const named = [...markup.matchAll(/(?:src|href)="(src\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
const size = file => fs.statSync(path.join(ROOT, file)).size;
const kb = bytes => `${Math.round(bytes / 1024)} KB`;

test('the new tab loads no more script than its budget', () => {
  const locales = fs.readdirSync(path.join(ROOT, 'src', 'locales')).map(name => size(path.join('src', 'locales', name)));
  // English is in the markup; the language in use is one more, at worst the largest.
  const script = named.filter(file => file.endsWith('.js')).reduce((sum, file) => sum + size(file), 0) + Math.max(...locales);
  assert.ok(script <= BUDGET.script, `script before the first paint is ${kb(script)}, the budget ${kb(BUDGET.script)}`);
});

test('the new tab loads no more style than its budget', () => {
  const style = named.filter(file => file.endsWith('.css')).reduce((sum, file) => sum + size(file), 0);
  assert.ok(style <= BUDGET.style, `style is ${kb(style)}, the budget ${kb(BUDGET.style)}`);
});

test('no language costs a tab more than its share', () => {
  for (const name of fs.readdirSync(path.join(ROOT, 'src', 'locales'))) {
    const bytes = size(path.join('src', 'locales', name));
    assert.ok(bytes <= BUDGET.locale, `${name} is ${kb(bytes)}, the budget ${kb(BUDGET.locale)}`);
  }
});

test('the page names only files that exist, and never another language', () => {
  for (const file of named) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing`);
  const locales = named.filter(file => file.startsWith('src/locales/'));
  assert.deepEqual(locales, ['src/locales/en.js'], 'only English belongs in the markup; boot.js adds the language in use');
});
