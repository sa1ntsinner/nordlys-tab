const { test, expect } = require('../helpers/nordlys-fixture.cjs');
const { NINE_FOLDERS } = require('../helpers/nine-folders.cjs');
const { DEMO_BOARD } = require('../helpers/demo-board.cjs');

/* One page fit (src/js/page-fit.js): with the switch on, the clock, the search
   field, every visible folder and the hidden-folder dock are inside the window
   with no document scrollbar, at any window size, display scale or browser
   zoom. With it off, the page is the page it always was. */

const link = (name, url) => ({ name, url });
/* A board far past what fits by compaction alone: thirty folders, fourteen
   bookmarks each, and one hidden folder so the dock is on the page. */
const DENSE_BOARD = {
  theme: 'aurora-void',
  groups: Array.from({ length: 30 }, (_, f) => ({
    label: `Folder ${f + 1}`, cols: 2 + (f % 3),
    links: Array.from({ length: 14 }, (_, l) => link(`Site ${f + 1}.${l + 1}`, `https://site-${f + 1}-${l + 1}.example/`))
  })).concat([{ label: 'Stashed', hidden: true, links: [link('Later', 'https://later.example/')] }])
};
const withFit = (board, on = true) => ({ ...board, onePageFit: on });

// Everything a person can see of the page, and whether the document scrolls.
function measure(page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement;
    const rect = (node) => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }; };
    const shown = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    const parts = ['#hero', '#searchwrap', '#board', '#hiddenDock'].map((selector) => document.querySelector(selector)).filter(shown);
    const cards = [...document.querySelectorAll('#board .card')];
    const tiles = [...document.querySelectorAll('#board .tile')];
    const fit = window.Nordlys.pageFit;
    const gear = document.getElementById('gear');
    return {
      scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight,
      scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
      innerHeight, innerWidth,
      parts: parts.map((node) => ({ id: node.id, ...rect(node) })),
      cards: cards.map(rect), tileCount: tiles.length,
      hiddenTiles: tiles.filter((tile) => !shown(tile)).length,
      tile: tiles[0] ? rect(tiles[0]) : null,
      gear: gear && shown(gear) ? rect(gear) : null,
      dock: document.getElementById('hiddenDock') && shown(document.getElementById('hiddenDock')) ? rect(document.getElementById('hiddenDock')) : null,
      state: fit ? { ...fit.state } : null,
      attribute: document.documentElement.getAttribute('data-page-fit'),
      // No declaration left on #page, whether or not an empty style attribute is.
      pageStyle: document.getElementById('page').style.cssText,
      surfaceDisplay: document.getElementById('fit-surface') ? getComputedStyle(document.getElementById('fit-surface')).display : null
    };
  });
}

// Settled: no pass waiting on a frame or on the resize spacing.
async function settled(page, height) {
  await page.waitForFunction((h) => {
    const fit = window.Nordlys?.pageFit;
    return fit && !fit.frame && !fit.timer && !fit.fitting && (h === undefined || fit.state.room === h || fit.state.stage === 'off');
  }, height);
}

function expectInside(m, label = '') {
  expect(m.scrollHeight, `${label} document scrolls`).toBeLessThanOrEqual(m.clientHeight);
  expect(m.scrollWidth, `${label} document scrolls sideways`).toBeLessThanOrEqual(m.clientWidth);
  for (const part of m.parts) {
    expect(part.top, `${label} ${part.id} top`).toBeGreaterThanOrEqual(-0.5);
    expect(part.bottom, `${label} ${part.id} bottom`).toBeLessThanOrEqual(m.innerHeight + 0.5);
    expect(part.left, `${label} ${part.id} left`).toBeGreaterThanOrEqual(-0.5);
    expect(part.right, `${label} ${part.id} right`).toBeLessThanOrEqual(m.innerWidth + 0.5);
  }
  for (const card of m.cards) expect(card.bottom, `${label} a folder`).toBeLessThanOrEqual(m.innerHeight + 0.5);
  expect(m.hiddenTiles, `${label} tiles hidden to make room`).toBe(0);
  // Nothing on the page sits under the gear, which is fixed over a corner.
  if (m.gear) {
    const under = (box) => box.right > m.gear.left && box.left < m.gear.right && box.bottom > m.gear.top && box.top < m.gear.bottom;
    for (const box of [...m.cards, ...(m.dock ? [m.dock] : [])]) expect(under(box), `${label} a folder under the gear`).toBe(false);
  }
}

