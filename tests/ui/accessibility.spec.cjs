const { AxeBuilder } = require('@axe-core/playwright');

/* Native dropdowns no longer render — they stay only as the value source behind
   the themed control. Drive them the way that control does when it commits. */
async function chooseOption(page, locator, value) {
  await locator.evaluate((select, chosen) => {
    select.value = chosen;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { openIconPicker } = require('../helpers/flows.cjs');

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
    // A composite control shows focus once, on the wrapper — the search bar lights
    // up rather than the field inside it — so an ancestor counts as the indicator.
    for (let node = document.activeElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if ((style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== 'none') return true;
    }
    return false;
  });
  expect(indicator, 'the focused control shows no visible focus, on itself or its wrapper').toBe(true);
});

for (const locale of ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'tr']) {
  for (const width of [720, 320]) {
    test(`${locale} settings navigation fits at ${width}px`, async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await page.setViewportSize({ width, height: 720 });
      await page.locator('#gear').click();
      await page.locator('#settings-tab-general').click();
      await chooseOption(page, page.locator('#cfg-language-select'), locale);
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

/* Named for the whole product, so it has to look at the whole product: the
   canvas, every settings section, the menus and the dialogs. It previously
   queried only #cfg, which is why undersized controls survived elsewhere. */
async function undersizedTargets(page, where) {
  // Overlays scale in; a control measured mid-animation reads smaller than it is.
  await page.waitForTimeout(340);
  const SELECTOR = 'button, a[href], select, [role="button"], [role="tab"], [role="option"], [role="slider"], [role="menuitem"], input:not([type="file"]):not([type="range"])';
  return page.evaluate(([selector, label]) => [...document.querySelectorAll(selector)]
    // A zero-area control is not a target: it is a visually hidden input proxied
    // by its label, and the label is what gets measured.
    .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert],[aria-hidden="true"]'))
    .filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
    .map(node => {
      const box = node.getBoundingClientRect();
      return { where: label, name: (node.getAttribute('aria-label') || node.textContent || node.id || node.className).trim().slice(0, 32), size: `${Math.round(box.width)}x${Math.round(box.height)}` };
    })
    .filter(item => {
      const [width, height] = item.size.split('x').map(Number);
      return width < 40 || height < 40;
    }), [SELECTOR, where]);
}

test('every target in the product has a 40px hit area', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const small = [];

  small.push(...await undersizedTargets(page, 'canvas'));

  const tile = page.locator('#board .tile').first();
  await tile.focus(); await page.keyboard.press('Shift+F10');
  // Wait for the menu to own focus: pressing Enter early activates the tile
  // underneath and navigates away.
  await expect(page.locator('#tile-ctx-menu').getByRole('menuitem').first()).toBeFocused();
  small.push(...await undersizedTargets(page, 'tile menu'));
  await page.keyboard.press('Enter');
  await expect(page.locator('#quick-edit-modal')).toBeVisible();
  small.push(...await undersizedTargets(page, 'quick edit'));
  await page.keyboard.press('Escape');

  await page.locator('#gear').click();
  for (const section of ['appearance', 'background', 'bookmarks', 'general', 'custom-css', 'backup']) {
    await page.locator(`#settings-tab-${section}`).click();
    await expect(page.locator(`#sec-${section}`)).toBeVisible();
    small.push(...await undersizedTargets(page, section));
  }

  const folder = page.locator('.bookmark-folder-accordion').first();
  await page.locator('#settings-tab-bookmarks').click();
  await folder.locator('summary').click();
  small.push(...await undersizedTargets(page, 'bookmarks expanded'));
  await openIconPicker(page, folder);
  small.push(...await undersizedTargets(page, 'icon picker'));

  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

  // States the default board never shows: a folded folder's dock chip, and the
  // prompt an empty board offers.
  await page.locator('#board > .card').first().locator('.foldBtn').click();
  await page.waitForTimeout(360);
  small.push(...await undersizedTargets(page, 'dock'));
  await page.evaluate(() => {
    window.Aurora.config.groups = [];
    window.Aurora.saveConfig(); window.Aurora.grid.render();
  });
  small.push(...await undersizedTargets(page, 'empty board'));

  expect(small, 'controls smaller than the 40px contract').toEqual([]);
});

/* Axe only runs the default dark theme, so a surface token that fails to follow a
   light theme stays invisible to it. Measure the rendered contrast in both modes.
   The themed dropdown is the control that reads --nl-surface-elevated today; the
   folder steppers this originally caught have since been replaced by the handle. */
async function elevatedSurfaceContrast(page) {
  return page.evaluate(() => {
    // Rasterise through a canvas: computed values may arrive as rgb(), color(srgb ...)
    // or any other CSS colour form, and only the painted pixel is format-proof.
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const pixel = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const channel = value => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    const luminance = color => { const [r, g, b] = pixel(color); return 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255); };
    const opaqueBackground = node => {
      for (let current = node; current; current = current.parentElement) {
        const background = getComputedStyle(current).backgroundColor;
        if (pixel(background)[3] > 229) return background;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    return [...document.querySelectorAll('.nl-select')].map(button => {
      const style = getComputedStyle(button);
      const [text, surface] = [luminance(style.color), luminance(opaqueBackground(button))];
      return { label: button.getAttribute('aria-label'), ratio: Number(((Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05)).toFixed(2)) };
    });
  });
}

test('elevated surfaces keep readable contrast in light and dark themes', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  for (const mode of ['light', 'dark']) {
    await page.locator('#settings-tab-appearance').click();
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator('#settings-tab-general').click();
    await expect(page.locator('#sec-general')).toBeVisible();
    const measured = await elevatedSurfaceContrast(page);
    expect(measured.length).toBeGreaterThan(0);
    for (const control of measured) expect.soft(control.ratio, `${mode}: ${control.label} at ${control.ratio}:1`).toBeGreaterThanOrEqual(4.5);
  }
});
