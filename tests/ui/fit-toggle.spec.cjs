const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { AxeBuilder } = require('@axe-core/playwright');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');

/* One page fit, on the page (#fit-toggle). The drawer's switch was the only
   way to the fit, three levels down in Settings → Bookmarks, and somebody
   looking for it did not find it. This one is on the new tab itself: named,
   saying which way it is, reachable from the keyboard, the same saved value as
   the drawer's switch, and out of the way of everything else on the page
   whether the fit is on or off. */

const link = (name, url) => ({ name, url });
// Far past what compaction alone can fit, so the fit has to zoom.
const DENSE_BOARD = {
  theme: 'aurora-void',
  groups: Array.from({ length: 24 }, (_, f) => ({
    label: `Folder ${f + 1}`, cols: 2 + (f % 3),
    links: Array.from({ length: 12 }, (_, l) => link(`Site ${f + 1}.${l + 1}`, `https://site-${f + 1}-${l + 1}.example/`))
  })).concat([{ label: 'Stashed', hidden: true, links: [link('Later', 'https://later.example/')] }])
};
const VIEWPORTS = [[1440, 900], [1366, 768], [1024, 700], [768, 1024], [390, 844], [320, 568]];
const LOCALES = ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'tr'];

/* At rest the switch is a star in its right-hand corner, and only that corner
   answers the pointer (the rest is clipped away), so it is pressed where the
   star is, as a person would. The pointer on the star unfolds it first. */
async function press(page, how = 'click') {
  const toggle = page.locator('#fit-toggle');
  const box = await toggle.boundingBox();
  await toggle[how]({ position: { x: box.width - 20, y: box.height / 2 } });
}

async function settled(page) {
  await page.waitForFunction(() => {
    const fit = window.Nordlys?.pageFit;
    return fit && !fit.frame && !fit.timer && !fit.fitting
      && (fit.state.stage === 'off' || fit.state.room === document.documentElement.clientHeight);
  });
}

