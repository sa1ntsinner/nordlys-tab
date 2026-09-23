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
  /* Menus and dialogs fade in now. Axe reads colours as they are at the moment
     it runs, and a button caught half-way through its entrance is a blend of
     itself and the page — so the layer is judged once it has arrived. */
  await page.evaluate(() => window.NordlysUI?.settled?.());
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
  await page.locator('#quick-icon-preview').click();
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
      await expect(tabs).toHaveCount(7);
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
    // Nor is one that is not there to be seen or pressed until it is revealed.
    .filter(node => getComputedStyle(node).visibility !== 'hidden')
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
  for (const section of ['appearance', 'background', 'bookmarks', 'general', 'support', 'custom-css', 'backup']) {
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

  // States the fixture board never shows: a folded folder's dock chip, and the
  // invitation an empty board offers — which is also what a new install opens on.
  await page.locator('#board .card').first().locator('.foldBtn').click();
  await page.waitForTimeout(360);
  small.push(...await undersizedTargets(page, 'dock'));
  await page.evaluate(() => {
    window.Nordlys.config.groups = [];
    window.Nordlys.saveConfig(); window.Nordlys.grid.render();
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

/* The two surfaces added with size and spacing and with icon addresses. */
test('size and spacing, and the icon address versions, have no high-impact violations', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.mouse.click(40, 700, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  await page.locator('#arrange-size').click();
  await expect(page.locator('#arrange-size-panel')).toBeVisible();
  await expectNoHighImpactViolations(page, '#arrange-bar');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const link = window.Nordlys.config.groups[0].links[0];
    link.iconUrls = [{ url: 'https://cdn.example.com/a.png', thumb: '', at: 2 }, { url: 'https://cdn.example.com/b.png', thumb: '', at: 1 }];
    link.iconUrl = 'https://cdn.example.com/a.png';
    window.Nordlys.settings.openIconModal(0, 0);
  });
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await expect(page.locator('.icon-url-version')).toHaveCount(2);
  await page.locator('.icon-url-version').first().hover();
  await expectNoHighImpactViolations(page, '#icon-url-source');
});

test('arranging, its size panel and the icon address versions keep the 40px contract', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const small = [];
  await page.mouse.click(40, 700, { button: 'right' });
  await page.locator('#board-ctx-menu [data-action="arrange"]').click();
  small.push(...(await undersizedTargets(page, 'arranging')).filter(item => !item.where.startsWith('canvas')));
  await page.locator('#arrange-size').click();
  small.push(...await undersizedTargets(page, 'size panel'));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const link = window.Nordlys.config.groups[0].links[0];
    link.iconUrls = [{ url: 'https://cdn.example.com/a.png', thumb: '', at: 2 }, { url: 'https://cdn.example.com/b.png', thumb: '', at: 1 }];
    link.iconUrl = 'https://cdn.example.com/a.png';
    window.Nordlys.settings.openIconModal(0, 0);
  });
  await page.locator('.icon-tab-btn[data-tab="custom"]').click();
  await page.locator('.icon-url-version').nth(1).hover();
  await page.locator('.icon-url-version').nth(1).locator('.icon-url-pick').focus();
  small.push(...(await undersizedTargets(page, 'icon addresses')).filter(item => /icon-url|Change|Remove|cdn/.test(item.name) || item.where === 'icon addresses'));
  expect(small.filter(item => !/^#board|tile/.test(item.name)), 'controls smaller than the 40px contract').toEqual([]);
});

/* In forced colours every background is the system's, and most choices here
   are shown by a background — the tab, the segment, the switch. Each chosen
   one has to take the system's selected colours to stay visible at all. */
test('what is chosen still shows in forced colours', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.emulateMedia({ forcedColors: 'active' });
  await page.evaluate(() => window.Nordlys.grid.arrange.enter());
  await page.locator('#arrange-size').click();
  await page.evaluate(() => window.NordlysUI.settled());
  const differ = selector => page.locator(selector).evaluate(chosen => {
    const others = [...chosen.parentElement.children].filter(node => node !== chosen && node.matches('button'));
    const paint = node => getComputedStyle(node).backgroundColor;
    return others.length > 0 && others.every(node => paint(node) !== paint(chosen));
  });
  expect(await differ('.arrange-controls .arrange-layout[aria-checked="true"]'), 'the chosen layout').toBe(true);
  expect(await differ('[data-tile][aria-checked="true"]'), 'the chosen bookmark size').toBe(true);
  expect(await differ('[data-width][aria-checked="true"]'), 'the chosen width').toBe(true);
  const track = await page.locator('label.tg:has(#arrange-names) i').evaluate(node => getComputedStyle(node).backgroundColor);
  await page.locator('label.tg:has(#arrange-names)').click();
  await page.evaluate(() => window.NordlysUI.settled());
  const off = await page.locator('label.tg:has(#arrange-names) i').evaluate(node => getComputedStyle(node).backgroundColor);
  expect(off, 'a switch shows whether it is on').not.toBe(track);
});

