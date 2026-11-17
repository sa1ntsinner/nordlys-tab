const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* On the software renderer, and so in a file of its own: this compares two
   paints of one still, and a GPU (the Mac's Metal, which playwright.config.cjs
   uses there) does not paint the same still twice alike. */
test.use({ launchOptions: { args: [] } });

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
}

/* The thumbnails are the sky in miniature, so choosing a mood repaints them in
   it — a picker whose previews stay on the old colours shows the wrong choice. */
test('scene previews repaint in the chosen colour mood', async ({ nordlysPage, browserName }) => {
  test.skip(browserName === 'firefox', 'Gecko does not paint the same preview twice byte for byte, which this test compares');
  const { page } = nordlysPage;
  await openBackground(page);
  const silk = page.locator('#bg-scene-grid canvas.scene-still[data-scene="silk"]');
  await expect(page.locator('#bg-scene-grid .scene-preview.is-live')).toHaveCount(8);
  /* How far the still is from the one first painted: the share of channels
     that moved, and by how much at most. Compared with a little give rather
     than byte for byte: WebKit on a newer macOS paints the same still a
     second time with six of its 35,000 channels a few levels off, which is
     the rasteriser and not another scene. */
  const pixels = () => silk.evaluate(node => Array.from(node.getContext('2d').getImageData(0, 0, node.width, node.height).data));
  const before = await pixels();
  const apart = async () => {
    const now = await pixels();
    let moved = 0;
    let most = 0;
    for (let i = 0; i < now.length; i++) {
      const step = Math.abs(now[i] - before[i]);
      if (step > 8) moved++;
      most = Math.max(most, step);
    }
    return { moved: moved / now.length, most };
  };
  await page.locator('[data-palette="ember"]').click();
  await expect.poll(async () => (await apart()).moved, 'the still repaints in the new mood').toBeGreaterThan(0.05);
  // Painted from the same seeded world: the mood changes the colours, not the scene.
  await page.locator('[data-palette="theme"]').click();
  await expect.poll(apart, 'and back in the old one it is the same still').toEqual({ moved: 0, most: expect.any(Number) });
  expect((await apart()).most).toBeLessThanOrEqual(8);
});