/* Whether a zoom a step larger than the one the fit chose would still fit,
   laid out either way a narrow window can lay a board out: flowing at the
   held width, or stacked. Tried on the page's own compact values, then put
   back exactly. */
function largerFits(page, factor = 1.02) {
  return page.evaluate((factor) => {
    const fit = window.Nordlys.pageFit;
    const host = document.getElementById('page');
    const saved = Object.fromEntries(fit.written.map((name) => [name, host.style.getPropertyValue(name)]));
    const wide = host.hasAttribute('data-fit-wide');
    const boardWidth = document.getElementById('board').getBoundingClientRect().width;
    const target = document.documentElement.clientHeight - 1;
    const z = Math.min(1, fit.state.zoom * factor);
    const tried = {};
    host.classList.add('fit-measuring');
    for (const flow of ['wide', 'stacked']) {
      const values = { ...saved, '--fit-zoom': String(z) };
      delete values['--fit-board-w'];
      if (flow === 'wide') values['--fit-board-w'] = `${boardWidth / z}px`;
      fit.write(values, { wide: flow === 'wide' });
      window.Nordlys.grid.flowRows();
      tried[flow] = fit.need() <= target && document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth;
    }
    fit.write(saved, { wide });
    window.Nordlys.grid.flowRows();
    host.classList.remove('fit-measuring');
    return tried;
  }, factor);
}

/* ── Off: the page it always was ──────────────────────────────────── */
test.describe('switched off', () => {
  test.use({ nordlysBoard: withFit(NINE_FOLDERS, false), viewport: { width: 1440, height: 900 } });

  test('the surface draws no box, and taking it away moves nothing by a pixel', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.evaluate(() => document.fonts.ready);
    await settled(page);
    const wrapped = await measure(page);
    expect(wrapped.attribute).toBeNull();
    expect(wrapped.surfaceDisplay).toBe('contents');
    expect(wrapped.pageStyle).toBe('');
    expect(wrapped.state.stage).toBe('off');
    // The ordinary page is taller than this window, and still scrolls.
    expect(wrapped.scrollHeight).toBeGreaterThan(wrapped.clientHeight);
    const before = await page.screenshot({ mask: [page.locator('#clock'), page.locator('#bg-container')] });
    await page.evaluate(() => {
      const surface = document.getElementById('fit-surface');
      surface.replaceWith(...surface.childNodes);
    });
    await page.evaluate(() => window.Nordlys.grid.flowRows());
    const bare = await measure(page);
    expect(bare.parts).toEqual(wrapped.parts);
    expect(bare.cards).toEqual(wrapped.cards);
    expect(bare.scrollHeight).toBe(wrapped.scrollHeight);
    const after = await page.screenshot({ mask: [page.locator('#clock'), page.locator('#bg-container')] });
    expect(after.equals(before), 'the page looks exactly the same without the surface').toBe(true);
  });

  test('on and then off again leaves nothing behind', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page);
    const before = await measure(page);
    await page.evaluate(() => { window.Nordlys.config.onePageFit = true; window.Nordlys.pageFit.request({ now: true }); });
    const on = await measure(page);
    expect(on.state.stage).not.toBe('off');
    expectInside(on, 'on');
    await page.evaluate(() => { window.Nordlys.config.onePageFit = false; window.Nordlys.pageFit.request({ now: true }); });
    const off = await measure(page);
    expect(off.attribute).toBeNull();
    expect(off.pageStyle).toBe('');
    expect(off.parts).toEqual(before.parts);
    expect(off.cards).toEqual(before.cards);
    expect(await page.evaluate(() => document.getElementById('sugg').style.cssText)).toBe('');
  });
});

/* ── On: every window a person may have ──────────────────────────────
   Windows display scale and browser zoom both reach the page as a smaller
   window in CSS pixels at a higher device pixel ratio; each is reproduced
   that way. 1280×720 at 1.5 is a 1920×1080 screen at 150%, 960×540 at 2 is
   the same screen at 200% browser zoom, 720×450 at 2 is 1440×900 at 200%. */
