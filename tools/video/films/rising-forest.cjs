/* The YouTube film, cut to "Rising Forest" by Diego Nava (Mixkit, free
   licence, no credit needed). 123 bpm; bar 0 is the first downbeat, at 1.74 s.

     bars 0-5    the groove          name, the page appearing, search
     bar 6       the dip             a command changes the sky
     bars 7-14   first drop          the dashboard: tasks, habits, cards, layouts, themes
     bars 15-22  breakdown           focus mode; skies speed up into the drop
     bars 23-38  second drop         black and light, profiles, connected apps, recap
     bars 39-41  outro               the name again

   Each shot: from (a time, from music.bar), into (how it arrives: a
   transition type for ffmpeg's xfade and its length; none means a hard
   cut), setup (off camera) and run (on camera). */

const DAY = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const ics = () => {
  const d = (days, h, m) => { const t = new Date(); t.setDate(t.getDate() + days); t.setHours(h, m, 0, 0); return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
  const allDay = (days) => { const t = new Date(); t.setDate(t.getDate() + days); return t.toISOString().slice(0, 10).replace(/-/g, ''); };
  const ev = (uid, title, start, end, where = '') => `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${title}\r\nDTSTART:${start}\r\nDTEND:${end}\r\n${where ? `LOCATION:${where}\r\n` : ''}END:VEVENT\r\n`;
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'
    + ev('a', 'Design review', d(0, 11, 0), d(0, 12, 0), 'Room 3')
    + ev('b', 'Lunch with Maya', d(0, 13, 0), d(0, 14, 0), 'Café Solsiden')
    + ev('c', 'Dentist', d(1, 9, 30), d(1, 10, 0))
    + `BEGIN:VEVENT\r\nUID:d\r\nSUMMARY:Mum's birthday\r\nDTSTART;VALUE=DATE:${allDay(3)}\r\nDTEND;VALUE=DATE:${allDay(4)}\r\nEND:VEVENT\r\n`
    + 'END:VCALENDAR\r\n';
};

/* Plausible answers from a few apps, for the connected-apps shots. Nothing
   leaves the machine: the requests are answered here. */
async function routes(context) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
  const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await context.route(/https:\/\/(api\.todoist\.com|api\.github\.com|calendar\.nordlys\.test)\//, (route) => {
    const req = route.request(), url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.includes('api.todoist.com') && req.method() === 'POST') return route.fulfill({ status: 204, headers: cors });
    if (url.includes('api.todoist.com')) return json(route, { results: [
      { id: 't1', content: 'Send the invoice to Studio North', due: { date: iso(0) }, priority: 4, project_name: 'Work' },
      { id: 't2', content: 'Pick up the camera from repair', due: { date: iso(1) }, priority: 1, project_name: 'Home' },
      { id: 't3', content: 'Book the train to Bergen', due: { date: iso(3) }, priority: 1, project_name: 'Trips' }
    ] });
    if (url.includes('/search/issues')) return json(route, { items: [{ id: 902, title: 'Keyboard shortcuts for the editor', pull_request: {}, html_url: 'https://github.com/northwind/web/pull/88', repository_url: 'https://api.github.com/repos/northwind/web' }] });
    if (url.includes('api.github.com/issues')) return json(route, [{ id: 901, title: 'Dark mode flickers on first load', html_url: 'https://github.com/northwind/app/issues/42', repository: { full_name: 'northwind/app' }, milestone: { due_on: `${iso(2)}T12:00:00Z` } }]);
    if (url.includes('calendar.nordlys.test')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/calendar' }, body: ics() });
    return route.continue();
  });
}

/* Once, before the first shot: two profiles, Work (this look) and Home
   (warm, over pearl clouds), and three connected apps. */
async function prepare({ js }) {
  await js(async () => {
    const s = Nordlys.sync;
    const work = s.list()[0];
    s.rename(work.id, 'Work');
    await s.create({ name: 'Home', from: 'copy' });
    Nordlys.setTheme('gruvbox-dark'); Nordlys.config.bgMode = 'nacre'; Nordlys.saveConfig(); Nordlys.updateBackgroundMode();
    await s.switchTo(work.id, { undo: false });
    const d = Nordlys.dashboard;
    d.connections = { todoist: { token: 'demo' }, github: { token: 'demo' }, ics: { url: 'https://calendar.nordlys.test/week.ics' } };
    d.saveConnections();
    d.setOn(false);
  });
}

