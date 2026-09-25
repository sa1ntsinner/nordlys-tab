/* global NORDLYS_REST_PHASE -- read inside page.evaluate, where background.js declares it */
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function openBackground(page) {
  await page.locator('#gear').click();
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
}

async function chooseBackground(page, mode) {
  await page.evaluate(key => {
    window.Nordlys.config.bgMode = key;
    window.Nordlys.saveConfig();
    window.Nordlys.updateBackgroundMode();
  }, mode);
  await page.waitForTimeout(300);
}

/* The scene used to be picked from a dropdown of engine names, which showed the
   user nothing. The replacement has to actually present the choice. */
test('scenes are chosen from shown previews, not a list of engine names', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);

  const cards = page.locator('#bg-scene-picker .scene-card');
  await expect(cards).toHaveCount(await page.locator('#cfg-bg-mode option').count());
  await expect(page.locator('#bg-scene-picker')).toHaveAttribute('role', 'radiogroup');

  /* The generative previews are stills painted by the scene engine, so each
     one is compared by its pixels. Wallpaper, Video and Solid share a ground
     and differ by the mark drawn on it, so comparing their background alone
     would report them identical. */
  await expect(page.locator('#bg-scene-grid .scene-preview.is-live')).toHaveCount(9);
  const stills = await page.locator('#bg-scene-grid canvas.scene-still').evaluateAll(
    nodes => nodes.map(node => {
      const data = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) painted++;
      return { image: node.toDataURL(), painted: painted / (data.length / 4) };
    })
  );
  for (const still of stills) expect(still.painted, 'a still must show its scene').toBeGreaterThan(0.02);
  expect(new Set(stills.map(still => still.image)).size, 'each scene must look like itself').toBe(9);
  const personal = await page.locator('#bg-personal-grid .scene-preview').evaluateAll(
    nodes => nodes.map(node => {
      const own = getComputedStyle(node);
      const mark = getComputedStyle(node, '::after');
      return `${own.backgroundImage}|${own.backgroundColor}|${mark.clipPath}|${mark.content}|${mark.width}`;
    })
  );
  expect(new Set(personal).size, 'each personal source must look like itself').toBe(personal.length);
  await expect(page.locator('#bg-scene-grid .scene-card')).toHaveCount(9);
  await expect(page.locator('#bg-personal-grid .scene-card')).toHaveCount(3);

  const solid = page.locator('.scene-card[data-scene="solid"]');
  await solid.click();
  await expect(solid).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.bgMode).toBe('solid');
});

/* The generated choices are compositions rather than effect-level variants:
   curtains, star trails round the pole, an ice halo, pillars of light, a
   mother-of-pearl cloud, a flow field, black ice, a contour map and a low
   horizon. Personal media remains alongside them without pretending to be a
   shader. */
test('the atmosphere gallery offers nine distinct compositions and personal media', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const offered = await page.locator('#cfg-bg-mode option').evaluateAll(
    nodes => nodes.map(node => node.value)
  );
  expect(offered).toEqual(['aurora', 'polaris', 'halo', 'pillars', 'nacre', 'silk', 'baikal', 'drift', 'horizon', 'custom-image', 'custom-video', 'solid']);
  // And nothing anywhere still offers a composition to pick between.
  expect(await page.locator('#bg-gradient-grid').count()).toBe(0);
});

/* The thumbnails are the sky in miniature, so choosing a mood repaints them in
   it — a picker whose previews stay on the old colours shows the wrong choice. */
test('scene previews repaint in the chosen colour mood', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const halo = page.locator('#bg-scene-grid canvas.scene-still[data-scene="halo"]');
  await expect(page.locator('#bg-scene-grid .scene-preview.is-live')).toHaveCount(9);
  const before = await halo.evaluate(node => node.toDataURL());
  await page.locator('[data-palette="ember"]').click();
  await expect.poll(() => halo.evaluate(node => node.toDataURL())).not.toBe(before);
  // Painted from the same seeded world: the mood changes the colours, not the scene.
  await page.locator('[data-palette="theme"]').click();
  await expect.poll(() => halo.evaluate(node => node.toDataURL())).toBe(before);
});