// The switch, what it must stay clear of, and whether the document scrolls.
function layout(page) {
  return page.evaluate(() => {
    const rect = (node) => { const b = node.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const shown = (node) => node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
    const all = (selector) => [...document.querySelectorAll(selector)].filter(shown).map((node) => ({ what: node.id || node.textContent.trim().slice(0, 24) || node.className, ...rect(node) }));
    const toggle = document.getElementById('fit-toggle');
    const label = toggle.querySelector('.fit-toggle-label');
    const doc = document.scrollingElement;
    return {
      toggle: shown(toggle) ? rect(toggle) : null,
      gear: rect(document.getElementById('gear')),
      label: { text: label.textContent, truncated: label.scrollWidth > label.clientWidth + 1 },
      zoom: toggle.currentCSSZoom,
      insidePage: Boolean(toggle.closest('#page, #fit-surface')),
      hero: all('#hero > *'),
      search: all('#searchwrap'),
      content: [...all('#board .box'), ...all('#board .lbl'), ...all('#board .cat')],
      cards: all('#board .card, #hiddenDock'),
      checked: toggle.getAttribute('aria-checked'),
      scroll: { height: doc.scrollHeight, client: doc.clientHeight, width: doc.scrollWidth, clientWidth: doc.clientWidth, top: doc.scrollTop },
      innerWidth, innerHeight,
      stage: window.Nordlys.pageFit.state.stage,
      attribute: document.documentElement.getAttribute('data-page-fit')
    };
  });
}

const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function expectClear(m, label) {
  expect(m.toggle, `${label}: the switch is on screen`).not.toBeNull();
  const t = m.toggle;
  expect(t.left, `${label}: left`).toBeGreaterThanOrEqual(0);
  expect(t.top, `${label}: top`).toBeGreaterThanOrEqual(0);
  expect(t.right, `${label}: right`).toBeLessThanOrEqual(m.innerWidth);
  expect(t.bottom, `${label}: bottom`).toBeLessThanOrEqual(m.innerHeight);
  expect(t.height, `${label}: a 40px target`).toBeGreaterThanOrEqual(40);
  expect(t.width, `${label}: a 40px target`).toBeGreaterThanOrEqual(40);
  expect(meets(t, m.gear), `${label}: the switch lies on the gear`).toBe(false);
  const under = [...m.hero, ...m.search, ...m.content, ...m.cards].filter((box) => meets(t, box)).map((box) => box.what);
  expect(under, `${label}: what the switch lies over`).toEqual([]);
}

/* ── Seen without opening Settings ─────────────────────────────────── */
for (const [width, height] of VIEWPORTS) {
  test.describe(`at ${width}×${height}`, () => {
    test.use({ nordlysBoard: NINE_FOLDERS, viewport: { width, height } });

    test('the switch is on the new tab, named, off, and over nothing', async ({ nordlysPage }) => {
      const { page, runtimeErrors } = nordlysPage;
      await page.evaluate(() => document.fonts.ready);
      await settled(page);
      const toggle = page.getByRole('switch', { name: 'One page fit' });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await expect(page.locator('#cfg')).not.toHaveClass(/open/);
      const m = await layout(page);
      expect(m.label).toEqual({ text: 'One page fit', truncated: false });
      expect(m.insidePage, 'the switch is chrome, outside what the fit scales').toBe(false);
      expect(m.zoom).toBe(1);
      expectClear(m, 'off');
      // Off is the ordinary page: it still scrolls, and the switch scrolls away
      // with the band above the clock rather than floating over the bookmarks.
      expect(m.scroll.height).toBeGreaterThan(m.scroll.client);
      expect(m.scroll.width).toBeLessThanOrEqual(m.scroll.clientWidth);
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
      const scrolled = await layout(page);
      expect(scrolled.scroll.top).toBeGreaterThan(0);
      expect(scrolled.toggle.top).toBeCloseTo(m.toggle.top - scrolled.scroll.top, 0);
      const over = scrolled.toggle.bottom > 0 ? [...scrolled.content].filter((box) => meets(scrolled.toggle, box)).map((box) => box.what) : [];
      expect(over, 'scrolled, the switch lies over bookmarks').toEqual([]);
      expect(runtimeErrors).toEqual([]);
    });

    test('pressed, the page fits the window with the switch and the gear clear of it', async ({ nordlysPage }) => {
      const { page, runtimeErrors } = nordlysPage;
      await page.evaluate(() => document.fonts.ready);
      await settled(page);
      await press(page);
      await settled(page);
      const m = await layout(page);
      expect(m.checked).toBe('true');
      expect(m.attribute).toBe('on');
      expect(m.stage).not.toBe('off');
      expect(m.scroll.height, 'the document scrolls').toBeLessThanOrEqual(m.scroll.client);
      expect(m.scroll.width, 'the document scrolls sideways').toBeLessThanOrEqual(m.scroll.clientWidth);
      for (const box of [...m.hero, ...m.search, ...m.cards]) expect(box.bottom, `${box.what} bottom`).toBeLessThanOrEqual(m.innerHeight + 0.5);
      expect(m.zoom, 'the switch is never scaled').toBe(1);
      expectClear(m, 'on');
      const underGear = m.cards.filter((box) => meets(m.gear, box)).map((box) => box.what);
      expect(underGear, 'a folder under the gear').toEqual([]);
      expect(runtimeErrors).toEqual([]);
    });
  });
}

/* A board that has to be zoomed, and a window zoomed to 200 %. */
for (const [width, height, scale] of [[1440, 900, 1], [390, 844, 3], [720, 450, 2]]) {
  test.describe(`a dense board at ${width}×${height}@${scale}x`, () => {
    test.use({ nordlysBoard: DENSE_BOARD, viewport: { width, height }, deviceScaleFactor: scale });

    test('is zoomed to fit, clear of the switch and the gear', async ({ nordlysPage }) => {
      const { page, runtimeErrors } = nordlysPage;
      await page.evaluate(() => document.fonts.ready);
      await settled(page);
      await press(page);
      await settled(page);
      const m = await layout(page);
      expect(m.stage).toBe('scaled');
      expect(m.scroll.height).toBeLessThanOrEqual(m.scroll.client);
      expect(m.scroll.width).toBeLessThanOrEqual(m.scroll.clientWidth);
      expectClear(m, 'dense');
      expect(m.cards.filter((box) => meets(m.gear, box)).map((box) => box.what)).toEqual([]);
      // What the switch says for a zoomed board is the drawer's state line.
      const percent = await page.evaluate(() => Math.round(window.Nordlys.pageFit.state.zoom * 100));
      await expect(page.locator('#fit-toggle')).toHaveAccessibleDescription(`Shown at ${percent}% to fit this window.`);
      expect(runtimeErrors).toEqual([]);
    });
  });
}

/* ── One saved value ───────────────────────────────────────────────── */
test.describe('saved', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  test('the switch is saved, survives a new tab, and turns off again', async ({ nordlysPage }) => {
    const { page, storageState } = nordlysPage;
    await settled(page);
    const sizes = (stored) => page.evaluate((stored) => {
      const cfg = stored ? JSON.parse(localStorage.getItem('nordlys_config')) : window.Nordlys.config;
      return { tileSize: cfg.tileSize, cardGap: cfg.cardGap, boardGap: cfg.boardGap };
    }, stored);
    const before = await sizes(false);
    const toggle = page.locator('#fit-toggle');
    await press(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).onePageFit)).toBe(true);
    // Both stores, as every other setting is saved.
    await expect.poll(() => storageState.nordlys_config?.onePageFit).toBe(true);

    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    await settled(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    let m = await layout(page);
    expect(m.attribute).toBe('on');
    expect(m.scroll.height).toBeLessThanOrEqual(m.scroll.client);

    await press(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await settled(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).onePageFit)).toBe(false);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    await settled(page);
    m = await layout(page);
    expect(m.checked).toBe('false');
    expect(m.attribute).toBeNull();
    expect(m.scroll.height, 'off, the ordinary page scrolls again').toBeGreaterThan(m.scroll.client);
    // Nothing the fit worked out was saved: only the switch.
    expect(await sizes(true)).toEqual(before);
  });

  test('the switch on the page and the one in Settings are the same switch', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    const quick = page.locator('#fit-toggle');
    const drawer = page.locator('#cfg-one-page-fit');
    await press(page);
    await settled(page);
    await page.locator('#gear').click();
    await page.getByRole('tab', { name: 'Bookmarks' }).click();
    await expect(drawer).toBeChecked();
    const line = page.locator('#page-fit-state');
    await expect(line).toBeVisible();
    const words = await line.textContent();
    expect(words.length).toBeGreaterThan(0);
    await expect(quick).toHaveAccessibleDescription(words);

    // Off from Settings: the page's switch follows at once.
    await drawer.evaluate((input) => input.closest('label').click());
    await expect(drawer).not.toBeChecked();
    await expect(quick).toHaveAttribute('aria-checked', 'false');
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-page-fit'))).toBeNull();
    // And on again from Settings.
    await drawer.evaluate((input) => input.closest('label').click());
    await expect(quick).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // Another tab turns it off: this one adopts it, switch and all.
    await page.evaluate(() => {
      const next = { ...JSON.parse(localStorage.getItem('nordlys_config')), onePageFit: false };
      localStorage.setItem('nordlys_config', JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: 'nordlys_config', newValue: JSON.stringify(next) }));
    });
    await expect(quick).toHaveAttribute('aria-checked', 'false');
    await expect(drawer).not.toBeChecked();
    await expect(quick).toHaveAccessibleDescription('Keeps the clock, the search and every folder in the window, with nothing to scroll.');
  });
});

