const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validateConfig, normalizeImportConfig, repairConfig } = require('../../src/js/config-schema.js');

const good = () => ({
  version: '2.2.3', theme: 'aurora-void', tileSize: 56, showSeconds: false,
  groups: [{ label: 'WORK', cols: 4, hidden: false, links: [
    { name: 'GitHub', url: 'https://github.com', icon: 'github', color: '#fff' }
  ] }]
});

test('a well-formed export passes', () => {
  assert.deepEqual(validateConfig(good()), { ok: true, errors: [] });
});

test('unknown fields are allowed through, so newer exports still import', () => {
  const candidate = { ...good(), somethingFromTheFuture: { nested: true } };
  assert.equal(validateConfig(candidate).ok, true);
});

test('old exports canonicalise numeric range strings before validation', () => {
  const candidate = { version: '2.0.0', cardRadius: '22', tileSize: '86', bgDim: '0.4', groups: [] };
  assert.equal(normalizeImportConfig(candidate), candidate);
  assert.deepEqual(candidate, { version: '2.0.0', cardRadius: 22, tileSize: 86, bgDim: 0.4, groups: [] });
  assert.equal(validateConfig(candidate).ok, true);
});

test('import normalisation never guesses at malformed numeric values', () => {
  for (const tileSize of ['', '86px', 'not-a-number']) {
    const candidate = { tileSize, groups: [] };
    normalizeImportConfig(candidate);
    assert.equal(validateConfig(candidate).ok, false, tileSize);
  }
});

/* The exact file that used to be accepted, saved, and then crashed every open. */
test('groups that is not a list is refused, with the reason', () => {
  const result = validateConfig({ theme: 'aurora-void', groups: {} });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['groups should be a list, not object']);
});

test('a folder whose links is not a list is refused', () => {
  const result = validateConfig({ groups: [{ label: 'X', links: 'nope' }] });
  assert.deepEqual(result.errors, ['folder 1: links should be a list']);
});

test('every wrong type is named, not just the first', () => {
  const result = validateConfig({ theme: 3, tileSize: 'big', showSeconds: 'yes', groups: [] });
  assert.deepEqual(result.errors, [
    'theme should be a string, not number',
    'tileSize should be a number, not string',
    'showSeconds should be a boolean, not string'
  ]);
});

test('a bookmark without a text url is refused', () => {
  const result = validateConfig({ groups: [{ links: [{ name: 'x' }] }] });
  assert.deepEqual(result.errors, ['folder 1, bookmark 1: url should be text']);
});

test('a url that would run code is refused', () => {
  for (const url of ['javascript:alert(1)', ' JavaScript:void(0)', 'data:text/html,hi', 'java\nscript:alert(1)', '\tjavascript:x', 'j\u0000avascript:x']) {
    const result = validateConfig({ groups: [{ links: [{ url }] }] });
    assert.equal(result.ok, false, url);
    assert.match(result.errors[0], /must open a page/);
  }
});

test('column counts outside the grid are refused', () => {
  assert.equal(validateConfig({ groups: [{ cols: 0 }] }).ok, false);
  assert.equal(validateConfig({ groups: [{ cols: 9 }] }).ok, false);
  assert.equal(validateConfig({ groups: [{ cols: 2.5 }] }).ok, false);
  assert.equal(validateConfig({ groups: [{ cols: 8 }] }).ok, true);
});

test('things that are not objects at all are refused with one clear line', () => {
  for (const candidate of [null, [], 'text', 42]) {
    assert.deepEqual(validateConfig(candidate), { ok: false, errors: ['the file does not contain a settings object'] });
  }
});

/* Repair is for what is already stored: hold what can be held, report that
   something changed so the original is kept. */
test('repair turns a non-list groups into an empty list and says so', () => {
  const config = { theme: 'aurora-void', groups: {} };
  assert.equal(repairConfig(config), true);
  assert.deepEqual(config.groups, []);
});

test('repair drops what cannot be a folder or a bookmark, and keeps the rest', () => {
  const config = { groups: [null, { label: 'A', links: [{ url: 'https://a.test' }, 'junk', { name: 'no url' }, { url: 'javascript:1' }] }, { label: 'B' }] };
  assert.equal(repairConfig(config), true);
  assert.equal(config.groups.length, 2);
  assert.deepEqual(config.groups[0].links, [{ url: 'https://a.test' }]);
  assert.deepEqual(config.groups[1].links, []);
});

test('repair leaves a sound config untouched and says nothing changed', () => {
  const config = good();
  const before = JSON.stringify(config);
  assert.equal(repairConfig(config), false);
  assert.equal(JSON.stringify(config), before);
});
