const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', '..', 'src', 'css');
const MARKUP = path.join(__dirname, '..', '..', 'newtab.html');

function stylesheets() {
  return fs.readdirSync(CSS_DIR)
    .filter(name => name.endsWith('.css'))
    .map(name => ({ name, text: fs.readFileSync(path.join(CSS_DIR, name), 'utf8') }));
}

/* A scale is only worth anything if it is closed. The moment one literal slips
   back in, the next person has permission to add another, and a year later the
   product has twenty font sizes again — seven of them on half-pixel steps,
   which is what this codebase actually had. */
test('every font size comes from the type scale', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/font-size:\s*([^;!}]+)/g)) {
      const value = match[1].trim();
      const allowed = value.startsWith('var(--nl-text-')
        || value.startsWith('clamp(')      // the clock, the one deliberate exception
        || value.endsWith('em')            // relative to a parent that is on the scale
        || value.startsWith('calc(')
        || value === 'inherit';
      if (!allowed) offenders.push(`${sheet.name}: font-size: ${value}`);
    }
  }
  assert.deepStrictEqual(offenders, [], `off-scale font sizes:\n${offenders.join('\n')}`);
});

test('markup carries no font size of its own', () => {
  const markup = fs.readFileSync(MARKUP, 'utf8');
  const offenders = [...markup.matchAll(/font-size:\s*([0-9.]+px)/g)].map(match => match[1]);
  assert.deepStrictEqual(offenders, [], `inline sizes in newtab.html: ${offenders.join(', ')}`);
});

/* Tracking belongs to a table indexed by size, not to whoever last looked at a
   label. Positive tracking on body text is the loudest "designed by a
   developer" signal there is. */
test('every letter-spacing comes from the tracking table', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/letter-spacing:\s*([^;!}]+)/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(--nl-track-') && value !== 'normal' && value !== 'inherit') {
        offenders.push(`${sheet.name}: letter-spacing: ${value}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `off-table tracking:\n${offenders.join('\n')}`);
});

test('the scale and the tracking table are actually defined', () => {
  const foundations = fs.readFileSync(path.join(CSS_DIR, 'foundations.css'), 'utf8');
  const required = [
    '--nl-text-2xs', '--nl-text-xs', '--nl-text-sm', '--nl-text-md',
    '--nl-text-lg', '--nl-text-xl', '--nl-text-2xl',
    '--nl-track-tight', '--nl-track-none', '--nl-track-label', '--nl-track-wide'
  ];
  for (const token of required) {
    assert.ok(foundations.includes(`${token}:`), `${token} is used but never defined`);
  }
});

/* Eighty-four distinct shadows is not a vocabulary, it is eighty-four implied
   light sources. Three elevations, one direction, and a theme may tint and damp
   the ladder but never redeclare it. */
test('shadows come from the elevation ladder', () => {
  const allowed = /^(var\(--nl-(shadow-[123]|ring|ring-tight)\)|none|inherit)$/;
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/box-shadow:\s*([^;}]+)/g)) {
      const value = match[1].split(',').map(part => part.trim());
      for (const layer of value) {
        if (!allowed.test(layer) && !layer.startsWith('var(--nl-')) {
          offenders.push(`${sheet.name}: ${match[1].trim().slice(0, 72)}`);
          break;
        }
      }
    }
  }
  // Drag affordances and the user's own card-glow slider still draw with colour
  // on purpose; everything else is on the ladder.
  const budget = 30;
  assert.ok(offenders.length <= budget,
    `${offenders.length} shadows outside the ladder (budget ${budget}):\n${offenders.slice(0, 12).join('\n')}`);
});

/* A theme carries colour. The moment it starts declaring its own elevation there
   are as many light sources as there are themes. */
test('themes do not redeclare card elevation', () => {
  const themes = fs.readFileSync(path.join(CSS_DIR, 'themes.css'), 'utf8');
  const offenders = [];
  for (const rule of themes.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const [, selector, body] = rule;
    if (!/box-shadow:/.test(body)) continue;
    const value = /box-shadow:\s*([^;}]+)/.exec(body)[1].trim();
    if (!value.startsWith('var(--nl-')) offenders.push(`${selector.trim().slice(-50)} => ${value.slice(0, 50)}`);
  }
  assert.deepStrictEqual(offenders, [], `themes declaring their own shadows:\n${offenders.join('\n')}`);
});

/* Twenty unnamed z-index literals from 0 to 500, with #toast-dock declared
   twice at two different values and the portalled select list sitting below the
   dialog it can be opened from. Names make a new layer say where it belongs
   instead of picking a number larger than the last one someone remembered. */
test('every layer comes from the z-index ladder', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/z-index:\s*([^;}]+)/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(--nl-z-') && value !== 'auto' && value !== 'inherit') {
        offenders.push(`${sheet.name}: z-index: ${value}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `unnamed layers:\n${offenders.join('\n')}`);
});

/* Ordering is the whole point of a ladder, and one inversion is not cosmetic:
   putting a panel's backdrop above the panel makes the backdrop swallow every
   click meant for it. That mistake cost thirty test timeouts. */
