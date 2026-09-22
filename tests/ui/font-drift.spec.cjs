const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Every word on the page is set in one of the three typography slots — the
   display face, the interface face, the monospace — whatever family the person
   picked for them. Form controls do not inherit type from the page, so the rail,
   the first-run actions and a dozen buttons rendered in the browser's own Arial
   and the slots never reached them. This walks every visible text element. */
for (const choice of ['default', 'Georgia', 'Arial']) {
  test(`every visible word is set in a typography slot (${choice})`, async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.evaluate(family => {
      window.Nordlys.config.fonts = { display: family, interface: family, mono: 'default' };
      window.NordlysType.apply(window.Nordlys.config, document.documentElement);
    }, choice);
    await page.locator('#gear').click();
    const drift = [];
    for (const tab of ['appearance', 'general', 'background', 'bookmarks', 'custom-css', 'backup', 'support']) {
      await page.locator(`.ctab[data-tab="${tab}"]`).click();
      drift.push(...await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const first = token => root.getPropertyValue(token).split(',')[0].trim().replace(/["']/g, '');
        const slots = new Set(['--font-display', '--font-main', '--font-mono'].map(first));
        const out = [];
        for (const node of document.querySelectorAll('body *')) {
          if (!node.getClientRects().length || getComputedStyle(node).visibility !== 'visible') continue;
          const ownText = [...node.childNodes].some(child => child.nodeType === 3 && child.nodeValue.trim())
            || (node.matches('input, textarea, select') && (node.value || node.placeholder));
          if (!ownText) continue;
          const family = getComputedStyle(node).fontFamily.split(',')[0].trim().replace(/["']/g, '');
          if (!slots.has(family)) out.push(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}.${[...node.classList].join('.')} "${(node.textContent || node.placeholder || '').trim().slice(0, 24)}" → ${family}`);
        }
        return out;
      }));
    }
    expect([...new Set(drift)]).toEqual([]);
  });
}

/* A face wider than the default cuts long names short; the whole name is then
   a tooltip — and only then, so the other tiles do not repeat themselves. */
test('a name cut short by a wide face gets its whole self as a tooltip', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const titled = () => page.locator('#board .tile[title]').evaluateAll(tiles => tiles.map(tile => tile.title));
  expect(await titled()).toEqual([]);
  await page.evaluate(() => {
    window.Nordlys.config.fonts = { display: 'DejaVu Sans', interface: 'DejaVu Sans', mono: 'default' };
    window.Nordlys.applyThemeTokens();
    document.documentElement.style.setProperty('--font-main', 'Verdana, "DejaVu Sans", sans-serif');
    document.documentElement.style.letterSpacing = '0.08em';
    window.Nordlys.grid.titleCutNames();
  });
  await expect.poll(titled).toContain('Kleinanzeigen');
  expect((await titled()).includes('Notion'), 'a name that fits has no tooltip').toBe(false);
});
