const test = require('node:test');
const assert = require('node:assert/strict');
const Skies = require('../../src/js/sky-catalog.js');

// A stream of answers from 0 to 1, the same every run.
const stream = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('a rotation picks from the pool the person chose', () => {
  const random = stream(11);
  for (let i = 0; i < 20; i++) {
    // This sky, shuffled: the same sky, another scatter or another photograph.
    const same = Skies.pick({ bgMode: 'photo-space' }, 'this', random);
    assert.equal(same.bgMode, 'photo-space');
    assert.ok(Number.isInteger(same.seed) && same.seed >= 0, 'a whole number seed');
    assert.equal(Skies.get(Skies.pick({ bgMode: 'blackhole' }, 'category', random).bgMode).category, 'nordlys');
    assert.equal(Skies.get(Skies.pick({ bgMode: 'photo-nature' }, 'category', random).bgMode).category, 'photos');
    // A wallpaper has nothing to shuffle and no group of its own: it rotates among the drawn skies.
    assert.equal(Skies.get(Skies.pick({ bgMode: 'custom-image' }, 'this', random).bgMode).category, 'nordlys');
    assert.ok(['canvas', 'picture'].includes(Skies.get(Skies.pick({ bgMode: 'custom-image' }, 'all', random).bgMode).kind), 'never a wallpaper');
  }
  const looks = [{ id: 'a', name: 'Mine', look: { bgMode: 'custom-video' } }, { id: 'b', name: 'Calm', look: { bgMode: 'starmap', bgSeed: 42 } }];
  assert.deepEqual(Skies.pick({ bgMode: 'aurora', looks }, 'looks', random), { bgMode: 'starmap', seed: 42 });
  assert.equal(Skies.get(Skies.pick({ bgMode: 'aurora', looks: [] }, 'looks', random).bgMode).category, 'nordlys', 'no saved look: the group');
});

test('every photograph topic is a picture sky toned to the mood', () => {
  const photos = Skies.inCategory('photos');
  assert.deepEqual(photos.map((sky) => sky.id), ['photo-nature', 'photo-weather', 'photo-horizon', 'photo-space', 'photo-scifi', 'photo-tech', 'photo-cities']);
  for (const sky of photos) {
    assert.equal(sky.kind, 'picture');
    assert.equal(sky.source, sky.id);
    assert.ok(sky.toned, `${sky.id} is toned`);
  }
  assert.equal(Skies.get('midnightsun'), null, 'Midnight sun is gone');
  assert.equal(Skies.get('blackhole').kind, 'canvas');
});
