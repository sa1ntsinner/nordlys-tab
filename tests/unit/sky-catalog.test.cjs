const test = require('node:test');
const assert = require('node:assert/strict');
const Skies = require('../../src/js/sky-catalog.js');

// A stream of answers from 0 to 1, the same every run.
const stream = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('a shuffle chooses again every layer not locked, and leaves the light and the bodies', () => {
  const own = { light: 'night', stars: false, horizon: 'sea' };
  const layers = Skies.shuffle(own, ['horizon'], stream(7));
  assert.equal(layers.horizon, 'sea', 'a locked layer stays');
  assert.equal(layers.light, 'night');
  assert.equal(layers.stars, false);
  for (const layer of ['weather', 'style', 'aurora']) assert.ok(Skies.COMPOSE.choices[layer].includes(layers[layer]), layer);
  assert.deepEqual(Skies.shuffle(own, [], stream(3)), Skies.shuffle(own, [], stream(3)), 'the same answers, the same sky');
});

test('a rotation picks from the pool the person chose', () => {
  const random = stream(11);
  const layered = Skies.pick({ bgMode: 'mountains', skyLayers: { style: 'poster' }, skyLocks: ['style'] }, 'layers', random);
  assert.equal(layered.bgMode, 'mountains');
  assert.equal(layered.skyLayers.style, 'poster');

  for (let i = 0; i < 20; i++) {
    assert.equal(Skies.get(Skies.pick({ bgMode: 'sea' }, 'category', random).bgMode).category, 'horizon');
    // A sky with no layers to shuffle rotates within its group.
    assert.equal(Skies.get(Skies.pick({ bgMode: 'aurora' }, 'layers', random).bgMode).category, 'nordlys');
    assert.ok(['canvas', 'picture'].includes(Skies.get(Skies.pick({ bgMode: 'custom-image' }, 'all', random).bgMode).kind), 'never a wallpaper');
  }
  const looks = [{ id: 'a', name: 'Mine', look: { bgMode: 'custom-video' } }, { id: 'b', name: 'Calm', look: { bgMode: 'fog', skyLayers: { horizon: 'sea' } } }];
  assert.deepEqual(Skies.pick({ bgMode: 'aurora', looks }, 'looks', random), { bgMode: 'fog', skyLayers: { horizon: 'sea' } });
  assert.equal(Skies.get(Skies.pick({ bgMode: 'aurora', looks: [] }, 'looks', random).bgMode).category, 'nordlys', 'no saved look: the group');
});