test('colour mood reaches the canvas engine and persists', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  const ember = page.locator('[data-palette="ember"]');
  await ember.click();
  await expect(ember).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => ({
    stored: window.Nordlys.config.bgPalette,
    active: window.Nordlys.bgEngine.paletteName,
    colours: window.Nordlys.bgEngine.palette
  }))).toEqual({ stored: 'ember', active: 'ember', colours: ['#ffd166', '#f48c6b', '#b86bff'] });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.bgEngine.paletteName)).toBe('ember');
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
      window.Nordlys.config.bgMode = mode;
      window.Nordlys.config.bgMotion = 1;
      window.Nordlys.saveConfig();
    }, stored);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    expect(await page.evaluate(() => window.Nordlys.config.bgMode), `${stored} should become aurora`).toBe('aurora');
    expect(await page.evaluate(() => window.Nordlys.config.bgMotion),
      `${stored} was ${motion ? 'moving' : 'still'} and should stay that way`).toBe(motion);
    expect(await page.evaluate(() => 'gradient' in window.Nordlys.config),
      'the composition key is not carried forward').toBe(false);
  }
  // Frost was retired for Baikal, the other sky made of ice.
  await page.evaluate(() => {
    window.Nordlys.config.bgMode = 'frost';
    window.Nordlys.config.bgMotion = 0.3;
    window.Nordlys.saveConfig();
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.bgMode), 'frost should become baikal').toBe('baikal');
  expect(await page.evaluate(() => window.Nordlys.bgEngine.mode)).toBe('baikal');
  expect(await page.evaluate(() => window.Nordlys.config.bgMotion), 'at the pace it was').toBe(0.3);
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
    motion: window.Nordlys.bgEngine.motion,
    intensity: window.Nordlys.bgEngine.intensity
  }))).toEqual({ motion: 0.4, intensity: 0.55 });
  await expect(page.locator('#lbl-bg-motion')).toHaveText('40%');
  await expect(page.locator('#lbl-bg-intensity')).toHaveText('55%');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.Nordlys.config.bgMotion)).toBe(0.4);
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
  expect(await page.evaluate(() => window.Nordlys.bgEngine.animId),
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
  expect(await page.evaluate(() => window.Nordlys.bgEngine.animId)).toBeTruthy();
});

/* Between paints the loop sleeps on a timer rather than taking a vsync callback
   every refresh only to find the budget not yet spent. Asleep or not, it keeps
   the thirty-a-second cadence, never has two frames on the way at once, and
   pausing leaves nothing behind to wake it. (How few callbacks each paint
   costs at each panel rate is pinned exactly in tests/unit/frame-budget.) */
test('a moving sky sleeps between paints and keeps its cadence; a paused one does nothing', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const sample = () => page.evaluate(async () => {
    const engine = window.Nordlys.bgEngine;
    const { loop, wake } = engine;
    const paints = [];
    let callbacks = 0;
    let wakes = 0;
    engine.loop = now => {
      callbacks++;
      loop(now);
      if (engine.lastFrame === now) paints.push(now);
    };
    engine.wake = () => { wakes++; wake(); };
    await new Promise(resolve => setTimeout(resolve, 1500));
    Object.assign(engine, { loop, wake });
    const gaps = paints.slice(1).map((time, i) => time - paints[i]).sort((a, b) => a - b);
    return { paints: paints.length, callbacks, wakes, median: gaps[gaps.length >> 1] ?? null, scheduled: engine.animId !== null };
  });

  const moving = await sample();
  expect(moving.scheduled).toBe(true);
  expect(moving.paints, 'still about thirty paints a second').toBeGreaterThan(20);
  expect(moving.paints).toBeLessThanOrEqual(48);
  expect(moving.median, 'paints a budget apart, not a refresh or two budgets').toBeGreaterThan(30);
  expect(moving.median).toBeLessThan(37);
  // One frame on its way at a time: no second chain of callbacks or timers.
  expect(moving.callbacks, `${moving.callbacks} callbacks for ${moving.paints} paints`).toBeLessThanOrEqual(moving.paints * 2 + 2);
  expect(moving.wakes).toBeLessThanOrEqual(moving.paints + 1);

  await page.evaluate(() => window.Nordlys.bgEngine.pause());
  const paused = await sample();
  expect(paused).toEqual({ paints: 0, callbacks: 0, wakes: 0, median: null, scheduled: false });

  await page.evaluate(() => window.Nordlys.bgEngine.resume());
  expect((await sample()).paints).toBeGreaterThan(20);
});

test('switching a still atmosphere repaints the new composition immediately', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Nordlys.config.bgMotion = 0;
    window.Nordlys.bgEngine.setAtmosphere({ motion: 0 });
  });
  await chooseBackground(page, 'halo');
  const halo = await page.locator('#bg-canvas').screenshot();
  await chooseBackground(page, 'drift');
  const drift = await page.locator('#bg-canvas').screenshot();
  expect(Buffer.compare(halo, drift)).not.toBe(0);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.mode)).toBe('drift');
});

