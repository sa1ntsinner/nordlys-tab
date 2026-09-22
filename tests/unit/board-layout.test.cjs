const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../../src/js/board-layout.js');

const folders = (...labels) => labels.map(label => ({ label, links: [] }));

/* The board in the screenshot that asked for this: nine folders measured at
   2000px, where the old wrap put six on top and three underneath. */
const USER = [200, 200, 200, 200, 288, 200, 214, 200, 376];

test('a board that fits on one line stays on one line', () => {
  assert.deepEqual(layout.balance([200, 200, 200], 14, 1400), [3]);
  assert.deepEqual(layout.balance([], 14, 1400), []);
});

test('two lines come out of a similar width, not a full one and a stub', () => {
  assert.deepEqual(layout.balance(USER, 14, 1400), [5, 4]);
  const greedy = [6, 3];
  const width = (counts) => {
    let at = 0;
    return counts.map(count => {
      const line = USER.slice(at, at += count);
      return line.reduce((sum, w) => sum + w, 0) + 14 * (line.length - 1);
    });
  };
  const [top, bottom] = width(layout.balance(USER, 14, 1400));
  const [greedyTop, greedyBottom] = width(greedy);
  assert.ok(Math.abs(top - bottom) < Math.abs(greedyTop - greedyBottom), 'balanced lines must be closer in width than greedy ones');
});

test('never more lines than the width requires, and none wider than it', () => {
  for (const capacity of [420, 640, 900, 1180, 1400]) {
    const counts = layout.balance(USER, 14, capacity);
    let fewest = 1;
    for (let start = 0, sum = -14, i = 0; i < USER.length; i++) {
      sum += 14 + USER[i];
      if (sum > capacity && i > start) { fewest++; start = i; sum = USER[i]; }
    }
    assert.equal(counts.length, fewest, `at ${capacity}px`);
    assert.equal(counts.reduce((a, b) => a + b, 0), USER.length);
    let at = 0;
    for (const count of counts) {
      const line = USER.slice(at, at += count);
      const width = line.reduce((sum, w) => sum + w, 0) + 14 * (line.length - 1);
      assert.ok(count === 1 || width <= capacity + 0.05, `a line of ${width}px at ${capacity}px`);
    }
  }
});

test('a tie gives the extra folder to the earlier line', () => {
  assert.deepEqual(layout.balance([200, 200, 200, 200, 200, 200, 200], 14, 1000), [4, 3]);
});

test('a folder wider than the window still gets a line of its own', () => {
  assert.deepEqual(layout.balance([900, 200, 200], 14, 600), [1, 2]);
});

test('rows are the board\'s own until a folder carries one', () => {
  const groups = folders('A', 'B', 'C');
  groups[1].hidden = true;
  assert.equal(layout.hasRows(groups), false);
  assert.deepEqual(layout.rowsOf(groups), [[0, 2]]);
  groups[0].row = 0; groups[1].row = 0; groups[2].row = 1;
  assert.deepEqual(layout.rowsOf(groups), [[0], [2]]);
  assert.deepEqual(layout.rowsOf([]), []);
});

test('commit writes what is on screen: reading order and a row for every folder', () => {
  const groups = folders('A', 'B', 'C', 'D');
  const where = layout.commit(groups, [[2, 0], [3, 1]]);
  assert.deepEqual(groups.map(g => g.label), ['C', 'A', 'D', 'B']);
  assert.deepEqual(groups.map(g => g.row), [0, 0, 1, 1]);
  assert.deepEqual(where, [1, 3, 0, 2]);
});

test('a hidden folder stays beside the folder in front of it, not the one being moved', () => {
  const groups = folders('A', 'B', 'H', 'C');
  groups[2].hidden = true;
  // B moves to the end: H should stay after A, not follow B.
  layout.commit(groups, [[0, 3, 1]], 1);
  assert.deepEqual(groups.map(g => g.label), ['A', 'H', 'C', 'B']);
  const again = folders('A', 'H', 'B');
  again[1].hidden = true;
  // A moves after B: H keeps its place at the front.
  layout.commit(again, [[2, 0]], 0);
  assert.deepEqual(again.map(g => g.label), ['H', 'B', 'A']);
});

test('normalise gives newcomers a row, closes gaps and reads row by row', () => {
  const groups = folders('A', 'B', 'C', 'D');
  groups[0].row = 3; groups[1].row = 3; groups[2].row = 7;
  // D has no row: it joins C.
  assert.equal(layout.normalise(groups), true);
  assert.deepEqual(groups.map(g => g.row), [0, 0, 1, 1]);
  const scrambled = folders('A', 'B', 'C');
  scrambled[0].row = 1; scrambled[1].row = 0; scrambled[2].row = 1;
  layout.normalise(scrambled);
  assert.deepEqual(scrambled.map(g => g.label), ['B', 'A', 'C']);
  assert.equal(layout.normalise(scrambled), false, 'a coherent board is left alone');
});

test('a row of nothing but hidden folders folds into the row in front of it', () => {
  const groups = folders('A', 'H', 'B');
  groups[0].row = 0; groups[1].row = 1; groups[1].hidden = true; groups[2].row = 2;
  layout.normalise(groups);
  assert.deepEqual(groups.map(g => g.row), [0, 0, 1]);
  assert.deepEqual(layout.rowsOf(groups), [[0], [2]]);
});

test('normalise without rows removes stray row values', () => {
  const groups = folders('A');
  groups[0].row = 'top';
  assert.equal(layout.normalise(groups), true);
  assert.equal('row' in groups[0], false);
});

