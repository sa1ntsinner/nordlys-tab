const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('relativeLuminance linearizes sRGB channels for WCAG contrast', () => {
  const context = vm.createContext({ window: {}, document: {}, setTimeout, requestAnimationFrame() {} });
  vm.runInContext(`${readFileSync('src/js/ui-kit.js', 'utf8')}\nthis.measure = relativeLuminance;`, context);
  assert.equal(context.measure('#000000'), 0);
  assert.ok(Math.abs(context.measure('#ffffff') - 1) < 1e-12);
  assert.ok(Math.abs(context.measure('#777777') - 0.1844749945) < 1e-6);
});
