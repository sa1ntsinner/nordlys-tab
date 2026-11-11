const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { png } = require('../helpers/icon-network.cjs');

/* A tone repaints a mark of one colour so it can be seen on its tile. It is
   never a reason to change the colours of a picture that has several. */

const link = (page) => page.evaluate(() => window.Nordlys.config.groups[0].links[0]);

/* The first tile wearing a picture drawn here, and what the tile then says of it. */
async function wear(page, draw, tone) {
  return page.evaluate(async ([source, tone]) => {
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
    const icon = document.querySelector('.tile .nl-icon');
    return { tone: icon.dataset.iconTone || null, flat: 'iconFlat' in icon.dataset, filter: getComputedStyle(icon.querySelector('img')).filter };
  }, [draw, tone]);
}
const ORANGE_PLATE = "pen.fillStyle = 'rgb(236,110,45)'; pen.beginPath(); pen.roundRect(1, 1, 62, 62, 12); pen.fill(); pen.fillStyle = '#fff'; pen.fillRect(14, 34, 36, 6);";
const NAVY_PLATE = "pen.fillStyle = 'rgb(8,16,56)'; pen.beginPath(); pen.roundRect(1, 1, 62, 62, 12); pen.fill(); pen.fillStyle = 'rgb(20,34,90)'; pen.fillRect(14, 34, 36, 6);";
const WHITE_LETTER_ORANGE_STROKE = "pen.fillStyle = '#fff'; pen.fillRect(22, 8, 20, 30); pen.fillStyle = 'rgb(255,153,0)'; pen.fillRect(10, 46, 44, 3);";
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
    expect(shown, `tone ${tone}`).toEqual({ tone: null, flat: false, filter: 'none' });
  }
});

test('a dark plate on a dark tile is left alone: a plate is not a mark to redraw as a shape', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  expect(await wear(page, NAVY_PLATE, null)).toEqual({ tone: null, flat: false, filter: 'none' });
});

test('a mark with a little colour in it is redrawn as its shape, never inverted into other colours', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const shown = await wear(page, WHITE_LETTER_ORANGE_STROKE, 'dark');
  expect(shown.tone).toBe('dark');
  expect(shown.flat).toBe(true);
  expect(shown.filter).toContain('brightness(0)');
});

test('a mark with no colour at all is still inverted, black to white', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const shown = await wear(page, BLACK_LETTER, null);
  expect(shown.tone).toBe('light');
  expect(shown.flat).toBe(false);
  expect(shown.filter).toBe('invert(1)');
});
