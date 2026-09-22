/* Measured contrast, not declared contrast.

   Axe reads a colour pair out of CSS, and on this page the CSS pair is rarely
   the pair a reader sees: text sits on glass that is translucent and blurred,
   over a canvas that a scene paints and a colour mood tints. So Axe marks most
   of the page "incomplete" and the rest is measured against a background that
   is not there.

   This sweep photographs the page twice — once as it is, once with every
   glyph made transparent — and measures each run of text against the pixels
   that were actually behind it. Two numbers per run:

     nominal   the text's computed colour composited over the real background,
               taken at the worst 5 % of the pixels under the run. This is the
               WCAG figure, and the one the gate uses.
     rendered  what the glyphs actually came out as, against the same pixels.
               A thin face at a small size never reaches its nominal colour,
               so this is where a font choice shows up as a legibility problem.

   Usage:
     npm run qa:contrast                              every theme, scene and mood
     node tools/qa-contrast.cjs --themes=nord-frost --surfaces=home,settings
     node tools/qa-contrast.cjs --surfaces=fonts      every face on every theme
     node tools/qa-contrast.cjs --quick               one dark, one light theme

   A full run writes worst.json beside its report: the hardest looks per
   theme. Copying it to tests/fixtures/contrast-worst.json is how the gate in
   tests/ui/contrast.spec.cjs learns where the sky is hardest. */
const { chromium } = require('@playwright/test');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { startStaticServer } = require('../tests/helpers/static-server.cjs');
const { DEMO_BOARD } = require('../tests/helpers/demo-board.cjs');

const root = resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const list = value => (value && value !== 'true' ? value.split(',').filter(Boolean) : null);

const SCENES = ['aurora', 'halo', 'silk', 'frost', 'drift', 'horizon'];
const MOODS = ['theme', 'polar', 'violet', 'ember', 'mono'];
// The fonts pass is opt-in (--surfaces=fonts): it re-renders every tab per face.
const SURFACES = list(args.surfaces) || ['home', 'search', 'settings', 'menus'];
/* The font pass sets one family on the display and interface slots at once.
   The list mixes the two bundled faces, a metric-compatible system face, and
   two deliberately awkward ones — a wide sans and a serif — because a user can
   pick any family installed on the device, not only the ones offered. */
const FONTS = list(args.fonts) || ['default', 'Outfit', 'Instrument Sans', 'Arial', 'DejaVu Sans', 'Liberation Serif'];
/* Two moments per scene. Every scene is a pure function of time, and a bright
   curtain that misses the clock at one phase can sit on it at another. */
const PHASES = (list(args.phases) || ['7.4', '31.7']).map(Number);
/* With the sky following the sun, four moments of an equinox day in Berlin:
   the golden light of sunrise and sunset, the pale day, and the blue hour.
   Opt-in with --surfaces=home,daylight (or daylight alone). */
const DAYLIGHT = list(args.daylight) || ['2026-09-22T05:02:00Z', '2026-09-22T11:00:00Z', '2026-09-22T17:05:00Z', '2026-09-22T17:42:00Z'];
const DAYLIGHT_MOODS = ['theme', 'ember', 'mono'];
/* The Atmosphere slider goes to 150%, and a brighter sky is the harder test,
   so that is the default; --intensity=1 measures the out-of-the-box look. */
const INTENSITY = Number(args.intensity || 1.5);

let browser, server;

const { themeKeys, cropShot, measurePage, setLook, worstLooks } = require('../tests/helpers/contrast.cjs');

