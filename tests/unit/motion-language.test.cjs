const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', '..', 'src', 'css');

/* Ambient loops are not part of the interaction language — they breathe on their
   own clock and are exempt by name, not by shape. */
const AMBIENT = [/animation:\s*pulse\s/];

function declarations() {
  return fs.readdirSync(CSS_DIR).filter(name => name.endsWith('.css')).flatMap(name => {
    const source = fs.readFileSync(path.join(CSS_DIR, name), 'utf8');
    return [...source.matchAll(/(?:transition|animation)\s*:[^;{}]*;/g)]
      .map(match => ({ file: name, text: match[0].replace(/\s+/g, ' ').trim() }))
      .filter(item => !AMBIENT.some(pattern => pattern.test(item.text)));
  });
}

/* Timing scattered across a dozen hand-picked values reads as sloppiness even
   when no single animation is wrong. Durations come from the scale. */
test('interaction timing comes from the motion scale', () => {
  const offenders = declarations()
    .filter(item => /(?<![\d.])\d*\.?\d+m?s/.test(item.text.replace(/\b0s\b/g, '')))
    .map(item => `${item.file}: ${item.text}`);
  assert.deepStrictEqual(offenders, [], `hardcoded durations:\n${offenders.join('\n')}`);
});

/* Two curves: one for ordinary movement, one for moments meant to land. */
test('interaction easing comes from the two named curves', () => {
  const offenders = declarations()
    .filter(item => /cubic-bezier\(/.test(item.text))
    .map(item => `${item.file}: ${item.text}`);
  assert.deepStrictEqual(offenders, [], `inline easing curves:\n${offenders.join('\n')}`);
});

test('the motion scale and both curves are actually defined', () => {
  const foundations = fs.readFileSync(path.join(CSS_DIR, 'foundations.css'), 'utf8');
  for (const token of ['--nl-motion-fast', '--nl-motion-control', '--nl-motion-panel', '--nl-motion-enter', '--nl-ease-emphasized', '--nl-ease-pop']) {
    assert.ok(foundations.includes(`${token}:`), `${token} is used but never defined`);
  }
});
