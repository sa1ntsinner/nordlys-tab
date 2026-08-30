const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Reduced Motion makes setTheme skip the view transition and swap the palette
   synchronously, so a measurement can never race a half-applied theme. */
test.use({ reducedMotion: 'reduce' });

/* Legibility is measured on rendered pixels, never on the same arithmetic the
   implementation uses: screenshot the icon plate, find the plate colour as the
   dominant tone, and count how much of the icon actually separates from it.
   The border is excluded by looking only at the centre of the plate. */
async function plateVisibility(page) {
  const board = page.locator('#board');
  const frame = await board.evaluate(node => {
    const origin = node.getBoundingClientRect();
    return {
      width: origin.width,
      boxes: [...node.querySelectorAll('.tile .box')].map(box => {
        const area = box.getBoundingClientRect();
        return { x: area.x - origin.x, y: area.y - origin.y, width: area.width, height: area.height };
      })
    };
  });
  const shot = await board.screenshot();
  return page.evaluate(async ([encoded, frame]) => {
    const image = await new Promise(resolve => { const node = new Image(); node.onload = () => resolve(node); node.src = `data:image/png;base64,${encoded}`; });
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const channel = value => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    const scale = image.width / frame.width;
    const luminanceAt = (x, y) => {
      const at = (y * canvas.width + x) * 4;
      return 0.2126 * channel(data[at] / 255) + 0.7152 * channel(data[at + 1] / 255) + 0.0722 * channel(data[at + 2] / 255);
    };
    const band = (box, from, to) => {
      const values = [];
      const left = Math.round((box.x + box.width * from) * scale), right = Math.round((box.x + box.width * to) * scale);
      const top = Math.round((box.y + box.height * from) * scale), bottom = Math.round((box.y + box.height * to) * scale);
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) values.push({ x, y, luminance: luminanceAt(x, y) });
      return values;
    };
    return frame.boxes.map(box => {
      // The plate colour is read from the outermost band, which the icon and its
      // rim never reach. Everything inside is then asked how much of it separates
      // from that colour — the rim included, since a rim traces the icon's edge
      // and a centre-only reading would miss it entirely on solid artwork.
      const ring = band(box, 0.02, 0.08).map(point => point.luminance).sort((a, b) => a - b);
      if (!ring.length) return 0;
      const plate = ring[Math.floor(ring.length / 2)];
      const inside = band(box, 0.12, 0.88).map(point => point.luminance);
      // Measured against the guarantee the product actually makes (1.8:1), not a
      // stricter bar the implementation never promised — otherwise a brand colour
      // sitting legitimately near the threshold reads as a failure.
      const separated = inside.filter(luminance => (Math.max(luminance, plate) + 0.05) / (Math.min(luminance, plate) + 0.05) >= 1.8).length;
      return inside.length ? Number((separated / inside.length).toFixed(4)) : 0;
    });
  }, [shot.toString("base64"), frame]);
}

function swatch(colour) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="8" fill="${colour}"/></svg>`)}`;
}

const HOSTILE_LINKS = [
  { name: 'Black raster', url: 'https://black.test/', customImg: swatch('#000000') },
  { name: 'White raster', url: 'https://white.test/', customImg: swatch('#ffffff') },
  { name: 'Black vector', url: 'https://vector-dark.test/', icon: 'github', color: '#000000' },
  { name: 'White vector', url: 'https://vector-light.test/', icon: 'github', color: '#ffffff' },
  { name: 'Brand vector', url: 'https://brand.test/', icon: 'youtube', color: '#ff0000' }
];

async function seedHostileBoard(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.evaluate(links => {
    window.Aurora.config.groups = [{ label: 'LEGIBILITY', cols: 5, hidden: false, links }];
    window.Aurora.saveConfig(); window.Aurora.grid.render();
    document.getElementById('board').classList.add('board-loaded');
  }, HOSTILE_LINKS);
  await expect(page.locator('#board .tile')).toHaveCount(HOSTILE_LINKS.length);
  await page.waitForFunction(() => [...document.querySelectorAll('#board .nl-icon img')].every(image => image.complete));
}

async function installedThemes(page) {
  return page.evaluate(() => [...new Set([...document.styleSheets]
    .flatMap(sheet => { try { return [...sheet.cssRules]; } catch { return []; } })
    .flatMap(rule => (rule.selectorText || '').match(/\[data-theme="[a-z0-9-]+"\]/g) || [])
    .map(match => match.slice(13, -2)))].sort());
}