const WINDOWS = [
  { name: '1920×1080 at 100%', viewport: { width: 1920, height: 1080 }, dpr: 1 },
  { name: '1920×1080 at 125% display scale', viewport: { width: 1536, height: 864 }, dpr: 1.25 },
  { name: '1920×1080 at 150% display scale', viewport: { width: 1280, height: 720 }, dpr: 1.5 },
  { name: '1920×1080 at 200% browser zoom', viewport: { width: 960, height: 540 }, dpr: 2 },
  { name: '1440×900 at 200% browser zoom', viewport: { width: 720, height: 450 }, dpr: 2 },
  { name: 'a phone', viewport: { width: 390, height: 844 }, dpr: 3 }
];
const BOARDS = [['nine folders', NINE_FOLDERS], ['a dense board', DENSE_BOARD]];

for (const win of WINDOWS) {
  for (const [boardName, board] of BOARDS) {
    test.describe(`${boardName} in ${win.name}`, () => {
      test.use({ nordlysBoard: withFit(board), viewport: win.viewport, deviceScaleFactor: win.dpr });
      test('everything is inside the window with nothing to scroll', async ({ nordlysPage }) => {
        const { page, runtimeErrors } = nordlysPage;
        await page.evaluate(() => document.fonts.ready);
        await settled(page, win.viewport.height);
        const m = await measure(page);
        expect(m.attribute).toBe('on');
        expectInside(m, win.name);
        const links = board.groups.filter((group) => !group.hidden).reduce((sum, group) => sum + group.links.length, 0);
        expect(m.tileCount).toBe(links);
        if (board === DENSE_BOARD) {
          expect(m.state.stage).toBe('scaled');
          expect(m.state.zoom).toBeLessThan(1);
          expect(m.parts.map((part) => part.id)).toContain('hiddenDock');
        }
        expect(runtimeErrors).toEqual([]);
      });
    });
  }
}

/* ── Compaction first, scale last ────────────────────────────────── */
test.describe('the gentlest stage that fits', () => {
  test.use({ nordlysBoard: withFit(NINE_FOLDERS), viewport: { width: 1440, height: 900 } });

  test('a board that nearly fits is only closed up, and the settings keep their values', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 900);
    const m = await measure(page);
    expect(m.state.stage).toBe('compact');
    expect(m.state.zoom).toBe(1);
    expectInside(m);
    // Nothing the fit borrowed was saved over what somebody chose.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')));
    expect(stored.tileSize ?? 78).toBe(78);
    expect(stored.cardGap ?? 12).toBe(12);
    expect(stored.boardGap).toBeUndefined();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tw'))).toContain('78px');
  });

  test('the drawer, the gear and dialogs are never scaled', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.setViewportSize({ width: 1024, height: 420 });
    await settled(page, 420);
    const m = await measure(page);
    expect(m.state.stage).toBe('scaled');
    const zooms = await page.evaluate(() => Object.fromEntries(['cfg', 'gear', 'toast-dock', 'quick-edit-modal', 'board'].map((id) => [id, document.getElementById(id)?.currentCSSZoom])));
    expect(zooms.board).toBeLessThan(1);
    for (const id of ['cfg', 'gear', 'toast-dock', 'quick-edit-modal']) expect(zooms[id], id).toBe(1);
    // A dialog opened over the fitted page scrolls inside itself, not the page.
    await page.locator('#board .tile').first().click({ button: 'right' });
    await page.locator('#tile-ctx-menu').getByRole('menuitem', { name: /Edit/ }).first().click();
    await expect(page.locator('#quick-edit-modal')).toBeVisible();
    const dialog = await page.evaluate(() => {
      const box = document.querySelector('#quick-edit-modal .quick-modal, #quick-edit-modal [role="dialog"], #quick-edit-modal')?.getBoundingClientRect();
      return { bottom: box.bottom, top: box.top, scroll: document.scrollingElement.scrollHeight, client: document.scrollingElement.clientHeight };
    });
    expect(dialog.scroll).toBeLessThanOrEqual(dialog.client);
  });
});

