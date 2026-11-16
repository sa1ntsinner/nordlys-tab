const test = require('node:test');
const assert = require('node:assert');
const autosave = require('../../src/js/autosave.js');

const DAY = 86400000;
const now = new Date(2026, 10, 16, 12, 0, 0).getTime();

test('the newest ten are kept whatever their age', () => {
  const ids = Array.from({ length: 14 }, (_, i) => now - i * 60000);
  const keep = autosave.kept(ids, now);
  for (const id of ids.slice(0, 10)) assert.ok(keep.has(id));
});

test('older than the newest ten, one copy a day stays: the last of that day', () => {
  const today = Array.from({ length: 12 }, (_, i) => now - i * 60000);
  const yesterday = [now - DAY, now - DAY - 3600000, now - DAY - 7200000];
  const keep = autosave.kept([...today, ...yesterday], now);
  assert.ok(keep.has(yesterday[0]));
  assert.ok(!keep.has(yesterday[1]));
  assert.ok(!keep.has(yesterday[2]));
  // The eleventh and twelfth of today are neither among the newest ten nor the day's last.
  assert.ok(!keep.has(today[10]));
  assert.ok(!keep.has(today[11]));
});

test('a copy older than thirty days goes, unless it is among the newest ten', () => {
  const recent = Array.from({ length: 10 }, (_, i) => now - i * DAY);
  const old = now - 45 * DAY;
  assert.ok(!autosave.kept([...recent, old], now).has(old));
  assert.ok(autosave.kept([now, old], now).has(old));
});

test('two files alike but for the moment they were written are one setup', () => {
  const a = { groups: [{ links: [{ url: 'https://a.example' }] }], nordlysBackup: { formatVersion: 1, savedAt: '2026-11-16T10:00:00.000Z' } };
  const b = JSON.parse(JSON.stringify(a));
  b.nordlysBackup.savedAt = '2026-11-16T11:00:00.000Z';
  assert.strictEqual(autosave.mark(a), autosave.mark(b));
  b.groups[0].links.push({ url: 'https://b.example' });
  assert.notStrictEqual(autosave.mark(a), autosave.mark(b));
  assert.strictEqual(a.nordlysBackup.savedAt, '2026-11-16T10:00:00.000Z');
});

test('a copy says how many bookmarks and folders it holds', () => {
  assert.deepStrictEqual(autosave.count({ groups: [{ links: [1, 2] }, { links: [3] }, {}] }), { folders: 3, links: 3 });
  assert.deepStrictEqual(autosave.count(null), { folders: 0, links: 0 });
});
