const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
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

  const gradient = page.locator('.scene-card[data-scene="gradient"]');
  await gradient.click();
  await expect(gradient).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.bgMode).toBe('gradient');
});

/* Two of the four procedural scenes were not scenes. Cosmos drew Aurora's
   nebulae, stars and meteors and left out the ribbons that give it its name;
   Particles measured 0.08 of 255 different from a plain colour. Both held a
   full animation loop open to do it. What replaced them is a still field that
   costs nothing and lets the glass above stop re-blurring every frame. */
test('only scenes that draw something are offered', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const offered = await page.locator('#cfg-bg-mode option').evaluateAll(
    nodes => nodes.map(node => node.value)
  );
  expect(offered).toEqual(['aurora', 'gradient', 'custom-image', 'custom-video', 'solid']);
});

test('a still field is offered in four compositions, and only when it is chosen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  // Compositions belong to the gradient; on Aurora they are noise.
  await expect(page.locator('#bg-gradient-grid')).toBeHidden();

  await page.locator('.scene-card[data-scene="gradient"]').click();
  await expect(page.locator('#bg-gradient-grid')).toBeVisible();
  const compositions = page.locator('#bg-gradient-grid .scene-card');
  await expect(compositions).toHaveCount(4);

  // Each arrangement has to be a different arrangement.
  const looks = await page.locator('#bg-gradient-grid .scene-preview').evaluateAll(
    nodes => nodes.map(node => getComputedStyle(node).backgroundImage)
  );
  expect(new Set(looks).size, 'four compositions, four appearances').toBe(4);

  await page.locator('.scene-card[data-gradient="bloom"]').click();
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.gradient).toBe('bloom');
  await expect(page.locator('html')).toHaveAttribute('data-gradient', 'bloom');
});

async function chooseBackground(page, mode) {
  await page.evaluate(key => {
    window.Aurora.config.bgMode = key;
    window.Aurora.saveConfig();
    window.Aurora.updateBackgroundMode();
  }, mode);
  await page.waitForTimeout(300);
}

test('the still field runs no animation at all', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await chooseBackground(page, 'gradient');
  const state = await page.evaluate(() => ({
    canvasShown: getComputedStyle(document.getElementById('bg-canvas')).display,
    // The loop handle is animId. An earlier version of this test read a field
    // that does not exist, computed the answer, and then never asserted it.
    frameHandle: window.Aurora.bgEngine.animId,
    painted: getComputedStyle(document.body).backgroundImage
  }));
  expect(state.canvasShown, 'the canvas has nothing to draw').toBe('none');
  expect(state.frameHandle, 'no frame may be scheduled for a still background').toBeFalsy();
  expect(state.painted, 'the composition is painted by CSS').toContain('radial-gradient');
});

/* The rule that paints the still field outranks every theme's own ground, so
   the attribute driving it must exist only in the mode that wants it. It did
   not: it was set on every background change, which quietly made Solid not
   solid and retired the wash all twenty-one themes define for themselves. */
test('a background that is not the gradient does not wear one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  await chooseBackground(page, 'gradient');
  await expect(page.locator('html')).toHaveAttribute('data-gradient', /\w+/);

  await chooseBackground(page, 'solid');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-gradient')),
    'solid must not carry a gradient attribute').toBe(false);

  const solid = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(solid, 'Solid means one colour, which is what its own preview promises').toBe('none');

  await chooseBackground(page, 'aurora');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-gradient')),
    'aurora keeps the theme ground it was designed with').toBe(false);
});

/* Someone who chose one of the removed scenes must land somewhere sensible
   rather than on a default that throws away what they picked. */
test('a stored scene that no longer exists migrates to its closest survivor', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  for (const [stored, expected] of [['cosmos', 'aurora'], ['particles', 'gradient'], ['mesh-gradient', 'gradient']]) {
    await page.evaluate(mode => {
      // Write through the app so the config lands wherever it actually lives.
      window.Aurora.config.bgMode = mode;
      delete window.Aurora.config.gradient;
      window.Aurora.saveConfig();
    }, stored);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Aurora?.grid));
    expect(await page.evaluate(() => window.Aurora.config.bgMode), `${stored} should become ${expected}`).toBe(expected);
  }
  // mesh-gradient drew two soft masses; bloom is that arrangement held still.
  expect(await page.evaluate(() => window.Aurora.config.gradient)).toBe('bloom');
});

/* Before this the procedural scenes differed only in the particles they drew, so
   changing anything read as no change. These two apply to every scene. */
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

test('the atmosphere sliders visibly change what the canvas draws', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  // Compare the same scene at full and at minimum presence: the engine must paint
  // a measurably different frame, otherwise the control is decorative.
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
