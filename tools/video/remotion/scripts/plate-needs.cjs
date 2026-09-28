/* How much of each plate the edits use: from which plate second to which,
   with the transitions' overlaps. A plate must be filmed a little longer. */
const edit = require('./edit-data.cjs')();
const FR = { cut: 0, whip: 14, whipUp: 14, zoom: 18, iris: 24, wipe: 20, fade: 20 };
const tf = (t) => (t ? t.frames ?? FR[t.type] ?? 0 : 0);
const need = {};
for (const cut of [edit.youtube, edit.appPreview]) {
  cut.shots.forEach((s, i) => {
    const next = cut.shots[i + 1];
    const pre = s.enter && s.enter.type !== 'cut' ? Math.ceil(tf(s.enter) / 2) : 0;
    const post = next && next.enter && next.enter.type !== 'cut' ? Math.ceil(tf(next.enter) / 2) : 0;
    const rate = s.rate ?? 1, tau = s.tau ?? 1;
    const plates = s.grid ? s.grid.plates : [s.plate, ...(s.window ? [s.window.backdrop] : [])];
    for (const p of plates) {
      const t0 = (p === s.window?.backdrop ? s.window.backdropTau ?? tau : tau);
      const a = t0 - (pre * rate) / 60, b = t0 + ((s.to - s.from + post) * rate) / 60;
      const n = (need[p] ||= { from: Infinity, to: 0, uses: [] });
      n.from = Math.min(n.from, a); n.to = Math.max(n.to, b); n.uses.push(`${cut.name}:${s.name}`);
    }
  });
}
for (const [p, n] of Object.entries(need).sort()) console.log(p.padEnd(24), n.from.toFixed(2).padStart(6), '->', n.to.toFixed(2).padStart(6), ' ', n.uses.join(' '));