/* ── A window that changes ───────────────────────────────────────── */
test.describe('live', () => {
  test.use({ nordlysBoard: withFit(NINE_FOLDERS), viewport: { width: 1440, height: 900 } });

  test('a window made shorter and taller again refits each time, and focus stays put', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 900);
    const tile = page.locator('#board .tile').nth(3);
    await tile.focus();
    const name = await tile.getAttribute('href');
    for (const [width, height] of [[1280, 640], [1100, 520], [800, 600], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await settled(page, height);
      expectInside(await measure(page), `${width}x${height}`);
      expect(await page.evaluate(() => document.activeElement?.getAttribute('href'))).toBe(name);
    }
    const back = await measure(page);
    expect(back.state.stage).toBe('compact');
  });

  test('a burst of resizes is one pass, and an idle page measures nothing', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 900);
    const passes = await page.evaluate(async () => {
      const fit = window.Nordlys.pageFit;
      let count = 0;
      const original = fit.fit.bind(fit);
      fit.fit = () => { count++; original(); };
      for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event('resize'));
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const burst = count;
      const trials = fit.trials;
      await new Promise((done) => setTimeout(done, 1200));
      fit.fit = original;
      return { burst, idleTrials: fit.trials - trials, idlePasses: count - burst };
    });
    expect(passes.burst).toBe(1);
    expect(passes.idleTrials).toBe(0);
    expect(passes.idlePasses).toBe(0);
  });

  test('a new folder, a setting and a board from another tab are all refitted', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 900);
    // A new folder full of bookmarks.
    await page.evaluate(() => {
      const app = window.Nordlys;
      app.config.groups.push({ label: 'More', cols: 4, links: Array.from({ length: 16 }, (_, i) => ({ name: `More ${i}`, url: `https://more-${i}.example/` })) });
      app.saveConfig();
      app.grid.render();
    });
    await settled(page, 900);
    expectInside(await measure(page), 'after a new folder');
    // Bigger bookmarks, as the size slider sets them.
    await page.evaluate(() => { window.Nordlys.config.tileSize = 110; window.Nordlys.applyGeometryTokens(); });
    await settled(page, 900);
    expectInside(await measure(page), 'after a bigger tile size');
    expect(await page.evaluate(() => window.Nordlys.config.tileSize)).toBe(110);
    // Another tab turns the fit off: this one adopts it and is the ordinary page.
    await page.evaluate(() => {
      const next = { ...JSON.parse(localStorage.getItem('nordlys_config')), onePageFit: false };
      localStorage.setItem('nordlys_config', JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: 'nordlys_config', newValue: JSON.stringify(next) }));
    });
    await page.waitForFunction(() => window.Nordlys.pageFit.state.stage === 'off');
    const off = await measure(page);
    expect(off.attribute).toBeNull();
    expect(off.scrollHeight).toBeGreaterThan(off.clientHeight);
    // …and back on.
    await page.evaluate(() => {
      const next = { ...JSON.parse(localStorage.getItem('nordlys_config')), onePageFit: true };
      localStorage.setItem('nordlys_config', JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: 'nordlys_config', newValue: JSON.stringify(next) }));
    });
    await page.waitForFunction(() => window.Nordlys.pageFit.state.stage !== 'off');
    await settled(page, 900);
    expectInside(await measure(page), 'adopted from another tab');
  });
});

