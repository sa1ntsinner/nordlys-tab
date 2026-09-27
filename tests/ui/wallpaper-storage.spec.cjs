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
