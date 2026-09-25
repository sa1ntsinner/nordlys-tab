const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

/* The sky is scattered from a seed, so the same seed at the same size must be
   the same world — that is what stops a new tab from rearranging the stars —
   and a different seed must actually be a different one. */
function sky(seed, w = 1440, h = 900) {
  const context = vm.createContext({ window: {}, document: {} });
  vm.runInContext(`${readFileSync('src/js/background.js', 'utf8')}\nthis.Engine = NordlysBackgroundEngine;`, context);
  const engine = Object.assign(Object.create(context.Engine.prototype), {
    w, h, seed, rng: null, stars: [], nebulae: [], silk: [], polaris: [], pillars: [], dust: [], nacre: [], baikal: null
  });
  engine.seedFields();
  return engine;
}

// Each composition on its own, so a change to one scene's scatter is caught as that scene.
const WORLDS = {
  stars: e => e.stars,
  silk: e => e.silk,
  polaris: e => e.polaris.slice(0, 300),
  pillars: e => ({ pillars: e.pillars, dust: e.dust }),
  nacre: e => e.nacre,
  baikal: e => ({ bubbles: e.baikal.bubbles, cracks: e.baikal.cracks.map(crack => Array.from(crack.points).slice(0, 40)) })
};

for (const [name, world] of Object.entries(WORLDS)) {
  test(`${name}: the same seed at the same size is the same world`, () => {
    assert.equal(JSON.stringify(world(sky(0))), JSON.stringify(world(sky(0))));
    assert.equal(JSON.stringify(world(sky(2654435761))), JSON.stringify(world(sky(2654435761))));
  });

  test(`${name}: another seed is another world`, () => {
    assert.notEqual(JSON.stringify(world(sky(0))), JSON.stringify(world(sky(1))));
  });
}

test('every new composition has something in it', () => {
  const engine = sky(0);
  assert.ok(engine.polaris.length > 200, `${engine.polaris.length} stars`);
  assert.ok(engine.pillars.length >= 4 && engine.dust.length >= 40);
  assert.ok(engine.nacre.length >= 3 && engine.nacre.every(cloud => cloud.streaks.length >= 8));
  assert.ok(engine.baikal.bubbles.length >= 20 && engine.baikal.cracks.length >= 3);
});

test('seeding does not leave the engine drawing from the seed afterwards', () => {
  const engine = sky(7, 800, 600);
  // Meteors and anything else at runtime stay unseeded.
  assert.equal(engine.rng, null);
});