/* ── The switch ──────────────────────────────────────────────────── */
test.describe('the switch in Settings', () => {
  test.use({ nordlysBoard: NINE_FOLDERS, viewport: { width: 1440, height: 900 } });

  test('is named, explained, next to the layouts, and saved', async ({ nordlysPage }) => {
    const { page, storageState } = nordlysPage;
    await page.locator('#gear').click();
    await page.getByRole('tab', { name: 'Bookmarks' }).click();
    const toggle = page.getByRole('checkbox', { name: 'One page fit' });
    // The switch is drawn by its label; the checkbox itself is the accessible part.
    await expect(page.locator('#page-fit-label')).toBeVisible();
    await expect(page.locator('label.tg:has(#cfg-one-page-fit)')).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toHaveAccessibleDescription(/nothing to scroll.*Not the same as Fitted/);
    // In the same block as the Natural and Fitted choices it is easy to mistake it for.
    expect(await page.evaluate(() => Boolean(document.getElementById('cfg-one-page-fit').closest('.board-layout-block')?.querySelector('.board-layout-option[data-layout="fitted"]')))).toBe(true);
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await settled(page, 900);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).onePageFit)).toBe(true);
    expect(storageState.nordlys_config?.onePageFit).toBe(true);
    await expect(page.locator('#page-fit-state')).toHaveText('Spacing and bookmarks are closed up to fit this window.');
    // Said once as it is turned on, and part of what the switch describes.
    await expect(page.locator('#nl-live-region')).toHaveText('Spacing and bookmarks are closed up to fit this window.');
    await expect(toggle).toHaveAccessibleDescription(/^Spacing and bookmarks are closed up to fit this window\. Keeps the clock/);
    // A window made smaller changes the line and the description, and says nothing.
    await page.setViewportSize({ width: 1440, height: 420 });
    await settled(page, 420);
    await expect(page.locator('#page-fit-state')).toHaveText(/^Shown at \d+% to fit this window\.$/);
    await expect(toggle).toHaveAccessibleDescription(/^Shown at \d+% to fit this window\. Keeps the clock/);
    await expect(page.locator('#nl-live-region')).toHaveText('Spacing and bookmarks are closed up to fit this window.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page, 900);
    // The drawer stayed at its own size over the fitted page.
    expect(await page.evaluate(() => document.getElementById('cfg').currentCSSZoom)).toBe(1);
    await page.keyboard.press('Escape');
    expectInside(await measure(page), 'after turning it on');

    // A new tab opens already laid out for the fit, before any script but the first.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') window.__firstFrameFit = document.documentElement.getAttribute('data-page-fit');
      });
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
    expect(await page.evaluate(() => window.__firstFrameFit)).toBe('on');
    await settled(page, 900);
    expectInside(await measure(page), 'after a reload');
    await page.locator('#gear').click();
    await page.getByRole('tab', { name: 'Bookmarks' }).click();
    await expect(page.getByRole('checkbox', { name: 'One page fit' })).toBeChecked();
  });

  test('says so when the board is shown smaller, in the language of the page', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await page.setViewportSize({ width: 900, height: 380 });
    await page.evaluate(() => { window.Nordlys.config.onePageFit = true; window.Nordlys.pageFit.request({ now: true }); window.Nordlys.settings.syncPageFit(); });
    await settled(page, 380);
    const zoom = await page.evaluate(() => window.Nordlys.pageFit.state.zoom);
    expect(zoom).toBeLessThan(1);
    await expect(page.locator('#page-fit-state')).toHaveText(`Shown at ${Math.round(zoom * 100)}% to fit this window.`);
    await page.evaluate(() => window.I18N.setLanguage('de'));
    await expect(page.locator('#page-fit-state')).toHaveText(`Auf ${Math.round(zoom * 100)} % verkleinert, damit alles in dieses Fenster passt.`);
    await expect(page.locator('#page-fit-label')).toHaveText('Alles auf einer Seite');
  });
});

/* ── Search ──────────────────────────────────────────────────────── */
test.describe('search', () => {
  test.use({ nordlysBoard: withFit(DENSE_BOARD), viewport: { width: 1280, height: 560 } });

  test('suggestions open inside the window and scroll inside themselves', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 560);
    await page.locator('#q').fill('Site 1');
    await expect(page.locator('#sugg.on')).toBeVisible();
    const box = await page.evaluate(() => {
      const list = document.getElementById('sugg');
      const rect = list.getBoundingClientRect();
      return { bottom: rect.bottom, scroll: document.scrollingElement.scrollHeight, client: document.scrollingElement.clientHeight, overflowY: getComputedStyle(list).overflowY, rows: list.children.length };
    });
    expect(box.rows).toBeGreaterThan(0);
    expect(box.bottom).toBeLessThanOrEqual(560);
    expect(box.scroll).toBeLessThanOrEqual(box.client);
    expect(box.overflowY).toBe('auto');
    // The arrow keys keep the chosen row in view inside the list.
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
    const chosen = await page.evaluate(() => {
      const list = document.getElementById('sugg');
      const row = list.querySelector('.sel');
      if (!row) return null;
      const a = row.getBoundingClientRect();
      const b = list.getBoundingClientRect();
      return { inside: a.top >= b.top - 1 && a.bottom <= b.bottom + 1, scroll: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight };
    });
    if (chosen) expect(chosen).toEqual({ inside: true, scroll: true });
    await page.keyboard.press('Escape');
  });
});

