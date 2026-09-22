const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('../helpers/nordlys-fixture.cjs');

/* The first ninety seconds used to belong to a stranger: a new install opened on
   five folders and twenty-two links the author had chosen, two of them the
   student portals of one German university. Everything below describes what
   arrives instead — an empty board that says why it is empty and offers the two
   ways in — and, at the bottom, the thing that change must never touch: a board
   somebody already has.

   No board is installed for these specs: this is the page exactly as it opens
   on a machine that has never run it. */
test.use({ nordlysBoard: null });

const EMPTY = '#board .board-empty';

test('a new install opens on a board with nothing on it', async ({ nordlysPage }) => {
  const { page, runtimeErrors } = nordlysPage;

  await expect(page.locator('#board .card')).toHaveCount(0);
  await expect(page.locator('#board .tile')).toHaveCount(0);
  await expect(page.locator('#hiddenDock')).toBeHidden();

  /* Not one address on the page itself — the promise, checked against what is
     rendered rather than against the source. Scoped to the canvas: the colophon
     in Settings links to the source and the privacy note on purpose, and those
     are the product talking about itself, not somebody's bookmarks. */
  const links = await page.evaluate(() => [...document.querySelectorAll('#page a[href]')].map(node => node.href));
  expect(links, 'a fresh install still ships somebody else\'s bookmarks').toEqual([]);
  expect(await page.evaluate(() => window.Nordlys.config.groups)).toEqual([]);
  expect(runtimeErrors, 'the first open must be quiet').toEqual([]);
});

test('the empty board is an invitation, and says what to do with it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const empty = page.locator(EMPTY);
  await expect(empty).toBeVisible();

  await expect(empty.locator('h2')).toHaveText('Make this space yours');
  await expect(empty.locator('.board-empty-text')).not.toBeEmpty();

  // A way to start clean and ways to arrive with what you already have: the
  // browser's own bookmarks where it can hand them over — first, because that
  // is where they already are — or a file. Nothing else.
  const ways = (await empty.getByRole('button').evaluateAll(nodes => nodes.map(node => node.id)));
  expect(ways.filter(id => id !== 'board-empty-browser')).toEqual(['board-empty-create', 'board-empty-import']);
  if (ways.includes('board-empty-browser')) expect(ways[0]).toBe('board-empty-browser');
  await expect(page.locator('#board-empty-create')).toBeVisible();
  await expect(page.locator('#board-empty-import')).toBeVisible();

  /* No sample links behind a button either. The promise is not "we hid the
     defaults", it is that there are none. */
  await expect(empty.locator('a')).toHaveCount(0);

  const copy = await empty.evaluate(node => node.textContent);
  expect(copy, 'the empty state must not carry emoji').not.toMatch(/\p{Extended_Pictographic}/u);
});

test('the first folder is made by the button that offers it', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.locator('#board-empty-create').click();

  await expect(page.locator('#board .card')).toHaveCount(1);
  await expect(page.locator(EMPTY), 'the invitation clears once there is a board').toHaveCount(0);
  await expect.poll(() => nordlysPage.storageState.nordlys_config?.groups?.length,
    'and the folder is kept').toBe(1);
  // Created through the same path the settings drawer uses, so the folder the
  // board made is the folder the manager lists.
  await page.locator('#gear').click();
  await page.locator('#settings-tab-bookmarks').click();
  await expect(page.locator('.bookmark-folder-accordion')).toHaveCount(1);
});

/* The import the empty state offers is the import the Backup tab already owns.
   It is asked for by name — one controller method — rather than by reaching
   across a closed drawer to click a hidden file input. */
