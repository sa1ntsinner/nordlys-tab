const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/* A new install used to open on the author's own board: five folders and
   twenty-two links, two of them the student portals of one German university.
   The product's promise is that it shows nothing you did not put there, and the
   first ninety seconds were the one place it broke that promise.

   Asserted against the source rather than a running page, so it fails at
   `npm run test:unit` — before a build, before a browser — and so it cannot be
   satisfied by a page that merely happens to render nothing. */

const SOURCE_PATH = path.join(__dirname, '..', '..', 'src', 'js', 'app.js');
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

function defaults() {
  const start = SOURCE.indexOf('const DEFAULT_CONFIG = {');
  assert.ok(start >= 0, 'DEFAULT_CONFIG is no longer declared in src/js/app.js');
  const open = SOURCE.indexOf('{', start);
  const close = SOURCE.indexOf('\n};', open);
  assert.ok(close > open, 'DEFAULT_CONFIG is not a plain object literal any more');
  return new Function(`return ${SOURCE.slice(open, close + 2)}`)();
}

test('a fresh install ships no folders at all', () => {
  assert.deepStrictEqual(defaults().groups, [],
    'the defaults seed a board again — a new user must start on their own empty space');
});

/* Written so it keeps meaning if the defaults ever gain named empty folders:
   a folder is allowed, a link inside one is not. */
test('no seeded folder carries a link', () => {
  const seeded = defaults().groups.filter(group => (group.links || []).length);
  assert.deepStrictEqual(seeded.map(group => group.label), [],
    'a default folder arrived with links in it');
});

test('the shipped defaults name no third-party address', () => {
  const start = SOURCE.indexOf('const DEFAULT_CONFIG = {');
  const block = SOURCE.slice(start, SOURCE.indexOf('\n};', start));
  const urls = [...block.matchAll(/https?:\/\/[^\s"'`]+/g)].map(match => match[0]);
  assert.deepStrictEqual(urls, [], `addresses still shipped by default:\n${urls.join('\n')}`);
});

/* The two links that made the defect impossible to argue with. Checked across
   the whole file, not only the config block, so moving them somewhere else in
   app.js does not pass. */
test('nothing in the orchestrator points at one person\'s university', () => {
  const found = [...SOURCE.matchAll(/[\w.-]*tu-dortmund[\w.-]*/gi)].map(match => match[0]);
  assert.deepStrictEqual([...new Set(found)], [], 'a personal portal is still hard-coded');
});
