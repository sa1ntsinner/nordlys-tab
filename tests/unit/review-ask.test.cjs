const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../src/js/review-ask.js');

// Asked for after two weeks and thirty new tabs, and never once answered.
test('the review is asked for after two weeks and thirty tabs, and only once', () => {
  const day = 86400000;
  const after = (state, now) => R.count(state, now);
  assert.equal(after(null, 0).due, false, 'the first tab');
  assert.deepEqual(after(null, 5).state, { since: 5, tabs: 1, done: false });
  assert.equal(after({ since: 0, tabs: 28 }, 20 * day).due, false, 'not enough tabs');
  assert.equal(after({ since: 0, tabs: 40 }, 13 * day).due, false, 'not long enough');
  assert.equal(after({ since: 0, tabs: 29 }, 14 * day).due, true);
  assert.equal(after({ since: 0, tabs: 90, done: true }, 90 * day).due, false, 'answered');
});
