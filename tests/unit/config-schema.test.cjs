const { test } = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../../src/js/config-schema.js');
const { validateConfig, normalizeImportConfig, repairConfig } = schema;

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

/* The corner slider was drawn over by a fixed 18px radius until the board
   learned layouts, so an old config's untouched 24 is migrated to the 18 its
   folders always showed — and only an old config's. */
test('an untouched corner radius from before layouts becomes the radius it showed', () => {
  const old = { cardRadius: 24, groups: [] };
  assert.equal(schema.migrateRaw(old), true);
  assert.equal(old.cardRadius, 18);
  const chosen = { cardRadius: 30, groups: [] };
  assert.equal(schema.migrateRaw(chosen), false);
  assert.equal(chosen.cardRadius, 30);
  const current = { cardRadius: 24, boardLayout: 'natural', groups: [] };
  assert.equal(schema.migrateRaw(current), false, 'a config that knows layouts chose its 24');
  assert.equal(current.cardRadius, 24);
});

test('rows and layouts are validated like every other field', () => {
  assert.equal(schema.validateConfig({ boardLayout: 'fitted', groups: [{ label: 'A', row: 2, links: [] }] }).ok, true);
  assert.deepEqual(schema.validateConfig({ boardLayout: 'grid', groups: [] }).errors, ['boardLayout should be "natural" or "fitted"']);
  assert.match(schema.validateConfig({ groups: [{ label: 'A', row: -1 }] }).errors[0], /row should be a whole number/);
  const stored = { boardLayout: 'masonry', groups: [] };
  assert.equal(schema.repairConfig(stored), true);
  assert.equal(stored.boardLayout, 'natural');
});

/* The addresses an icon came from ride along in the config; a damaged list
   is trimmed to what is sound, never a reason to refuse the rest. */
test('icon addresses are kept when sound and trimmed when not', () => {
  const config = good();
  const link = config.groups[0].links[0];
  link.iconUrl = 'https://cdn.test/a.png';
  link.iconUrls = [{ url: 'https://cdn.test/a.png', thumb: 'data:image/webp;base64,AA', at: 1 }];
  assert.equal(repairConfig(config), false);
  assert.equal(validateConfig(config).ok, true);

  link.iconUrl = 'javascript:alert(1)';
  link.iconUrls = [{ url: 'https://cdn.test/a.png', thumb: 'data:text/html,<b>' }, { url: 'ftp://x' }, 'nope'];
  assert.equal(repairConfig(config), true);
  assert.equal(link.iconUrl, undefined);
  assert.deepEqual(link.iconUrls, [{ url: 'https://cdn.test/a.png', thumb: '', at: 0 }]);

  link.iconUrls = 'not a list';
  assert.ok(validateConfig(config).errors.some(error => /iconUrls/.test(error)));
  assert.equal(repairConfig(config), true);
  assert.equal('iconUrls' in link, false);
});

/* Size and spacing: a width outside the three, or a folder gap outside the
   slider's reach, is put back rather than drawn. */
test('board width and folder spacing are repaired when out of range', () => {
  const config = { ...good(), boardWidth: 'enormous', boardGap: 400, tileLabels: false };
  assert.ok(validateConfig(config).errors.some(error => /boardWidth/.test(error)));
  assert.equal(repairConfig(config), true);
  assert.equal(config.boardWidth, 'standard');
  assert.equal('boardGap' in config, false);
  assert.equal(config.tileLabels, false);
  const sound = { ...good(), boardWidth: 'wide', boardGap: 24 };
  assert.equal(repairConfig(sound), false);
  assert.equal(validateConfig({ ...good(), tileLabels: 'yes' }).ok, false);
});

/* Found by fuzzing stored configs: a setting of the wrong kind crashed the
   page where it was used — a class name built from an object, a hash of a
   name that was a number — so the page never started. */
test('settings and bookmark fields of the wrong kind are put right, not crashed on', () => {
  const defaults = { hoverEffect: 'lift', tileSize: 78, showSeconds: false };
  const config = { ...good(), hoverEffect: { evil: true }, tileSize: 'huge', showSeconds: 'yes', customTheme: 7 };
  config.groups[0].label = 42;
  config.groups[0].cols = 'many';
  config.groups[0].links[0].name = ['not', 'text'];
  config.groups[0].links[0].color = 7;
  assert.equal(repairConfig(config, defaults), true);
  assert.equal(config.hoverEffect, 'lift');
  assert.equal(config.tileSize, 78);
  assert.equal(config.showSeconds, false);
  assert.equal('customTheme' in config, false);
  assert.equal('label' in config.groups[0], false);
  assert.equal('cols' in config.groups[0], false);
  assert.equal('name' in config.groups[0].links[0], false);
  assert.equal(config.groups[0].links[0].url, 'https://github.com');
  assert.equal(repairConfig(config, defaults), false, 'a repaired config needs nothing more');
});
