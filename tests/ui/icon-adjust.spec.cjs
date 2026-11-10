const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { png, pretendInternet } = require('../helpers/icon-network.cjs');

/* Adjust: the picture on the tile's own plate, moved by dragging it and
   scaled by the wheel, a pinch or the one slider. Fit and Fill are the two
   framings; there is nothing else to press. */

const link = (page) => page.evaluate(() => window.Nordlys.config.groups[0].links[0]);

async function openWithFile(page, buffer, { name = 'icon.png', mimeType = 'image/png' } = {}) {
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  await page.locator('#icon-file-input').setInputFiles({ name, mimeType, buffer });
}

async function openAdjust(page, buffer, file) {
  await openWithFile(page, buffer, file);
  await expect.poll(async () => (await link(page)).iconSource).toBe('file');
  await page.locator('#icon-adjust').click();
  await expect(page.locator('#icon-view-adjust')).toBeVisible();
}

/* How much of the canvas is painted, and where its paint is centred. */
const painted = (page) => page.evaluate(() => {
  const canvas = document.getElementById('icon-adjust-canvas');
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let count = 0, sumX = 0, sumY = 0;
  for (let at = 3; at < data.length; at += 4) if (data[at] > 24) { count++; sumX += ((at - 3) / 4) % canvas.width; sumY += Math.floor((at - 3) / 4 / canvas.width); }
  return { share: count / (canvas.width * canvas.height), x: count ? sumX / count : 0, y: count ? sumY / count : 0 };
});

test('a file becomes the icon at once, and Adjust is offered for it', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;
  const asked = await pretendInternet(page, origin);
  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  // The library mark the tile starts with is not a picture: nothing to adjust yet.
  await expect(page.locator('#icon-adjust')).toBeDisabled();
  await page.locator('#icon-file-input').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: png(128, [30, 160, 60]) });
  await expect.poll(async () => (await link(page)).customImg || '').toMatch(/^data:image\//);
  await expect(page.locator('#icon-adjust')).toBeEnabled();
  expect(asked).toEqual([]);
});

test('Adjust opens with the whole picture, on the tile\'s plate', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openAdjust(page, png(128, [30, 160, 60], { plate: true }));
  expect((await painted(page)).share).toBeGreaterThan(0.98);
  // The plate is a real tile box, so shape and theme are the tile's own.
  await expect(page.locator('#icon-adjust-box')).toHaveClass(/box/);
  const stage = await page.locator('#icon-adjust-box').boundingBox();
  expect(stage.width).toBeGreaterThanOrEqual(240);
  // Fewer things to press than there were: one slider and two framings.
  await expect(page.locator('#icon-view-adjust input')).toHaveCount(1);
  await expect(page.locator('#icon-view-adjust button')).toHaveCount(4);
});

test('dragging moves the picture, the wheel scales it, Fit puts it back', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openAdjust(page, png(128, [30, 160, 60]));
  const start = await painted(page);
  const stage = await page.locator('#icon-adjust-box').boundingBox();
  const centre = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 30, centre.y, { steps: 3 });
  await page.mouse.up();
  const dragged = await painted(page);
  expect(dragged.x).toBeGreaterThan(start.x + 20);

  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number(await page.locator('#icon-adjust-zoom').inputValue())).toBeGreaterThan(310);

  await page.locator('#icon-adjust-fit').click();
  const fitted = await painted(page);
  expect(Math.abs(fitted.x - start.x)).toBeLessThan(1);
  expect(Math.abs(fitted.share - start.share)).toBeLessThan(0.01);
});

test('Fill covers the plate with a picture that is not square', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const wide = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    const pen = canvas.getContext('2d'); pen.fillStyle = '#c33'; pen.fillRect(0, 0, 200, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await openAdjust(page, Buffer.from(wide, 'base64'));
  expect((await painted(page)).share).toBeLessThan(0.55);
  await page.locator('#icon-adjust-fill').click();
  expect((await painted(page)).share).toBeGreaterThan(0.98);
});