test('the second way in opens the import the Backup tab already has', async ({ nordlysPage }) => {
  const { page } = nordlysPage;

  const chooser = page.waitForEvent('filechooser');
  await page.locator('#board-empty-import').click();
  expect((await chooser).element(), 'the picker raised is the universal import input')
    .toBeTruthy();

  // And it leaves the user standing where importing lives, not somewhere they
  // then have to find their way out of.
  await expect(page.locator('#sec-backup')).toBeVisible();
  await expect(page.locator('#settings-tab-backup')).toHaveAttribute('aria-selected', 'true');

  const loaded = page.waitForEvent('load');
  await page.locator('#cfg-import-universal').setInputFiles({
    name: 'nordlys-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      theme: 'aurora-void',
      groups: [{ label: 'BROUGHT WITH ME', cols: 2, hidden: false, links: [
        { name: 'Mine', url: 'https://example.test/', icon: 'globe', color: '#7c9cff' }
      ] }]
    }))
  });
  await loaded;
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator('#board .cat b').first()).toHaveText('BROUGHT WITH ME');
});

/* Local-first is a claim the product can keep checkable. On the open that has
   the least reason to be trusted — the very first one — nothing is fetched,
   nothing is asked for, and the browser's own bookmarks are not read. */
test('the first open reaches for nothing: no network, no permission, no bookmarks', async ({ nordlysPage }) => {
  const { page, origin } = nordlysPage;

  await page.addInitScript(() => {
    window.__probe = { permissionRequests: 0, bookmarkReads: 0 };
    const permissions = window.chrome.permissions;
    const bookmarks = window.chrome.bookmarks;
    const request = permissions.request.bind(permissions);
    const getTree = bookmarks.getTree.bind(bookmarks);
    const getChildren = bookmarks.getChildren.bind(bookmarks);
    permissions.request = (...args) => { window.__probe.permissionRequests++; return request(...args); };
    bookmarks.getTree = (...args) => { window.__probe.bookmarkReads++; return getTree(...args); };
    bookmarks.getChildren = (...args) => { window.__probe.bookmarkReads++; return getChildren(...args); };
  });

  const offsite = [];
  page.on('request', request => { if (!request.url().startsWith(origin)) offsite.push(request.url()); });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await expect(page.locator(EMPTY)).toBeVisible();
  await page.waitForTimeout(500);

  expect(offsite, 'the first open must not touch the network').toEqual([]);
  expect(await page.evaluate(() => window.__probe)).toEqual({ permissionRequests: 0, bookmarkReads: 0 });
});

test('every locale gets the invitation in its own words', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  const keys = ['board.emptyTitle', 'board.empty', 'board.emptyCreate', 'board.emptyImport'];

  for (const locale of ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh', 'tr']) {
    await page.evaluate(code => window.I18N.setLanguage(code), locale);
    const rendered = await page.evaluate(() => ({
      title: document.querySelector('#board .board-empty h2')?.textContent.trim(),
      line: document.querySelector('#board .board-empty-text')?.textContent.trim(),
      create: document.getElementById('board-empty-create')?.textContent.trim(),
      restore: document.getElementById('board-empty-import')?.textContent.trim()
    }));
    const expected = await page.evaluate(([code, list]) =>
      list.map(key => window.I18N.translations[code][key]), [locale, keys]);

    expect(expected.every(text => typeof text === 'string' && text.trim()),
      `${locale} is missing one of ${keys.join(', ')}`).toBe(true);
    expect([rendered.title, rendered.line, rendered.create, rendered.restore],
      `${locale} renders something other than its own strings`).toEqual(expected);
    expect(keys.includes(rendered.title), `${locale} leaked a raw key`).toBe(false);
  }
});

test('the invitation is reachable, focusable and fits 320px', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator(EMPTY)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    'the empty state must not widen the page at 320px').toBeLessThanOrEqual(0);

  // Both actions carry the 40px hit area the rest of the product keeps.
  const boxes = await page.locator(`${EMPTY} button`).evaluateAll(nodes =>
    nodes.map(node => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }));
  expect(boxes.every(([width, height]) => width >= 40 && height >= 40), `undersized: ${JSON.stringify(boxes)}`).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  const reached = [];
  for (let press = 0; press < 12 && reached.length < 2; press++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.id);
    if (['board-empty-create', 'board-empty-import'].includes(id) && !reached.includes(id)) reached.push(id);
  }
  expect(reached.sort(), 'both actions must be reachable by keyboard').toEqual(['board-empty-create', 'board-empty-import']);

  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement);
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== 'none';
  });
  expect(ring, 'the focused action shows no focus').toBe(true);
});

