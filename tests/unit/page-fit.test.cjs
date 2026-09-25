const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* One page fit, the parts that are arithmetic: how far each measure may go,
   how the search for a fitting size behaves on heights that move smoothly and
   on heights that jump when a line breaks, the zoom model, and the switch as
   the config, the schema and the first frame see it. What it looks like in a
   browser is tests/ui/one-page-fit.spec.cjs. */

const ROOT = path.join(__dirname, '..', '..');
const fit = require('../../src/js/page-fit.js');
const schema = require('../../src/js/config-schema.js');
const { FLOORS, MIN_ZOOM, HINT_STORE, measuresAt, solveFit, zoomModel, boardHeight, largestZoom, toleranceFor, fingerprint, validHint } = fit;
const { balance } = require('../../src/js/board-layout.js');

const BASE = {
  padTop: 81, padBottom: 72, gap: 24, clock: 96, dateTop: 8, searchTop: 10,
  cardTop: 14, cardBottom: 16, cardGap: 14, tileGap: 8, gridGap: 12, boardGap: 14, tile: 78
};

test('at nothing borrowed every measure is exactly what was chosen', () => {
  assert.deepEqual(measuresAt(BASE, 0), BASE);
});

test('at the end of the way every measure sits on its floor', () => {
  const floors = measuresAt(BASE, 1);
  for (const key of Object.keys(BASE)) assert.equal(floors[key], Math.min(BASE[key], FLOORS[key]), key);
  assert.equal(floors.tile, 56, 'never below the smallest tile the grid keeps');
});

test('spacing closes up before the bookmarks get any smaller', () => {
  const half = measuresAt(BASE, 0.5);
  assert.equal(half.tile, BASE.tile, 'tiles untouched while spacing is still closing');
  assert.equal(half.padTop, FLOORS.padTop);
  assert.equal(half.gridGap, FLOORS.gridGap);
  const later = measuresAt(BASE, 0.75);
  assert.ok(later.tile < BASE.tile && later.tile > FLOORS.tile);
});

test('a measure already under its floor is never raised to it', () => {
  const tight = { ...BASE, padTop: 4, gridGap: 3, tile: 56 };
  const floors = measuresAt(tight, 1);
  assert.equal(floors.padTop, 4);
  assert.equal(floors.gridGap, 3);
  assert.equal(floors.tile, 56);
});

test('measures only shrink as t grows, and t outside 0..1 is held to it', () => {
  let previous = measuresAt(BASE, 0);
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const next = measuresAt(BASE, t);
    for (const key of Object.keys(BASE)) assert.ok(next[key] <= previous[key] + 1e-9, `${key} at ${t}`);
    previous = next;
  }
  assert.deepEqual(measuresAt(BASE, -3), measuresAt(BASE, 0));
  assert.deepEqual(measuresAt(BASE, 7), measuresAt(BASE, 1));
  assert.deepEqual(measuresAt(BASE, Number.NaN), measuresAt(BASE, 0));
});

// A page whose height falls smoothly as compaction grows: 1100px to 700px.
const smooth = (t) => 1100 - 400 * t;

test('the search lands just inside the room, with few layouts', () => {
  let layouts = 0;
  const measure = (x) => { layouts++; return smooth(x); };
  const target = 899;
  const { fit: found } = solveFit(measure, { x: 1, need: smooth(1) }, { x: 0, need: smooth(0) }, target, { tolerance: toleranceFor(900) });
  assert.ok(found.need <= target, 'what it returns fits');
  assert.ok(target - found.need <= toleranceFor(900), `close to the room: ${found.need}`);
  assert.ok(layouts <= 2, `${layouts} layouts`);
});

test('a height that jumps where a line breaks still ends on a size that fits', () => {
  // Below 0.4 a folder drops to its own line: 180px more.
  const stepped = (t) => 1000 - 200 * t + (t < 0.4 ? 180 : 0);
  const target = 899;
  const { fit: found } = solveFit(stepped, { x: 1, need: stepped(1) }, { x: 0, need: stepped(0) }, target, { tolerance: 18, probes: 4 });
  assert.ok(found.need <= target);
  assert.ok(found.x >= 0.4, 'never picks a point it did not see fit');
});

test('it never measures more than it is allowed to', () => {
  let layouts = 0;
  const wild = (t) => { layouts++; return t < 0.999 ? 5000 : 10; };
  solveFit(wild, { x: 1, need: 10 }, { x: 0, need: 5000 }, 899, { tolerance: 1, probes: 3 });
  assert.equal(layouts, 3);
});

