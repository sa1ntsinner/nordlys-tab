const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

/* A 1024px logo could not be zoomed out far enough to see: the slider floored at
   30%, the initial fit was floored at 40%, and Fit View ran into the same floor —
   so the one button whose job is to fit the image could not fit it. */
const BIG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#1db954"/><circle cx="512" cy="512" r="300" fill="#fff"/></svg>')}`;

async function openCropperWith(page, source) {
  // The cropper lives inside the icon picker, so the picker has to be genuinely
  // open before its controls can be clicked.
  if (!(await page.locator('#icon-modal').isVisible())) {
    await page.locator('#gear').click();
    await page.locator('#settings-tab-bookmarks').click();
    const folder = page.locator('.bookmark-folder-accordion').first();
    await folder.locator('summary').click();
    await openIconPicker(page, folder);
    await expect(page.locator('#icon-modal')).toBeVisible();
  }
  await page.evaluate(async src => {
    await window.Nordlys.settings.openCropper(src, 'url');
  }, source);
  await page.waitForFunction(() => Boolean(window.Nordlys.settings.cropperImage));
  await page.waitForTimeout(150);
}

function fits(state) {
  return state.zoom * state.imageWidth <= state.canvasWidth + 1 && state.zoom * state.imageHeight <= state.canvasHeight + 1;
}

async function cropperState(page) {
  return page.evaluate(() => {
    const settings = window.Nordlys.settings;
    const canvas = document.getElementById('cropper-canvas');
    const slider = document.getElementById('cropper-zoom-slider');
    return {
      zoom: settings.cropperZoom,
      imageWidth: settings.cropperImage.naturalWidth || settings.cropperImage.width,
      imageHeight: settings.cropperImage.naturalHeight || settings.cropperImage.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      sliderMin: Number(slider.min),
      sliderMax: Number(slider.max)
    };
  });
}

test('a large image can be zoomed out until it fits', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCropperWith(page, BIG);

  const opened = await cropperState(page);
  const fitScale = Math.min(opened.canvasWidth / opened.imageWidth, opened.canvasHeight / opened.imageHeight);
  expect(opened.sliderMin, `the slider floors at ${opened.sliderMin}, above the ${fitScale.toFixed(3)} needed to fit`).toBeLessThanOrEqual(fitScale);

  // Drag the slider to its own minimum: the image must end up inside the frame.
  await page.evaluate(() => {
    const slider = document.getElementById('cropper-zoom-slider');
    slider.value = slider.min;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const zoomedOut = await cropperState(page);
  expect(fits(zoomedOut), `at minimum zoom the image is still ${Math.round(zoomedOut.zoom * zoomedOut.imageWidth)}px in a ${zoomedOut.canvasWidth}px frame`).toBe(true);
});

test('Fit View actually fits, whatever the image size', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const source of [BIG, `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#ff0000"/></svg>')}`]) {
    await openCropperWith(page, source);
    await page.locator('#cropper-tool-fit').click();
    await page.waitForTimeout(80);
    const state = await cropperState(page);
    expect(fits(state), `Fit View left a ${state.imageWidth}px image at ${Math.round(state.zoom * state.imageWidth)}px in a ${state.canvasWidth}px frame`).toBe(true);
  }
});

test('the cropper opens showing the whole image', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCropperWith(page, BIG);
  const opened = await cropperState(page);
  expect(fits(opened), `it opened at ${Math.round(opened.zoom * 100)}%, overflowing the frame`).toBe(true);
});

/* Two live previews showing different icons, neither labelled as before or after,
   just reads as a contradiction. */
test('the picker preview steps aside while the cropper has its own', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCropperWith(page, BIG);
  await expect(page.locator('#icon-modal .icon-live-preview')).toBeHidden();
  await expect(page.locator('#cropper-tile-preview-canvas')).toBeVisible();

  await page.locator('#cropper-back-btn').click();
  await expect(page.locator('#icon-modal .icon-live-preview')).toBeVisible();
});

