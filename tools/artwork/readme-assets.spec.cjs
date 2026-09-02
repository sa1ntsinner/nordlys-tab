const { test, expect } = require('../../tests/helpers/nordlys-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/* Regenerates the README artwork. The stills it replaces still showed
   the horizontal settings tabs the left rail replaced. */

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/assets');
const FRAMES = path.join(ROOT, 'tools/artwork/.scratch/frames');
const WARMUP = 14000;

test.setTimeout(600000);

/* 96 colours and 8fps keep the aurora free of visible banding while landing
   under two megabytes; 128 colours at 10fps cost a megabyte more for no
   difference the eye can find in a dark gradient. */
function encodeGif(framesDir, output, fps, colors = 96) {
  const result = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(framesDir, '%03d.png'),
    '-vf', `fps=${fps},scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`,
    '-loop', '0', output
  ], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`ffmpeg failed for ${path.basename(output)}. Install it and re-run.
${result.stderr || result.error}`);
  }
  console.log(`  ${path.basename(output)} ${Math.round(fs.statSync(output).size / 1024)}KB`);
}


async function calm(page, wait = 600) {
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}#q{caret-color:transparent!important}' });
  await page.waitForTimeout(150);
}

async function board(page, { intensity = 1.35 } = {}) {
  await page.evaluate(atmosphere => {
    window.Nordlys.bgEngine?.setAtmosphere({ motion: 1, intensity: atmosphere });
    window.Nordlys.grid.render();
    document.getElementById('board')?.classList.add('board-loaded');
    document.activeElement?.blur();
  }, intensity);
}

test('regenerate the README stills', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  // Three folders keep the board whole inside a 720-tall frame.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.Nordlys.config.groups.slice(3).forEach(group => { group.hidden = true; });
    window.Nordlys.saveConfig();
  });
  await board(page);

  // Search doing arithmetic.
  await calm(page, WARMUP);
  await page.locator('#q').click();
  await page.locator('#q').fill('45 * 12 + sqrt(144)');
  await calm(page, 700);
  await page.screenshot({ path: path.join(OUT, 'still-search-calc.png') });
  await page.locator('#q').fill('');
  await page.keyboard.press('Escape');

  // Settings, both modes, on the rail the old stills predate.
  await page.locator('#gear').click();
  await page.locator('#settings-tab-appearance').click();
  await expect(page.locator('#sec-appearance')).toBeVisible();
  await calm(page);
  await page.screenshot({ path: path.join(OUT, 'still-settings-dark.png') });

  await page.locator('[data-mode="light"]').click();
  await calm(page, 900);
  await page.screenshot({ path: path.join(OUT, 'still-settings-light.png') });
  await page.locator('[data-mode="dark"]').click();
  await page.keyboard.press('Escape');

  // Theme portraits, wider so the whole board fits.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => {
    window.Nordlys.config.groups.forEach(group => { group.hidden = false; });
    window.Nordlys.saveConfig();
  });
  for (const [theme, file] of [['gruvbox-dark', 'theme-gruvbox-dark.png'], ['oled-obsidian', 'theme-oled.png'], ['mint-breeze', 'theme-mint.png']]) {
    await page.evaluate(key => window.Nordlys.setTheme(key), theme);
    await board(page);
    await calm(page, WARMUP);
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`  ${file}`);
  }
  await page.evaluate(() => window.Nordlys.setTheme('aurora-void'));
});

test('capture the README animations', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(path.join(FRAMES, 'aurora'), { recursive: true });
  fs.mkdirSync(path.join(FRAMES, 'themes'), { recursive: true });

  await page.setViewportSize({ width: 960, height: 540 });
  await page.evaluate(() => {
    window.Nordlys.config.groups.slice(2).forEach(group => { group.hidden = true; });
    window.Nordlys.saveConfig();
  });
  await board(page);
  await calm(page, WARMUP);

  // The aurora drifts slowly, so sampling every frame would produce a still.
  for (let frame = 0; frame < 60; frame++) {
    await page.screenshot({ path: path.join(FRAMES, 'aurora', `${String(frame).padStart(3, '0')}.png`) });
    await page.waitForTimeout(120);
  }
  console.log('  aurora frames captured');

  // One frame per theme, held long enough to read the name.
  const carousel = ['aurora-void', 'cyberpunk-neon', 'tokyo-night', 'gruvbox-dark', 'boreal-emerald',
                    'oled-obsidian', 'nordic-snow', 'sakura-daylight', 'peach-sunset', 'mint-breeze'];
  let index = 0;
  for (const theme of carousel) {
    await page.evaluate(key => window.Nordlys.setTheme(key), theme);
    await board(page);
    await calm(page, 2500);
    // Two identical frames per theme, so each holds on screen.
    for (const copy of [0, 1]) {
      await page.screenshot({ path: path.join(FRAMES, 'themes', `${String(index * 2 + copy).padStart(3, '0')}.png`) });
    }
    index++;
  }
  console.log('  theme frames captured');

  encodeGif(path.join(FRAMES, 'aurora'), path.join(OUT, 'aurora-live.gif'), 8);
  encodeGif(path.join(FRAMES, 'themes'), path.join(OUT, 'themes-carousel.gif'), 1.4);
});
