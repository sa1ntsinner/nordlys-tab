/* Settings → Background, as far as choosing the sky goes (settings-sky.js):
   the photographs and their tone, a shuffle, the skies someone saved, where
   the sky is, the rotation, the night light and the colours of a picture.
   Nothing here reaches the network: what would leave the machine is answered
   here, or refused. */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

// One pixel of a warm orange, served as a picture of the day.
const ORANGE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4kCwFAAOEAV7cTYuCAAAAAElFTkSuQmCC', 'base64');

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
}

async function chooseSky(page, bgMode, seed) {
  await page.evaluate(([mode, sow]) => {
    window.Nordlys.config.bgMode = mode;
    if (sow !== null) window.Nordlys.config.bgSeed = sow;
    window.Nordlys.saveConfig();
    return window.Nordlys.updateBackgroundMode();
  }, [bgMode, seed ?? null]);
}

async function pick(page, select, option) {
  await page.locator(`${select} + .nl-select`).click();
  await page.locator('.nl-select-list.open [role="option"]', { hasText: option }).click();
}

const saved = nordlysPage => nordlysPage.storageState.nordlys_config || {};

// Every request that would leave the machine is answered by host, or refused.
async function offline(page, answers = {}) {
  await page.route(url => url.protocol === 'https:', (route) => {
    const url = new URL(route.request().url());
    return answers[url.hostname] ? answers[url.hostname](route, url) : route.abort();
  });
}
const json = (route, body) => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

test('a photograph of a subject comes in the colours of the mood, or in its own', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const searched = [];
  await offline(page, {
    'commons.wikimedia.org': (route, url) => {
      searched.push(url.searchParams.get('gsrsearch'));
      if (url.searchParams.get('gsrlimit') === '1') return json(route, { query: { searchinfo: { totalhits: 40 } } });
      return json(route, { query: { pages: { 5: { index: 1, title: 'File:Orange evening.jpg', imageinfo: [{
        mime: 'image/jpeg', width: 4000, height: 2600, thumburl: 'https://upload.wikimedia.org/test/Orange.png',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Orange_evening.jpg',
        extmetadata: { Artist: { value: 'Someone' }, LicenseShortName: { value: 'CC BY-SA 4.0' } }
      }] } } } });
    },
    'upload.wikimedia.org': route => route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: ORANGE })
  });
  await openBackground(page);
  await page.locator('.sky-kind[data-kind="photos"]').click();
  await expect(page.locator('#bg-kind-note')).toContainText('Only the date and the subject are sent');
  await page.locator('.scene-card[data-scene="photo-space"]').click();

  const media = page.locator('#bg-media');
  await expect(media).toHaveAttribute('src', 'https://upload.wikimedia.org/test/Orange.png');
  expect(searched[0], 'the subject is all that is searched for').toContain('Featured_pictures_of_astronomy');
  await expect(page.locator('#bg-credit')).toHaveText('Orange evening — Someone · CC BY-SA 4.0');
  await expect(media).toHaveClass(/is-toned/);
  // In the mood's colours, the moods are offered and the picture's own colours are not.
  const colours = page.locator('label.tg:has(#cfg-picture-colours)');
  await expect(page.locator('.atmosphere-palette')).toBeVisible();
  await expect(colours).toBeHidden();

  await expect(page.locator('#cfg-photo-tone')).toBeChecked();
  await page.locator('label.tg:has(#cfg-photo-tone)').click();
  await expect.poll(() => saved(nordlysPage).photoTone).toBe(false);
  await expect(media).not.toHaveClass(/is-toned/);
  await expect(page.locator('.atmosphere-palette')).toBeHidden();
  await expect(colours).toBeVisible();

  // A drawn sky has no photograph to tone.
  await page.locator('.sky-kind[data-kind="nordlys"]').click();
  await page.locator('.scene-card[data-scene="silk"]').click();
  await expect(page.locator('label.tg:has(#cfg-photo-tone)')).toBeHidden();
});

test('a shuffle gives the sky another scatter, one undo away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'silk', 42);
  await openBackground(page);
  await page.locator('#bg-shuffle').click();
  await expect.poll(() => saved(nordlysPage).bgSeed).not.toBe(42);
  const seed = saved(nordlysPage).bgSeed;
  expect(Number.isInteger(seed) && seed > 0, 'a whole number').toBe(true);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.seed), 'the sky on screen is the new one').toBe(seed);

  await page.locator('.toast .toast-action').last().click();
  await expect.poll(() => saved(nordlysPage).bgSeed).toBe(42);
});

test('a sky is saved with its scatter, worn again from its chip and removed with an undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await offline(page);
  await chooseSky(page, 'silk', 42);
  await openBackground(page);
  await expect(page.locator('#bg-looks-block')).toBeHidden();
  await page.locator('#bg-look-save').click();
  const chips = page.locator('#bg-looks .sky-look');
  await expect(chips).toHaveText(['Silk']);
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => saved(nordlysPage).looks?.map(entry => entry.look)).toEqual([{ bgMode: 'silk', bgSeed: 42 }]);
  // The same sky is not saved twice; shuffled another way it is another, told apart by a number.
  await page.locator('#bg-look-save').click();
  await expect(chips).toHaveCount(1);
  await page.locator('#bg-shuffle').click();
  await page.locator('#bg-look-save').click();
  await expect(chips).toHaveText(['Silk', 'Silk 2']);

  await page.locator('.scene-card[data-scene="polaris"]').click();
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'false');
  await chips.first().click();
  await expect.poll(() => [saved(nordlysPage).bgMode, saved(nordlysPage).bgSeed]).toEqual(['silk', 42]);
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#bg-looks .sky-look-remove').first().click();
  await expect(chips).toHaveText(['Silk 2']);
  await page.locator('.toast .toast-action').last().click();
  await expect(chips).toHaveText(['Silk', 'Silk 2']);
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
  await chooseSky(page, 'silk');
  await openBackground(page);
  // Only the skies drawn from the real one have a place.
  await expect(page.locator('.sky-place')).toBeHidden();
  await page.locator('.scene-card[data-scene="starmap"]').click();
  await expect(page.locator('.sky-place')).toBeVisible();
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
  await chooseSky(page, 'blackhole');
  await openBackground(page);
  await page.evaluate(() => window.I18N.setLanguage('de'));
  await expect(page.locator('.sky-kind[data-kind="photos"]')).toHaveText('Fotos');
  await expect(page.locator('.scene-card[data-scene="blackhole"] .scene-name')).toHaveText('Schwarzes Loch');
  await expect(page.locator('#bg-scene-note')).toContainText('wie ein Schwarzes Loch es krümmt');
  await expect(page.locator('#cfg-night-mode + .nl-select .nl-select-value')).toHaveText('Aus');
});
