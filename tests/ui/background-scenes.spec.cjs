const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
}

async function chooseBackground(page, mode) {
  await page.evaluate(key => {
    window.Aurora.config.bgMode = key;
    window.Aurora.saveConfig();
    window.Aurora.updateBackgroundMode();
  }, mode);
  await page.waitForTimeout(300);
}

/* The scene used to be picked from a dropdown of engine names, which showed the
   user nothing. The replacement has to actually present the choice. */
test('scenes are chosen from shown previews, not a list of engine names', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);

  const cards = page.locator('#bg-scene-grid .scene-card');
  await expect(cards).toHaveCount(await page.locator('#cfg-bg-mode option').count());
  await expect(page.locator('#bg-scene-grid')).toHaveAttribute('role', 'radiogroup');

  /* Wallpaper, Video and Solid share a ground and differ by the mark drawn on
     it, so comparing the background alone would report them identical. */
  const previews = await page.locator('#bg-scene-grid .scene-preview').evaluateAll(
    nodes => nodes.map(node => {
      const own = getComputedStyle(node);
      const mark = getComputedStyle(node, '::after');
      return `${own.backgroundImage}|${mark.clipPath}|${mark.content}|${mark.width}`;
    })
  );
  expect(new Set(previews).size, 'each scene must look like itself').toBe(previews.length);

  const solid = page.locator('.scene-card[data-scene="solid"]');
  await solid.click();
  await expect(solid).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.bgMode).toBe('solid');
});

/* What is offered has been cut twice, both times on measurement rather than
   taste. Cosmos drew Aurora's nebulae, stars and meteors and left out the
   ribbons that give it its name. Particles measured 0.08 of 255 away from a
   plain colour. Then the four still compositions went: rendered at full size
   behind the real board they sat 4.55 to 8.68 of 255 apart — the same distance
   that had already condemned cosmos — and since a person sees exactly one of
   them at a time, they were being asked to choose between things they could not
   tell apart. Four scenes remain and each is a different kind of thing. */
test('only scenes that are a different kind of thing are offered', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const offered = await page.locator('#cfg-bg-mode option').evaluateAll(
    nodes => nodes.map(node => node.value)
  );
  expect(offered).toEqual(['aurora', 'custom-image', 'custom-video', 'solid']);
  // And nothing anywhere still offers a composition to pick between.
  expect(await page.locator('#bg-gradient-grid').count()).toBe(0);
});

test('solid means one colour, and no attribute survives the deleted mode', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await chooseBackground(page, 'solid');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage),
    'Solid means one colour, which is what its own preview promises').toBe('none');

  await chooseBackground(page, 'aurora');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-gradient')),
    'no attribute survives from the deleted mode').toBe(false);
});

/* Someone who chose one of the removed scenes must land somewhere sensible
   rather than on a default that throws away what they picked. A scene that held
   still has to keep holding still, or the migration is a visible change they
   never asked for. */
test('a stored scene that no longer exists migrates to its closest survivor', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const [stored, motion] of [['cosmos', 1], ['particles', 0], ['mesh-gradient', 0], ['gradient', 0]]) {
    await page.evaluate(mode => {
      window.Aurora.config.bgMode = mode;
      window.Aurora.config.bgMotion = 1;
      window.Aurora.saveConfig();
    }, stored);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
    expect(await page.evaluate(() => window.Aurora.config.bgMode), `${stored} should become aurora`).toBe('aurora');
    expect(await page.evaluate(() => window.Aurora.config.bgMotion),
      `${stored} was ${motion ? 'moving' : 'still'} and should stay that way`).toBe(motion);
    expect(await page.evaluate(() => 'gradient' in window.Aurora.config),
      'the composition key is not carried forward').toBe(false);
  }
});

/* Before this the procedural scenes differed only in the particles they drew, so
   changing anything read as no change. */
test('motion and atmosphere reach the canvas engine and persist', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);

  await page.locator('#cfg-bg-motion').fill('40');
  await page.locator('#cfg-bg-motion').dispatchEvent('change');
  await page.locator('#cfg-bg-intensity').fill('55');
  await page.locator('#cfg-bg-intensity').dispatchEvent('change');

  expect(await page.evaluate(() => ({
    motion: window.Aurora.bgEngine.motion,
    intensity: window.Aurora.bgEngine.intensity
  }))).toEqual({ motion: 0.4, intensity: 0.55 });
  await expect(page.locator('#lbl-bg-motion')).toHaveText('40%');
  await expect(page.locator('#lbl-bg-intensity')).toHaveText('55%');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  expect(await page.evaluate(() => window.Aurora.config.bgMotion)).toBe(0.4);
});

/* Zero on the motion slider is the state that replaced a whole background mode,
   so it has to be a real state rather than just a small number: the scene is
   painted once and held, nothing is scheduled after it, and the slider says so
   in words instead of reporting "0%" and leaving the user to work out whether
   anything is still there. */
test('zero motion paints the scene once and then stops', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await page.locator('#cfg-bg-motion').fill('0');
  await page.locator('#cfg-bg-motion').dispatchEvent('change');
  await expect(page.locator('#lbl-bg-motion')).not.toHaveText('0%');

  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.Aurora.bgEngine.animId),
    'nothing may be scheduled once the scene is at rest').toBeNull();

  // Painted, not blank — the whole point of holding a frame rather than stopping.
  const painted = await page.evaluate(() => {
    const canvas = document.getElementById('bg-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 2) lit++;
    return lit;
  });
  expect(painted, 'a scene at rest is held, not erased').toBeGreaterThan(100);

  // And it comes back.
  await page.locator('#cfg-bg-motion').fill('100');
  await page.locator('#cfg-bg-motion').dispatchEvent('change');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.Aurora.bgEngine.animId)).toBeTruthy();
});

/* "Reduce motion" is not "remove the picture". The loop used to refuse to start
   at all under that setting, so a reduced-motion user who kept the default
   background got a blank canvas over their theme — the product's signature
   absent for exactly the people least able to opt back into it. */
test('reduced motion holds the scene instead of blanking it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.bgEngine));
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const canvas = document.getElementById('bg-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 2) lit++;
    return { lit, scheduled: window.Aurora.bgEngine.animId, mode: window.Aurora.config.bgMode };
  });
  expect(state.mode).toBe('aurora');
  expect(state.lit, 'the aurora is painted for a reduced-motion user too').toBeGreaterThan(100);
  expect(state.scheduled, 'but nothing keeps moving').toBeNull();
});

test('the atmosphere sliders visibly change what the canvas draws', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const sample = () => page.evaluate(() => {
    const engine = window.Aurora.bgEngine;
    engine.render(1);
    const canvas = document.getElementById('bg-canvas');
    const probe = document.createElement('canvas');
    probe.width = probe.height = 24;
    const context = probe.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, 24, 24);
    return [...context.getImageData(0, 0, 24, 24).data].reduce((total, value) => total + value, 0);
  });

  await page.evaluate(() => window.Aurora.bgEngine.setAtmosphere({ intensity: 1.5 }));
  const bright = await sample();
  await page.evaluate(() => window.Aurora.bgEngine.setAtmosphere({ intensity: 0.15 }));
  const faint = await sample();
  expect(bright, 'a fainter atmosphere must paint less light').toBeGreaterThan(faint);
});
