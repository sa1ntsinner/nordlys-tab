const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The rail's group headings were built once, in English, and never retranslated —
   so a Russian panel carried English section titles above Russian items. */
test('switching language translates the whole settings chrome, not just the items', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();

  const chrome = () => page.evaluate(() => ({
    groups: [...document.querySelectorAll('.settings-nav-label')].map(node => node.textContent.trim()),
    title: document.querySelector('.chead b')?.textContent.trim(),
    items: [...document.querySelectorAll('#cfg [role="tab"]')].map(node => node.textContent.trim())
  }));

  const english = await chrome();
  expect(english.groups).toEqual(['Customize', 'App', 'Advanced']);

  await page.locator('#cfg-language-select').evaluate(select => {
    select.value = 'ru'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await chrome()).items[0]).not.toBe(english.items[0]);

  const russian = await chrome();
  const cyrillic = /[а-яА-Я]/;
  expect(russian.groups.every(label => cyrillic.test(label)), `group headings stayed English: ${russian.groups.join(', ')}`).toBe(true);
  expect(cyrillic.test(russian.title || ''), `panel title stayed English: ${russian.title}`).toBe(true);
});

/* A key that reaches the screen unresolved reads as "nav.backup" to the user. */
test('no message key leaks to the screen in any locale', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  const leaked = [];
  for (const locale of ['en', 'ru', 'de', 'ja', 'zh', 'tr', 'es', 'fr']) {
    await page.locator('#cfg-language-select').evaluate((select, value) => {
      select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
    }, locale);
    await page.waitForTimeout(60);
    for (const section of ['appearance', 'background', 'bookmarks', 'general', 'custom-css', 'backup']) {
      await page.locator(`#settings-tab-${section}`).click();
      // Compare against the real key list rather than a shape: text like
      // "nordlys.app" is a domain in the preview card, not an unresolved key.
      leaked.push(...await page.evaluate(([locale, section]) => {
        const keys = new Set(Object.keys(window.I18N.translations.en));
        return [...document.querySelectorAll('#cfg *')]
          .filter(node => node.children.length === 0 && node.getClientRects().length)
          .map(node => node.textContent.trim())
          .filter(text => keys.has(text))
          .map(text => `${locale}/${section}: ${text}`);
      }, [locale, section]));
    }
  }
  expect([...new Set(leaked)]).toEqual([]);
});
