/* A day already under way on the dashboard, for the camera: the promo
   video (tools/video/record2.cjs) and the store pictures use the same one.
   Runs in the page (page.evaluate), so it may use only what the page has.
   "video" is a layout made for the frame; any other name is a preset. Pass
   { preset, withBoard: true } to keep the folders on screen under the cards
   (page.evaluate takes one argument). */
function seedDashboard(arg) {
  const { preset, withBoard = false } = typeof arg === 'string' ? { preset: arg } : arg;
  const n = window.Nordlys, d = n.dashboard, K = window.NordlysWidgetKit;
  if (preset === 'video') {
    // A layout made for the frame: five rows, nothing too small to read.
    const cards = [['focus', 0, 0, 6, 2], ['countdown', 6, 0, 3, 2], ['clocks', 9, 0, 3, 2], ['tasks', 0, 2, 5, 3], ['habits', 5, 2, 4, 3], ['timer', 9, 2, 3, 3]];
    d.write({ ...d.state, on: true, seeded: true, widgets: cards.map(([type, x, y, w, h]) => ({ ...d.blank(type), x, y, w, h })) });
  } else d.applyPreset(preset);
  // The dashboard alone on camera: the cards large enough to read.
  d.write({ ...d.state, showBoard: Boolean(withBoard) });
  return d.render().then(async () => {
    const now = Date.now();
    for (const w of d.widgets()) {
      const key = d.dataKey(w);
      if (w.type === 'tasks') { const l = K.tasks.create(); for (const [x, o] of [['Write the release notes', { priority: true, due: K.dayOf(now) }], ['Reply to Anna', { due: K.dayOf(now) }], ['Book the dentist', { due: K.tasks.shift(now, 3) }], ['Water the plants', {}], ['Renew the passport', { due: K.tasks.shift(now, 12) }]]) K.tasks.add(l, x, now, o); d.persist(key, l); }
      if (w.type === 'focus') { const f = K.focus.create(); K.focus.set(f, 'Plan the week', now); d.persist(key, f); }
      if (w.type === 'notes') d.persist(key, { text: 'Keys are in the blue bowl.\nCall Mum on Sunday.' });
      if (w.type === 'habits') { const h = K.habits.create(); for (const [name, days] of [['Read', [0, 1, 2, 4, 5]], ['Walk', [3, 5]], ['Stretch', [4, 5]], ['No phone at dinner', [0, 1, 2, 3, 4, 5]], ['Water', [1, 3, 5]]]) { const x = K.habits.add(h, name); for (const i of days) K.habits.toggle(h, x.id, K.tasks.shift(now, i - 6)); } d.persist(key, h); }
      if (w.type === 'countdown') d.change(w.id, (x) => ({ ...x, settings: { title: 'the launch', date: K.tasks.shift(now, 18) } }));
      if (w.type === 'clocks') d.change(w.id, (x) => ({ ...x, settings: { zones: ['America/New_York', 'Europe/Lisbon', 'Asia/Tokyo'] } }));
      if (w.type === 'weather') d.change(w.id, (x) => ({ ...x, settings: { ...x.settings, place: { name: 'Oslo', lat: 59.91, lon: 10.75 } } }));
    }
    d.signature = '';
    await d.render();
    document.querySelectorAll('#toast-dock > *').forEach((t) => t.remove());
  });
}

module.exports = { seedDashboard };