test('the zoom model solves z·rest + z²·board = room', () => {
  const z = zoomModel(800, 300, 2000);
  assert.ok(Math.abs(z * 300 + z * z * 2000 - 800) < 1e-6, `z ${z}`);
  // With no board it is a plain ratio, and it is never above 1 or below the floor.
  assert.equal(zoomModel(400, 800, 0), 0.5);
  assert.equal(zoomModel(5000, 300, 200), 1);
  assert.equal(zoomModel(1, 1e6, 1e9), MIN_ZOOM);
  assert.equal(zoomModel(0, 100, 100), MIN_ZOOM);
});

test('the zoom model is generous, never mean, for a board that reflows exactly', () => {
  /* A board of area A in a window width W is A/W tall; zoomed by z with its
     width on screen held, it is z²·A/W on screen. The model is exact there,
     and real boards break lines later than that, so the fit corrects down. */
  const A = 1440 * 3000;
  const W = 1440;
  const rest = 250;
  const z = zoomModel(860, rest, A / W);
  assert.ok(Math.abs(z * rest + z * z * (A / W) - 860) < 1e-6);
});

test('a board is as tall as its lines, each as tall as its tallest folder', () => {
  const plan = { gap: 10, balance, runs: [{ widths: [300, 300, 300, 300], heights: [200, 120, 80, 160] }] };
  // Room for all four on one line.
  assert.equal(boardHeight(plan, 1230), 200);
  // Two to a line: 200 + 160 and one gap.
  assert.equal(boardHeight(plan, 700), 200 + 160 + 10);
  // One to a line.
  assert.equal(boardHeight(plan, 300), 200 + 120 + 80 + 160 + 30);
});

test('rows somebody made break on their own, with one gap between rows and lines alike', () => {
  const plan = { gap: 8, balance, runs: [
    { widths: [400, 400], heights: [100, 140] },
    { widths: [200], heights: [60] }
  ] };
  assert.equal(boardHeight(plan, 1000), 140 + 60 + 8);
  assert.equal(boardHeight(plan, 500), 100 + 140 + 60 + 16);
});

test('the largest zoom is found without a layout, even where a line break makes the height jump', () => {
  const plan = { gap: 8, balance, runs: [{ widths: Array(12).fill(250), heights: Array(12).fill(400) }] };
  const width = 1400;
  const predict = (z) => 40 + z * (180 + boardHeight(plan, width / z));
  const target = 860;
  const z = largestZoom(predict, target);
  assert.ok(predict(z) <= target, `fits at ${z}`);
  assert.ok(predict(Math.min(1, z * 1.01)) > target || z === 1, 'and a step larger does not');
  // An upper bound is honoured, for a guess that is re-made below a miss.
  assert.ok(largestZoom(predict, target, MIN_ZOOM, z * 0.9) <= z * 0.9);
  // A page that fits at 1 is left at 1, and one that never fits ends on the floor.
  assert.equal(largestZoom(() => 100, 860), 1);
  assert.equal(largestZoom(() => 5000, 860), MIN_ZOOM);
});

/* ── The switch as the rest of the product sees it ──────────────── */

function defaults() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'js', 'app.js'), 'utf8');
  const open = source.indexOf('{', source.indexOf('const DEFAULT_CONFIG = {'));
  const close = source.indexOf('\n};', open);
  return new Function(`return ${source.slice(open, close + 2)}`)();
}

test('it is off for everybody until they turn it on', () => {
  assert.equal(defaults().onePageFit, false);
});

test('a backup says true or false, and nothing else passes', () => {
  assert.equal(schema.validateConfig({ onePageFit: true, groups: [] }).ok, true);
  assert.equal(schema.validateConfig({ onePageFit: false, groups: [] }).ok, true);
  const refused = schema.validateConfig({ onePageFit: 'yes', groups: [] });
  assert.equal(refused.ok, false);
  assert.match(refused.errors.join('\n'), /onePageFit should be a boolean/);
});

test('a stored switch of the wrong kind goes back to off', () => {
  const stored = { onePageFit: 'on', groups: [] };
  assert.equal(schema.repairConfig(stored, defaults()), true);
  assert.equal(stored.onePageFit, false);
});

function firstFrame(stored) {
  const attributes = new Map();
  const root = {
    classList: { add() {} },
    style: {},
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const storage = { getItem: (key) => (key === 'nordlys_config' && stored !== undefined ? JSON.stringify(stored) : null) };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'js', 'boot.js'), 'utf8'), {
    document: { documentElement: root },
    window: { addEventListener() {} },
    localStorage: storage,
    requestAnimationFrame() {}
  });
  return attributes;
}

