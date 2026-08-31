const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LISTING = fs.readFileSync(
  path.join(__dirname, '..', '..', 'docs', 'store-listing.md'), 'utf8');

/* Every field in the Developer Dashboard has a cap, and going over is found at
   paste time — after the package is built, in a browser tab, by a person who
   then has to edit prose under pressure. The listing file exists to be pasted
   verbatim, so the caps belong here where they fail early. */
const BLOCK = /### (.+?) — (\d+) chars\n\n```\n([\s\S]*?)\n```/g;

test('every permission justification fits the dashboard field', () => {
  const blocks = [...LISTING.matchAll(BLOCK)];
  assert.ok(blocks.length >= 6, `expected a justification per permission, found ${blocks.length}`);
  const over = blocks
    .filter(([, , , body]) => body.length > 1000)
    .map(([, label, , body]) => `${label}: ${body.length}`);
  assert.deepStrictEqual(over, [], `over the 1000-character cap:\n${over.join('\n')}`);
});

/* The heading states the count. A stated number that nothing checks is a number
   that drifts — this repo has already shipped a release guide naming the
   previous version's archive. */
test('the stated character count is the real one', () => {
  const wrong = [...LISTING.matchAll(BLOCK)]
    .filter(([, , claimed, body]) => Number(claimed) !== body.length)
    .map(([, label, claimed, body]) => `${label}: says ${claimed}, is ${body.length}`);
  assert.deepStrictEqual(wrong, [], `stale counts:\n${wrong.join('\n')}`);
});

test('the summary fits the 132 characters the store allows', () => {
  const summary = LISTING.match(/## Summary \(132 characters maximum\)\n\n```\n([\s\S]*?)\n```/);
  assert.ok(summary, 'the listing has no summary block');
  assert.ok(summary[1].length <= 132, `summary is ${summary[1].length} characters`);
});
