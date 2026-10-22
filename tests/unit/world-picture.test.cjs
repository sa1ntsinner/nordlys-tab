const test = require('node:test');
const assert = require('node:assert/strict');

/* The picture of the day, with the network answered from here: what each
   source's answer becomes, and when a new tab asks again. */
function load(answer) {
  delete require.cache[require.resolve('../../src/js/world-picture.js')];
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(url);
    const body = answer(url);
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body };
  };
  return { World: require('../../src/js/world-picture.js'), asked, store };
}

const DAY = new Date(2026, 9, 23, 12);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('the picture of the day is a photograph: a video day falls back to the day before', async () => {
  const { World, asked } = load((url) => url.includes('/2026/10/23') ? { image: { image: { source: 'https://upload.wikimedia.org/x/clip.webm', width: 1920, height: 1080 } } }
    : url.includes('/2026/10/22') ? { image: {
      image: { source: 'https://upload.wikimedia.org/a/b/Tower.jpg', width: 4000, height: 2600 },
      thumbnail: { source: 'https://upload.wikimedia.org/thumb/a/b/Tower.jpg/640px-Tower.jpg?x=1' },
      description: { text: 'A tower in Skopje, North Macedonia. Today is the anniversary of something.' },
      artist: { text: 'Someone' }, license: { type: 'CC BY-SA 4.0' }, file_page: 'https://commons.wikimedia.org/wiki/File:Tower.jpg'
    } } : undefined);
  const picture = await World.SOURCES.wikimedia.ask(DAY, 'de');
  assert.ok(asked[0].includes('/wikipedia/de/featured/2026/10/23'), 'asked in the reader\'s language');
  assert.equal(picture.url, 'https://upload.wikimedia.org/thumb/a/b/Tower.jpg/1920px-Tower.jpg');
  assert.equal(picture.title, 'A tower in Skopje, North Macedonia.');
  assert.equal(picture.by, 'Someone · CC BY-SA 4.0');
  assert.deepEqual([picture.fit, picture.cors], ['fill', true]);
});

test('a painting is chosen by the day from the featured ones, and framed whole', async () => {
  const { World, asked } = load((url) => {
    const offset = Number(new URL(url).searchParams.get('gsroffset'));
    return { query: { searchinfo: { totalhits: 400 }, pages: { 7: { title: 'File:Wall.jpg', imageinfo: [{
      thumburl: `https://thumb.wikimedia.org/a/1920px-Wall.jpg?utm_source=x&n=${offset}`, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Wall.jpg', width: 3000, height: 3800,
      extmetadata: { ObjectName: { value: 'The Wailing Wall' }, Artist: { value: '<a href="x">J. L. Gérôme</a>' }, DateTimeOriginal: { value: 'Unknown date' } }
    }] } } } };
  });
  const picture = await World.SOURCES.paintings.ask(DAY, 'en');
  assert.equal(new URL(asked[1]).searchParams.get('gsroffset'), String(World.dayOf(DAY) % 400));
  assert.equal(picture.url, 'https://thumb.wikimedia.org/a/1920px-Wall.jpg');
  assert.deepEqual([picture.title, picture.by, picture.fit], ['The Wailing Wall', 'J. L. Gérôme', 'frame']);
});

test('a new tab shows the kept picture, and asks again only on a new day or in a new language', async () => {
  let served = 0;
  const { World, asked } = load(() => { served += 1; return [{ date: '2026-10-20 11:24:48', image: `epic_${served}` }]; });
  assert.equal(World.today('epic', null, { now: DAY }), null, 'nothing kept yet');
  await settle();
  const kept = World.today('epic', null, { now: DAY });
  assert.match(kept.url, /epic_1\.jpg$/);
  assert.equal(asked.length, 1, 'today\'s is kept, not asked for again');
  World.today('epic', null, { now: DAY, lang: 'ru' });
  await settle();
  assert.equal(asked.length, 2, 'another language is another caption');
  const tomorrow = new Date(DAY.getTime() + 86400000);
  let fresh = null;
  assert.match(World.today('epic', (picture) => { fresh = picture; }, { now: tomorrow, lang: 'ru' }).url, /epic_2/, 'yesterday\'s while today\'s is asked for');
  await settle();
  assert.match(fresh.url, /epic_3/);
});

test('a source that fails is left alone for half an hour', async () => {
  const { World, asked } = load(() => undefined);
  World.today('met', null, { now: DAY });
  await settle(); await settle();
  World.today('met', null, { now: DAY });
  await settle();
  assert.equal(asked.length, 1);
});