test('the first-run board has no serious or critical Axe violations', async ({ nordlysPage }) => {
  const results = await new AxeBuilder({ page: nordlysPage.page }).include('#page').analyze();
  const high = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  expect(high, high.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
});

/* ── The other half of the change ──────────────────────────────────────────
   Emptying the defaults must reach exactly nobody who already has a board.
   The config below is what every 2.2.3 install has in localStorage right now:
   five folders, twenty-two links, written by the release this one replaces.
   It has to come back out of the page identical — same order, same fields,
   same values — and no new default may be merged into it. */
const LEGACY_BOARD = {
  version: '2.2.3',
  theme: 'aurora-void',
  colorMode: 'dark',
  bgMode: 'aurora',
  groups: [
    { label: 'Daily', cols: 4, hidden: false, links: [
      { name: 'YouTube', url: 'https://www.youtube.com/', color: '#ff6b6b', icon: 'youtube' },
      { name: 'Notion', url: 'https://www.notion.so/', color: '#f8f9fa', icon: 'notion' },
      { name: 'ChatGPT', url: 'https://chatgpt.com/', color: '#10a37f', icon: 'openai' },
      { name: 'Reddit', url: 'https://www.reddit.com/', color: '#ff8c42', icon: 'reddit' },
      { name: 'DeepL', url: 'https://www.deepl.com/translator', color: '#4d96ff', icon: 'deepl' },
      { name: 'Spotify', url: 'https://open.spotify.com/', color: '#1db954', icon: 'spotify' },
      { name: 'Telegram', url: 'https://web.telegram.org/a/', color: '#29b6f6', icon: 'telegram' },
      { name: 'Netflix', url: 'https://www.netflix.com/', color: '#e50914', icon: 'netflix' }
    ] },
    { label: 'Dev & tech', cols: 3, hidden: false, links: [
      { name: 'GitHub', url: 'https://github.com/', color: '#9aa5b1', icon: 'github' },
      { name: 'LeetCode', url: 'https://leetcode.com/', color: '#ffa116', icon: 'leetcode' },
      { name: 'Gemini', url: 'https://gemini.google.com/app', color: '#8ab4f8', icon: 'gemini' },
      { name: 'Perplexity', url: 'https://www.perplexity.ai/', color: '#22b8cd', icon: 'perplexity' },
      { name: 'Deep-ML', url: 'https://www.deep-ml.com/', color: '#d946ef', icon: 'brain' },
      { name: 'VIA Keymap', url: 'https://usevia.app/', color: '#06b6d4', icon: 'keyboard' }
    ] },
    { label: 'Studies', cols: 2, hidden: false, links: [
      { name: 'Moodle', url: 'https://moodle.example.edu/my/', color: '#f97316', icon: 'school' },
      { name: 'Portal', url: 'https://portal.example.edu/', color: '#84cc16', icon: 'school' }
    ] },
    { label: 'Gaming & sim', cols: 2, hidden: false, links: [
      { name: 'Steam', url: 'https://store.steampowered.com/', color: '#66c0f4', icon: 'steam' },
      { name: 'GG.deals', url: 'https://gg.deals/', color: '#a855f7', icon: 'tag' },
      { name: 'LFM Sim', url: 'https://lowfuelmotorsport.com/', color: '#ef4444', icon: 'flag' },
      { name: 'RaceControl', url: 'https://game.racecontrol.gg/', color: '#38bdf8', icon: 'steering' }
    ] },
    { label: 'Shopping', cols: 2, hidden: false, links: [
      { name: 'AliExpress', url: 'https://www.aliexpress.com/', color: '#ff4747', icon: 'bag' },
      { name: 'Kleinanzeigen', url: 'https://www.kleinanzeigen.de/', color: '#86efac', icon: 'bag' }
    ] }
  ]
};

test('a board from before the change survives it untouched', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(stored => {
    localStorage.removeItem('nordlys_restore_point');
    localStorage.setItem('nordlys_config', JSON.stringify(stored));
  }, LEGACY_BOARD);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));

  const live = await page.evaluate(() => window.Nordlys.config.groups);
  expect(live, 'the empty defaults replaced an existing board').toEqual(LEGACY_BOARD.groups);
  expect(JSON.stringify(live), 'kept verbatim, field for field').toBe(JSON.stringify(LEGACY_BOARD.groups));
  expect(live.reduce((total, group) => total + group.links.length, 0)).toBe(22);

  // On screen as well as in memory, and with no invitation over the top of it.
  await expect(page.locator('#board .card')).toHaveCount(5);
  await expect(page.locator('#board .tile')).toHaveCount(22);
  await expect(page.locator(EMPTY)).toHaveCount(0);

  // Nothing was rewritten on the way through, so nothing was migrated.
  expect(await page.evaluate(() => localStorage.getItem('nordlys_config')))
    .toBe(JSON.stringify(LEGACY_BOARD));
  expect(await page.evaluate(() => localStorage.getItem('nordlys_restore_point')),
    'an unchanged load must not spend the restore point').toBeNull();
});