/* ── Drag and Arrange ────────────────────────────────────────────── */
test.describe('drag and arrange', () => {
  test.use({ nordlysBoard: withFit(NINE_FOLDERS), viewport: { width: 1200, height: 460 } });

  test('a bookmark carried across a zoomed board is the size it was and lands where it is dropped', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 460);
    const zoom = await page.evaluate(() => window.Nordlys.pageFit.state.zoom);
    expect(zoom).toBeLessThan(1);
    const from = page.locator('.card', { has: page.locator('.cat b', { hasText: 'Watch' }) }).locator('.tile').first();
    const to = page.locator('.card', { has: page.locator('.cat b', { hasText: 'Work' }) }).locator('.tile').last();
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 3);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 3 + 12, { steps: 3 });
    const lift = await page.locator('.drag-lift').boundingBox();
    // In hand it is the size it was on the board, under the pointer.
    expect(Math.abs(lift.width - start.width)).toBeLessThan(2);
    expect(Math.abs(lift.height - start.height)).toBeLessThan(2);
    expect(Math.abs(lift.x - (start.x + 12))).toBeLessThan(2);
    await page.mouse.move(end.x + end.width * 0.8, end.y + end.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const folders = await page.evaluate(() => window.Nordlys.config.groups.map((group) => ({ label: group.label, links: group.links.map((l) => l.name) })));
    expect(folders.find((f) => f.label === 'Watch').links).not.toContain('YouTube');
    expect(folders.find((f) => f.label === 'Work').links).toContain('YouTube');
    await settled(page, 460);
    expectInside(await measure(page), 'after the drop');
  });

  test('arranging stands the fit down, and Done brings it back', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 460);
    await page.evaluate(() => window.Nordlys.grid.arrange.enter());
    await expect(page.locator('body')).toHaveClass(/arranging/);
    const arranging = await measure(page);
    expect(arranging.attribute).toBeNull();
    expect(arranging.pageStyle).toBe('');
    expect(await page.evaluate(() => document.getElementById('board').currentCSSZoom)).toBe(1);
    await page.locator('#arrange-done').click();
    await settled(page, 460);
    const back = await measure(page);
    expect(back.attribute).toBe('on');
    expectInside(back, 'after Done');
  });

  test('a folder carried on the zoomed board moves in the order it was dropped', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 460);
    const card = (name) => page.locator('.card', { has: page.locator('.cat b', { hasText: name }) });
    const order = () => page.evaluate(() => [...document.querySelectorAll('#board .card .cat b')].map((b) => b.textContent));
    const before = await order();
    const grip = await card('Misc').locator('.cat b').boundingBox();
    const target = await card('Watch').boundingBox();
    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 20, grip.y + 20, { steps: 3 });
    await page.mouse.move(target.x + 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const after = await order();
    expect(after).not.toEqual(before);
    expect(after.indexOf('Misc')).toBeLessThan(after.indexOf('Watch'));
    await settled(page, 460);
    expectInside(await measure(page), 'after moving a folder');
  });
});

/* ── Reduced motion ──────────────────────────────────────────────── */
test.describe('reduced motion', () => {
  test.use({ nordlysBoard: withFit(DEMO_BOARD), viewport: { width: 1280, height: 600 }, reducedMotion: 'reduce' });

  test('fits the same, with nothing animated to get there', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 600);
    expectInside(await measure(page));
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('#fit-surface')).length);
    expect(running).toBe(0);
  });
});

/* A pass from the unfitted page, as a new tab pays for it when nothing is
   remembered for its window. Fonts are loaded first, so the answer is the
   one the finished page gets. */
async function coldFit(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const fit = window.Nordlys.pageFit;
    localStorage.removeItem(window.NordlysPageFit.HINT_STORE);
    fit.remembered = null;
    fit.clear();
    fit.state = { stage: 'off', t: 0, zoom: 1 };
    const trials = fit.trials;
    fit.request({ now: true });
    return { ...fit.state, trials: fit.trials - trials };
  });
}

/* ── A narrow window: the largest zoom that fits ──────────────────────
   Below 860px the stylesheet stacks folders. Zoomed, a stack is wider in
   its own lengths and shorter than it measured, and a board can also flow
   as it does on a desktop; the zoom may not stop at either's first guess.
   The search ends within its tolerance (2% of the height), so "a step
   larger" is 3%. */