/* ── Keyboard and screen readers ───────────────────────────────────── */
test.describe('from the keyboard', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  test('Tab reaches it before the gear, Space and Enter work it, and focus stays', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const order = [];
    for (let press = 0; press < 120 && !order.includes('gear'); press++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement?.id || ''));
    }
    expect(order).toContain('fit-toggle');
    expect(order.indexOf('fit-toggle'), 'the switch comes just before the gear').toBe(order.indexOf('gear') - 1);
    await page.keyboard.press('Shift+Tab');
    const toggle = page.locator('#fit-toggle');
    await expect(toggle).toBeFocused();
    // Focus is drawn where it is.
    const ring = await toggle.evaluate((node) => { const s = getComputedStyle(node); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow.includes('px'); });
    expect(ring, 'no focus ring').toBe(true);

    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await settled(page);
    await expect(toggle).toBeFocused();
    // Turning it on says what the fit did, once.
    await expect(page.locator('#nl-live-region')).toHaveText(/fit|window/i);
    const described = await page.locator('#fit-toggle-state').textContent();
    expect(await page.locator('#nl-live-region').textContent()).toBe(described);

    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toBeFocused();
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-page-fit'))).toBeNull();
  });

  test('has no Axe violations either way', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    for (const state of ['false', 'true']) {
      if (state === 'true') { await press(page); await settled(page); }
      await expect(page.locator('#fit-toggle')).toHaveAttribute('aria-checked', state);
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).include('#fit-toggle').analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`), `aria-checked=${state}`).toEqual([]);
    }
  });
});

/* ── Every language, at a desktop, a phone, and the narrowest, shortest
   window that still has the clock and the switch side by side ────────── */
for (const [width, height] of [[1440, 900], [760, 700], [360, 740]]) {
  test.describe(`every language at ${width}×${height}`, () => {
    test.use({ nordlysBoard: NINE_FOLDERS, viewport: { width, height } });

    test('the switch carries its name in full and stays clear, off and on', async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await page.evaluate(() => document.fonts.ready);
      await settled(page);
      for (const locale of LOCALES) {
        for (const on of [false, true]) {
          await page.evaluate(([lang, fit]) => {
            window.I18N.setLanguage(lang);
            if (window.Nordlys.config.onePageFit !== fit) window.Nordlys.settings.setPageFit(fit);
          }, [locale, on]);
          await settled(page);
          const words = await page.evaluate(() => ({ name: window.I18N.t('bookmarks.onePageFit'), hint: window.I18N.t('bookmarks.onePageFitHint') }));
          const m = await layout(page);
          const where = `${locale} ${on ? 'on' : 'off'}`;
          expect(m.label, where).toEqual({ text: words.name, truncated: false });
          await expect(page.getByRole('switch', { name: words.name })).toHaveAttribute('aria-checked', String(on));
          if (!on) await expect(page.locator('#fit-toggle'), where).toHaveAccessibleDescription(words.hint);
          expectClear(m, where);
          if (on) expect(m.scroll.height, `${where}: the document scrolls`).toBeLessThanOrEqual(m.scroll.client);
        }
      }
    });
  });
}

/* ── A star until it is wanted ─────────────────────────────────────── */
/* Most people turn the fit on once and never touch it again, so on the page
   the switch is kept as a star — the Nordlys mark, one more star in the sky —
   and turns into the switch only when a pointer or the keyboard comes to it. */
const look = (page) => page.evaluate(() => {
  const toggle = document.getElementById('fit-toggle');
  const style = (node) => getComputedStyle(node);
  const star = toggle.querySelector('.fit-toggle-star');
  return {
    star: star ? { opacity: Number(style(star).opacity), colour: style(star).color, shown: star.getClientRects().length > 0 } : null,
    label: Number(style(toggle.querySelector('.fit-toggle-label')).opacity),
    track: Number(style(toggle.querySelector('.fit-toggle-track')).opacity),
    glass: style(toggle).backgroundColor,
    blur: style(toggle).backdropFilter,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  };
});
const transparent = (colour) => colour === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(colour);

test.describe('a star until it is wanted', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  test('at rest only the star shows: no glass, no name, no track', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await page.mouse.move(5, 500);
    await expect.poll(async () => (await look(page)).label).toBe(0);
    const rest = await look(page);
    expect(rest.star?.shown, 'the star is there').toBe(true);
    expect(rest.star.opacity, 'visible, and quiet').toBeGreaterThan(0.3);
    expect(rest.star.opacity).toBeLessThan(0.8);
    expect(rest.track).toBe(0);
    expect(transparent(rest.glass), `no glass at rest: ${rest.glass}`).toBe(true);
    // Nothing is blurred behind a star, so the sky costs nothing more for it.
    expect(rest.blur === 'none' || rest.blur === '', `no backdrop blur at rest: ${rest.blur}`).toBe(true);
  });

  test('a pointer on the star turns it into the switch, and away it becomes a star again', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await press(page, 'hover');
    await expect.poll(async () => (await look(page)).label).toBe(1);
    const open = await look(page);
    expect(open.track).toBe(1);
    expect(open.star.opacity, 'the star has gone into the switch').toBeLessThan(0.05);
    expect(transparent(open.glass), 'the glass is drawn').toBe(false);
    await page.mouse.move(5, 500);
    await expect.poll(async () => (await look(page)).label).toBe(0);
    await expect.poll(async () => (await look(page)).star.opacity, 'the star comes back').toBeGreaterThan(0.5);
  });

  test('keyboard focus opens it as a pointer does', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await page.locator('#fit-toggle').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('#fit-toggle')).toBeFocused();
    await expect.poll(async () => (await look(page)).label).toBe(1);
  });

  test('with the fit on, the star is lit in the accent', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await press(page);
    await settled(page);
    await page.mouse.move(5, 500);
    await expect.poll(async () => (await look(page)).label).toBe(0);
    const hex = (await look(page)).accent.replace('#', '');
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    await expect.poll(async () => (await look(page)).star.colour, 'lit in the accent').toBe(`rgb(${rgb.join(', ')})`);
    await expect.poll(async () => (await look(page)).star.opacity, 'lit brighter than at rest').toBeGreaterThan(0.75);
  });

  /* The glint is for a star nobody has found yet. A pointer or the keyboard
     already on it has found it, and a glint over the open switch draws the
     star on top of its knob — which is what a pointer arriving a moment after
     the page opened used to see. */
  const glinting = (page) => page.evaluate(() => document.querySelector('#fit-toggle .fit-toggle-star')
    .getAnimations().some((animation) => animation.animationName === 'fitStarGlint' && animation.playState === 'running'));

  test('the glint never plays over the open switch', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await press(page, 'hover');
    await expect.poll(async () => (await look(page)).label).toBe(1);
    await page.evaluate(() => window.Nordlys.settings.glintStar());
    expect(await glinting(page), 'a star already found does not glint').toBe(false);
    expect((await look(page)).star.opacity).toBeLessThan(0.05);
  });

  test('a pointer that comes mid-glint puts it out, and leaving does not start it again', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await page.mouse.move(5, 500);
    await page.evaluate(() => window.Nordlys.settings.glintStar());
    expect(await glinting(page), 'a star at rest glints').toBe(true);
    await press(page, 'hover');
    expect(await glinting(page), 'the pointer puts the glint out').toBe(false);
    await page.mouse.move(5, 500);
    await expect.poll(async () => (await look(page)).label).toBe(0);
    expect(await glinting(page), 'leaving does not start it again').toBe(false);
  });
});

test.describe('on a touch screen', () => {
  test.use({ nordlysBoard: NINE_FOLDERS, hasTouch: true });

  test('the first tap opens the star, the second works the switch', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    const toggle = page.locator('#fit-toggle');
    await press(page, 'tap');
    await expect.poll(async () => (await look(page)).label).toBe(1);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await press(page, 'tap');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

/* ── Out of the way of the rest of the chrome ──────────────────────── */
test.describe('beside the rest of the chrome', () => {
  test.use({ nordlysBoard: NINE_FOLDERS });

  for (const [width, height] of [[1440, 900], [760, 900], [390, 844]]) {
    test(`a toast never lands on it at ${width}×${height}`, async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await page.setViewportSize({ width, height });
      await settled(page);
      await page.evaluate(() => window.NordlysUI.showUndoToast({ message: 'A long message about a folder that was moved somewhere else entirely', actionLabel: 'Undo', onAction() {} }));
      const toast = page.locator('#toast-dock .toast').first();
      await expect(toast).toBeVisible();
      const [a, b] = await Promise.all([page.locator('#fit-toggle').boundingBox(), toast.boundingBox()]);
      const box = (r) => ({ left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height });
      expect(meets(box(a), box(b))).toBe(false);
    });
  }

  test('arranging the board puts it away, and Done brings it back', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    await press(page);
    await settled(page);
    await page.evaluate(() => window.Nordlys.grid.arrange.enter());
    await expect(page.locator('#arrange-bar')).toBeVisible();
    await expect(page.locator('#fit-toggle')).toBeHidden();
    await page.locator('#arrange-done').click();
    await expect(page.locator('#fit-toggle')).toBeVisible();
    await expect(page.locator('#fit-toggle')).toHaveAttribute('aria-checked', 'true');
  });

  test('a light theme draws it readable', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.locator('#gear').click();
    await page.locator('[data-mode="light"]').click();
    await page.locator('#cfgx').click();
    await settled(page);
    for (const state of ['false', 'true']) {
      if (state === 'true') { await press(page); await settled(page); }
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).include('#fit-toggle').withRules(['color-contrast']).analyze();
      expect(results.violations.map((v) => v.nodes.map((n) => n.failureSummary).join('; ')), `light, aria-checked=${state}`).toEqual([]);
    }
  });
});
