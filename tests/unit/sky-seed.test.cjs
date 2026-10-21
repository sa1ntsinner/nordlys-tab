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
    w, h, seed, rng: null, stars: [], nebulae: [], silk: [], polaris: [], chart: null, field: [], coast: []
  });
  engine.seedFields();
  return engine;
}

// Each composition on its own, so a change to one scene's scatter is caught as that scene.
const WORLDS = {
  stars: e => e.stars,
  silk: e => e.silk,
  polaris: e => e.polaris.slice(0, 300),
  // The Star map's stars are the real ones; the seed turns the way it looks.
  starmap: e => e.chart,
  meteors: e => e.field,
  midnightsun: e => e.coast
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
  assert.ok(engine.field.length >= 150, `${engine.field.length} stars behind the meteors`);
  assert.ok(engine.coast.length >= 4 && engine.coast.every(hill => hill.back.length >= 8));
  // Seed zero is the authored view, facing the equator; any other faces some other way.
  assert.equal(engine.chart.turn, 0);
  assert.ok(sky(7).chart.turn > 0 && sky(7).chart.turn < 360);
});

test('seeding does not leave the engine drawing from the seed afterwards', () => {
  const engine = sky(7, 800, 600);
  // Meteors and anything else at runtime stay unseeded.
  assert.equal(engine.rng, null);
});

/* A meteor is a pure function of the scene clock and the seed, so any frame
   at a moment shows the same one, at any frame rate, and a held frame the
   one meant for it; another seed is another night's. */
test('a meteor is where the clock and the seed put it, whoever asks', () => {
  const night = seed => {
    const engine = sky(seed);
    engine.now = () => new Date(Date.UTC(2026, 9, 22, 1));
    engine.meteorRates = () => ({ showers: [], total: 0.5 });
    return engine;
  };
  const moments = Array.from({ length: 400 }, (_, i) => 3 + i * 0.037);
  const trace = engine => JSON.stringify(moments.map(t => engine.meteorsAt(t, engine.skyView())));
  const first = night(5);
  assert.ok(moments.some(t => first.meteorsAt(t, first.skyView()).length), 'some of the moments hold a meteor');
  assert.equal(trace(night(5)), trace(first));
  assert.notEqual(trace(night(6)), trace(first));
});
