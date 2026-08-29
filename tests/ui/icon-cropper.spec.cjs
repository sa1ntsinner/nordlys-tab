const { test, expect } = require('../helpers/nordlys-fixture.cjs');

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
    await folder.locator('.bookmark-summary-row').first().getByRole('button', { name: /^Edit/ }).first().click();
    await folder.getByRole('button', { name: /Choose icon/ }).click();
    await expect(page.locator('#icon-modal')).toBeVisible();
  }
  await page.evaluate(async src => {
    await window.Aurora.settings.openCropper(src, 'url');
  }, source);
  await page.waitForFunction(() => Boolean(window.Aurora.settings.cropperImage));
  await page.waitForTimeout(150);
}

function fits(state) {
  return state.zoom * state.imageWidth <= state.canvasWidth + 1 && state.zoom * state.imageHeight <= state.canvasHeight + 1;
}

async function cropperState(page) {
  return page.evaluate(() => {
    const settings = window.Aurora.settings;
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
