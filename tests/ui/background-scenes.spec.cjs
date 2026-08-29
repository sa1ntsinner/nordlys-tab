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

  // Every card carries its own preview, so the grid cannot silently degrade to
  // a row of identical squares.
  const previews = await page.locator('#bg-scene-grid .scene-preview').evaluateAll(
    nodes => nodes.map(node => getComputedStyle(node).backgroundImage)
  );
  expect(new Set(previews).size, 'each scene must look like itself').toBeGreaterThan(3);

  const cosmos = page.locator('.scene-card[data-scene="cosmos"]');
  await cosmos.click();
  await expect(cosmos).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.scene-card[data-scene="aurora"]')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.bgMode).toBe('cosmos');
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