// A dashboard in a given layout, with a morning already in it.
function dashboardIn({ layout, board = false, preset }) {
  const d = window.Nordlys.dashboard, K = window.NordlysWidgetKit;
  if (preset) d.applyPreset(preset);
  else d.write({ ...d.state, on: true, seeded: true, widgets: layout.map(([type, x, y, w, h]) => ({ ...d.blank(type), x, y, w, h })) });
  d.write({ ...d.state, on: true, showBoard: Boolean(board) });
  return d.render().then(async () => {
    const now = Date.now();
    for (const w of d.widgets()) {
      const key = d.dataKey(w);
      if (w.type === 'tasks') { const l = K.tasks.create(); for (const [x, o] of [['Write the release notes', { priority: true, due: K.dayOf(now) }], ['Reply to Anna', { due: K.dayOf(now) }], ['Book the dentist', { due: K.tasks.shift(now, 3) }], ['Water the plants', {}], ['Renew the passport', { due: K.tasks.shift(now, 12) }]]) K.tasks.add(l, x, now, o); d.persist(key, l); }
      if (w.type === 'focus') { const f = K.focus.create(); K.focus.set(f, 'Plan the week', now); d.persist(key, f); }
      if (w.type === 'notes') d.persist(key, { text: 'Keys are in the blue bowl.\nCall Mum on Sunday.' });
      if (w.type === 'habits') { const h = K.habits.create(); for (const [name, days] of [['Read', [0, 1, 2, 4, 5]], ['Walk', [3, 5]], ['Stretch', [4, 5]], ['No phone at dinner', [0, 1, 2, 3, 4, 5]], ['Water', [1, 3, 5]]]) { const x = K.habits.add(h, name); for (const i of days) K.habits.toggle(h, x.id, K.tasks.shift(now, i - 6)); } d.persist(key, h); }
      if (w.type === 'countdown') d.change(w.id, (x) => ({ ...x, settings: { title: 'the trip to Bergen', date: K.tasks.shift(now, 18) } }));
      if (w.type === 'clocks') d.change(w.id, (x) => ({ ...x, settings: { zones: ['America/New_York', 'Europe/Lisbon', 'Asia/Tokyo'] } }));
      if (w.type === 'weather') d.change(w.id, (x) => ({ ...x, settings: { ...x.settings, place: { name: 'Oslo', lat: 59.91, lon: 10.75 } } }));
    }
    d.signature = '';
    await d.render();
  });
}
const VIDEO = [['focus', 0, 0, 6, 2], ['countdown', 6, 0, 3, 2], ['clocks', 9, 0, 3, 2], ['tasks', 0, 2, 5, 3], ['habits', 5, 2, 4, 3], ['timer', 9, 2, 3, 3]];
const APPS = [['inbox', 0, 0, 6, 5], ['agenda', 6, 0, 6, 5]];
const TRAVEL = [['weather', 0, 0, 4, 3], ['clocks', 4, 0, 4, 3], ['countdown', 8, 0, 4, 3], ['focus', 0, 3, 8, 2], ['notes', 8, 3, 4, 2]];

const card = (sel) => `#dash .dash-card[data-type="${sel}"]`;
const look = async (s, { theme, scene, dash, board = false, bare = false, focus = false }) => {
  if (focus === false) await s.js(() => { if (window.Nordlys.focusMode?.open) window.Nordlys.focusMode.hide(); });
  if (theme) await s.theme(theme);
  if (scene) await s.scene(scene);
  if (dash === false) await s.js(() => window.Nordlys.dashboard.setOn(false));
  else if (dash) await s.js(dashboardIn, dash.layout ? { layout: dash.layout, board } : { preset: dash.preset, board });
  await s.bare(bare, true);
};