/* "Reduce motion" is not "remove the picture". The loop used to refuse to start
   at all under that setting, so a reduced-motion user who kept the default
   background got a blank canvas over their theme — the product's signature
   absent for exactly the people least able to opt back into it. */
test('reduced motion holds the scene instead of blanking it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.bgEngine));
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const canvas = document.getElementById('bg-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 2) lit++;
    return { lit, scheduled: window.Nordlys.bgEngine.animId, mode: window.Nordlys.config.bgMode };
  });
  expect(state.mode).toBe('aurora');
  expect(state.lit, 'the aurora is painted for a reduced-motion user too').toBeGreaterThan(100);
  expect(state.scheduled, 'but nothing keeps moving').toBeNull();
});

test('the atmosphere sliders visibly change what the canvas draws', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const sample = () => page.evaluate(() => {
    const engine = window.Nordlys.bgEngine;
    engine.render(1);
    const canvas = document.getElementById('bg-canvas');
    const probe = document.createElement('canvas');
    probe.width = probe.height = 24;
    const context = probe.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, 24, 24);
    return [...context.getImageData(0, 0, 24, 24).data].reduce((total, value) => total + value, 0);
  });

  await page.evaluate(() => window.Nordlys.bgEngine.setAtmosphere({ intensity: 1.5 }));
  const bright = await sample();
  await page.evaluate(() => window.Nordlys.bgEngine.setAtmosphere({ intensity: 0.15 }));
  const faint = await sample();
  expect(bright, 'a fainter atmosphere must paint less light').toBeGreaterThan(faint);
});

/* Guarding only the zero case is how a partial fix passes for a whole one: the
   suite asserted the endpoint, the endpoint worked, and every other slider
   position was still wrong. A meteor is the fastest thing in the frame, so if
   anything ignores the pace it is the thing the eye will find. */
test('every moving part keeps the pace the slider sets', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const travelAt = motion => page.evaluate(pace => {
    const engine = window.Nordlys.bgEngine;
    /* The live loop is stopped for the measurement. It shares the meteor array
       with this test, and once in a run of many it got a frame in between the
       two readings — a dice roll this test exists to take out of the picture. */
    engine.stop();
    engine.motion = pace;
    // One meteor, placed by hand, so the measurement does not wait on a dice roll.
    engine.meteors = [{ x: 100, y: 100, len: 60, speed: 10, angle: Math.PI / 4, life: 1 }];
    for (let frame = 0; frame < 10; frame++) engine.renderMeteors(0, 1);
    const meteor = engine.meteors[0];
    return meteor ? Math.hypot(meteor.x - 100, meteor.y - 100) : 0;
  }, motion);

  const full = await travelAt(1);
  const tenth = await travelAt(0.1);
  expect(full, 'a meteor at full pace travels').toBeGreaterThan(10);
  expect(tenth, 'and at a tenth of the pace it travels about a tenth as far')
    .toBeLessThan(full * 0.25);
});

/* The sky is scattered from a stored seed. A new tab used to scatter it again,
   so the ice a person liked was gone the next time they looked; now reload
   is the same sky, Shuffle is a different one, and Undo is the last one. */
test('the sky keeps its composition across reloads, and shuffle is one undo away', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const still = async () => page.evaluate(async () => {
    window.Nordlys.config.bgMode = 'baikal';
    window.Nordlys.config.bgMotion = 0;
    await window.Nordlys.updateBackgroundMode();
    const engine = window.Nordlys.bgEngine;
    engine.t = NORDLYS_REST_PHASE.baikal;
    engine.render(0);
    return document.getElementById('bg-canvas').toDataURL();
  });
  const first = await still();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await still(), 'a reload is the same sky').toBe(first);

  await openBackground(page);
  await page.locator('#bg-shuffle').click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.bgSeed).not.toBe(0);
  const shuffled = await still();
  expect(shuffled, 'shuffle scatters a different sky').not.toBe(first);

  await page.locator('.toast .toast-action').last().click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.bgSeed).toBe(0);
  expect(await still(), 'undo brings the previous sky back').toBe(first);
});

/* Halo draws tonight's moon, from the date alone. The same sky at a new moon and
   a full moon is two different pictures; with the real sky off it holds full. */