test('the keyboard moves and scales the picture', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openAdjust(page, png(128, [30, 160, 60]));
  await expect(page.locator('#icon-adjust-box')).toBeFocused();
  const start = await painted(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const moved = await painted(page);
  expect(moved.x).toBeGreaterThan(start.x + 4);
  expect(moved.y).toBeGreaterThan(start.y + 20);
  await page.keyboard.press('+');
  expect((await painted(page)).share).toBeGreaterThan(start.share);
  await page.keyboard.press('0');
  expect(Math.abs((await painted(page)).x - start.x)).toBeLessThan(1);
  // The slider is a stop of its own, and the arrows work it.
  await page.locator('#icon-adjust-zoom').focus();
  const at = Number(await page.locator('#icon-adjust-zoom').inputValue());
  await page.keyboard.press('ArrowRight');
  expect(Number(await page.locator('#icon-adjust-zoom').inputValue())).toBeGreaterThan(at);
});

test('Done keeps what the plate shows, at icon size; Back keeps what was there', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openAdjust(page, png(128, [30, 160, 60]));
  const before = (await link(page)).customImg;
  await page.locator('#icon-adjust-fill').click();
  await page.locator('#icon-adjust-back').click();
  await expect(page.locator('#icon-view-find')).toBeVisible();
  expect((await link(page)).customImg).toBe(before);

  await page.locator('#icon-adjust').click();
  await page.keyboard.press('+');
  await page.locator('#icon-adjust-done').click();
  await expect(page.locator('#icon-view-find')).toBeVisible();
  const after = (await link(page)).customImg;
  expect(after).not.toBe(before);
  const size = await page.evaluate(async (src) => { const image = new Image(); image.src = src; await image.decode(); return [image.naturalWidth, image.naturalHeight]; }, after);
  expect(size).toEqual([384, 384]);
  await expect(page.locator('.tile').first().locator('img')).toHaveAttribute('src', after);
});

test('a file over 5 MB, or one that is not an image, is refused with the reason', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const before = await link(page);
  await openWithFile(page, Buffer.alloc(5 * 1024 * 1024 + 1), { name: 'huge.png' });
  await expect(page.locator('#icon-find-status')).toHaveText('That file is over 5 MB');
  await page.locator('#icon-file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('#icon-find-status')).toHaveText('That file is not an image');
  expect(await link(page)).toEqual(before);
});

/* The config lives in a store of a few megabytes shared with everything
   else; an icon is drawn at a few dozen pixels. */
test('a large picture is stored at icon size, with its clear margins cut away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const big = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1600;
    const pen = canvas.getContext('2d'); pen.fillStyle = '#2a6'; pen.fillRect(600, 600, 400, 400);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await openWithFile(page, Buffer.from(big, 'base64'));
  await expect.poll(async () => (await link(page)).iconSource).toBe('file');
  const stored = (await link(page)).customImg;
  expect(stored.length).toBeLessThan(60000);
  const drawn = await page.evaluate(async (src) => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const pen = canvas.getContext('2d'); pen.drawImage(image, 0, 0);
    return { side: image.naturalWidth, corner: pen.getImageData(2, 2, 1, 1).data[3] };
  }, stored);
  expect(drawn.side).toBeLessThanOrEqual(384);
  // The square now reaches the edges: the margin that made it a quarter of the tile is gone.
  expect(drawn.corner).toBeGreaterThan(200);
});

test('a light vector stays a vector, a heavy one is drawn at icon size', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const light = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#36c"/></svg>';
  await openWithFile(page, Buffer.from(light), { name: 'a.svg', mimeType: 'image/svg+xml' });
  await expect.poll(async () => (await link(page)).customImg || '').toMatch(/^data:image\/svg\+xml/);
  const heavy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#36c"/><!--${'x'.repeat(200000)}--></svg>`;
  await page.locator('#icon-file-input').setInputFiles({ name: 'b.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(heavy) });
  await expect.poll(async () => (await link(page)).customImg || '').toMatch(/^data:image\/(webp|png)/);
  expect((await link(page)).customImg.length).toBeLessThan(60000);
});