for (const [boardName, board] of [['the demo board', DEMO_BOARD], ['nine folders', NINE_FOLDERS]]) {
  test.describe(`${boardName} in a 640×630 window`, () => {
    test.use({ nordlysBoard: withFit(board), viewport: { width: 640, height: 630 } });

    test('is shown at the largest zoom that fits, with nothing to scroll', async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await settled(page, 630);
      const state = await coldFit(page);
      expect(state.stage).toBe('scaled');
      expectInside(await measure(page), '640×630');
      expect(await largerFits(page, 1.03), 'a zoom a step larger').toEqual({ wide: false, stacked: false });
      expectInside(await measure(page), 'put back');
    });
  });
}

test.describe('a stacking window that a stack still fits', () => {
  test.use({ nordlysBoard: withFit(DEMO_BOARD), viewport: { width: 480, height: 800 } });

  test('keeps the stack, at the largest zoom it fits', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 800);
    const state = await coldFit(page);
    expect(state.stage).toBe('scaled');
    expect(await page.evaluate(() => document.getElementById('page').hasAttribute('data-fit-wide')), 'folders stacked, one to a line').toBe(false);
    expectInside(await measure(page), '480×800');
    expect((await largerFits(page, 1.03)).stacked, 'a stack a step larger').toBe(false);
  });
});

/* ── A new tab ───────────────────────────────────────────────────────
   Every new tab used to search from nothing. The answer this window and
   board settled on is kept aside, worn from the first layout and confirmed
   by one measurement. */
test.describe('a new tab', () => {
  test.use({ nordlysBoard: withFit(NINE_FOLDERS), viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });

  // The first frames that have folders on them, as each is about to be painted.
  const watchFirstFrames = (page) => page.addInitScript(() => {
    window.__frames = [];
    const look = () => {
      if (document.querySelector('#board .card')) {
        const host = document.getElementById('page');
        window.__frames.push({ stage: host.getAttribute('data-fit-stage'), zoom: host.style.getPropertyValue('--fit-zoom'), scrolls: document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight });
      }
      if (window.__frames.length < 3) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });

  test('wears what this window settled on last time, from the first frame, for one layout', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 540);
    const before = await coldFit(page);
    expect(before.stage).toBe('scaled');
    expect(before.trials).toBeGreaterThan(1);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_fit_hint')));
    expect(stored).toHaveLength(1);
    // The page's own custom properties, never the settings.
    expect(Object.keys(stored[0].values).every((name) => name.startsWith('--'))).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nordlys_config')).tileSize)).toBeUndefined();

    /* Whether the bundled faces have loaded by a new tab's first pass
       varies, and a tab whose page is not the one remembered searches and
       leaves its own answer; so within a tab or two, one opens on exactly
       the page it has. Every one is fitted from its first frame. */
    await watchFirstFrames(page);
    const opens = [];
    for (let i = 0; i < 3 && !opens.some((open) => open.opened.hint === 'used'); i++) {
      await page.reload();
      await page.waitForFunction(() => Boolean(window.Nordlys?.pageFit?.opened) && window.__frames.length > 0);
      const open = await page.evaluate(() => ({ opened: window.Nordlys.pageFit.opened, first: window.__frames[0] }));
      // Never a frame of the unfitted board, or of another zoom than the first pass wore.
      expect(open.first).toEqual({ stage: 'scaled', zoom: String(open.opened.zoom), scrolls: false });
      opens.push(open);
      await settled(page, 540);
      expectInside(await measure(page), `reopened ${i + 1}`);
    }
    const used = opens.find((open) => open.opened.hint === 'used');
    expect(used?.opened, JSON.stringify(opens.map((open) => open.opened))).toMatchObject({ hint: 'used', trials: 1, stage: 'scaled' });
    expect(Math.abs(used.opened.zoom - before.zoom)).toBeLessThan(0.03);
  });

  test('drops an answer that no longer fits, and one for another board is never used', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 540);
    const before = await coldFit(page);
    // A tab opens, so there is an answer for a new tab's first pass too.
    await page.reload();
    await settled(page, 540);
    // What was remembered is out of date: a zoom this window cannot take.
    await page.evaluate(() => {
      const hints = JSON.parse(localStorage.getItem('nordlys_fit_hint'));
      for (const hint of hints) {
        Object.assign(hint, { zoom: 0.97, need: 900 });
        hint.values['--fit-zoom'] = '0.97';
      }
      localStorage.setItem('nordlys_fit_hint', JSON.stringify(hints));
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.pageFit?.opened));
    expect(await page.evaluate(() => window.Nordlys.pageFit.opened.hint)).toBe('stale');
    await settled(page, 540);
    expectInside(await measure(page), 'after a stale answer');
    expect((await coldFit(page)).zoom).toBe(before.zoom);

    // Another folder: the remembered answer belongs to a different board.
    await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('nordlys_config'));
      config.groups.push({ label: 'More', cols: 2, links: [{ name: 'More', url: 'https://more.example/' }] });
      localStorage.setItem('nordlys_config', JSON.stringify(config));
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(window.Nordlys?.pageFit?.opened));
    expect(await page.evaluate(() => window.Nordlys.pageFit.opened.hint)).toBe('none');
    await settled(page, 540);
    expectInside(await measure(page), 'another board');
  });
});

