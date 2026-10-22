const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Some WebKit sessions (a Safari private window, WebKit's test builds) refuse
   to keep a Blob in IndexedDB. A wallpaper is then kept as its bytes, and
   comes back as the same picture. Chromium is made to refuse the same way. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOo3MtMEmIY1TCqYfhqAADdITkQZQGFuAAAAABJRU5ErkJggg==', 'base64');

test('a store that refuses Blobs still keeps the wallpaper, across a reload', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...rest) {
      if (value && value.blob instanceof Blob) throw new DOMException('Blobs are not supported here', 'DataCloneError');
      return put.call(this, value, ...rest);
    };
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await page.locator('#cfg-custom-media').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(page.locator('.scene-card[data-scene="custom-image"]')).toHaveAttribute('aria-checked', 'true');
  const stored = () => page.evaluate(async () => {
    const blob = await MediaVault.getMedia('custom_bg');
    return blob ? { size: blob.size, type: blob.type } : null;
  });
  await expect.poll(stored).toEqual({ size: PIXEL.length, type: 'image/png' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await stored()).toEqual({ size: PIXEL.length, type: 'image/png' });
  expect(runtimeErrors.filter((line) => line.startsWith('pageerror'))).toEqual([]);
});

/* A photo larger than the screen is kept at the screen's size: every new tab
   decodes it. One already small enough is kept byte for byte (above). */
test('a large photo is kept at the size the screen can show', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  test.slow();
  const big = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 4800; canvas.height = 3200;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 4800, 3200); g.addColorStop(0, '#123'); g.addColorStop(1, '#9cf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4800, 3200);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = ''; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }), 'base64');
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await page.locator('#cfg-custom-media').setInputFiles({ name: 'camera.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect(page.locator('.scene-card[data-scene="custom-image"]')).toHaveAttribute('aria-checked', 'true');
  const kept = await page.evaluate(async () => {
    const blob = await MediaVault.getMedia('custom_bg');
    const bitmap = await createImageBitmap(blob);
    return { type: blob.type, width: bitmap.width, height: bitmap.height, size: blob.size };
  });
  expect(kept.type).toBe('image/webp');
  expect(Math.max(kept.width, kept.height)).toBeLessThanOrEqual(3840);
  expect(kept.width / kept.height).toBeCloseTo(1.5, 2);
});

/* The wallpaper is read from the vault, which answers later. A sky chosen
   while it was being read used to have the wallpaper laid back over it. */
test('a wallpaper read late does not come back over the sky chosen after it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const shown = await page.evaluate(async () => {
    let release;
    MediaVault.getMedia = () => new Promise(resolve => { release = () => resolve(new Blob(['x'], { type: 'image/png' })); });
    const app = window.Nordlys;
    app.config.bgMode = 'custom-image';
    const late = app.updateBackgroundMode();
    app.config.bgMode = 'aurora';
    await app.updateBackgroundMode();
    release();
    await late;
    return { active: document.getElementById('bg-media').classList.contains('active'), url: app.mediaObjectUrl || null };
  });
  expect(shown).toEqual({ active: false, url: null });
});
