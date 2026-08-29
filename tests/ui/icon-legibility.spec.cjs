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
      // The plate is read from a ring just inside the border, where the icon never
      // reaches; the icon is read from the centre. Sampling one region for both
      // lets a full-bleed icon be mistaken for its own background.
      const outer = band(box, 0.06, 0.94), inner = band(box, 0.2, 0.8);
      const innerKeys = new Set(inner.map(point => `${point.x},${point.y}`));
      const ring = outer.filter(point => !innerKeys.has(`${point.x},${point.y}`)).map(point => point.luminance).sort((a, b) => a - b);
      if (!ring.length) return 0;
      const plate = ring[Math.floor(ring.length / 2)];
      const centre = band(box, 0.3, 0.7).map(point => point.luminance);
      const separated = centre.filter(luminance => (Math.max(luminance, plate) + 0.05) / (Math.min(luminance, plate) + 0.05) >= 3).length;
      return centre.length ? Number((separated / centre.length).toFixed(4)) : 0;
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

/* The fallback plate is a mid tone that separates from anything, so a board that
   silently drops onto it passes a pure legibility check while the real mechanism
   never ran. Measurable icons must be measured. */
test('measurable icons are never pushed onto the unmeasurable fallback plate', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.waitForFunction(() => document.querySelectorAll('#board .tile .box').length > 10);
  await page.waitForTimeout(400);
  const fallen = await page.evaluate(() => [...document.querySelectorAll('#board .tile')]
    .filter(tile => tile.querySelector('.box')?.dataset.iconPlate === 'neutral')
    .map(tile => tile.querySelector('.lbl').textContent));
  expect(fallen, 'built-in icons resolve their own colour and must never fall back').toEqual([]);
});

test('adapting the plate never repaints a brand icon', async ({ nordlysPage }) => {
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
