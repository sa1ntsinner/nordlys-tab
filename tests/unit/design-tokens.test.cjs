const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', '..', 'src', 'css');
const MARKUP = path.join(__dirname, '..', '..', 'newtab.html');

function stylesheets() {
  return fs.readdirSync(CSS_DIR)
    .filter(name => name.endsWith('.css'))
    .map(name => ({ name, text: fs.readFileSync(path.join(CSS_DIR, name), 'utf8') }));
}

/* A scale is only worth anything if it is closed. The moment one literal slips
   back in, the next person has permission to add another, and a year later the
   product has twenty font sizes again — seven of them on half-pixel steps,
   which is what this codebase actually had. */
test('every font size comes from the type scale', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/font-size:\s*([^;!}]+)/g)) {
      const value = match[1].trim();
      const allowed = value.startsWith('var(--nl-text-')
        || value.startsWith('clamp(')      // the clock, the one deliberate exception
        || value.endsWith('em')            // relative to a parent that is on the scale
        || value.startsWith('calc(')
        || value === 'inherit';
      if (!allowed) offenders.push(`${sheet.name}: font-size: ${value}`);
    }
  }
  assert.deepStrictEqual(offenders, [], `off-scale font sizes:\n${offenders.join('\n')}`);
});

test('markup carries no font size of its own', () => {
  const markup = fs.readFileSync(MARKUP, 'utf8');
  const offenders = [...markup.matchAll(/font-size:\s*([0-9.]+px)/g)].map(match => match[1]);
  assert.deepStrictEqual(offenders, [], `inline sizes in newtab.html: ${offenders.join(', ')}`);
});

/* Tracking belongs to a table indexed by size, not to whoever last looked at a
   label. Positive tracking on body text is the loudest "designed by a
   developer" signal there is. */
test('every letter-spacing comes from the tracking table', () => {
  const offenders = [];
  for (const sheet of stylesheets()) {
    if (sheet.name === 'foundations.css') continue;
    for (const match of sheet.text.matchAll(/letter-spacing:\s*([^;!}]+)/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(--nl-track-') && value !== 'normal' && value !== 'inherit') {
        offenders.push(`${sheet.name}: letter-spacing: ${value}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `off-table tracking:\n${offenders.join('\n')}`);
});

test('the scale and the tracking table are actually defined', () => {
  const foundations = fs.readFileSync(path.join(CSS_DIR, 'foundations.css'), 'utf8');
  const required = [
    '--nl-text-2xs', '--nl-text-xs', '--nl-text-sm', '--nl-text-md',
    '--nl-text-lg', '--nl-text-xl', '--nl-text-2xl',
    '--nl-track-tight', '--nl-track-none', '--nl-track-label', '--nl-track-wide'
  ];
  for (const token of required) {
    assert.ok(foundations.includes(`${token}:`), `${token} is used but never defined`);
  }
});
