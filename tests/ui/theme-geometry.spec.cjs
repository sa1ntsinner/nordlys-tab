const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { themeKeys } = require('../helpers/contrast.cjs');

/* A theme is a palette. It must never move anything: light themes used to set
   their own weights on folder titles and tile names, a heavier face is a wider
   one, and switching to a light theme reflowed the demo board from one row of
   folders to two — in Auto mode, on its own, at dusk. */
for (const width of [1440, 1024]) {
  test(`every theme lays the board out identically at ${width}px`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.setViewportSize({ width, height: 900 });
    // The rows re-break for a new width before the next frame is painted.
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const layout = () => page.evaluate(async () => {
      await document.fonts.ready;
      const rect = node => { const r = node.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 2) / 2); };
      return {
        cards: [...document.querySelectorAll('#board .card')].map(rect),
        tiles: [...document.querySelectorAll('#board .tile')].map(rect),
        truncated: [...document.querySelectorAll('#board .lbl, #board .cat b')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent)
      };
    });
    const themes = await themeKeys();
    let reference = null;
    for (const theme of themes) {
      await page.evaluate(key => { window.Nordlys.config.theme = key; window.Nordlys.applyThemeTokens(); }, theme);
      const now = await layout();
      expect(now.truncated, `${theme} cuts a name short`).toEqual([]);
      if (!reference) { reference = { theme, ...now }; continue; }
      expect(now.cards, `${theme} moves a folder relative to ${reference.theme}`).toEqual(reference.cards);
      expect(now.tiles, `${theme} moves a tile relative to ${reference.theme}`).toEqual(reference.tiles);
    }
  });
}