test('arrow keys walk the reading order and change rows', () => {
  const lines = [[0, 1, 2], [3, 4]];
  assert.deepEqual(layout.step(lines, 1, 'ArrowLeft'), [[1, 0, 2], [3, 4]]);
  assert.deepEqual(layout.step(lines, 2, 'ArrowRight'), [[0, 1], [2, 3, 4]], 'past the end of a row into the next');
  assert.deepEqual(layout.step(lines, 3, 'ArrowLeft'), [[0, 1, 2, 3], [4]], 'past the start into the row above');
  assert.equal(layout.step(lines, 0, 'ArrowLeft'), null);
  assert.equal(layout.step(lines, 4, 'ArrowRight'), null);
  assert.deepEqual(layout.step(lines, 4, 'ArrowUp'), [[0, 4, 1, 2], [3]], 'up keeps roughly the same place along the row');
  assert.deepEqual(layout.step(lines, 1, 'ArrowDown'), [[0, 2], [3, 1, 4]]);
  assert.deepEqual(layout.step(lines, 0, 'ArrowUp'), [[0], [1, 2], [3, 4]], 'above the first row opens a new one');
  assert.deepEqual(layout.step(lines, 3, 'ArrowDown'), [[0, 1, 2], [4], [3]], 'below the last row opens a new one');
  assert.equal(layout.step([[0], [1, 2]], 0, 'ArrowUp'), null, 'a folder alone on top has nowhere higher to go');
  assert.deepEqual(layout.step([[0], [1, 2]], 0, 'ArrowDown'), [[0, 1, 2]], 'an emptied row closes');
});

test('place drops a folder into a row or opens a new one', () => {
  const lines = [[0, 1, 2], [3, 4]];
  assert.deepEqual(layout.place(lines, 4, { row: 0, before: 1 }), [[0, 4, 1, 2], [3]]);
  assert.deepEqual(layout.place(lines, 0, { row: 1, before: null }), [[1, 2], [3, 4, 0]]);
  assert.deepEqual(layout.place(lines, 2, { newRow: 1 }), [[0, 1], [2], [3, 4]]);
  assert.deepEqual(layout.place(lines, 3, { newRow: 2 }), [[0, 1, 2], [4], [3]]);
  assert.deepEqual(layout.place([[0], [1]], 0, { row: 1, before: 1 }), [[0, 1]], 'leaving a row empty closes it');
});

test('tidy puts folders of one height on one row, tallest first', () => {
  // The screenshot's board: five folders two tiles tall, four one tile tall.
  const heights = [304, 304, 304, 191, 304, 191, 191, 191, 304];
  const items = USER.map((width, index) => ({ index, width, height: heights[index] }));
  assert.deepEqual(layout.tidy(items, 14, 1400), [[0, 1, 2, 4, 8], [3, 5, 6, 7]]);
});

test('tidy never builds a row wider than the window', () => {
  const heights = [304, 304, 304, 191, 304, 191, 191, 191, 304];
  const items = USER.map((width, index) => ({ index, width, height: heights[index] }));
  for (const capacity of [640, 900, 1180]) {
    for (const line of layout.tidy(items, 14, capacity)) {
      const width = line.reduce((sum, index) => sum + USER[index], 0) + 14 * (line.length - 1);
      assert.ok(line.length === 1 || width <= capacity + 0.05, `a line of ${width}px at ${capacity}px`);
    }
  }
});

test('tidy keeps one tall folder with its neighbours rather than alone on a row', () => {
  // One folder a little taller than the rest is not worth a row of its own.
  const items = [200, 200, 200, 200].map((width, index) => ({ index, width, height: index === 2 ? 210 : 191 }));
  assert.deepEqual(layout.tidy(items, 14, 1400), [[2, 0, 1, 3]]);
  assert.deepEqual(layout.tidy([], 14, 1400), []);
});

test('the settings list steps through rows the way the arrow keys do', () => {
  const board = () => {
    const groups = folders('A', 'B', 'C', 'D');
    groups.forEach((g, i) => { g.row = i < 2 ? 0 : 1; });
    return groups;
  };
  const shape = groups => layout.rowsOf(groups).map(line => line.map(i => groups[i].label).join('')).join('|');
  const groups = board();
  const d = () => groups.findIndex(g => g.label === 'D');
  layout.shift(groups, d(), -1);
  assert.equal(shape(groups), 'AB|DC');
  layout.shift(groups, d(), -1);
  assert.equal(shape(groups), 'ABD|C', 'first of a row steps to the end of the row above');
  layout.shift(groups, d(), -1);
  assert.equal(shape(groups), 'ADB|C');
  const automatic = folders('A', 'B', 'C');
  assert.equal(layout.shift(automatic, 2, -1), 1);
  assert.deepEqual(automatic.map(g => g.label), ['A', 'C', 'B']);
  assert.equal(layout.shift(automatic, 0, -1), -1, 'nothing moves before the first folder');
});

test('a hidden folder moved in the list stays where it was put', () => {
  const groups = folders('A', 'B', 'H', 'C', 'D');
  groups.forEach((g, i) => { g.row = i < 3 ? 0 : 1; });
  groups[2].hidden = true;
  layout.shift(groups, 2, 1);
  assert.deepEqual(groups.map(g => g.label), ['A', 'B', 'C', 'H', 'D']);
  assert.equal(groups[3].row, 1);
});
