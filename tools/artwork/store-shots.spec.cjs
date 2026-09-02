const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');

/* Regenerates the Chrome Web Store artwork from the real product.
   Not part of the gate (playwright.config.cjs ignores __t-*). */

const OUT = path.resolve(__dirname, '../../docs/store-assets');
const SHOT = { width: 1280, height: 800 };

test.use({ viewport: SHOT });
test.setTimeout(240000);

/* The scene animates on a slow clock: in the first second the aurora is still a
   flat wash, and only after roughly a dozen does it draw the ribbons that make
   it worth showing. Sampled at 1, 4, 8, 14 and 22 seconds, 14 was the frame. */
const CANVAS_WARMUP = 14000;

async function settle(page, warmup = 600) {
  await page.waitForTimeout(warmup);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}#q{caret-color:transparent!important}' });
  await page.waitForTimeout(200);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
  const bytes = fs.statSync(path.join(OUT, name)).size;
  console.log(`  ${name} ${Math.round(bytes / 1024)}KB`);
}

test('regenerate the store artwork', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  fs.mkdirSync(OUT, { recursive: true });

  // 1. The product as it opens. Two folders go to the dock so the board is whole
  //    rather than sliced by the bottom edge, and the aurora runs a little
  //    stronger than default so it reads in a still frame.
  await page.evaluate(() => {
    window.Nordlys.config.groups.slice(3).forEach(group => { group.hidden = true; });
    window.Nordlys.config.bgIntensity = 1.4;
    window.Nordlys.saveConfig();
    window.Nordlys.bgEngine?.setAtmosphere({ motion: 1, intensity: 1.4 });
    window.Nordlys.grid.render();
    document.getElementById('board')?.classList.add('board-loaded');
  });
  await settle(page, CANVAS_WARMUP);
  await shot(page, 'screenshot-1-aurora.png');

  // 2. Appearance: the theme grid and the typography slots below it.
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await expect(page.locator('#sec-appearance')).toBeVisible();
  await settle(page);
  await shot(page, 'screenshot-2-themes.png');

  // 3. Background: scene cards plus the two sliders that apply to all of them.
  await page.locator('#settings-tab-background').click();
  await expect(page.locator('#sec-background')).toBeVisible();
  await settle(page);
  await shot(page, 'screenshot-3-scenes.png');
  await page.keyboard.press('Escape');

  // 4. A light theme, to show the palette is not decoration. Escape returns focus
  //    to the gear, and its focus ring would read as an artefact in a still.
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.Nordlys.setTheme('nordic-snow');
  });
  await settle(page, CANVAS_WARMUP);
  await shot(page, 'screenshot-4-light.png');

  // 5. Search doing arithmetic, with suggestions under it.
  await page.evaluate(() => window.Nordlys.setTheme('aurora-void'));
  await settle(page, CANVAS_WARMUP);
  await page.locator('#q').click();
  await page.locator('#q').fill('45 * 12 + sqrt(144)');
  await page.waitForTimeout(500);
  await settle(page);
  await shot(page, 'screenshot-5-search.png');

  console.log('artwork written to docs/store-assets');
});