/* ── The gear ─────────────────────────────────────────────────────────
   Fixed over the bottom right corner, over whatever the board puts there.
   Fitted runs every line edge to edge, so its last line always reaches
   under it. A fit used to keep only the page's own bottom padding (32px in
   these windows), less than the 68px the gear needs. */
for (const [stage, height] of [['compact', 800], ['scaled', 560]]) {
  test.describe(`a Fitted board under the gear, ${stage}`, () => {
    test.use({ nordlysBoard: withFit({ ...NINE_FOLDERS, boardLayout: 'fitted' }), viewport: { width: 1440, height } });

    test('keeps its last folders clear of it', async ({ nordlysPage }) => {
      const { page } = nordlysPage;
      await settled(page, height);
      const m = await measure(page);
      expect(m.state.stage).toBe(stage);
      expect(m.gear).not.toBeNull();
      // The board does reach under it, so this is the case that matters.
      expect(Math.max(...m.cards.map((card) => card.right))).toBeGreaterThan(m.gear.left);
      expectInside(m, 'under the gear');
    });
  });
}

/* ── A folder lifted off a zoomed narrow board ───────────────────────
   A phone gives every folder's bookmarks as many columns as fit its full
   width (components.css, max-width: 480px). A board zoomed and laid out
   wide keeps each folder's own columns, and so must the copy in hand —
   which shows where a folder is wider than its columns, as a long name
   makes it. */
const LONG_NAME = { ...NINE_FOLDERS, groups: [...NINE_FOLDERS.groups, { label: 'Reading for the weekend', cols: 2, links: ['A', 'B', 'C', 'D'].map((name) => link(name, 'https://' + name.toLowerCase() + '.example/')) }] };
test.describe('a folder lifted on a phone', () => {
  test.use({ nordlysBoard: withFit(LONG_NAME), viewport: { width: 390, height: 844 } });

  test('keeps the columns and the size it had on the board', async ({ nordlysPage }) => {
    const { page } = nordlysPage;
    await settled(page, 844);
    expect(await page.evaluate(() => document.getElementById('page').hasAttribute('data-fit-wide'))).toBe(true);
    // Layout lengths, which the lift's tilt and lift in hand do not change.
    const shape = (selector) => page.evaluate((selector) => {
      const card = document.querySelector(selector);
      const grid = card.querySelector('.grid');
      const box = card.getBoundingClientRect();
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        gridHeight: grid.offsetHeight,
        width: box.width, height: box.height,
        overflow: card.scrollHeight - card.clientHeight
      };
    }, selector);
    const folder = '#board .card[data-group-idx="9"]';
    const before = await shape(folder);
    expect(before.columns).toBe(2);
    const grip = await page.locator(`${folder} .cat b`).boundingBox();
    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 24, grip.y + grip.height / 2 + 10, { steps: 4 });
    await expect(page.locator('.drag-lift > .card')).toBeVisible();
    const lifted = await shape('.drag-lift > .card');
    expect({ columns: lifted.columns, gridHeight: lifted.gridHeight }).toEqual({ columns: before.columns, gridHeight: before.gridHeight });
    expect(lifted.overflow, 'nothing spills out of the folder in hand').toBeLessThanOrEqual(1);
    // Scaled up a touch in hand (the lift's own 1.02), never reflowed.
    expect(Math.abs(lifted.width / before.width - 1)).toBeLessThan(0.05);
    expect(Math.abs(lifted.height / before.height - 1)).toBeLessThan(0.05);
    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('.drag-lift')).toHaveCount(0);
    await settled(page, 844);
    expectInside(await measure(page), 'after the lift');
  });
});
