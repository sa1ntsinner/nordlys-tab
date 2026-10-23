const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* The page layouts, the parts that are not a picture: one list of them as
   the schema, a shared look, the settings and the stylesheet see it, a sheet
   that draws nothing until a layout is chosen, the first frame, and the
   command that chooses one. What each looks like is
   tests/ui/page-layouts.spec.cjs. */

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const schema = require('../../src/js/config-schema.js');
const commands = require('../../src/js/commands.js');
const LAYOUTS = ['board', 'columns', 'dock', 'today', 'prompt', 'poster'];

test('one list of layouts: the schema, a shared look, the settings and the sheet', () => {
  for (const layout of LAYOUTS) {
    const config = { pageLayout: layout, groups: [] };
    assert.equal(schema.repairConfig(config, {}), false, `${layout} is kept as it is`);
  }
  const radios = [...read('newtab.html').matchAll(/data-page-layout="([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(radios, LAYOUTS, 'the settings offer every layout, the default first');
  const drawn = new Set([...read('src', 'css', 'layouts.css').matchAll(/\[data-page="([a-z]+)"\]/g)].map((match) => match[1]));
  assert.deepEqual([...drawn].sort(), LAYOUTS.filter((layout) => layout !== 'board').sort(), 'the sheet draws every layout but the board, which is the page as it is');
  const share = read('src', 'js', 'look-share.js').match(/pageLayout: oneOf\(\[([^\]]+)\]\)/);
  assert.deepEqual(share[1].split(',').map((word) => word.trim().replace(/'/g, '')), LAYOUTS, 'a shared look knows the same layouts');
});

test('a layout this version does not know goes back to the board', () => {
  const config = { pageLayout: 'masonry', groups: [] };
  assert.equal(schema.repairConfig(config, {}), true);
  assert.equal(config.pageLayout, 'board');
});

test('a shared look carries the layout of the page', () => {
  const window = {};
  vm.runInContext(read('src', 'js', 'look-share.js'), vm.createContext({ window, TextEncoder, TextDecoder, btoa, atob }));
  const { capture, encode, decode } = window.NordlysLook;
  assert.equal(decode(encode(capture({ theme: 'nord-frost', pageLayout: 'dock', groups: [] }))).look.pageLayout, 'dock');
  assert.equal(decode(encode({ pageLayout: 'masonry' })).error, 'empty', 'a layout this version does not know is dropped');
});

/* Every rule waits for a layout, so with the board chosen the sheet draws
   nothing at all and the page is what the other sheets make it. */
test('every rule in the sheet waits for a layout', () => {
  const sheet = read('src', 'css', 'layouts.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '');
  const selectors = [...sheet.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((match) => match[1].trim()).filter(Boolean);
  assert.ok(selectors.length > 20);
  for (const selector of selectors) {
    // The commas between selectors, not the ones inside :is() or :not().
    const parts = [''];
    let depth = 0;
    for (const char of selector) {
      if (char === ',' && depth === 0) { parts.push(''); continue; }
      if (char === '(') depth++;
      if (char === ')') depth--;
      parts[parts.length - 1] += char;
    }
    for (const part of parts) assert.match(part.trim(), /^:root(\[data-page="[a-z]+"\]|:is\(\[data-page="[a-z]+"\](, \[data-page="[a-z]+"\])*\))/, part);
  }
});

test('the layouts load before One page fit, whose sheet stays last', () => {
  const sheets = [...read('newtab.html').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sheets.slice(-2), ['src/css/layouts.css', 'src/css/page-fit.css']);
});

function firstFrame(stored) {
  const attributes = new Map();
  const root = { classList: { add() {} }, style: {}, setAttribute: (name, value) => attributes.set(name, value) };
  const storage = { getItem: (key) => (key === 'nordlys_config' && stored !== undefined ? JSON.stringify(stored) : null) };
  vm.runInNewContext(read('src', 'js', 'boot.js'), {
    document: { documentElement: root },
    window: { addEventListener() {} },
    localStorage: storage,
    requestAnimationFrame() {}
  });
  return attributes;
}

test('the first frame is already the layout that was chosen', () => {
  assert.equal(firstFrame({ pageLayout: 'poster', groups: [] }).get('data-page'), 'poster');
  assert.equal(firstFrame({ pageLayout: 'board', groups: [] }).has('data-page'), false, 'the board has no mark');
  assert.equal(firstFrame({ groups: [] }).has('data-page'), false);
  assert.equal(firstFrame(undefined).has('data-page'), false);
});

test('"page" and "view" choose a layout by its name', () => {
  const world = { pages: [{ key: 'board', name: 'Board' }, { key: 'columns', name: 'Columns' }, { key: 'dock', name: 'Dock' }, { key: 'poster', name: 'Poster' }] };
  assert.deepEqual(commands.parse('page col', world).candidates.map((candidate) => [candidate.kind, candidate.target.key]), [['page', 'columns']]);
  assert.equal(commands.parse('view dock', world).candidates[0].target.key, 'dock');
  // In another language the verb and the names are its own.
  assert.equal(commands.parse('страница пост', { pages: [{ key: 'columns', name: 'Колонки' }, { key: 'poster', name: 'Постер' }] }, { verbs: { page: ['страница', 'вид'] } }).candidates[0].target.key, 'poster');
  // "layout" stays the way into arranging the board.
  assert.equal(commands.parse('layout', world).candidates[0].kind, 'arrange');
});
