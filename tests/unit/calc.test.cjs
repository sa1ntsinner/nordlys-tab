const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const calc = require('../../src/js/calc.js');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'js', 'calc.js'), 'utf8');

/* The whole reason this file exists. The previous calculator ran on
   new Function(), which the extension's CSP forbids; it passed in the HTTP test
   fixture, where there is no CSP, and produced nothing in the real extension. */
test('the evaluator never reaches for eval or new Function', () => {
  // The header comment explains why those are absent; only code is judged.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bnew\s+Function\b/);
  assert.doesNotMatch(code, /\beval\s*\(/);
});

const answers = [
  ['2+2', 4],
  ['45 * 12 + sqrt(144)', 552],
  ['2 ^ 10', 1024],
  ['2^3^2', 512],                 // right-associative, as on paper
  ['-2^2', -4],                   // the sign applies to the power
  ['(1 + 2) * 3', 9],
  ['10 / 4', 2.5],
  ['0.1 + 0.2', 0.3],             // tidy, not 0.30000000000000004
  ['15% of 200', 30],
  ['200 * 15%', 30],
  ['50%', 0.5],
  ['10 x 10', 100],
  ['3 × 4 ÷ 2', 6],
  ['2pi', 2 * Math.PI],
  ['2(3+4)', 14],
  ['(2)(3)', 6],
  ['(2)3', 6],
  ['2 3', null],                  // two bare numbers are a typo, not a product
  ['2^-1', 0.5],
  ['(-2)^2', 4],
  ['sin(0)', 0],
  ['log10(1000)', 3],
  ['ln(e)', 1],
  ['max(3, 9, 4)', 9],
  ['round(2.5)', 3],
  ['abs(-7) + 1', 8],
  ['1e3 + 1', null],              // no exponent notation: "e3" is not a word we know
  ['2 + ', null],
  ['(2 + 3', null],
  ['2 ** 3', null],               // JavaScript syntax is not arithmetic syntax
  ['1 / 0', null],                // infinity is not an answer
  ['2025', null],                 // a bare number is a search, not a sum
  ['pi', null],                   // so is a constant on its own
  ['e', null],
  ['youtube', null],
  ['12 apples + 3', null],
  ['', null],
  ['   ', null],
  ['1,5 + 2', null],              // the comma separates function arguments only
  ['alert(1)', null],
  ['window.location', null],
  ['constructor', null]
];

for (const [text, expected] of answers) {
  test(`evaluate(${JSON.stringify(text)}) → ${expected}`, () => {
    const value = calc.evaluate(text);
    if (expected === null) assert.equal(value, null);
    else assert.ok(Math.abs(value - expected) < 1e-9, `got ${value}`);
  });
}

test('describe shows the text as typed with its answer', () => {
  assert.equal(calc.describe('  2+2 '), '2+2 = 4');
  assert.equal(calc.describe('45 * 12 + sqrt(144)'), '45 * 12 + sqrt(144) = 552');
  assert.equal(calc.describe('hello'), null);
});

test('very large results keep their magnitude and drop unreadable digits', () => {
  assert.equal(calc.evaluate('2^60'), Number(Math.pow(2, 60).toPrecision(12)));
  assert.equal(calc.evaluate('10^15 + 1'), 1e15);
});
