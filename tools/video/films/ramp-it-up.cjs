/* The plates for the Remotion films cut to "Ramp It Up" by Ahjay Stelino
   (Mixkit, Stock Music Free License): 120 bpm, so a beat is half a second
   and a bar two.

     node tools/video/plates.cjs tools/video/films/ramp-it-up.cjs <out-dir> [--only a,b]

   Each plate is one moment of the product, filmed clean: no captions, no
   title cards (the words are drawn in Remotion). A plate has a second of
   handle before the edit uses it, and its script times what happens from
   there in beats (at(n): n beats after the shot begins), so a key pressed
   on a beat of the plate lands on that beat of the film, wherever the edit
   puts the plate. tools/video/remotion/src/edit.ts places the plates on the
   music and says what the camera and the words do over them.

   The page, the demo data and the mocked apps (Todoist, GitHub, a calendar,
   Open-Meteo) are the ones rising-forest.cjs set up for the last film. */
const { helpers } = require('./rising-forest.cjs');
const { routes, prepare, look, card, VIDEO, APPS, TRAVEL } = helpers;

const B = 0.5, E = B / 2, Q = B / 4, T0 = 1;
// Plate time of a beat, counted from where the shot begins.
const at = (beats) => T0 + beats * B;

/* The demo board has a folder of AI assistants; in its place the film shows
   the board's own "Watch & listen" folder (hidden on the demo, the same
   size), so nothing on screen is about AI. Demo data only. */
function board() {
  const groups = Nordlys.config.groups;
  const ai = groups.findIndex((g) => g.label === 'AI');
  const watch = groups.findIndex((g) => g.label === 'Watch & listen');
  if (ai >= 0 && watch >= 0) {
    const [w] = groups.splice(watch, 1);
    w.hidden = false;
    groups.splice(groups.findIndex((g) => g.label === 'AI'), 1, w);
  }
  Nordlys.saveConfig();
}

/* Before every plate: an empty search box, and the focus timer back at rest
   (the focus plate starts it; later shots show the card as it was). */
async function reset(s) {
  if (s.plate.name === 'focus') return;
  await s.js(() => {
    const q = document.getElementById('q');
    if (q && q.value) { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }
    q?.blur();
    const fm = window.Nordlys.focusMode, K = window.NordlysWidgetKit;
    if (fm?.open) fm.hide();
    if (fm?.timer && K?.timer && (fm.timer.running || fm.timer.startedAt || fm.timer.endsAt)) { K.timer.reset(fm.timer); fm.save?.(); fm.draw?.(); }
  });
}

/* A look, then time for it to land: a new layout moves its cards into place
   (over about half a second) and the camera must aim at where they end up. */
const settled = async (s, opts, seconds = 0.9) => { await look(s, opts); await s.settle(seconds); };

const intro = (theme, scene) => async (s) => { await look(s, { theme, scene, dash: false, bare: true }); await s.look('center', 1.12); };
const drift = (seconds, to = 1.0) => async (s) => { await s.look('center', to, seconds, 'cubic-bezier(.25,.1,.25,1)'); };
const still = () => async () => {};

// Where the pointer first shows: below and to the right of a control, over nothing.
const pointerNear = async (s, sel, dx, dy) => { const [x, y] = await s.centre(sel); await s.move(x + dx, y + dy); };
const rowOf = (s, css, text) => s.js(([c, t]) => [...document.querySelectorAll(c)].findIndex((n) => n.textContent.includes(t)), [css, text]);

let agendaAt = null;

const skies = [['halo', 'nord-frost'], ['pillars', 'sunset-amber'], ['nacre', 'peach-sunset'], ['silk', 'catppuccin-mocha'], ['baikal', 'aurora-void'], ['drift', 'dracula-velvet'], ['horizon', 'nordic-snow'], ['polaris', 'tokyo-night']];
const themes = ['aurora-void', 'nord-frost', 'catppuccin-mocha', 'dracula-velvet', 'tokyo-night', 'gruvbox-dark', 'porcelain-light', 'sakura-daylight', 'sunset-amber'];

