const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

async function expectNoHighImpactViolations(page, context) {
  const results = await new AxeBuilder({ page }).include(context).analyze();
  const highImpact = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  expect(highImpact, highImpact.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
}

test('canvas and settings sections have no serious or critical Axe violations', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await expectNoHighImpactViolations(page, '#page');
  await page.locator('#gear').click();
  for (const tab of await page.locator('#cfg [role="tab"]').all()) {
    await tab.click();
    await expectNoHighImpactViolations(page, '#cfg');
  }
});

test('menus, quick edit, and icon picker have no high-impact violations', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const tile = page.locator('#board .tile').first();
  await tile.focus(); await page.keyboard.press('Shift+F10'); await page.waitForTimeout(120);
  await expectNoHighImpactViolations(page, '#tile-ctx-menu');
  await page.keyboard.press('Enter');
  await expectNoHighImpactViolations(page, '#quick-edit-modal');
  await page.locator('#quick-change-icon-btn').click();
  await expectNoHighImpactViolations(page, '#icon-modal');
});

test('keyboard focus is visibly indicated', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.keyboard.press('Tab');
  const indicator = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement);
    return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow };
  });
  expect(indicator.outline !== 'none' && indicator.width >= 2 || indicator.shadow !== 'none').toBe(true);
});

for (const locale of ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'tr']) {
  for (const width of [720, 320]) {
    test(`${locale} settings navigation fits at ${width}px`, async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await page.setViewportSize({ width, height: 720 });
      await page.locator('#gear').click();
      await page.locator('#settings-tab-general').click();
      await page.locator('#cfg-language-select').selectOption(locale);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const tabs = page.locator('#cfg [role="tab"]');
      await expect(tabs).toHaveCount(6);
      const names = await tabs.evaluateAll(items => items.map(item => item.getAttribute('aria-label') || item.textContent.trim()));
      expect(names.every(Boolean)).toBe(true);
    });
  }
}

test('every locale contains every visible English message key', async ({ nordlysPage }) => {
  const missing = await nordlysPage.page.evaluate(() => Object.fromEntries(Object.entries(I18N.translations).map(([locale, messages]) => [locale, Object.keys(I18N.translations.en).filter(key => typeof messages[key] !== 'string' || !messages[key].trim())]).filter(([, keys]) => keys.length)));
  expect(missing).toEqual({});
});

test('every visible settings, dialog, and menu target has a 40px hit area', async ({ nordlysPage }) => {
  const { page } = nordlysPage; await page.locator('#gear').click();
  for (const section of ['appearance', 'background', 'bookmarks', 'general', 'custom-css', 'backup']) {
    await page.locator(`#settings-tab-${section}`).click();
    const small = await page.locator('#cfg :is(button,input:not([type="file"]),select,textarea,[role="button"]):visible').evaluateAll(items => items.map(item => ({ name: item.getAttribute('aria-label') || item.textContent.trim(), box: item.getBoundingClientRect().toJSON() })).filter(item => item.box.width < 40 || item.box.height < 40));
    expect.soft(small, section).toEqual([]);
  }
});
