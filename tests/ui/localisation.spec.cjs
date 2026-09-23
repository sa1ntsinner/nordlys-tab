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
    for (const section of ['appearance', 'background', 'bookmarks', 'general', 'support', 'custom-css', 'backup']) {
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

/* Tooltips, accessible names and placeholders are text too — a screen reader
   speaks them and a hover shows them — and most of them stayed English in
   every locale. In German and Russian none may still equal its English self,
   except what is the same in every language: addresses, code, names. */
test('titles, accessible names and placeholders are translated, not only the visible text', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const read = () => page.evaluate(() => {
    const out = {};
    for (const node of document.querySelectorAll('[id][title], [id][aria-label], [id][placeholder]')) {
      for (const attribute of ['title', 'aria-label', 'placeholder']) {
        const value = node.getAttribute(attribute);
        if (value && /[A-Za-z]/.test(value)) out[`#${node.id} ${attribute}`] = value;
      }
    }
    return out;
  });
  const english = await read();
  expect(Object.keys(english).length).toBeGreaterThan(20);
  const universal = value => /:\/\/|^[\w.-]+\.[a-z]{2,}(\/|$)|^https?:|^#|^[\d\s.,:%×x-]+$/i.test(value) || /^(Nordlys|CSS|JSON|URL)$/.test(value)
    // Brand names given as examples, and a look's code prefix, read the same in every language.
    || /^GitHub, Figma, Spotify…$/.test(value) || value.startsWith('nordlys-look:');
  // Words that are the same word in the target language.
  const cognates = { de: new Set(['Name']) };
  for (const locale of ['de', 'ru']) {
    await page.evaluate(value => window.I18N.setLanguage ? window.I18N.setLanguage(value) : null, locale);
    await page.locator('#gear').click();
    await page.locator('#cfg-language-select').evaluate((select, value) => {
      select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
    }, locale);
    await page.waitForTimeout(80);
    const translated = await read();
    const untranslated = Object.entries(english)
      .filter(([where, value]) => translated[where] === value && !universal(value) && !cognates[locale]?.has(value))
      .map(([where, value]) => `${where}: ${value}`);
    expect(untranslated, `${locale} still English`).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

/* The icon picker, its cropper, the bookmark list's accessible names and the
   font list were English in every language: written into the markup or the
   script and never given a key. */
test('the icon picker, the cropper and the bookmark list speak the chosen language', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.I18N.setLanguage('ru'));
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  const folder = page.locator('.bookmark-folder-accordion').first();
  await folder.locator('summary').click();
  const names = await folder.locator('button, input, select, [aria-label]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('aria-label')).filter(Boolean));
  const english = /\b(More actions|Folder name|Add bookmark|Choose icon|Save|bookmarks|Columns for|Bookmark title)\b/;
  expect(names.filter(name => english.test(name))).toEqual([]);

  const fonts = await page.locator('#cfg-font-display option, #cfg-font-display optgroup').evaluateAll(nodes =>
    nodes.map(node => node.label || node.textContent));
  expect(fonts.filter(label => /Default|Recommended|Bundled|All fonts/.test(label))).toEqual([]);

  await page.evaluate(() => window.Nordlys.settings.openIconModal(0, 0));
  const visible = async () => page.locator('#icon-modal').evaluate(root => {
    const out = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const el = walk.currentNode.parentElement;
      if (el.closest('[hidden], .modal-tab-pane:not(.active)') || !el.getClientRects().length) continue;
      const text = walk.currentNode.textContent.trim();
      if (/[A-Za-z]{4,}/.test(text) && !/[а-яё]/i.test(text)) out.push(text);
    }
    return out;
  });
  const brands = /^(YouTube|Bookmark|Google|DuckDuckGo|www\.[\w.]+|[\w.-]+\.[a-z]{2,})$/;
  for (const tab of ['search', 'favicon', 'custom']) {
    await page.locator(`.icon-tab-btn[data-tab="${tab}"]`).click();
    expect((await visible()).filter(text => !brands.test(text)), `English left in the ${tab} pane`).toEqual([]);
  }
  await page.evaluate(() => window.Nordlys.settings.openCropper(`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>')}`, 'url'));
  await page.waitForFunction(() => Boolean(window.Nordlys.settings.cropperImage));
  expect((await visible()).filter(text => !brands.test(text)), 'English left in the cropper').toEqual([]);
});