async function main() {
  const outDir = resolve(root, args.out || 'test-screenshots/contrast');
  await mkdir(outDir, { recursive: true });
  const allThemes = await themeKeys();
  const themes = list(args.themes) || (args.quick ? ['aurora-void', 'porcelain-light'] : allThemes);
  const scenes = list(args.scenes) || [...SCENES, 'solid'];
  const moods = list(args.moods) || MOODS;

  server = await startStaticServer(root);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(board => {
    const state = { nordlys_config: JSON.stringify(board) };
    window.chrome = {
      storage: { local: {
        get(keys, callback) { callback(typeof keys === 'object' && !Array.isArray(keys) ? { ...keys, ...state } : { ...state }); },
        set(values, callback) { Object.assign(state, values); callback?.(); },
        remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; callback?.(); },
        clear(callback) { for (const key of Object.keys(state)) delete state[key]; callback?.(); }
      } },
      runtime: { getURL: path => `${location.origin}/${path}` },
      search: { query: () => Promise.resolve() }
    };
    try { localStorage.setItem('nordlys_config', JSON.stringify(board)); } catch { /* storage refused */ }
  }, DEMO_BOARD);
  await page.route('https://api.iconify.design/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.route('**/_favicon/**', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwO+WQAAAABJRU5ErkJggg==', 'base64')
  }));
  await page.goto(`${server.origin}/newtab.html`);
  await page.waitForFunction(() => Boolean(window.Nordlys?.grid));
  await page.evaluate(groups => {
    window.Nordlys.config.groups = groups;
    window.Nordlys.saveConfig();
    window.Nordlys.grid.render();
  }, DEMO_BOARD.groups);

  const applyLook = (theme, scene, mood, phase, daylight = null) => setLook(page, { theme, scene, mood, phase, intensity: INTENSITY, daylight });

  const setFonts = family => page.evaluate(async family => {
    const app = window.Nordlys;
    app.config.fonts = { ...(app.config.fonts || {}), display: family, interface: family };
    window.NordlysType.apply(app.config, document.documentElement);
    await document.fonts.ready;
    app.grid?.render();
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, family);

  const results = [];
  const evidence = new Map();
  const groupOf = (surface, run) => `${surface} · ${run.where} · ${run.kind}`;
  const record = async (scenario) => {
    const { runs: measured, withText: shot } = await measurePage(page, scenario.scope ?? (scenario.tab ? '#cfg' : null));
    const withText = shot.toString('base64');
    results.push({ ...scenario, runs: measured });
    for (const run of measured) {
      if (run.disabled || run.nominal == null || run.nominal >= run.required) continue;
      const group = groupOf(scenario.surface, run);
      const kept = evidence.get(group);
      if (!kept || run.nominal < kept.run.nominal) evidence.set(group, { run, scenario, withText });
    }
  };

  const started = Date.now();
  let done = 0;
  for (const theme of themes) {
    if (SURFACES.includes('home')) {
      for (const scene of scenes) {
        const sceneMoods = scene === 'solid' ? ['theme'] : moods;
        for (const mood of sceneMoods) {
          const phases = scene === 'solid' ? [0] : mood === 'theme' ? PHASES : PHASES.slice(0, 1);
          for (const phase of phases) {
            await applyLook(theme, scene, mood, phase);
            await record({ surface: 'home', theme, scene, mood, phase });
            done++;
          }
        }
      }
    }
    if (SURFACES.includes('daylight')) {
      for (const scene of scenes.filter(name => name !== 'solid')) {
        for (const mood of DAYLIGHT_MOODS.filter(m => moods.includes(m))) {
          for (const daylight of DAYLIGHT) {
            await applyLook(theme, scene, mood, PHASES[0], daylight);
            await record({ surface: 'home', theme, scene, mood, phase: PHASES[0], daylight });
            done++;
          }
        }
      }
      await applyLook(theme, 'aurora', 'theme', PHASES[0]);
    }
    if (SURFACES.includes('search')) {
      for (const [scene, mood] of [['aurora', 'theme'], ['aurora', 'mono']]) {
        await applyLook(theme, scene, mood, PHASES[0]);
        await page.locator('#q').fill('g');
        await page.waitForTimeout(250);
        await record({ surface: 'search', theme, scene, mood, phase: PHASES[0] });
        await page.locator('#q').fill('');
        await page.keyboard.press('Escape');
        done++;
      }
    }
    if (SURFACES.includes('settings')) {
      await applyLook(theme, 'aurora', 'theme', PHASES[0]);
      await page.locator('#gear').click();
      await page.waitForTimeout(350);
      const tabs = await page.$$eval('.ctabs .ctab', nodes => nodes.map(node => node.dataset.tab));
      for (const tab of tabs) {
        await page.locator(`.ctab[data-tab="${tab}"]`).click();
        await page.waitForTimeout(120);
        const scroller = page.locator('.cbody');
        const { height, client } = await scroller.evaluate(node => ({ height: node.scrollHeight, client: node.clientHeight }));
        for (let offset = 0, step = 0; step < 6; offset += Math.max(200, client - 80), step++) {
          await scroller.evaluate((node, top) => { node.scrollTop = top; }, offset);
          await page.waitForTimeout(60);
          await record({ surface: 'settings', theme, scene: 'aurora', mood: 'theme', phase: PHASES[0], tab, offset });
          done++;
          if (offset + client >= height) break;
        }
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
    /* The layers a person meets for a moment — menus, the confirm dialog, the
       toasts — are where danger and success colours are text, and where a
       light theme's white menu meets a colour picked on a dark one. */
    if (SURFACES.includes('menus')) {
      await applyLook(theme, 'aurora', 'theme', PHASES[0]);
      const layers = [
        ['tile menu', '#tile-ctx-menu', () => page.locator('.tile').first().click({ button: 'right' })],
        ['folder menu', '#folder-ctx-menu', () => page.locator('.cat').first().click({ button: 'right' })],
        ['board menu', '#board-ctx-menu', () => page.locator('#page').click({ button: 'right', position: { x: 40, y: 860 } })],
        ['confirm', '#confirm-modal', () => page.evaluate(() => { window.confirmDialog({ title: 'Delete this folder?', message: 'Its six bookmarks go with it.', okText: 'Delete', danger: true }); })],
        ['toasts', '#toast-dock', () => page.evaluate(() => {
          window.toast('Backup saved', 'success');
          window.toast('That file is not a backup', 'danger');
          window.NordlysUI.showUndoToast({ message: 'Removed “Spotify”', actionLabel: 'Undo', onAction() {} });
        })]
      ];
      for (const [name, scope, open] of layers) {
        await open();
        await page.waitForTimeout(260);
        await record({ surface: 'menus', theme, scene: 'aurora', mood: 'theme', phase: PHASES[0], layer: name, scope });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelectorAll('#toast-dock > *').forEach(node => node.remove()));
        done++;
      }
    }
    if (SURFACES.includes('fonts')) {
      for (const family of FONTS) {
        await setFonts(family);
        await applyLook(theme, 'aurora', 'theme', PHASES[0]);
        await record({ surface: 'fonts', theme, scene: 'aurora', mood: 'theme', phase: PHASES[0], font: family });
        await page.locator('#gear').click();
        await page.waitForTimeout(350);
        for (const tab of ['appearance', 'general', 'background']) {
          await page.locator(`.ctab[data-tab="${tab}"]`).click();
          await page.waitForTimeout(120);
          await record({ surface: 'fonts', theme, scene: 'aurora', mood: 'theme', phase: PHASES[0], font: family, tab });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        done += 4;
      }
      await setFonts('default');
    }
    process.stdout.write(`${theme}: ${done} scenarios, ${Math.round((Date.now() - started) / 1000)}s\n`);
  }

  // ── Report ───────────────────────────────────────────────────────────
  const failures = [];
  const faint = [];
  for (const scenario of results) {
    for (const run of scenario.runs) {
      if (run.disabled || run.nominal == null) continue;
      const entry = { ...scenario, runs: undefined, run };
      if (run.nominal < run.required) failures.push(entry);
      else if (run.rendered != null && run.rendered < (run.large ? 2.4 : 3.2)) faint.push(entry);
    }
  }
  const key = entry => `${entry.surface} · ${entry.run.where} · ${entry.run.kind}`;
  const worstBy = entries => {
    const map = new Map();
    for (const entry of entries) {
      const k = key(entry);
      const current = map.get(k);
      if (!current) map.set(k, { worst: entry, count: 1, themes: new Set([entry.theme]) });
      else {
        current.count++;
        current.themes.add(entry.theme);
        if (entry.run.nominal < current.worst.run.nominal) current.worst = entry;
      }
    }
    return [...map.entries()].sort((p, q) => p[1].worst.run.nominal - q[1].worst.run.nominal);
  };
  const lines = [
    `# Measured contrast`,
    ``,
    `${results.length} scenarios · ${results.reduce((n, s) => n + s.runs.length, 0)} text runs · ${failures.length} below WCAG AA · ${faint.length} pass on paper but render faint`,
    ``,
    `## Below AA, grouped by element (worst case first)`,
    ``,
    `| ratio | need | element | text | worst in | failing scenarios | themes |`,
    `|---:|---:|---|---|---|---:|---:|`
  ];
  for (const [k, info] of worstBy(failures)) {
    const e = info.worst;
    lines.push(`| ${e.run.nominal.toFixed(2)} | ${e.run.required} | \`${k}\` | ${e.run.text.replace(/\|/g, '\\|')} | ${e.theme} / ${e.scene} / ${e.mood}${e.tab ? ` / ${e.tab}` : ''}${e.layer ? ` / ${e.layer}` : ''}${e.font ? ` / ${e.font}` : ''} | ${info.count} | ${info.themes.size} |`);
  }
  lines.push('', '## Pass on paper, render faint (rendered glyph contrast)', '', '| rendered | nominal | element | text | font | size/weight | worst in |', '|---:|---:|---|---|---|---|---|');
  for (const [k, info] of worstBy(faint).slice(0, 60)) {
    const e = info.worst;
    lines.push(`| ${e.run.rendered?.toFixed(2)} | ${e.run.nominal.toFixed(2)} | \`${k}\` | ${e.run.text.replace(/\|/g, '\\|')} | ${e.run.family} | ${e.run.size}px/${e.run.weight} | ${e.theme} / ${e.scene} / ${e.mood} |`);
  }
  const cut = new Map();
  for (const scenario of results) {
    for (const run of scenario.runs) {
      if (!run.truncated) continue;
      const k = `${run.where} · ${run.text}`;
      const entry = cut.get(k) || { run, fonts: new Set(), count: 0 };
      entry.fonts.add(scenario.font || 'default');
      entry.count++;
      cut.set(k, entry);
    }
  }
  lines.push('', '## Cut short (ellipsis or clipped)', '', '| element | text | fonts | scenarios |', '|---|---|---|---:|');
  for (const [, entry] of [...cut.entries()].sort((p, q) => q[1].count - p[1].count).slice(0, 60)) {
    lines.push(`| \`${entry.run.where}\` | ${entry.run.text.replace(/\|/g, '\\|')} | ${[...entry.fonts].join(', ')} | ${entry.count} |`);
  }
  const byTheme = new Map();
  for (const entry of failures) byTheme.set(entry.theme, (byTheme.get(entry.theme) || 0) + 1);
  lines.push('', '## Failures per theme', '', ...[...byTheme.entries()].sort((p, q) => q[1] - p[1]).map(([theme, count]) => `- ${theme}: ${count}`));
  if (errors.length) lines.push('', '## Page errors', '', ...errors.map(error => `- ${error}`));

  const crops = resolve(outDir, 'crops');
  await mkdir(crops, { recursive: true });
  let index = 0;
  for (const [group, kept] of [...evidence.entries()].sort((p, q) => p[1].run.nominal - q[1].run.nominal)) {
    const rect = kept.run.rects.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
    const data = await page.evaluate(cropShot, { data: kept.withText, rect, pad: 28, scale: 2 });
    const name = `${String(++index).padStart(2, '0')}-${kept.run.nominal.toFixed(2)}-${group.replace(/[^a-z0-9]+/gi, '_').slice(0, 70)}.png`;
    await writeFile(resolve(crops, name), Buffer.from(data, 'base64'));
  }
  const dump = results.flatMap(scenario => scenario.runs.map(run => [
    scenario.surface, scenario.theme, scenario.scene, scenario.mood, scenario.phase, scenario.tab || '', scenario.font || '',
    run.where, run.kind, run.text, run.nominal == null ? null : +run.nominal.toFixed(2),
    run.rendered == null ? null : +run.rendered.toFixed(2), run.required, run.size, run.weight, run.family, run.background, run.truncated,
    run.color, +run.opacity.toFixed(3), scenario.daylight || ''
  ]));
  await writeFile(resolve(outDir, 'runs.json'), JSON.stringify({
    columns: ['surface', 'theme', 'scene', 'mood', 'phase', 'tab', 'font', 'where', 'kind', 'text', 'nominal', 'rendered', 'required', 'size', 'weight', 'family', 'background', 'truncated', 'color', 'opacity', 'daylight'],
    rows: dump
  }));
  await writeFile(resolve(outDir, 'report.md'), `${lines.join('\n')}\n`);
  // The gate's fixture: copy it to tests/fixtures/contrast-worst.json to adopt it.
  await writeFile(resolve(outDir, 'worst.json'), `${JSON.stringify(worstLooks(results), null, 2)}\n`);
  await writeFile(resolve(outDir, 'report.json'), JSON.stringify({ failures, faint: faint.slice(0, 400) }, null, 1));
  process.stdout.write(`${lines.slice(0, 3).join('\n')}\n${resolve(outDir, 'report.md')}\n`);
  process.exitCode = failures.length ? 1 : 0;
}

main()
  .catch(error => { console.error(error); process.exitCode = 2; })
  .finally(async () => { await browser?.close(); await server?.close(); });