module.exports = {
  clock: '09:41',
  timezone: 'Europe/Berlin',
  routes,
  prepare,
  board,
  reset,
  music: { bpm: 120, beat: B, bar: 4 * B },
  plates: () => [
    // ── The name, over the sky ──
    { name: 'sky-aurora', seconds: 13, setup: intro('aurora-void', 'aurora'), run: drift(12) },
    // The page as it opens: the board over the aurora, still. The edit floats it in a window, then fills the frame with it.
    { name: 'hero', seconds: 11,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false }); await s.look('center', 1.0); },
      run: still() },

    // ── Search: math, then a command that changes the sky ──
    { name: 'search', seconds: 9.5, settle: 0.6,
      setup: async (s) => {
        await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false });
        await s.page.locator('#q').click();
        await s.page.fill('#q', '');
        await s.look('#searchwrap', 1.6);
      },
      run: async (s) => {
        await s.typeTo('1920 / 16 * 9', at(3), Q);
        s.mark('answer');
        await s.rect('answer', '#searchwrap');
        await s.press('Control+A', at(5));
        await s.typeTo('> sky polaris', at(8.5), Q);
        await s.press('Enter', at(10));
        s.mark('enter');
        await s.at(at(10.5));
        await s.look('center', 1.0, 1.5, 'cubic-bezier(.3,0,.1,1)');
      } },
    { name: 'find', seconds: 7,
      setup: async (s) => {
        await look(s, { theme: 'tokyo-night', scene: 'polaris', dash: false });
        await s.page.locator('#q').click();
        await s.page.fill('#q', '');
        await s.look('#searchwrap', 1.6);
      },
      run: async (s) => { await s.typeTo('git', at(1.5), E); } },
    // ── The dashboard ──
    { name: 'dash-in', seconds: 4,
      setup: async (s) => {
        await s.pointer(false);
        await settled(s, { theme: 'nord-frost', scene: 'halo', dash: { layout: VIDEO } });
        await s.bare(true, true);
      },
      run: async (s) => { await s.bare(false); s.mark('in'); } },
    { name: 'task', seconds: 5, settle: 0.3,
      setup: async (s) => {
        // At rest: zoomed in by the page's camera, the dashboard lays itself out wider than the
        // window and the card is cut at the edge. The edit frames it (a 5K plate has room).
        await settled(s, { theme: 'nord-frost', scene: 'halo', dash: { layout: VIDEO } });
        await s.look('center', 1.0);
        await s.page.locator(`${card('tasks')} input.dash-input`).click();
      },
      run: async (s) => {
        await s.typeTo('Call Anna tomorrow !', at(2.875), Q / 2);
        await s.press('Enter', at(4));
        s.mark('enter');
        await s.at(at(4.5));
        await s.rect('task', [`${card('tasks')} .dash-check`, 1]);
      } },
    { name: 'habit', seconds: 3.5,
      setup: async (s) => {
        await s.look(card('habits'), 1.7);
        // In the gap to the right of the card: over nothing, so no row shows its buttons.
        const b = await s.box(card('habits'));
        await s.move(b.x + b.w + 9, b.y + b.h * 0.62);
        await s.pointer(true);
      },
      run: async (s) => { await s.clickOn(at(1), [`${card('habits')} .dash-habit-day.is-today`, 1], 0.4, 'click'); } },
    { name: 'cards', seconds: 4,
      setup: async (s) => { await s.pointer(false); await s.look(card('countdown'), 1.6); },
      run: async (s) => { await s.at(at(1)); await s.look(card('clocks'), 1.6, B, 'cubic-bezier(.6,0,.2,1)'); } },
    { name: 'drag', seconds: 4,
      setup: async (s) => {
        await s.look('center', 1.0);
        await pointerNear(s, `${card('clocks')} .dash-head h2`, 36, 64);
        await s.pointer(true);
      },
      run: async (s) => {
        const head = `${card('clocks')} .dash-head h2`;
        const [hx, hy] = await s.centre(head);
        const own = await s.box(card('clocks'));
        const target = await s.box(card('countdown'));
        await s.glide(hx - 20, hy, 0.3);
        await s.down();
        await s.glide(hx - 12, hy + 6, 0.1);
        await s.at(at(3) - 0.8);
        await s.glide(hx - 20 + (target.x - own.x), hy + (target.y - own.y), 0.8);
        await s.at(at(3));
        await s.up();
        s.mark('drop');
      } },
    { name: 'stretch', seconds: 4,
      setup: async (s) => {
        // A row shorter than the cards beside it, so stretching it fills a space that is there already.
        await s.js(() => { const d = window.Nordlys.dashboard; const t = d.widgets().find((w) => w.type === 'tasks'); d.change(t.id, (w) => ({ ...w, h: 2 })); });
        await s.settle(1.2);
        await s.look(card('tasks'), 1.25);
        const [x, y] = await s.centre(card('tasks'));
        await s.move(x + 70, y + 30);
        await s.pointer(true);
      },
      run: async (s) => {
        // The corner is taken just before the stretch: while held, the card shows only its outline.
        const corner = await s.box(`${card('tasks')} .dash-resize`);
        await s.at(at(0.5));
        await s.glide(corner.x + 9, corner.y + 9, 0.3);
        await s.down();
        await s.glide(corner.x + 22, corner.y + 118, at(3) - at(0.5) - 0.4);
        await s.at(at(3));
        await s.up();
        s.mark('release');
      } },
    // Five layouts, framed alike, for a cut on every beat.
    ...['calm', 'travel', 'minimal', 'deep'].map((preset) => ({ name: `layout-${preset}`, seconds: 2.5, settle: 1.2,
      setup: async (s) => { await s.pointer(false); await settled(s, { dash: { preset } }); await s.look('center', 1.0); },
      run: still() })),
    // The planner, then a dolly into its focus timer: the card becomes focus mode.
    { name: 'layout-planner', seconds: 4, settle: 1.2,
      setup: async (s) => { await settled(s, { dash: { preset: 'planner' } }); await s.look('center', 1.0); await s.rect('timer', card('timer')); },
      run: async (s) => { await s.at(at(0.5)); await s.look(card('timer'), 3.4, 1.75, 'cubic-bezier(.6,0,.9,.4)'); s.mark('dolly'); } },

    // ── The breakdown: focus mode ──
    { name: 'focus', seconds: 13.5, settle: 0.8, clock: true,
      setup: async (s) => {
        await s.js(() => window.Nordlys.focusMode.show());
        await s.settle(0.6);
        await s.page.locator('#focus-mode .fm-intent').fill('');
        await s.look('center', 1.0);
        await pointerNear(s, '#focus-mode .fm-intent', 230, 110);
      },
      run: async (s) => {
        await s.at(at(1));
        await s.pointer(true);
        await s.clickOn(at(2), '#focus-mode .fm-intent', 0.5);
        await s.typeTo('Write the release notes', at(7), Q);
        await s.clickOn(at(8), '#focus-mode .fm-go', 0.45, 'go');
        await s.clickOn(at(12), '#focus-mode .fm-chip[data-sound="rain"]', 0.55, 'rain');
        await s.at(at(13));
        await s.pointer(false);
        await s.at(at(14));
        await s.look('#focus-mode .fm-face', 2.3, 5.4, 'cubic-bezier(.45,0,.3,1)');
      } },

    // ── Skies, framed alike, for cuts that speed up into the drop ──
    ...skies.map(([scene, theme]) => ({ name: `sky-${scene}`, seconds: 3, settle: 0.8,
      setup: async (s) => { await s.js(() => { if (window.Nordlys.focusMode?.open) window.Nordlys.focusMode.hide(); }); await intro(theme, scene)(s); },
      run: drift(3) })),

    // ── Looks: the same dashboard in nine themes, for a grid; black; light ──
    ...themes.map((theme) => ({ name: `theme-${theme}`, seconds: 5.5, settle: 1.0,
      setup: async (s) => { await settled(s, { theme, scene: 'aurora', dash: { layout: VIDEO } }); await s.look('center', 1.0); },
      run: still() })),
    { name: 'oled', seconds: 7, settle: 1.0,
      setup: async (s) => { await settled(s, { theme: 'oled-obsidian', scene: 'drift', dash: { layout: VIDEO } }); await s.look('center', 1.0); },
      run: still() },
    { name: 'light', seconds: 4.5, settle: 1.0,
      setup: async (s) => { await settled(s, { theme: 'porcelain-light', scene: 'horizon', dash: { layout: VIDEO } }); await s.look('center', 1.0); },
      run: still() },

    // ── Profiles: Work to Home, and the look that comes with it ──
    // Filmed with the page's camera at rest: the menu is placed from the chip's box on screen. The edit frames it.
    { name: 'profiles', seconds: 8, settle: 1.0,
      setup: async (s) => {
        await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false });
        await s.look('center', 1.0);
        await s.rect('chip', '#profile-chip');
        await pointerNear(s, '#profile-chip', 190, 8);
        await s.pointer(true);
      },
      run: async (s) => {
        await s.clickOn(at(1), '#profile-chip', 0.45, 'menu');
        await s.at(at(1.5));
        await s.rect('menu', '#profile-menu');
        const home = await rowOf(s, '#profile-menu .ctx-item', 'Home');
        await s.clickOn(at(3), ['#profile-menu .ctx-item', home], 0.4, 'switch');
        await s.at(at(4));
        await s.pointer(false);
      } },

    // ── Connected apps ──
    { name: 'apps', seconds: 4.5, settle: 1.0,
      setup: async (s) => {
        await s.pointer(false);
        await s.js(async () => { const p = Nordlys.sync; const work = p.list().find((x) => x.name === 'Work'); await p.switchTo(work.id, { undo: false }); });
        // The section lists the apps only while the dashboard is on.
        await settled(s, { theme: 'tokyo-night', scene: 'polaris', dash: { layout: VIDEO } });
        await s.js(() => window.Nordlys.settings.open('dashboard'));
        await s.settle(1.4);
        await s.js(() => document.querySelector('.dash-connections')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await s.settle(0.5);
        await s.look('.dash-connections', 1.3);
      },
      run: async (s) => { await s.look('.dash-connections', 1.38, 3.4, 'linear'); } },
    { name: 'inbox', seconds: 5, settle: 1.6,
      setup: async (s) => {
        await s.js(() => window.Nordlys.settings.close());
        await settled(s, { theme: 'tokyo-night', scene: 'polaris', dash: { layout: APPS } }, 1.2);
        await s.look(card('inbox'), 1.4);
        // Just outside the card, to the right, over the gap between the cards.
        const b = await s.box(card('inbox'));
        await s.move(b.x + b.w + 10, b.y + b.h * 0.42);
        await s.pointer(true);
      },
      run: async (s) => { await s.clickOn(at(2), `${card('inbox')} input.dash-check`, 0.5, 'tick'); } },
    { name: 'agenda', seconds: 3.5,
      // The events sit at the top left of a large card: the camera looks there.
      setup: async (s) => {
        await s.pointer(false);
        const b = await s.box(card('agenda'));
        agendaAt = { x: b.x + b.w * 0.36, y: b.y + b.h * 0.34 };
        await s.look(agendaAt, 1.6);
      },
      run: async (s) => { await s.look(agendaAt, 1.7, 2.5, 'linear'); } },
    { name: 'weather', seconds: 4, settle: 1.6,
      setup: async (s) => { await settled(s, { theme: 'nord-frost', scene: 'horizon', dash: { layout: TRAVEL } }, 1.2); await s.look(card('weather'), 1.55); },
      run: async (s) => { await s.at(at(1)); await s.look(card('clocks'), 1.55, 2 * B, 'cubic-bezier(.5,0,.2,1)'); } },

    // ── The whole of it, then the name again ──
    { name: 'hero-dash', seconds: 6, settle: 1.2,
      setup: async (s) => { await settled(s, { theme: 'aurora-void', scene: 'aurora', dash: { layout: VIDEO }, board: true }); await s.look('center', 1.0); },
      run: still() },
    { name: 'sky-end', seconds: 8, setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false, bare: true }); await s.look('center', 1.0); },
      run: drift(7, 1.05) }
  ]
};