test('the ladder is ordered so nothing swallows what it covers', () => {
  const foundations = fs.readFileSync(path.join(CSS_DIR, 'foundations.css'), 'utf8');
  const ladder = {};
  for (const match of foundations.matchAll(/--nl-z-([\w-]+):\s*(\d+);/g)) {
    ladder[match[1]] = Number(match[2]);
  }
  const required = ['background', 'veil', 'chrome', 'scrim', 'raised',
                    'float', 'drawer-scrim', 'drawer', 'overlay', 'modal', 'menu', 'toast'];
  for (const name of required) {
    assert.ok(name in ladder, `--nl-z-${name} is missing from the ladder`);
  }

  const order = [
    ['background', 'veil'], ['veil', 'chrome'],
    // The search scrim covers the page furniture, which is why the board, the
    // clock and the dock no longer each dim themselves.
    ['chrome', 'scrim'], ['scrim', 'raised'], ['raised', 'float'],
    // A panel sits above its own backdrop; a dialog sits above the panel.
    ['float', 'drawer-scrim'], ['drawer-scrim', 'drawer'], ['drawer', 'overlay'],
    ['overlay', 'modal'], ['modal', 'menu'], ['menu', 'toast']
  ];
  for (const [below, above] of order) {
    assert.ok(ladder[below] < ladder[above],
      `--nl-z-${below} (${ladder[below]}) must sit below --nl-z-${above} (${ladder[above]})`);
  }
});

/* A theme carries the palette. Every light theme already wears .light-ui, so
   naming three of them again beside it says nothing — 420 selectors across 114
   rule groups did exactly that, and half of themes.css was the repetition. */
test('themes do not name a light theme that .light-ui already covers', () => {
  const themes = fs.readFileSync(path.join(CSS_DIR, 'themes.css'), 'utf8');
  const offenders = [];
  for (const rule of themes.matchAll(/([^{}]*)\{[^{}]*\}/g)) {
    const selector = rule[1];
    if (!selector.includes('.light-ui')) continue;
    for (const named of selector.matchAll(/html\[data-theme="([a-z-]+)"\]/g)) {
      offenders.push(named[1]);
    }
  }
  assert.deepStrictEqual([...new Set(offenders)], [],
    `themes named alongside .light-ui: ${[...new Set(offenders)].join(', ')}`);
});

/* A coloured halo behind an icon or a control is the fastest way to date an
   interface, and it was on every bookmark on the board. Shadows are neutral;
   colour that carries meaning is a ring or a fill, never a bloom. */
test('no shadow is tinted with the accent', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    for (const match of sheet.text.matchAll(/(?:filter|box-shadow):\s*([^;}]+)/g)) {
      const value = match[1];
      if (!/drop-shadow|px/.test(value)) continue;
      // A ring is a colour with no blur; a bloom is a colour with one.
      if (/drop-shadow\([^)]*(?:var\(--accent|var\(--c\b|color-mix)/.test(value)) {
        offenders.push(`${sheet.name}: ${value.trim().slice(0, 64)}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `tinted shadows:\n${offenders.join('\n')}`);
});

/* A translation nobody asks for is not free: it is eight strings that a
   translator has to read, and a reader has to believe still means something.
   Twenty keys survived the features that used them. */
test('every message key is referenced somewhere', () => {
  const root = path.join(__dirname, '..', '..');
  const dictionary = fs.readFileSync(path.join(root, 'src', 'js', 'i18n.js'), 'utf8');
  const english = dictionary.slice(dictionary.indexOf('"en": {'), dictionary.indexOf('"ru": {'));
  const keys = [...english.matchAll(/"([\w.]+)":\s*"/g)].map(match => match[1]);

  const sources = ['newtab.html']
    .concat(fs.readdirSync(path.join(root, 'src', 'js')).filter(name => name !== 'i18n.js').map(name => path.join('src', 'js', name)))
    .concat(fs.readdirSync(path.join(root, 'tests', 'ui')).filter(name => name.endsWith('.spec.cjs')).map(name => path.join('tests', 'ui', name)))
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');

  const orphans = keys.filter(key => !sources.includes(key));
  assert.deepStrictEqual(orphans, [], `message keys nothing references:\n${orphans.join('\n')}`);
});

/* Eight languages that disagree about which keys exist is how one of them ends
   up showing a raw key on screen. */
test('every locale carries exactly the same keys', () => {
  const dictionary = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'js', 'i18n.js'), 'utf8');
  const blocks = dictionary.split(/\n {2}"(?:en|ru|es|de|fr|ja|zh|tr)": \{/).slice(1);
  assert.strictEqual(blocks.length, 8, 'expected eight locales');
  const sets = blocks.map(block => new Set([...block.matchAll(/"([\w.]+)":\s*"/g)].map(match => match[1])));
  const [first, ...rest] = sets;
  rest.forEach((keys, index) => {
    const missing = [...first].filter(key => !keys.has(key));
    const extra = [...keys].filter(key => !first.has(key));
    assert.deepStrictEqual({ missing, extra }, { missing: [], extra: [] },
      `locale ${index + 2} disagrees with English`);
  });
});
