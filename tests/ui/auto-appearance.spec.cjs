const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* Auto follows the system's light or dark. The theme in storage is the one
   the last new tab used, so the first tab after the system changed over
   (the first of the morning, mostly) was drawn in yesterday's theme and
   only followed when the system changed again while it was open. The
   family is now settled before the first frame (boot.js) and kept. */

// Every theme the page wore from its very first frame on, in order.
async function openWith(page, config, scheme) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(() => {
    window.__themes = [];
    new MutationObserver(() => {
      const theme = document.documentElement?.dataset.theme;
      if (theme && window.__themes.at(-1) !== theme) window.__themes.push(theme);
    // The document itself: at this point it has no root element yet to watch.
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
  });
  await page.evaluate(stored => localStorage.setItem('nordlys_config', JSON.stringify({ ...window.Nordlys.config, ...stored })), config);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  return page.evaluate(() => ({ worn: window.__themes, light: document.documentElement.classList.contains('light-ui'), live: window.Nordlys.config.theme, stored: JSON.parse(localStorage.getItem('nordlys_config')).theme, mode: window.Nordlys.config.colorMode }));
}

test('the first tab after the system went light opens in the light theme last used, from its first frame', async ({ nordlysPage }) => {
  const seen = await openWith(nordlysPage.page, { colorMode: 'auto', theme: 'aurora-void', lastLightTheme: 'warm-ivory', lastDarkTheme: 'aurora-void' }, 'light');
  expect(seen.worn, 'never yesterday\'s theme, not for a frame').toEqual(['warm-ivory']);
  expect(seen).toMatchObject({ light: true, live: 'warm-ivory', stored: 'warm-ivory', mode: 'auto' });
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('and after it went dark, in the dark one', async ({ nordlysPage }) => {
  const seen = await openWith(nordlysPage.page, { colorMode: 'auto', theme: 'warm-ivory', lastLightTheme: 'warm-ivory', lastDarkTheme: 'tokyo-night' }, 'dark');
  expect(seen.worn).toEqual(['tokyo-night']);
  expect(seen).toMatchObject({ light: false, live: 'tokyo-night', stored: 'tokyo-night', mode: 'auto' });
});

test('with no theme of that family used yet, the family\'s first one is worn', async ({ nordlysPage }) => {
  const seen = await openWith(nordlysPage.page, { colorMode: 'auto', theme: 'aurora-void', lastLightTheme: undefined }, 'light');
  expect(seen.worn).toEqual(['porcelain-light']);
});

test('a theme chosen as Dark or Light stays, whatever the system says', async ({ nordlysPage }) => {
  const seen = await openWith(nordlysPage.page, { colorMode: 'dark', theme: 'aurora-void', lastLightTheme: 'warm-ivory' }, 'light');
  expect(seen.worn).toEqual(['aurora-void']);
  expect(seen).toMatchObject({ live: 'aurora-void', stored: 'aurora-void', mode: 'dark' });
});

test('Auto that already agrees with the system changes nothing', async ({ nordlysPage }) => {
  const seen = await openWith(nordlysPage.page, { colorMode: 'auto', theme: 'tokyo-night', lastLightTheme: 'warm-ivory' }, 'dark');
  expect(seen.worn).toEqual(['tokyo-night']);
});