test('every icon stays visible against its plate in every built-in theme', async ({ nordlysPage }) => {
  test.setTimeout(180000);
  const { page } = nordlysPage;
  await seedHostileBoard(page);
  const themes = await installedThemes(page);
  expect(themes.length, 'no themes discovered from stylesheets').toBeGreaterThanOrEqual(20);

  const invisible = [];
  for (const theme of themes) {
    await page.evaluate(key => window.Aurora.setTheme(key), theme);
    await page.waitForTimeout(120);
    const ratios = await plateVisibility(page);
    ratios.forEach((ratio, index) => {
      if (ratio < 0.03) invisible.push(`${theme} / ${HOSTILE_LINKS[index].name} = ${(ratio * 100).toFixed(1)}%`);
    });
  }
  expect(invisible, 'icons that blend into their own plate').toEqual([]);
});

/* The whole point of the halo is that the grid keeps one surface. If a future
   change starts tinting plates per icon again, the board goes patchy — which is
   exactly what this replaced. */
test('every tile plate renders identically', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedHostileBoard(page);
  for (const theme of ['oled-obsidian', 'porcelain-light']) {
    await page.evaluate(key => window.Aurora.setTheme(key), theme);
    await page.waitForTimeout(150);
    const surfaces = await page.evaluate(() => [...new Set(
      [...document.querySelectorAll('#board .tile .box')].map(box => getComputedStyle(box).backgroundColor)
    )]);
    expect(surfaces, `${theme}: plates must not differ between tiles`).toHaveLength(1);
  }
});

test('a colourless mark is re-toned; a coloured one never is', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedHostileBoard(page);
  await page.evaluate(() => window.Aurora.setTheme('oled-obsidian'));
  await page.waitForTimeout(250);
  const toned = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#board .tile')].map(tile => [
      tile.querySelector('.lbl').textContent,
      tile.querySelector('.nl-icon')?.dataset.iconTone || 'none'
    ])
  ));
  // A black glyph on a black plate is exactly the case a mark's own guidance
  // covers: it flips. White art already reads, and colour is never touched.
  expect(toned['Black raster']).toBe('light');
  expect(toned['Black vector']).toBe('light');
  expect(toned['White raster'], 'white art already separates from a dark plate').toBe('none');
  expect(toned['Brand vector'], 'a coloured logo must keep its colour').toBe('none');
});

test('the per-bookmark choice overrides the automatic decision', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    window.Aurora.config.groups = [{ label: 'TONE', cols: 3, hidden: false, links: [
      { name: 'Auto', url: 'https://a.test/', icon: 'github', color: '#000000' },
      { name: 'Left alone', url: 'https://b.test/', icon: 'github', color: '#000000', tone: 'original' },
      { name: 'Forced dark', url: 'https://c.test/', icon: 'github', color: '#ffffff', tone: 'dark' }
    ] }];
    window.Aurora.saveConfig(); window.Aurora.grid.render();
  });
  await page.waitForTimeout(250);
  const toned = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#board .tile')].map(tile => [
      tile.querySelector('.lbl').textContent,
      tile.querySelector('.nl-icon')?.dataset.iconTone || 'none'
    ])
  ));
  expect(toned['Auto'], 'left to itself the black mark flips').toBe('light');
  expect(toned['Left alone'], 'an explicit "original" must be obeyed even when unreadable').toBe('none');
  expect(toned['Forced dark'], 'an explicit direction wins over the measurement').toBe('dark');
});

test('re-toning never touches a coloured brand icon', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await seedHostileBoard(page);
  await page.evaluate(() => window.Aurora.setTheme('oled-obsidian'));
  await page.waitForTimeout(80);
  const painted = await page.locator('#board .tile').nth(4).locator('.nl-icon').evaluate(node => {
    const target = node.querySelector('svg') || node.querySelector('img');
    return getComputedStyle(target).fill || '';
  });
  expect(painted, 'brand icon must keep its own colour').toContain('255, 0, 0');
});

/* The automatic decision is deliberately conservative — it will not re-tone a
   coloured logo — so the manual override has to be reachable and has to stick. */
test('the icon tone can be set from the bookmark editor and survives a reload', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const tile = page.locator('#board .tile').first();
  await tile.focus(); await page.keyboard.press('Shift+F10');
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quick-edit-modal')).toBeVisible();

  // Tone lives under the Appearance disclosure now.
  await page.locator('.quick-advanced summary').click();
  await page.locator('#quick-tone-select').evaluate(select => {
    select.value = 'dark'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#quick-save-btn').click();
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.groups?.[0]?.links?.[0]?.tone).toBe('dark');
  await expect(page.locator('#board .tile').first().locator('.nl-icon')).toHaveAttribute('data-icon-tone', 'dark');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Aurora?.grid));
  await expect(page.locator('#board .tile').first().locator('.nl-icon')).toHaveAttribute('data-icon-tone', 'dark');
});
