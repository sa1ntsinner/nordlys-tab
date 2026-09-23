const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

test.use({ nordlysBoard: NINE_FOLDERS });

/* Axe judges one theme, and the contrast gate judges words over the sky. The
   panels between them — the icon picker, the cropper, quick edit, menus, the
   arrange bar and its size panel — were judged by nobody, and in light themes
   some of them had fallen under 2:1. Each text element is measured against
   the colour actually behind it, layers blended, in the themes that came out
   worst: two dark, two light. */
const MEASURE = () => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const px = c => { ctx.clearRect(0,0,1,1); ctx.fillStyle = c; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data]; };
  const blend = (top, under) => { const a = top[3] / 255; return [0,1,2].map(i => top[i] * a + under[i] * (1 - a)); };
  const ch = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = ([r,g,b]) => 0.2126*ch(r/255)+0.7152*ch(g/255)+0.0722*ch(b/255);
  // A gradient layer counts as the average of its stops, as the product's own
  // plate measure does; treating it as transparent read the backdrop instead.
  const TOKEN = /rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/gi;
  const gradientLayer = image => {
    const stops = image && image !== 'none' ? image.match(TOKEN) : null;
    if (!stops?.length) return null;
    const sum = [0, 0, 0, 0];
    for (const stop of stops) { const [r, g, b, a] = px(stop); sum[0] += r * a; sum[1] += g * a; sum[2] += b * a; sum[3] += a; }
    return sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3], sum[3] / stops.length] : null;
  };
  /* The layers up the DOM, blended. It cannot see a background painted by a
     pseudo-element, which is why this runs at desktop size only: at phone
     size a dialog paints its card that way. Pixels are what qa-contrast
     measures; this is the quick gate over every overlay. */
  const ground = el => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none' && n !== document.body && !/gradient/.test(cs.backgroundImage)) return null;
      const gradient = n !== document.body ? gradientLayer(cs.backgroundImage) : null;
      if (gradient) stack.push(gradient);
      stack.push(px(cs.backgroundColor));
    }
    let c = px(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    for (const layer of stack.reverse()) c = blend(layer, c);
    return c;
  };
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walk.nextNode()) {
    const el = walk.currentNode.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (!walk.currentNode.textContent.trim() || (el.closest('#searchwrap') && !el.closest('#sugg')) || el.closest('#board .card, #hiddenDock, #hero, [hidden], [aria-hidden="true"], .nl-visually-hidden, :disabled, [aria-disabled="true"], svg')) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    let op = 1; for (let n = el; n; n = n.parentElement) op *= +getComputedStyle(n).opacity; if (op < 0.99) continue;
    const bg = ground(el); if (!bg) continue;
    const fg = blend(px(cs.color), bg); const a = L(fg), b = L(bg); const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const large = size >= 24 || (bold && size >= 18.66);
    if (ratio < (large ? 3 : 4.5)) out.push({ text: walk.currentNode.textContent.trim().slice(0, 40), cls: (el.id || el.className?.toString() || el.tagName).slice(0, 40), ratio: +ratio.toFixed(2) });
  }
  return out;
};

const THEMES = ['aurora-void', 'dracula-velvet', 'solarized-light', 'warm-ivory'];

test('text on every overlay stays readable in the hardest themes', async ({ nordlysPage }) => {
  test.setTimeout(120000);
  const { page } = nordlysPage;
  const failures = [];
  const record = async (theme, where) => {
    await page.waitForTimeout(150);
    await page.evaluate(() => window.NordlysUI.settled());
    for (const row of await page.evaluate(MEASURE)) failures.push(`${theme} ${where}: "${row.text}" ${row.ratio}:1`);
  };
  for (const theme of THEMES) {
    await page.evaluate(name => window.Nordlys.setTheme(name), theme);
    await page.evaluate(() => {
      const link = window.Nordlys.config.groups[0].links[0];
      link.iconUrls = [{ url: 'https://cdn.example.com/a.png', thumb: '', at: 2 }, { url: 'https://cdn.example.com/b.png', thumb: '', at: 1 }];
      link.iconUrl = 'https://cdn.example.com/a.png';
      window.Nordlys.settings.openIconModal(0, 0);
    });
    for (const tab of ['search', 'favicon', 'custom']) {
      await page.locator(`.icon-tab-btn[data-tab="${tab}"]`).click();
      await record(theme, `icon picker, ${tab}`);
    }
    await page.evaluate(() => window.Nordlys.settings.openCropper(`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}`, 'url'));
    await record(theme, 'cropper');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.Nordlys.grid.openQuickEditModal(0, 0));
    await record(theme, 'quick edit');
    await page.keyboard.press('Escape');
    await page.locator('#board .tile').first().click({ button: 'right' });
    await record(theme, 'tile menu');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.NordlysUI.showUndoToast({ message: 'Folder deleted', duration: 60000, onAction: () => {} });
      window.toast?.('Saved', 'success', 60000);
      window.toast?.('Could not save', 'danger', 60000);
    });
    await record(theme, 'notices');
    await page.evaluate(() => document.getElementById('toast-dock')?.replaceChildren());
    for (const query of ['you', '2+2*3', '>']) {
      await page.locator('#q').fill(query);
      await expect(page.locator('#sugg .sugg-item').first()).toBeVisible();
      await record(theme, `search "${query}"`);
    }
    await page.keyboard.press('Escape');
    await page.locator('#q').fill('');
    await page.locator('#q').blur();
    await page.evaluate(() => document.getElementById('toast-dock')?.replaceChildren());
    await page.evaluate(() => window.Nordlys.grid.arrange.enter());
    await page.locator('#arrange-size').click();
    await record(theme, 'arranging');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
  expect(failures).toEqual([]);
});
