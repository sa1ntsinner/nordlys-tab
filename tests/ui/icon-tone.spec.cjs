const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { png } = require('../helpers/icon-network.cjs');

/* A tone repaints a mark of one colour so it can be seen on its tile. It is
   never a reason to change the colours of a picture that has several. */

const link = (page) => page.evaluate(() => window.Nordlys.config.groups[0].links[0]);

/* The first tile wearing a picture drawn here, and what the tile then says of it. */
async function wear(page, draw, tone) {
  await page.evaluate(async ([source, tone]) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const pen = canvas.getContext('2d');
    new Function('pen', source)(pen);
    const target = window.Nordlys.config.groups[0].links[0];
    for (const field of ['icon', 'monogram', 'tone']) delete target[field];
    target.customImg = canvas.toDataURL('image/png');
    if (tone) target.tone = tone;
    window.Nordlys.grid.render();
    await new Promise(resolve => setTimeout(resolve, 60));
    await window.NordlysIcons.refreshIconContrast();
  }, [draw, tone]);
  /* The filter arrives through a short transition, so it is read until it
     rests: halfway there it is neither the old value nor the new one. */
  const read = () => page.evaluate(() => {
    const icon = document.querySelector('.tile .nl-icon');
    const image = icon.querySelector('img');
    // What is on the tile, at the letter and at the stroke under it (the pictures here are 64 across).
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const pen = canvas.getContext('2d', { willReadFrequently: true });
    if (image.complete && image.naturalWidth) pen.drawImage(image, 0, 0, 64, 64);
    const at = (x, y) => [...pen.getImageData(x, y, 1, 1).data].slice(0, 3).join();
    return { tone: icon.dataset.iconTone || null, flat: 'iconFlat' in icon.dataset, parts: 'iconParts' in icon.dataset, filter: getComputedStyle(image).filter, letter: at(32, 20), stroke: at(32, 47) };
  });
  let last = await read();
  await expect.poll(async () => { const now = await read(); const still = JSON.stringify(now) === JSON.stringify(last); last = now; return still; }, { intervals: [250, 250, 400, 400, 600] }).toBe(true);
  return last;
}
const ORANGE_PLATE = "pen.fillStyle = 'rgb(236,110,45)'; pen.beginPath(); pen.roundRect(1, 1, 62, 62, 12); pen.fill(); pen.fillStyle = '#fff'; pen.fillRect(14, 34, 36, 6);";
const NAVY_PLATE = "pen.fillStyle = 'rgb(8,16,56)'; pen.beginPath(); pen.roundRect(1, 1, 62, 62, 12); pen.fill(); pen.fillStyle = 'rgb(20,34,90)'; pen.fillRect(14, 34, 36, 6);";
const WHITE_LETTER_ORANGE_STROKE = "pen.fillStyle = '#fff'; pen.fillRect(22, 8, 20, 30); pen.fillStyle = 'rgb(255,153,0)'; pen.fillRect(10, 46, 44, 3);";
const BLACK_LETTER_ORANGE_STROKE = "pen.fillStyle = '#000'; pen.fillRect(22, 8, 20, 30); pen.fillStyle = 'rgb(255,153,0)'; pen.fillRect(10, 44, 44, 6);";
const BLACK_LETTER = "pen.fillStyle = '#000'; pen.fillRect(22, 8, 20, 44);";

test('a tone set by hand for one picture does not repaint the next one chosen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => { window.Nordlys.config.groups[0].links[0].tone = 'light'; window.Nordlys.saveConfig(); });
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await page.locator('#icon-file-input').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: png(128, [236, 110, 45]) });
  await expect.poll(async () => (await link(page)).iconSource).toBe('file');
  expect((await link(page)).tone).toBeUndefined();
  const preview = page.locator('#icon-view-find .nl-icon').first();
  await expect(preview.locator('img')).toHaveCSS('filter', 'none');
  await expect(preview).not.toHaveAttribute('data-icon-tone', /.+/);
});

test('a picture in several colours keeps them, whatever tone is asked for', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const tone of ['light', 'dark', null]) {
    const shown = await wear(page, ORANGE_PLATE, tone);
    expect(shown, `tone ${tone}`).toMatchObject({ tone: null, flat: false, parts: false, filter: 'none' });
  }
});

test('a dark plate on a dark tile is left alone: a plate is not a mark to redraw as a shape', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  expect(await wear(page, NAVY_PLATE, null)).toMatchObject({ tone: null, flat: false, parts: false, filter: 'none' });
});

test('black beside a colour: on a dark tile the black turns white and the colour stays', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // The orange carries the picture's average over the line; the letter alone is what is lost.
  const shown = await wear(page, BLACK_LETTER_ORANGE_STROKE, null);
  expect(shown).toMatchObject({ tone: 'light', parts: true, flat: false, filter: 'none', letter: '255,255,255', stroke: '255,153,0' });
  // On a light tile it reads as it is, and is put back as it was.
  await page.evaluate(() => window.Nordlys.setTheme('porcelain-light'));
  await page.evaluate(() => window.NordlysIcons.refreshIconContrast());
  await expect.poll(() => page.evaluate(() => 'iconParts' in document.querySelector('.tile .nl-icon').dataset)).toBe(false);
  expect(await page.evaluate(() => document.querySelector('.tile .nl-icon img').src)).toBe(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg));
});

test('white beside a colour, asked dark by hand: the white turns black, the colour stays', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const shown = await wear(page, WHITE_LETTER_ORANGE_STROKE, 'dark');
  expect(shown).toMatchObject({ tone: 'dark', parts: true, flat: false, filter: 'none', letter: '0,0,0', stroke: '255,153,0' });
  // Asked light, it is already so: the picture as it was found.
  expect(await wear(page, WHITE_LETTER_ORANGE_STROKE, 'light')).toMatchObject({ tone: null, parts: false, letter: '255,255,255', stroke: '255,153,0' });
});

test('a white sign on a coloured ground is not turned over on a light tile', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.Nordlys.setTheme('porcelain-light'));
  // Steam's kind of mark: the white is a third of it and sits inside the colour, which reads on any tile.
  const shown = await wear(page, "pen.fillStyle = 'rgb(23,64,110)'; pen.beginPath(); pen.arc(32, 32, 28, 0, 7); pen.fill(); pen.fillStyle = '#fff'; pen.fillRect(18, 18, 28, 28);", null);
  expect(shown).toMatchObject({ tone: null, parts: false, filter: 'none', letter: '255,255,255' });
});

test('Invert in the icon dialog turns the icon over and back, and it stays as chosen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await wear(page, BLACK_LETTER_ORANGE_STROKE, null);
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  const button = page.locator('#icon-invert');
  const preview = page.locator('#icon-view-find .nl-icon').first();
  // Nordlys turned it over by itself for this dark tile: the button shows it, and a press asks for the picture as found.
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].tone)).toBe('original');
  await expect(preview).not.toHaveAttribute('data-icon-tone', /.+/);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.Nordlys.config.groups[0].links[0].tone)).toBe('inverted');
  await expect(preview).toHaveAttribute('data-icon-parts', '');
  // A picture in several colours and no black or white has no other side to show.
  await page.keyboard.press('Escape');
  await wear(page, ORANGE_PLATE, null);
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await expect(button).toBeDisabled();
});

test('a mark with no colour at all is still inverted, black to white', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const shown = await wear(page, BLACK_LETTER, null);
  expect(shown).toMatchObject({ tone: 'light', flat: false, parts: false, filter: 'invert(1)' });
});