/* The sliding thumb behind a chosen segment is a pseudo-element, which the
   DOM-walking checks cannot see; it had been painted in the accent under
   text meant for a tint, and "Dark" read at 1.6:1. Measured here directly. */
test('the chosen segment reads against the thumb behind it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#gear').click();
  for (const theme of ['aurora-void', 'dracula-velvet', 'porcelain-light']) {
    await page.evaluate(name => window.Nordlys.setTheme(name), theme);
    // The theme lands inside a view transition, after setTheme returns; what
    // must read is the state it arrives at.
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const measure = () => page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      // color-mix() comes back as color(srgb …), which a canvas fill does not take.
      const paint = colour => {
        const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(colour);
        if (srgb) return srgb.slice(1, 4).map(value => Math.round(Number(value) * 255));
        context.clearRect(0, 0, 1, 1); context.fillStyle = getComputedStyle(document.body).backgroundColor; context.fillRect(0, 0, 1, 1); context.fillStyle = colour; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data];
      };
      const channel = value => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
      const luminance = ([r, g, b]) => 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
      const switcher = document.getElementById('color-mode-switcher');
      const label = switcher.querySelector('.mode-btn.active span') || switcher.querySelector('.mode-btn.active');
      const text = luminance(paint(getComputedStyle(label).color));
      const thumb = luminance(paint(getComputedStyle(switcher, '::before').backgroundColor));
      return (Math.max(text, thumb) + 0.05) / (Math.min(text, thumb) + 0.05);
    });
    await expect.poll(measure, { message: `${theme}: the chosen colour mode` }).toBeGreaterThanOrEqual(4.5);
  }
});

/* A folder's handle appears when the folder is hovered, as a hint; at 0.35
   it read at 1.7:1, below the 3:1 a control needs to be seen. Measured on
   rendered pixels in the theme where it was hardest. */
test('a folder handle that has appeared can be seen', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => window.Nordlys.setTheme('solarized-light'));
  await page.evaluate(() => window.NordlysUI.settled());
  const card = page.locator('#board .card').first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10);
  // Folders reveal their handles on hover intent, not the instant a pointer
  // passes; the measurement waits for the handle to have appeared.
  await expect.poll(() => card.locator('.groupGrip').evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0.5);
  await page.evaluate(() => window.NordlysUI.settled());
  const shot = await card.locator('.groupGrip').screenshot();
  const ratio = await page.evaluate(async encoded => {
    const image = await new Promise(done => { const node = new Image(); node.onload = () => done(node); node.src = `data:image/png;base64,${encoded}`; });
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const channel = value => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    const values = [];
    for (let at = 0; at < data.length; at += 4) values.push(0.2126 * channel(data[at] / 255) + 0.7152 * channel(data[at + 1] / 255) + 0.0722 * channel(data[at + 2] / 255));
    values.sort((a, b) => a - b);
    const ground = values[Math.floor(values.length / 2)];
    const mark = Math.abs(values[0] - ground) > Math.abs(values[values.length - 1] - ground) ? values[0] : values[values.length - 1];
    return (Math.max(mark, ground) + 0.05) / (Math.min(mark, ground) + 0.05);
  }, shot.toString('base64'));
  expect(ratio).toBeGreaterThanOrEqual(3);
});

/* At 200% zoom a 1440 by 900 window is 720 by 450. The bookmark editor with
   its Appearance section open ran off both edges with nothing to scroll. */
test('at 200% zoom the bookmark editor stays on the screen and its button can be reached', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 720, height: 450 });
  await page.evaluate(() => window.Nordlys.grid.openQuickEditModal(0, 0));
  await page.locator('.quick-advanced summary').click();
  await page.evaluate(() => window.NordlysUI.settled());
  const card = await page.locator('#quick-edit-modal .quick-modal-card').boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(450);
  await page.locator('#quick-save-btn').scrollIntoViewIfNeeded();
  await expect(page.locator('#quick-save-btn')).toBeInViewport();
});

/* A system set to reduce transparency — macOS, Windows — got translucent,
   blurred glass all the same. */
test('a system that asks for less transparency gets solid glass', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
  const glass = await page.evaluate(() => ({
    opacity: getComputedStyle(document.documentElement).getPropertyValue('--glass-opacity').trim(),
    blur: getComputedStyle(document.documentElement).getPropertyValue('--glass-blur').trim()
  }));
  expect(Number(glass.opacity)).toBe(1);
  expect(glass.blur).toBe('0px');
  await page.locator('#gear').click();
  await page.locator('#advanced-glass-settings > summary').click();
  await expect(page.locator('.glass-solid-note')).toBeVisible();
});