test('the first frame is laid out for the fit only when it is on', () => {
  assert.equal(firstFrame({ onePageFit: true, groups: [] }).get('data-page-fit'), 'on');
  assert.equal(firstFrame({ onePageFit: false, groups: [] }).has('data-page-fit'), false);
  assert.equal(firstFrame({ onePageFit: 'true', groups: [] }).has('data-page-fit'), false);
  assert.equal(firstFrame(undefined).has('data-page-fit'), false);
});

test('the page loads the fit after the board it measures, and its sheet last', () => {
  const markup = fs.readFileSync(path.join(ROOT, 'newtab.html'), 'utf8');
  const grid = markup.indexOf('src/js/grid.js');
  const pageFit = markup.indexOf('src/js/page-fit.js');
  const app = markup.indexOf('src/js/app.js');
  assert.ok(grid > 0 && pageFit > grid && app > pageFit);
  const sheets = [...markup.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(sheets.at(-1), 'src/css/page-fit.css');
});

test('the surface holds the page content and nothing that is fixed to the window', () => {
  const markup = fs.readFileSync(path.join(ROOT, 'newtab.html'), 'utf8');
  const open = markup.indexOf('<div id="fit-surface"');
  const close = markup.indexOf('</main>');
  assert.ok(open > 0 && close > open);
  const inside = markup.slice(open, close);
  for (const id of ['hero', 'searchwrap', 'board', 'hiddenDock']) assert.ok(inside.includes(`id="${id}"`), `${id} is inside`);
  for (const id of ['gear', 'cfg', 'toast-dock', 'quick-edit-modal']) assert.ok(!inside.includes(`id="${id}"`), `${id} is outside`);
});

test('every rule the fit adds waits for the switch', () => {
  const sheet = fs.readFileSync(path.join(ROOT, 'src', 'css', 'page-fit.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...sheet.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((match) => match[1].trim());
  assert.ok(selectors.length > 3);
  for (const selector of selectors) {
    if (selector === '.fit-surface') continue; // display: contents — draws no box at all
    // The commas between selectors, not the ones inside :is() or :where(:not()).
    const parts = [''];
    let depth = 0;
    for (const char of selector) {
      if (char === ',' && depth === 0) { parts.push(''); continue; }
      if (char === '(') depth++;
      if (char === ')') depth--;
      parts[parts.length - 1] += char;
    }
    for (const part of parts) assert.match(part.trim(), /^html\[data-page-fit="on"\]/, part);
  }
});

/* ── What a new tab remembers ───────────────────────────────────── */

test('a remembered answer is keyed by a fingerprint that any change moves', () => {
  const key = fingerprint('1|960|540|2|en|{"groups":[]}');
  assert.equal(fingerprint('1|960|540|2|en|{"groups":[]}'), key, 'the same page, the same key');
  for (const other of ['1|961|540|2|en|{"groups":[]}', '1|960|540|1|en|{"groups":[]}', '1|960|540|2|de|{"groups":[]}', '1|960|540|2|en|{"groups":[{}]}']) {
    assert.notEqual(fingerprint(other), key, other);
  }
  assert.ok(key.length < 20, 'short enough to keep a few of');
});

test('only a compact or scaled answer made of short custom properties is worn', () => {
  const good = { key: 'k', stage: 'scaled', t: 1, zoom: 0.5, need: 520, wide: true, values: { '--fit-zoom': '0.5', '--tw': 'clamp(56px, 12vw, 56px)' } };
  assert.equal(validHint(good), true);
  assert.equal(validHint({ ...good, stage: 'natural' }), false, 'natural needs nothing kept');
  assert.equal(validHint({ ...good, need: 'tall' }), false);
  assert.equal(validHint({ ...good, values: { color: 'red' } }), false, 'a property that is not the fit\'s own');
  assert.equal(validHint({ ...good, values: { '--fit-zoom': 'x'.repeat(300) } }), false, 'a value no fit writes');
  assert.equal(validHint({ ...good, values: { '--fit-zoom': 0.5 } }), false);
  assert.equal(validHint(null), false);
});

test('a reset clears what the fit remembers, and a backup never carries it', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src', 'js', 'app.js'), 'utf8');
  const owned = app.slice(app.indexOf('const OWNED_LOCAL_KEYS = ['), app.indexOf('];', app.indexOf('const OWNED_LOCAL_KEYS = [')));
  assert.ok(owned.includes(`"${HINT_STORE}"`), 'in the list a reset removes');
  const side = app.slice(app.indexOf('const SIDE_STORAGE'), app.indexOf('};', app.indexOf('const SIDE_STORAGE')));
  assert.ok(!side.includes(HINT_STORE), 'not one of the stores a backup or a recovery point takes');
  assert.equal(defaults().fitHint, undefined, 'and never part of the config');
});