async function openCustomPane(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();
  await openIconPicker(page, folder);
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await expect(page.locator('#modal-pane-custom')).toBeVisible();
}

/* The status line used to say "Image loaded successfully!" whatever happened,
   because the loader hands the address back unchanged when every fetch fails. */
test('an address that gives no image says so and offers nothing to apply', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.route('https://example.invalid/**', route => route.fulfill({ status: 404, body: 'gone' }));
  await page.route('https://images.weserv.nl/**', route => route.fulfill({ status: 404, body: 'gone' }));
  await openCustomPane(page);
  await page.locator('#icon-url-input').fill('https://example.invalid/logo.png');
  await page.locator('#icon-url-check-btn').click();
  await expect(page.locator('#icon-url-status')).toHaveText('No image came back from that address');
  await expect(page.locator('#icon-url-actions')).toBeHidden();

  await page.locator('#icon-url-input').fill(BIG);
  await page.locator('#icon-url-check-btn').click();
  await expect(page.locator('#icon-url-status')).toHaveText('Image ready');
  await expect(page.locator('#icon-url-actions')).toBeVisible();
});

/* "Max 5MB" was a caption and nothing more. */
test('a file over 5 MB, or one that is not an image, is refused with the reason', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  const input = page.locator('#icon-file-input');
  await input.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.locator('#icon-file-hint')).toHaveText('That file is over 5 MB');
  await expect(page.locator('#icon-file-preview-wrap')).toBeHidden();
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('#icon-file-hint')).toHaveText('That file is not an image');
});

/* An icon is stored inside the config, and the config shares a few megabytes
   with everything else; the full file used to go in as it came. */
test('a large image used as an icon is stored at icon size', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openCustomPane(page);
  const big = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 1200;
    const context = canvas.getContext('2d');
    for (let i = 0; i < 400; i++) { context.fillStyle = `hsl(${i * 37 % 360} 70% 50%)`; context.fillRect((i * 97) % 1600, (i * 53) % 1200, 120, 90); }
    return canvas.toDataURL('image/png');
  });
  await page.locator('#icon-file-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(big.split(',')[1], 'base64') });
  await expect(page.locator('#icon-file-preview-wrap')).toBeVisible();
  await page.locator('#icon-file-apply-btn').click();
  await expect(page.locator('#icon-modal')).toBeHidden();
  const stored = await page.evaluate(() => window.Nordlys.config.groups[0].links[0].customImg);
  expect(stored).toMatch(/^data:image\/webp/);
  const size = await page.evaluate(src => new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.src = src; }), stored);
  expect(Math.max(...size)).toBe(256);
  // A budget per icon, not a ratio: a flat test image compresses unusually well.
  expect(stored.length).toBeLessThan(60000);
});

/* A vector stays a vector — unless it is heavy. An SVG from an address can
   run to megabytes, and the config it would live in is written whole. */
test('a heavy vector is stored at icon size, a light one stays a vector', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const result = await page.evaluate(async () => {
    const light = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#e33"/></svg>')}`;
    const noise = Array.from({ length: 6000 }, (_, i) => `<rect x="${i % 64}" y="${(i * 7) % 64}" width="1" height="1" fill="#${(i * 2654435761 >>> 8).toString(16).padStart(6, '0').slice(0, 6)}"/>`).join('');
    const heavy = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${noise}</svg>`)}`;
    const settings = window.Nordlys.settings;
    return { light: await settings.iconSizedDataUrl(light), heavyIn: heavy.length, heavy: await settings.iconSizedDataUrl(heavy) };
  });
  expect(result.light).toMatch(/^data:image\/svg\+xml/);
  expect(result.heavyIn).toBeGreaterThan(150000);
  expect(result.heavy).toMatch(/^data:image\/webp/);
  expect(result.heavy.length).toBeLessThan(result.heavyIn);
});
