const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Menus, dialogs and the fields inside them are drawn from the theme in use.
   They were one navy written out in two dozen places, so a black theme, a
   brown one and a green one all opened the same blue menu. */

const THEMES = [...fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'css', 'themes.css'), 'utf8').matchAll(/^:root(?:, :root)?\[data-theme="([a-z-]+)"\]/gm)].map(match => match[1]).concat('liquid-glass');

/* Each surface as painted, and the theme's own card colour beside it. */
const READ = () => {
  const paint = (colour) => {
    const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    pen.canvas.width = pen.canvas.height = 1;
    pen.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--void').trim() || '#000'; pen.fillRect(0, 0, 1, 1);
    pen.fillStyle = colour; pen.fillRect(0, 0, 1, 1);
    return [...pen.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const of = (selector, property = 'backgroundColor') => { const node = document.querySelector(selector); return node ? paint(getComputedStyle(node)[property]) : null; };
  return {
    card: paint(getComputedStyle(document.documentElement).getPropertyValue('--card-tint').trim()),
    accent: paint(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),
    surfaces: {
      'context menu': of('#ctx-menu, .glass-context-menu'),
      'icon dialog': of('#icon-modal .modal-box'),
      'icon field': of('#icon-find'),
      'bookmark editor': of('.quick-modal-card'),
      'settings field': of('#cfg .ipt')
    },
    ring: of('#icon-find', 'borderTopColor')
  };
};

const distance = (a, b) => Math.max(...a.map((value, at) => Math.abs(value - b[at])));

async function openEverything(page) {
  await page.evaluate(() => {
    document.querySelector('.glass-context-menu')?.classList.add('open');
    window.Nordlys.grid.openQuickEditModal(0, 0);
  });
  await page.evaluate(() => { window.Nordlys.settings.openIconModal(0, 0); });
  await page.locator('#icon-find').focus();
}

test('there are twenty-one themes to check', () => {
  expect(THEMES.length).toBe(21);
});

test('menus, dialogs and fields take their colour from every theme', async ({ nordlysPage }) => {
  test.setTimeout(120000);
  const { page } = nordlysPage;
  const wrong = [];
  const seen = new Map();
  for (const theme of THEMES) {
    await page.evaluate(name => window.Nordlys.setTheme(name), theme);
    await page.waitForTimeout(150);
    await openEverything(page);
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const read = await page.evaluate(READ);
    for (const [name, colour] of Object.entries(read.surfaces)) {
      if (!colour) { wrong.push(`${theme}: ${name} was not found`); continue; }
      // Within a few steps of the theme's card colour: lifted or sunk a little, never another hue.
      if (distance(colour, read.card) > 40) wrong.push(`${theme}: ${name} is rgb(${colour}) on a theme whose card is rgb(${read.card})`);
    }
    if (distance(read.ring, read.accent) > 6) wrong.push(`${theme}: the focused field is edged rgb(${read.ring}), the accent rgb(${read.accent})`);
    seen.set(theme, read.surfaces['icon dialog'].join());
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.evaluate(() => { window.Nordlys.settings.closeIconModal(); document.querySelector('.glass-context-menu')?.classList.remove('open'); });
  }
  expect(wrong).toEqual([]);
  // And they are not one colour: each dark theme has a dialog of its own, and the light ones share only a white card.
  expect(new Set(seen.values()).size).toBeGreaterThan(12);
});

test('a black theme has neutral menus: no blue in them', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.Nordlys.setTheme('oled-obsidian'));
  await page.waitForTimeout(150);
  await openEverything(page);
  const { surfaces } = await page.evaluate(READ);
  for (const [name, [r, g, b]] of Object.entries(surfaces)) {
    expect(Math.max(r, g, b) - Math.min(r, g, b), `${name} rgb(${r}, ${g}, ${b})`).toBeLessThanOrEqual(6);
  }
});

test('a theme the person made colours the menus too', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const root = document.documentElement;
    // What applying a custom theme does: its colours written onto the page.
    for (const [name, value] of Object.entries({ '--card-tint': '#3a2410', '--card-tint-deep': '#1f1206', '--ink': '#fff4e6', '--void': '#140b03', '--accent': '#ffb347' })) root.style.setProperty(name, value);
  });
  await openEverything(page);
  const read = await page.evaluate(READ);
  for (const [name, [r, , b]] of Object.entries(read.surfaces)) expect(r - b, `${name} is warm like the theme`).toBeGreaterThan(12);
  expect(distance(read.ring, [255, 179, 71])).toBeLessThanOrEqual(6);
});
