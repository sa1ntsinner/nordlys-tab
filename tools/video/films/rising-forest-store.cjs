/* The store cut, about 25 seconds: bars 3 to 16 of "Rising Forest", the
   same shots as the YouTube film (rising-forest.cjs), faster. It ends where
   the first drop gives way to the breakdown, so the music ends on its own. */
const MAP = require('../../../docs/video/music/rising-forest.json');
const full = require('./rising-forest.cjs');
const { look, card, routes, prepare, VIDEO } = full.helpers;

module.exports = {
  from: MAP.downbeats[3],
  clock: '09:41',
  routes,
  prepare,
  fadeOut: 1.6,
  shots(m) {
    const b = m.bar, B = m.BEAT;
    this.to = MAP.downbeats[16];
    const shots = [];
    const add = (shot) => shots.push(shot);
    add({ name: 'title', from: 0, settle: 0.6,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false, bare: true }); await s.look('center', 1.1); },
      run: async (s) => { await s.look('center', 1.03, m.BAR + 0.5, 'cubic-bezier(.3,0,.2,1)'); await s.card('<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>Your favourite sites, on every new tab</p>'); } });
    add({ name: 'reveal', from: b(4), into: { type: 'fade', d: 0.8 }, settle: 0.4,
      setup: async (s) => { await look(s, { dash: false, bare: true }); await s.look('center', 1.14); },
      run: async (s) => { await s.look('center', 1.0, m.BAR + 0.3, 'cubic-bezier(.45,0,.15,1)'); await s.bare(false); await s.at(b(4, 1)); await s.caption('Your favourite sites, in folders', 'Nordlys'); } });
    add({ name: 'command', from: b(5),
      setup: async (s) => { await look(s, { dash: false }); await s.page.locator('#q').click(); await s.page.fill('#q', ''); await s.look('#searchwrap', 1.9); },
      run: async (s) => {
        await s.caption('Commands after the > sign', 'Search');
        await s.typeTo('> sky polaris', b(5, 3.5), B / 4);
        await s.at(b(6) - 0.02); await s.page.keyboard.press('Enter');
        await s.look('center', 1.0, m.BAR, 'cubic-bezier(.7,0,.3,1)');
        await s.at(b(6, 1)); await s.caption(null);
      } });
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
      setup: async (s) => { await s.look(card('habits'), 1.75); const [x, y] = await s.centre(s.page.locator(`${card('habits')} .dash-habit-day.is-today`).nth(1)); await s.glide(x + 40, y + 60, 0); await s.pointer(true); },
      run: async (s) => { await s.clickOn(b(9, 1), s.page.locator(`${card('habits')} .dash-habit-day.is-today`).nth(1), 0.35); } });
    add({ name: 'clocks', from: b(9, 2),
      setup: async (s) => { await s.pointer(false); await s.look(card('clocks'), 1.7); },
      run: async (s) => { await s.look(card('countdown'), 1.7, b(10) - b(9, 2) + 0.2, 'cubic-bezier(.45,0,.2,1)'); } });
    add({ name: 'move', from: b(10),
      setup: async (s) => {
        await s.look('center', 1.0);
        const [hx, hy] = await s.centre(s.page.locator(`${card('clocks')} .dash-head h2`));
        await s.glide(hx + 36, hy + 64, 0); await s.pointer(true);
      },
      run: async (s) => {
        await s.caption('Drag cards anywhere', 'Dashboard');
        const head = s.page.locator(`${card('clocks')} .dash-head h2`);
        const [hx, hy] = await s.centre(head);
        const own = await s.page.locator(card('clocks')).boundingBox();
        const target = await s.page.locator(card('countdown')).boundingBox();
        await s.glide(hx - 20, hy, 0.35); await s.page.mouse.down(); await s.glide(hx - 10, hy + 8, 0.08);
        await s.at(b(10, 3) - 0.9); await s.glide(hx - 20 + (target.x - own.x), hy + (target.y - own.y), 0.85);
        await s.at(b(10, 3)); await s.page.mouse.up();
      } });
    for (const [i, preset] of ['calm', 'minimal'].entries()) {
      add({ name: `layout-${preset}`, from: b(11, i * 2), keepCaption: i > 0,
        setup: async (s) => { await s.pointer(false); await look(s, { dash: { preset } }); await s.look('center', 1.0); },
        run: async (s) => { if (i === 0) await s.caption('Five layouts to start from', 'Dashboard'); await s.look('center', 1.035, 2 * B + 0.2, 'linear'); } });
    }
    add({ name: 'focus', from: b(12), settle: 0.9,
      setup: async (s) => {
        await look(s, { theme: 'oled-obsidian', dash: { layout: VIDEO } });
        await s.js(() => window.Nordlys.focusMode.show());
        await s.settle(0.4);
        await s.page.locator('#focus-mode .fm-intent').fill('Write the release notes');
        await s.page.locator('#focus-mode .fm-go').click();
        await s.look('#focus-mode .fm-ring', 1.05);
      },
      run: async (s) => { await s.caption('One thing at a time', 'Focus mode', 'top'); await s.look('#focus-mode .fm-ring', 1.3, m.BAR + 0.3, 'cubic-bezier(.4,0,.2,1)'); } });
    for (const [i, theme] of ['porcelain-light', 'catppuccin-mocha', 'sakura-daylight', 'gruvbox-dark'].entries()) {
      // Soft wipes and a quick caption, as in the long film: the caption holds still while the colours change.
      add({ name: `theme-${theme}`, from: b(13, i), into: i ? { type: 'smoothleft', d: 0.24 } : undefined, keepCaption: i > 0, settle: 0.9,
        setup: async (s) => { await look(s, { theme, dash: i === 0 ? { layout: VIDEO } : undefined }); await s.look('center', 1.0); },
        run: async (s) => { if (i === 0) await s.caption('21 colour themes', 'Looks', null, true); } });
    }
    const skies = [['halo', 'nord-frost'], ['pillars', 'sunset-amber'], ['baikal', 'aurora-void'], ['drift', 'dracula-velvet']];
    skies.forEach(([scene, theme], i) => {
      add({ name: `sky-${scene}`, from: b(14, i), into: { type: 'fade', d: 0.16 }, keepCaption: i > 0, settle: 0.7,
        setup: async (s) => { await look(s, { theme, scene, dash: false, bare: true }); await s.look('center', 1.12); },
        run: async (s) => { if (i === 0) await s.caption('Nine skies, drawn live', 'Looks'); await s.look('center', 1.0, B + 0.4, 'cubic-bezier(.3,0,.3,1)'); } });
    });
    add({ name: 'end', from: b(15), into: { type: 'fade', d: 1.0 }, settle: 0.6,
      setup: async (s) => { await look(s, { theme: 'aurora-void', scene: 'aurora', dash: false, bare: true }); await s.look('center', 1.06); },
      run: async (s) => {
        await s.look('center', 1.0, m.BAR * 1.2, 'linear');
        await s.card('<img src="icons/icon.svg" alt=""><h1>Nordlys</h1><p>For Chrome, Edge, Firefox and Safari</p><div class="tags"><span>Free</span><span>No account</span><span>Open source</span></div>');
      } });
    return shots;
  }
};
