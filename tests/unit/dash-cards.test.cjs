const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tidy, IDLE_DAYS } = require('../../src/js/dash-cards.js');

/* The Open tabs card (dash-cards.js): which tabs are open twice and which
   have been left for days, worked out from what the browser lists. */

const DAY = 86400e3;
const NOW = Date.parse('2026-10-23T12:00:00Z');
const SELF = 'chrome-extension://nordlys/';

test('a page open twice keeps the copy in front, else the one looked at last', () => {
  const tabs = [
    { id: 1, windowId: 1, url: 'https://docs.test/a', lastAccessed: NOW - 50 },
    { id: 2, windowId: 1, url: 'https://docs.test/a#part', lastAccessed: NOW - 10 },
    { id: 3, windowId: 2, url: 'https://docs.test/a', active: true, lastAccessed: NOW - 90 },
    { id: 4, windowId: 2, url: 'https://news.test/', lastAccessed: NOW - 20 },
    { id: 5, windowId: 2, url: 'https://news.test/', lastAccessed: NOW - 30 }
  ];
  const { count, windows, twice } = tidy(tabs, NOW, SELF);
  assert.equal(count, 5);
  assert.equal(windows, 2);
  assert.deepEqual(twice.map((group) => [group.keep.id, group.extra.map((tab) => tab.id)]), [[3, [2, 1]], [4, [5]]]);
});

test('a tab left for days is one nobody has looked at since, and never one pinned, playing or in front', () => {
  const old = NOW - (IDLE_DAYS + 1) * DAY;
  const tabs = [
    { id: 1, url: 'https://old.test/1', lastAccessed: old },
    { id: 2, url: 'https://old.test/2', lastAccessed: old - DAY },
    { id: 3, url: 'https://pinned.test/', pinned: true, lastAccessed: old },
    { id: 4, url: 'https://music.test/', audible: true, lastAccessed: old },
    { id: 5, url: 'https://front.test/', active: true, lastAccessed: old },
    { id: 6, url: 'https://fresh.test/', lastAccessed: NOW - DAY },
    { id: 7, url: 'https://unknown.test/' },
    { id: 8, url: `${SELF}newtab.html`, lastAccessed: old },
    { id: 9, url: 'chrome://settings/', lastAccessed: old }
  ];
  assert.deepEqual(tidy(tabs, NOW, SELF).left.map((tab) => tab.id), [2, 1], 'oldest first');
});

test('a copy is told once: as a copy, not also as left', () => {
  const old = NOW - 9 * DAY;
  const { twice, left } = tidy([{ id: 1, url: 'https://a.test/', lastAccessed: old }, { id: 2, url: 'https://a.test/', lastAccessed: old - 1 }], NOW, SELF);
  assert.deepEqual(twice.map((group) => group.extra.map((tab) => tab.id)), [[2]]);
  assert.deepEqual(left.map((tab) => tab.id), [1]);
});
