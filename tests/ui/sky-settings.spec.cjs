/* Settings → Background, as far as choosing the sky goes (settings-sky.js):
   the layers of a composed sky, the skies someone saved, where the sky is,
   the working hours, the rotation, the night light and the colours of a
   picture. Nothing here reaches the network: what would leave the machine is
   answered here, or refused. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

// One pixel of a warm orange, served as a picture of the day.
const ORANGE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4kCwFAAOEAV7cTYuCAAAAAElFTkSuQmCC', 'base64');

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
}

async function chooseSky(page, bgMode, skyLayers) {
  await page.evaluate(([mode, layers]) => {
    window.Nordlys.config.bgMode = mode;
    if (layers) window.Nordlys.config.skyLayers = layers; else delete window.Nordlys.config.skyLayers;
    window.Nordlys.saveConfig();
    return window.Nordlys.updateBackgroundMode();
  }, [bgMode, skyLayers || null]);
}

async function pick(page, select, option) {
  await page.locator(`${select} + .nl-select`).click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: option }).click();
}

const saved = nordlysPage => nordlysPage.storageState.nordlys_config || {};
const layersNow = page => page.evaluate(() => window.NordlysSkies.layersOf(window.Nordlys.config.bgMode, window.Nordlys.config.skyLayers));

// Every request that would leave the machine is answered by host, or refused.
async function offline(page, answers = {}) {
  await page.route(url => url.protocol === 'https:', (route) => {
    const url = new URL(route.request().url());
    return answers[url.hostname] ? answers[url.hostname](route, url) : route.abort();
  });
}
const json = (route, body) => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

test('a composed sky is chosen layer by layer, and only what differs from it is kept', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await openBackground(page);
  await expect(page.locator('.sky-composer')).toBeHidden();
  await page.locator('.sky-kind[data-kind="horizon"]').click();
  await page.locator('.scene-card[data-scene="mountains"]').click();
  await expect(page.locator('.sky-composer')).toBeVisible();
  await expect(page.locator('#bg-layers select[data-layer="horizon"]')).toHaveValue('mountains');

  await pick(page, '#bg-layers select[data-layer="weather"]', 'Snow');
  await expect.poll(() => saved(nordlysPage).skyLayers).toEqual({ weather: 'snow' });
  expect(await page.evaluate(() => window.Nordlys.bgEngine.skyLayers), 'the sky on screen has it').toEqual({ weather: 'snow' });
  // Back to what the sky comes with, nothing is kept.
  await pick(page, '#bg-layers select[data-layer="weather"]', 'Clear');
  await expect.poll(() => saved(nordlysPage).skyLayers).toBeUndefined();

  // A body taken out of the sky is kept as taken out.
  const stars = page.locator('#bg-bodies [data-body="stars"]');
  await expect(stars).toHaveAttribute('aria-pressed', 'true');
  await stars.click();
  await expect(stars).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => saved(nordlysPage).skyLayers).toEqual({ stars: false });

  // Another sky is chosen as it comes, not with the layers changed on this one.
  await page.locator('.scene-card[data-scene="sea"]').click();
  await expect.poll(() => saved(nordlysPage).bgMode).toBe('sea');
  expect(saved(nordlysPage).skyLayers).toBeUndefined();
  await expect(stars).toHaveAttribute('aria-pressed', 'true');
});

test('a shuffle chooses again every layer not kept, and is one undo away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'mountains');
  await openBackground(page);
  const lock = page.locator('#bg-layers [data-lock="horizon"]');
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => saved(nordlysPage).skyLocks).toEqual(['horizon']);
  // The light is never shuffled, so it has no padlock.
  await expect(page.locator('#bg-layers [data-lock="light"]')).toHaveCount(0);

  const first = await layersNow(page);
  let before = null, now = first;
  for (let turn = 0; turn < 6 && JSON.stringify(now) === JSON.stringify(first); turn++) {
    before = await page.evaluate(() => window.Nordlys.config.skyLayers || null);
    await page.locator('#bg-shuffle').click();
    now = await layersNow(page);
    expect(now.horizon, 'a kept layer stays as it is').toBe('mountains');
  }
  expect(now, 'a shuffle changes the sky').not.toEqual(first);
  await expect(page.locator('#bg-layers select[data-layer="weather"]')).toHaveValue(now.weather);

  await page.locator('.toast .toast-action').last().click();
  await expect.poll(() => page.evaluate(() => window.Nordlys.config.skyLayers || null)).toEqual(before);
});

test('a sky can be saved, worn again from its chip and removed with an undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'mountains', { weather: 'snow' });
  await openBackground(page);
  await expect(page.locator('#bg-looks-block')).toBeHidden();
  await page.locator('#bg-look-save').click();
  const chip = page.locator('#bg-looks .sky-look');
  await expect(chip).toHaveText('Mountains · Snow');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => saved(nordlysPage).looks?.map(entry => entry.look)).toEqual([{ bgMode: 'mountains', skyLayers: { weather: 'snow' } }]);
  // The same sky is not saved twice.
  await page.locator('#bg-look-save').click();
  await expect(chip).toHaveCount(1);

  await page.locator('.sky-kind[data-kind="nordlys"]').click();
  await page.locator('.scene-card[data-scene="polaris"]').click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect.poll(() => [saved(nordlysPage).bgMode, saved(nordlysPage).skyLayers]).toEqual(['mountains', { weather: 'snow' }]);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#bg-looks .sky-look-remove').click();
  await expect(page.locator('#bg-looks-block')).toBeHidden();
  await expect.poll(() => saved(nordlysPage).looks).toEqual([]);
  await page.locator('.toast .toast-action').last().click();
  await expect(chip).toHaveText('Mountains · Snow');
});

test('where the sky is, is searched by what is typed and only the place chosen is kept', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const asked = [];
  await offline(page, {
    'geocoding-api.open-meteo.com': (route, url) => {
      asked.push(url.searchParams.get('name'));
      return json(route, { results: [{ name: 'Tromsø', admin1: 'Troms', country: 'Norway', latitude: 69.6496, longitude: 18.956 }] });
    }
  });
  await chooseSky(page, 'mountains');
  await openBackground(page);
  await expect(page.locator('#bg-place-name')).toContainText('time zone');
  await page.locator('#bg-place-change').click();
  await expect(page.locator('#bg-place-change')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#bg-place-input')).toBeFocused();
  await page.locator('#bg-place-input').fill('Tromsø');
  await page.locator('.sky-place-result', { hasText: 'Tromsø, Troms, Norway' }).click();

  await expect.poll(() => saved(nordlysPage).skyPlace).toEqual({ name: 'Tromsø, Norway', lat: 69.65, lon: 18.956 });
  expect(asked, 'only what was typed is sent').toEqual(['Tromsø']);
  await expect(page.locator('#bg-place-name')).toHaveText('Tromsø, Norway');
  await expect(page.locator('#bg-place-search')).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.bgEngine.place), 'the sky moved there').toEqual({ lat: 69.65, lon: 18.956 });

  await page.locator('#bg-place-change').click();
  await page.locator('#bg-place-zone').click();
  await expect.poll(() => saved(nordlysPage).skyPlace).toBeUndefined();
  await expect(page.locator('#bg-place-name')).toContainText('time zone');
});

test('the working hours are asked for only by a sky that uses them', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'mountains');
  await openBackground(page);
  await expect(page.locator('#bg-workday-row')).toBeHidden();
  await pick(page, '#bg-layers select[data-layer="light"]', 'My working day');
  await expect(page.locator('#bg-workday-row')).toBeVisible();
  await expect(page.locator('#cfg-workday-start')).toHaveValue('09:00');
  await page.locator('#cfg-workday-start').fill('08:30');
  await expect.poll(() => saved(nordlysPage).workday).toEqual({ start: 8.5, end: 18 });
  expect(await page.evaluate(() => window.Nordlys.bgEngine.workday)).toEqual({ start: 8.5, end: 18 });
  // An end before the start is not kept.
  await page.locator('#cfg-workday-end').fill('07:00');
  await expect.poll(() => saved(nordlysPage).workday).toEqual({ start: 8.5, end: 18 });
});

test('a rotation shows another sky and writes nothing over the one chosen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await openBackground(page);
  await expect(page.locator('#bg-pool-row')).toBeHidden();
  await pick(page, '#cfg-sky-rotate', 'With every new tab');
  await expect.poll(() => saved(nordlysPage).skyRotate).toBe('tab');
  await expect(page.locator('#bg-pool-row')).toBeVisible();
  await pick(page, '#cfg-sky-pool', 'Every sky');
  await expect.poll(() => saved(nordlysPage).skyPool).toBe('all');

  const shown = await page.evaluate(() => ({ rotation: window.Nordlys.rotation?.bgMode, page: document.documentElement.dataset.bg }));
  expect(shown.rotation, 'the rotation chose a sky').toBeTruthy();
  expect(shown.page).toBe(shown.rotation);
  expect(saved(nordlysPage).bgMode, 'the chosen sky is still the chosen one').toBe('aurora');

  // Choosing a sky here shows that sky, rotation or not.
  await page.locator('.sky-kind[data-kind="nordlys"]').click();
  await page.locator('.scene-card[data-scene="fjord"]').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bg)).toBe('fjord');
  await pick(page, '#cfg-sky-rotate', 'Never');
  await expect(page.locator('#bg-pool-row')).toBeHidden();
  expect(await page.evaluate(() => window.Nordlys.rotation)).toBeNull();
});

test('the night light covers the page in a warm red and holds the sky still', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await openBackground(page);
  await pick(page, '#cfg-night-mode', 'Always');
  await expect.poll(() => saved(nordlysPage).nightMode).toBe('on');
  await expect(page.locator('html')).toHaveClass(/night-mode/);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.motion), 'held still').toBe(0);
  const veil = await page.evaluate(() => getComputedStyle(document.documentElement, '::after').opacity);
  expect(Number(veil)).toBeGreaterThan(0.2);

  await pick(page, '#cfg-night-mode', 'Off');
  await expect(page.locator('html')).not.toHaveClass(/night-mode/);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.motion)).toBeGreaterThan(0);
});

test('the picture of the day is credited, and its colours can become the accent', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page, {
    'api.wikimedia.org': route => json(route, { image: {
      image: { source: 'https://upload.wikimedia.org/test/Orange.png', width: 1600, height: 900 },
      description: { text: 'An orange evening over the sea. It was taken in summer.' },
      artist: { text: 'Someone' }, license: { type: 'CC BY-SA 4.0' }, file_page: 'https://commons.wikimedia.org/wiki/File:Orange.png'
    } }),
    'upload.wikimedia.org': route => route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: ORANGE })
  });
  await openBackground(page);
  await page.locator('.sky-kind[data-kind="world"]').click();
  await expect(page.locator('#bg-kind-note')).toContainText('Only the date and your language are sent');
  await page.locator('.scene-card[data-scene="picture-wikimedia"]').click();

  const credit = page.locator('#bg-credit');
  await expect(credit).toHaveText('An orange evening over the sea. — Someone · CC BY-SA 4.0');
  await expect(credit).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Orange.png');
  await expect(page.locator('#bg-media')).toHaveAttribute('src', 'https://upload.wikimedia.org/test/Orange.png');

  const accent = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
  const colours = page.locator('label.tg:has(#cfg-picture-colours)');
  await expect(colours).toBeVisible();
  expect(await accent(), 'the theme keeps its accent until asked').toBe('');
  await colours.click();
  await expect.poll(() => saved(nordlysPage).pictureColours).toBe(true);
  await expect.poll(accent).toMatch(/^#[0-9a-f]{6}$/);
  const [r, g, b] = (await accent()).match(/[0-9a-f]{2}/g).map(hex => parseInt(hex, 16));
  expect(r, 'an orange picture makes an orange accent').toBeGreaterThan(b + 80);
  expect(g).toBeGreaterThan(b);

  // A sky that is not a picture gives the theme its accent back.
  await page.locator('.sky-kind[data-kind="nordlys"]').click();
  await page.locator('.scene-card[data-scene="aurora"]').click();
  await expect.poll(accent).toBe('');
  await expect(credit).toBeHidden();
  // The picture is kept for the day, and its card shows it.
  await page.locator('.sky-kind[data-kind="world"]').click();
  await expect(page.locator('.scene-card[data-scene="picture-wikimedia"] img')).toHaveAttribute('src', 'https://upload.wikimedia.org/test/Orange.png');
  // A picture whose pixels cannot be read offers no colours.
  await page.locator('.scene-card[data-scene="picture-met"]').click();
  await expect(colours).toBeHidden();
});

test('the panel follows a change of language, dropdowns included', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'mountains');
  await openBackground(page);
  await page.evaluate(() => window.I18N.setLanguage('de'));
  await expect(page.locator('.sky-kind[data-kind="weather"]')).toHaveText('Wetter');
  await expect(page.locator('.scene-card[data-scene="mountains"] .scene-name')).toHaveText('Berge');
  await expect(page.locator('#bg-layers select[data-layer="horizon"] + .nl-select .nl-select-value')).toHaveText('Berge');
  await expect(page.locator('#cfg-night-mode + .nl-select .nl-select-value')).toHaveText('Aus');
  await expect(page.locator('#bg-layers [data-lock="weather"]')).toHaveAttribute('aria-label', 'Wetter beim Mischen behalten');
});

/* Words over a sky that paints its own daylight get their quiet as a band
   from the top, the whole width, never as a dark blot under each line: at
   the height of the date the sky is taken back as much at the window's edge
   as under the words. */
test('over a sky with its own daylight, the words are quietened by a band, not a blot', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'mountains', { light: 'day' });
  await page.waitForFunction(() => window.Nordlys.bgEngine.quietZones.length > 0);
  const read = await page.evaluate(() => {
    const engine = window.Nordlys.bgEngine;
    engine.quietSolvedAt = -Infinity;
    engine.render(0);
    const canvas = document.getElementById('bg-canvas');
    const ratio = canvas.width / innerWidth;
    const date = document.getElementById('date').getBoundingClientRect();
    const y = Math.round((date.top + date.height / 2) * ratio);
    const alphaAt = x => canvas.getContext('2d').getImageData(Math.round(x * ratio), y, 1, 1).data[3];
    return { needed: Math.max(...engine.quietAlphas), edge: alphaAt(12), middle: alphaAt(date.left + date.width / 2) };
  });
  expect(read.needed, 'a day sky behind white words needs quiet').toBeGreaterThan(0.05);
  expect(read.middle, 'the sky under the words is taken back').toBeLessThan(250);
  expect(Math.abs(read.edge - read.middle), 'as much at the edge as under the words').toBeLessThan(6);
});
