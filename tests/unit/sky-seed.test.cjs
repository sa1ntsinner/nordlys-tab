const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The sky is scattered from a seed, so the same seed at the same size must be
   the same world — that is what stops a new tab from rearranging the stars —
   and a different seed must actually be a different one. */
function world(seed, w = 1440, h = 900) {
  const context = vm.createContext({ window: {}, document: {} });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const sky = Object.assign(Object.create(context.Engine.prototype), {
    w, h, seed, rng: null, stars: [], nebulae: [], silk: [], frost: [], frostTips: [], frostPatches: []
  });
  sky.seedFields();
  return JSON.stringify({ stars: sky.stars, silk: sky.silk, frost: sky.frost.slice(0, 200), tips: sky.frostTips });
}

test('the same seed at the same size is the same sky', () => {
  assert.equal(world(0), world(0));
  assert.equal(world(2654435761), world(2654435761));
});

test('another seed is another sky', () => {
  assert.notEqual(world(0), world(1));
});

test('seeding does not leave the engine drawing from the seed afterwards', () => {
  const context = vm.createContext({ window: {}, document: {} });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const sky = Object.assign(Object.create(context.Engine.prototype), {
    w: 800, h: 600, seed: 7, rng: null, stars: [], nebulae: [], silk: [], frost: [], frostTips: [], frostPatches: []
  });
  sky.seedFields();
  // Meteors and anything else at runtime stay unseeded.
  assert.equal(sky.rng, null);
});