module.exports = {
  from: 0,
  clock: '09:41',
  routes,
  prepare,
  fadeOut: 2.4,
  shots(m) {
    const b = m.bar, B = m.BEAT;
    const to = b(41);
    this.to = to + this.from;
    const shots = [];
    const add = (shot) => shots.push(shot);

    // ── The name ──
    add({ name: 'title', from: 0, settle: 0.6,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false, bare: true }); await s.look('center', 1.12); },
      run: async (s) => {
        await s.look('center', 1.04, b(2) + 0.6, 'cubic-bezier(.3,0,.2,1)');
        await s.at(b(0) - 0.25);
        await s.card('<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>Your favourite sites, on every new tab</p>');
      } });
    // ── The page appears out of the sky ──
    add({ name: 'reveal', from: b(2), into: { type: 'fade', d: 1.2 }, settle: 0.4,
      setup: async (s) => { await look(s, { dash: false, bare: true }); await s.look('center', 1.16); },
      run: async (s) => {
        await s.look('center', 1.0, b(4) - b(2) + 0.4, 'cubic-bezier(.45,0,.15,1)');
        await s.at(b(2, 1)); await s.bare(false);
        await s.at(b(3)); await s.caption('Your favourite sites, in folders', 'Nordlys');
      } });
    // ── Search: math, then a command on the dip ──
    add({ name: 'math', from: b(4),
      setup: async (s) => { await look(s, { dash: false }); await s.page.locator('#q').click(); await s.page.fill('#q', ''); await s.look('#searchwrap', 1.9); },
      run: async (s) => { await s.caption('Math right in the search box', 'Search'); await s.typeTo('1920 / 16 * 9', b(4, 3), B / 4); } });
    add({ name: 'command', from: b(5),
      setup: async (s) => { await s.page.fill('#q', ''); await s.look('#searchwrap', 1.9); },
      run: async (s) => {
        await s.caption('Commands after the > sign', 'Search');
        await s.typeTo('> sky polaris', b(5, 3.5), B / 4);
        await s.at(b(6) - 0.02); await s.page.keyboard.press('Enter');
        await s.look('center', 1.0, b(7) - b(6), 'cubic-bezier(.7,0,.3,1)');
        await s.at(b(6, 1)); await s.caption(null);
      } });
    // ── First drop: the dashboard ──
    add({ name: 'dashboard', from: b(7),
      setup: async (s) => { await s.page.locator('#q').blur(); await look(s, { theme: 'nord-frost', scene: 'halo', dash: { layout: VIDEO } }); await s.look('center', 1.08); },
      run: async (s) => { await s.flash(); await s.look('center', 1.0, m.BAR, 'cubic-bezier(.16,1,.3,1)'); await s.at(b(7, 0.25)); await s.caption('A dashboard for your day', 'Dashboard'); } });
    add({ name: 'task', from: b(8), settle: 0.3,
      setup: async (s) => { await s.look(card('tasks'), 1.75); await s.page.locator(card('tasks')).getByRole('textbox', { name: 'Add a task' }).click(); },
      run: async (s) => {
        await s.caption('Type tasks the way you say them', 'Tasks');
        await s.typeTo('Call Anna tomorrow !', b(8, 2.6), (b(8, 2.6) - b(8, 0.3)) / 19);
        await s.at(b(8, 3) - 0.02); await s.page.keyboard.press('Enter');
      } });
    add({ name: 'habit', from: b(9),
      setup: async (s) => { await s.look(card('habits'), 1.75); await s.pointer(true); const [x, y] = await s.centre(s.page.locator(`${card('habits')} .dash-habit-day.is-today`).nth(1)); await s.glide(x + 40, y + 60, 0); },
      run: async (s) => { await s.clickOn(b(9, 1), s.page.locator(`${card('habits')} .dash-habit-day.is-today`).nth(1), 0.35); } });
    add({ name: 'clocks', from: b(9, 2),
      setup: async (s) => { await s.pointer(false); await s.look(card('clocks'), 1.7); },
      run: async (s) => { await s.look(card('countdown'), 1.7, b(10) - b(9, 2) + 0.2, 'cubic-bezier(.45,0,.2,1)'); } });
    add({ name: 'move', from: b(10),
      setup: async (s) => { await s.look('center', 1.0); await s.pointer(true); },
      run: async (s) => {
        await s.caption('Drag cards anywhere, stretch them to fit', 'Dashboard');
        const head = s.page.locator(`${card('clocks')} .dash-head h2`);
        const [hx, hy] = await s.centre(head);
        const own = await s.page.locator(card('clocks')).boundingBox();
        const target = await s.page.locator(card('countdown')).boundingBox();
        await s.glide(hx - 20, hy, 0.35); await s.page.mouse.down(); await s.glide(hx - 10, hy + 8, 0.08);
        await s.at(b(10, 3) - 0.9); await s.glide(hx - 20 + (target.x - own.x), hy + (target.y - own.y), 0.85);
        await s.at(b(10, 3)); await s.page.mouse.up();
      } });
    add({ name: 'resize', from: b(11), keepCaption: true,
      setup: async (s) => { await s.look(card('tasks'), 1.2); const box = s.page.locator(card('tasks')); await box.hover(); },
      run: async (s) => {
        const corner = await s.page.locator(`${card('tasks')} .dash-resize`).boundingBox();
        await s.glide(corner.x + 9, corner.y + 9, 0.3); await s.page.mouse.down();
        await s.at(b(11, 3) - 0.75); await s.glide(corner.x + 22, corner.y + 110, 0.72);
        await s.at(b(11, 3)); await s.page.mouse.up();
      } });
    for (const [i, preset] of ['calm', 'travel', 'minimal', 'planner'].entries()) {
      add({ name: `layout-${preset}`, from: b(12 + Math.floor(i / 2), (i % 2) * 2), keepCaption: i > 0,
        setup: async (s) => { await s.pointer(false); await look(s, { dash: { preset } }); await s.look('center', 1.0); },
        run: async (s) => { if (i === 0) await s.caption('Five layouts to start from', 'Dashboard'); await s.look('center', 1.035, 2 * B + 0.2, 'linear'); } });
    }
    for (const [i, theme] of ['porcelain-light', 'catppuccin-mocha', 'sakura-daylight', 'oled-obsidian'].entries()) {
      add({ name: `theme-${theme}`, from: b(14, i), into: i ? { type: i % 2 ? 'slideleft' : 'slideright', d: 0.2 } : undefined, keepCaption: i > 0, settle: 0.9,
        setup: async (s) => { await look(s, { theme, dash: i === 0 ? { layout: VIDEO } : undefined }); await s.look('center', 1.0); },
        run: async (s) => { if (i === 0) await s.caption('21 colour themes', 'Looks'); } });
    }
    // ── Breakdown: focus mode ──
    add({ name: 'focus', from: b(15), into: { type: 'fade', d: 1.0 }, settle: 0.8,
      setup: async (s) => {
        await s.js(() => window.Nordlys.focusMode.show());
        await s.page.locator('#focus-mode .fm-intent').fill('');
        await s.look('#focus-mode .fm-ring', 1.0);
      },
      run: async (s) => {
        // Set it going first, with the camera still; then lean in on the ring.
        await s.at(b(15, 2)); await s.caption('One thing at a time', 'Focus mode', 'top');
        await s.pointer(true);
        await s.clickOn(b(16), s.page.locator('#focus-mode .fm-intent'), 0.5);
        await s.page.locator('#focus-mode .fm-intent').focus();
        await s.typeTo('Write the release notes', b(16, 3.5), B / 6);
        await s.clickOn(b(17), s.page.locator('#focus-mode .fm-go'), 0.45);
        await s.clickOn(b(17, 2), s.page.locator('#focus-mode').getByRole('radio', { name: 'Rain' }), 0.5);
        await s.at(b(17, 3)); await s.pointer(false);
        await s.look('#focus-mode .fm-ring', 1.25, b(19) - b(17, 3) + 0.6, 'cubic-bezier(.4,0,.2,1)');
      } });
    add({ name: 'focus-close', from: b(19), into: { type: 'fade', d: 1.2 },
      setup: async (s) => { await s.look('#focus-mode .fm-face', 2.3); },
      run: async (s) => { await s.look('#focus-mode .fm-face', 2.5, b(21) - b(19) + 0.6, 'linear'); } });
    // ── Skies, faster and faster into the drop ──
    const skies = [['halo', 'nord-frost'], ['pillars', 'sunset-amber'], ['nacre', 'peach-sunset'], ['silk', 'catppuccin-mocha'], ['baikal', 'aurora-void'], ['drift', 'dracula-velvet']];
    const skyAt = [b(21), b(21, 2), b(22), b(22, 1), b(22, 2), b(22, 3)];
    skies.forEach(([scene, theme], i) => {
      add({ name: `sky-${scene}`, from: skyAt[i], into: { type: 'fade', d: i < 2 ? 0.5 : 0.18 }, keepCaption: i > 0, settle: 0.7,
        setup: async (s) => { await look(s, { theme, scene, dash: false, bare: true }); await s.look('center', 1.14); },
        run: async (s) => { if (i === 0) await s.caption('Nine skies, drawn live', 'Looks'); await s.look('center', 1.0, (skyAt[i + 1] || b(23)) - skyAt[i] + 0.5, 'cubic-bezier(.3,0,.3,1)'); } });
    });
    // ── Second drop ──
    add({ name: 'oled', from: b(23),
      setup: async (s) => { await look(s, { theme: 'oled-obsidian', scene: 'drift', dash: { layout: VIDEO } }); await s.look('center', 1.1); },
      run: async (s) => { await s.flash(); await s.look('center', 1.0, m.BAR, 'cubic-bezier(.16,1,.3,1)'); await s.at(b(23, 0.25)); await s.caption('Pure black, for OLED screens', 'Looks'); } });
    add({ name: 'light', from: b(24), into: { type: 'smoothleft', d: 0.3 }, settle: 0.9,
      setup: async (s) => { await look(s, { theme: 'porcelain-light', scene: 'horizon' }); await s.look('center', 1.0); },
      run: async (s) => { await s.caption('Or light, if you like', 'Looks'); await s.look('center', 1.04, m.BAR + 0.3, 'linear'); } });
    add({ name: 'profiles', from: b(25), settle: 0.9,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false }); await s.look('#profile-chip', 2.1); },
      run: async (s) => {
        await s.caption('Profiles for work and home', 'Profiles');
        await s.at(b(25, 1) - 0.02);
        await s.js(async () => { const p = Nordlys.sync; const home = p.list().find((x) => x.name === 'Home'); await p.switchTo(home.id, { undo: false }); });
        await s.look('center', 1.0, m.BAR * 0.75, 'cubic-bezier(.45,0,.15,1)');
      } });
    add({ name: 'apps', from: b(26), into: { type: 'smoothright', d: 0.3 }, settle: 1.0,
      setup: async (s) => {
        await s.js(async () => { const p = Nordlys.sync; const work = p.list().find((x) => x.name === 'Work'); await p.switchTo(work.id, { undo: false }); });
        // The section lists the apps only while the dashboard is on.
        await look(s, { theme: 'tokyo-night', scene: 'polaris', dash: { layout: VIDEO } });
        await s.js(() => window.Nordlys.settings.open('dashboard'));
        // The drawer slides in; the grid is measured once it has stopped.
        await s.settle(1.3);
        await s.js(() => document.querySelector('.dash-connections')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await s.settle(0.5);
        await s.look('.dash-connections', 1.3);
      },
      run: async (s) => { await s.caption('Tasks from the apps you already use', 'Connected apps'); await s.look('.dash-connections', 1.4, m.BAR + 0.3, 'linear'); } });
    add({ name: 'inbox', from: b(27), settle: 1.6,
      setup: async (s) => {
        await s.js(() => window.Nordlys.settings.close());
        await look(s, { theme: 'tokyo-night', scene: 'polaris', dash: { layout: APPS } });
        await s.settle(1.2);
        await s.look(card('inbox'), 1.4);
        await s.pointer(true);
      },
      run: async (s) => {
        await s.caption('Everything that\'s due, in one list', 'Connected apps');
        const box = s.page.locator(`${card('inbox')} input[type="checkbox"], ${card('inbox')} .dash-task-check, ${card('inbox')} button[role="checkbox"]`).first();
        if (await box.count()) await s.clickOn(b(27, 2), box, 0.5);
      } });
    add({ name: 'agenda', from: b(28), keepCaption: true,
      setup: async (s) => { await s.pointer(false); await s.look(card('agenda'), 1.4); },
      run: async (s) => { await s.look(card('agenda'), 1.5, m.BAR + 0.3, 'linear'); } });
    add({ name: 'weather', from: b(29), settle: 1.6,
      setup: async (s) => { await look(s, { theme: 'nord-frost', scene: 'horizon', dash: { layout: TRAVEL } }); await s.settle(1.0); await s.look(card('weather'), 1.55); },
      run: async (s) => { await s.caption('Weather, clocks and countdowns', 'Dashboard'); await s.look(card('clocks'), 1.55, m.BAR + 0.3, 'cubic-bezier(.45,0,.2,1)'); } });
    add({ name: 'tidy', from: b(30), into: { type: 'fade', d: 0.35 }, settle: 0.8,
      setup: async (s) => { await look(s, { theme: 'tokyo-night', scene: 'polaris', dash: false }); await s.look('center', 1.0); await s.js(() => Nordlys.grid.arrange.enter()); },
      run: async (s) => {
        await s.caption('Tidy your folders in one click', 'Bookmarks');
        await s.pointer(true);
        await s.clickOn(b(30, 2), s.page.locator('.arrange-layout[data-layout="fitted"]'), 0.6);
      } });
    add({ name: 'find', from: b(31), settle: 0.5,
      setup: async (s) => { await s.pointer(false); await s.js(() => Nordlys.grid.arrange.exit()); await s.page.locator('#q').click(); await s.page.fill('#q', ''); await s.look('#searchwrap', 1.7); },
      run: async (s) => { await s.caption('Find any site as you type', 'Search'); await s.typeTo('git', b(31, 1.5), B / 2); } });
    add({ name: 'statement', from: b(32), into: { type: 'fade', d: 0.6 }, settle: 0.6,
      setup: async (s) => { await s.page.fill('#q', ''); await s.page.locator('#q').blur(); await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false, bare: true }); await s.look('center', 1.1); },
      run: async (s) => { await s.look('center', 1.02, 2 * m.BAR + 0.3, 'linear'); await s.at(b(32, 0.1)); await s.statement('No account.|Nothing tracked.'); } });
    // ── A recap on the beat ──
    const recap = [
      { name: 'recap-dash', look: { theme: 'oled-obsidian', scene: 'drift', dash: { layout: VIDEO } }, cam: ['center', 1.12, 1.0] },
      { name: 'recap-focus', focus: true, look: { theme: 'oled-obsidian' }, cam: ['#focus-mode .fm-ring', 1.35, 1.25] },
      { name: 'recap-sky', look: { theme: 'aurora-void', scene: 'baikal', dash: false, bare: true }, cam: ['center', 1.0, 1.1] },
      { name: 'recap-light', look: { theme: 'sakura-daylight', scene: 'nacre', dash: false }, cam: ['center', 1.1, 1.0] },
      { name: 'recap-home', look: { theme: 'gruvbox-dark', scene: 'pillars', dash: { layout: VIDEO } }, cam: ['center', 1.0, 1.08] },
      { name: 'recap-polaris', look: { theme: 'tokyo-night', scene: 'polaris', dash: false }, cam: ['center', 1.12, 1.0] }
    ];
    recap.forEach((r, i) => {
      add({ name: r.name, from: b(34 + Math.floor(i / 2), (i % 2) * 2), into: i % 3 === 1 ? { type: 'smoothleft', d: 0.25 } : undefined, settle: 0.9,
        setup: async (s) => {
          if (r.focus) { await look(s, { ...r.look, focus: true }); await s.js(() => window.Nordlys.focusMode.show()); }
          else await look(s, r.look);
          await s.look(r.cam[0], r.cam[1]);
        },
        run: async (s) => { await s.look(r.cam[0], r.cam[2], 2 * B + 0.3, 'cubic-bezier(.3,0,.3,1)'); } });
    });
    // ── The whole thing, then the name ──
    add({ name: 'hero', from: b(37), into: { type: 'fade', d: 0.8 }, settle: 1.0,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: { layout: VIDEO }, board: true }); await s.look('center', 1.2); },
      run: async (s) => { await s.look('center', 1.0, b(39) - b(37) + 0.7, 'cubic-bezier(.45,0,.15,1)'); await s.at(b(37, 1)); await s.caption('Free, and nothing to sign up for', 'Nordlys'); } });
    add({ name: 'end', from: b(39), into: { type: 'fade', d: 1.4 }, settle: 0.6,
      setup: async (s) => { await look(s, { dash: false, bare: true }); await s.look('center', 1.06); },
      run: async (s) => {
        await s.look('center', 1.0, to - b(39) + 0.5, 'linear');
        await s.card('<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>For Chrome, Edge, Firefox and Safari</p><div class="tags"><span>Free</span><span>No account</span><span>Open source</span></div>');
      } });
    return shots;
  }
};

// For the shorter cuts of the same film (films/rising-forest-store.cjs).
module.exports.helpers = { look, dashboardIn, card, routes, prepare, VIDEO, APPS, TRAVEL };