/* Where the browser can hand its bookmarks over, the empty board offers that
   first: the bar and each of its folders, as folders that follow the browser.
   The permission is asked on the click, never on install. */
test('the empty board brings the browser bookmarks bar in, one click, one undo', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.addInitScript(() => {
    const tree = [{ id: '0', title: '', children: [
      { id: '1', title: 'Bookmarks bar', children: [
        { id: '10', title: 'Mail', url: 'https://mail.example/' },
        { id: '11', title: 'Work', children: [
          { id: '110', title: 'GitHub', url: 'https://github.com/' },
          { id: '111', title: 'Linear', url: 'https://linear.app/' }
        ] },
        { id: '12', title: 'Empty', children: [] }
      ] },
      { id: '2', title: 'Other bookmarks', children: [{ id: '20', title: 'Elsewhere', url: 'https://elsewhere.example/' }] }
    ] }];
    const find = (nodes, id) => { for (const node of nodes) { if (node.id === id) return node; const inner = node.children && find(node.children, id); if (inner) return inner; } return null; };
    window.__asked = 0;
    window.chrome.permissions = { contains: (p, done) => done(false), request: (p, done) => { window.__asked++; done(true); } };
    window.chrome.bookmarks = { getTree: done => done(tree), getChildren: (id, done) => done(find(tree, id)?.children || []) };
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  expect(await page.evaluate(() => window.__asked), 'nothing asked at open').toBe(0);

  const bring = page.locator('#board-empty-browser');
  await expect(bring).toBeVisible();
  await expect(bring).toHaveClass(/accent/);
  await bring.click();
  await expect(page.locator('#board .card')).toHaveCount(2);
  expect(await page.evaluate(() => window.__asked)).toBe(1);
  const groups = await page.evaluate(() => window.Nordlys.config.groups.map(group => ({ label: group.label, follows: group.source?.folderId, links: group.links.map(link => link.name) })));
  expect(groups).toEqual([
    { label: 'Bookmarks bar', follows: '1', links: ['Mail'] },
    { label: 'Work', follows: '11', links: ['GitHub', 'Linear'] }
  ]);
  await expect(page.locator('#toast-dock .toast')).toContainText('2 folders and 3 bookmarks');

  await page.locator('#toast-dock .toast-action').click();
  await expect(page.locator('#board .card')).toHaveCount(0);
  await expect(page.locator('#board-empty-browser')).toBeVisible();
});
