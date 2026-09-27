const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../../src/js/dash-layout.js');

const item = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const at = (items, id) => { const i = items.find(it => it.id === id); return [i.x, i.y, i.w, i.h]; };
const overlaps = items => {
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (L.collides(items[i], items[j])) return [items[i].id, items[j].id];
  return null;
};

test('two items collide only when their cells overlap', () => {
  assert.strictEqual(L.collides(item('a', 0, 0, 3, 2), item('b', 3, 0, 3, 2)), false, 'side by side');
  assert.strictEqual(L.collides(item('a', 0, 0, 3, 2), item('b', 2, 1, 3, 2)), true);
  assert.strictEqual(L.collides(item('a', 0, 0, 3, 2), item('b', 0, 2, 3, 2)), false, 'one below the other');
});

test('compacting lets every item rise until something holds it', () => {
  const out = L.compact([item('a', 0, 3, 6, 2), item('b', 6, 5, 6, 2), item('c', 0, 9, 3, 1)]);
  assert.deepStrictEqual(at(out, 'a'), [0, 0, 6, 2]);
  assert.deepStrictEqual(at(out, 'b'), [6, 0, 6, 2]);
  assert.deepStrictEqual(at(out, 'c'), [0, 2, 3, 1]);
});

test('an item dropped onto another pushes it down, and nothing overlaps after', () => {
  const start = L.compact([item('a', 0, 0, 6, 2), item('b', 6, 0, 6, 2), item('c', 0, 2, 12, 2)]);
  const out = L.move(start, 'c', 3, 0);
  assert.strictEqual(overlaps(out), null);
  assert.deepStrictEqual(at(out, 'c'), [0, 0, 12, 2], 'a full-width item is held inside the grid');
  assert.ok(out.find(i => i.id === 'a').y >= 2 && out.find(i => i.id === 'b').y >= 2);
});

test('moving is held inside the columns, and to whole cells', () => {
  const out = L.move([item('a', 0, 0, 4, 2)], 'a', 10.6, -3);
  assert.deepStrictEqual(at(out, 'a'), [8, 0, 4, 2]);
});

test('swapping two items of the same size in a row', () => {
  const start = [item('a', 0, 0, 6, 2), item('b', 6, 0, 6, 2)];
  const out = L.move(start, 'a', 6, 0);
  assert.strictEqual(overlaps(out), null);
  assert.deepStrictEqual(at(out, 'a'), [6, 0, 6, 2]);
  assert.deepStrictEqual(at(out, 'b'), [0, 0, 6, 2], 'the one it landed on takes the space it left');
});

test('resizing grows an item and makes room for it', () => {
  const start = [item('a', 0, 0, 3, 2), item('b', 3, 0, 3, 2), item('c', 0, 2, 3, 2)];
  const out = L.resize(start, 'a', 6, 3);
  assert.strictEqual(overlaps(out), null);
  assert.deepStrictEqual(at(out, 'a'), [0, 0, 6, 3]);
});

test('a resize keeps to the item\'s own smallest and largest sizes and to the grid', () => {
  const start = [item('a', 8, 0, 3, 2, { minW: 3, minH: 2, maxW: 6, maxH: 4 })];
  assert.deepStrictEqual(at(L.resize(start, 'a', 1, 1), 'a'), [8, 0, 3, 2]);
  assert.deepStrictEqual(at(L.resize(start, 'a', 9, 9), 'a'), [8, 0, 4, 4], 'wider than the grid allows from x=8 is cut to fit');
});

test('a new item takes the first place where it fits, reading like a page', () => {
  const start = [item('a', 0, 0, 6, 2), item('b', 9, 0, 3, 2)];
  assert.deepStrictEqual(L.firstFit(start, 3, 2), { x: 6, y: 0 });
  assert.deepStrictEqual(L.firstFit(start, 6, 2), { x: 0, y: 2 });
  assert.deepStrictEqual(L.firstFit([], 12, 2), { x: 0, y: 0 });
});

test('normalising repairs what a hand-edited or older layout could hold', () => {
  const out = L.normalize([item('a', -2, 1.4, 20, 0), item('b', 5, 0, 3, 2), { id: 'c' }], { c: { w: 4, h: 2 } });
  assert.strictEqual(overlaps(out), null);
  for (const i of out) {
    assert.ok(Number.isInteger(i.x) && Number.isInteger(i.y) && Number.isInteger(i.w) && Number.isInteger(i.h));
    assert.ok(i.x >= 0 && i.x + i.w <= L.COLS && i.w >= 1 && i.h >= 1);
  }
  assert.deepStrictEqual(at(out, 'c').slice(2), [4, 2], 'an item with no place gets its default size');
});

test('on a narrower screen the same order is kept, fitted to fewer columns', () => {
  const wide = L.compact([item('a', 0, 0, 6, 2), item('b', 6, 0, 3, 2), item('c', 9, 0, 3, 2), item('d', 0, 2, 12, 2)]);
  const six = L.reflow(wide, 6);
  assert.strictEqual(overlaps(six), null);
  assert.deepStrictEqual(six.map(i => i.id), ['a', 'b', 'c', 'd']);
  for (const i of six) assert.ok(i.x + i.w <= 6);
  const one = L.reflow(wide, 1);
  assert.deepStrictEqual(one.map(i => [i.x, i.w]), [[0, 1], [0, 1], [0, 1], [0, 1]]);
  assert.deepStrictEqual(one.map(i => i.y), [0, 2, 4, 6], 'stacked in reading order, each keeping its height');
});

test('nothing is changed in place: the caller\'s layout stays as it was', () => {
  const start = [item('a', 0, 0, 6, 2), item('b', 6, 0, 6, 2)];
  const copy = JSON.stringify(start);
  L.move(start, 'a', 6, 0);
  L.resize(start, 'a', 12, 2);
  L.compact(start);
  assert.strictEqual(JSON.stringify(start), copy);
});

test('the height of the whole layout, in rows', () => {
  assert.strictEqual(L.height([item('a', 0, 0, 6, 2), item('b', 0, 2, 3, 3)]), 5);
  assert.strictEqual(L.height([]), 0);
});

test('two cards of different sizes trade places, and the rest make room', () => {
  const start = [item('focus', 0, 0, 6, 2), item('tasks', 6, 0, 3, 3), item('timer', 9, 0, 3, 2)];
  const out = L.swap(start, 'tasks', 'focus');
  assert.strictEqual(overlaps(out), null);
  assert.deepStrictEqual(at(out, 'tasks'), [0, 0, 3, 3]);
  assert.deepStrictEqual(at(out, 'focus').slice(1), [0, 6, 2], 'the other goes where the first one was, on the same row');
  const reading = [...out].sort((a, b) => a.y - b.y || a.x - b.x).map(i => i.id);
  assert.deepStrictEqual(reading.slice(0, 2), ['tasks', 'focus']);
});