test('Halo follows the real moon, and holds a full one when told not to', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const moonAt = iso => page.evaluate(async when => {
    window.Nordlys.config.bgMode = 'halo';
    window.Nordlys.config.bgMotion = 0;
    await window.Nordlys.updateBackgroundMode();
    const engine = window.Nordlys.bgEngine;
    engine.now = () => new Date(when);
    engine.moonCache = null;
    engine.t = NORDLYS_REST_PHASE.halo;
    engine.render(0);
    // The moon itself, top right: read back just that patch.
    const canvas = document.getElementById('bg-canvas');
    const ratio = canvas.width / innerWidth;
    const x = Math.round(innerWidth * 0.775 * ratio), y = Math.round(innerHeight * 0.24 * ratio);
    const { data } = canvas.getContext('2d').getImageData(x - 20, y - 20, 40, 40);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) lit += data[i + 3] > 200 ? 1 : 0;
    return { lit, info: engine.moonTonight() };
  }, iso);
  const newMoon = await moonAt('2024-04-08T18:21:00Z');
  const fullMoon = await moonAt('2024-10-17T11:26:00Z');
  expect(newMoon.info.illumination).toBeLessThan(0.02);
  expect(fullMoon.info.illumination).toBeGreaterThan(0.98);
  expect(fullMoon.lit, 'a full moon lights more of its patch').toBeGreaterThan(newMoon.lit * 2);

  await openBackground(page);
  await page.locator('.scene-card[data-scene="halo"]').click();
  await expect(page.locator('#bg-moon-tonight')).toHaveText(/^Tonight: .+, \d+% lit$/);
  await page.locator('label.tg:has(#cfg-bg-real-sky)').click();
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.bgRealSky).toBe(false);
  expect((await moonAt('2024-04-08T18:21:00Z')).info.illumination, 'held full').toBe(1);
});

/* A mood can start from somewhere other than three blank pickers: two harmonies
   of its first colour, and — when there is one — the person's own wallpaper. */
test('a mood can start from a harmony, or from the wallpaper when there is one', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await expect(page.locator('#bg-palette-wallpaper')).toBeHidden();
  await page.locator('#bg-palette-new').click();
  const hexes = () => page.locator('#bg-palette-colors .hex-text').evaluateAll(nodes => nodes.map(node => node.value));
  const first = (await hexes())[0];
  await page.locator('[data-harmony="split"]').click();
  const split = await hexes();
  expect(split[0]).toBe(first);
  expect(new Set(split).size).toBe(3);
  expect(await page.evaluate(() => window.Nordlys.bgEngine.palette)).toEqual(split);
  await page.locator('#bg-palette-cancel').click();

  // A wallpaper of three flat bands, stored the way an upload stores it.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 90; canvas.height = 30;
    const context = canvas.getContext('2d');
    [['#1446a0', 0], ['#e68c28', 30], ['#1e783c', 60]].forEach(([fill, x]) => { context.fillStyle = fill; context.fillRect(x, 0, 30, 30); });
    const blob = await new Promise(done => canvas.toBlob(done, 'image/png'));
    await MediaVault.saveMedia('custom_bg', blob, 'image/png');
  });
  await page.locator('#bg-palette-new').click();
  await expect(page.locator('#bg-palette-wallpaper')).toBeVisible();
  const fresh = (await hexes()).join();
  await page.locator('#bg-palette-wallpaper').click();
  // Reading the wallpaper back is asynchronous; wait for the draft to change.
  await expect.poll(async () => (await hexes()).join()).not.toBe(fresh);
  const fromWallpaper = await hexes();
  // An orange, a blue and a green, in some order: the picture's own colours.
  const channels = fromWallpaper.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  expect(channels.some(([r, g, b]) => r > g && r > b)).toBe(true);
  expect(channels.some(([r, g, b]) => b > r && b > g)).toBe(true);
  expect(channels.some(([r, g, b]) => g > r && g > b)).toBe(true);
});

/* A mood can become a whole theme: the studio opens with the mood's colours
   as its three base colours, derives the rest, and keeps the text readable. */
test('a mood becomes a theme in the studio, readable from the start', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await openBackground(page);
  await expect(page.locator('#bg-palette-theme')).toBeHidden();
  await page.locator('[data-palette="ember"]').click();
  await expect(page.locator('#bg-palette-theme')).toBeVisible();
  await page.locator('#bg-palette-theme').click();
  await expect(page.locator('#custom-theme-editor-card')).toBeVisible();
  await expect(page.locator('#thm-accent-hex')).toHaveValue('#ffd166');
  await expect(page.locator('#thm-name-input')).toHaveValue('Ember');
  // The page is wearing it, and the studio has nothing to warn about.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#ffd166');
  await expect(page.locator('#custom-theme-contrast-warning')).toBeHidden();
});
