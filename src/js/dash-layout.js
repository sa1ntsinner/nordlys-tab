/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - WHERE THE DASHBOARD CARDS SIT
   ═══════════════════════════════════════════════════════════════════

   Pure: a layout is a list of { id, x, y, w, h } in whole cells of a grid
   twelve columns wide, and every function hands back a new list rather than
   changing the one it was given. Items fall upward like widgets on a phone
   home screen: there are no holes above a card unless something holds it.

     move      put one item at a cell; what it lands on moves out of the way
     resize    give one item a new size in cells, within its own limits
     firstFit  where a new item of a size would go, reading like a page
     compact   let everything rise until something holds it
     reflow    the same order on fewer columns, for a narrower window     */
(function (root) {
  "use strict";

  const COLS = 12;
  const MAX_H = 12;
  const clone = (items) => items.map((it) => ({ ...it }));
  const int = (value, fallback) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback);
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

  const collides = (a, b) => a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const height = (items) => items.reduce((most, it) => Math.max(most, it.y + it.h), 0);
  const byReading = (a, b) => a.y - b.y || a.x - b.x;

  /* Everything rises as far as it can, top rows first. The pinned item (the
     one being moved) settles before others level with it, so it keeps the
     place it was dropped on. */
  function compact(items, pinned = null) {
    const order = clone(items).sort((a, b) => a.y - b.y || (a.id === pinned ? -1 : b.id === pinned ? 1 : 0) || a.x - b.x);
    const done = [];
    for (const it of order) {
      while (it.y > 0 && !done.some((other) => collides({ ...it, y: it.y - 1 }, other))) it.y--;
      done.push(it);
    }
    return items.map((it) => done.find((d) => d.id === it.id));
  }

  // Whatever overlaps `mover` goes below it, and so on down the line.
  function pushDown(list, mover) {
    const queue = [mover];
    while (queue.length) {
      const current = queue.shift();
      for (const other of list.filter((it) => collides(current, it)).sort(byReading)) {
        if (other.id === mover.id) continue;
        other.y = current.y + current.h;
        queue.push(other);
      }
    }
  }

  function move(items, id, x, y) {
    const list = clone(items);
    const it = list.find((i) => i.id === id);
    if (!it) return list;
    const from = { x: it.x, y: it.y };
    it.x = clamp(int(x, it.x), 0, COLS - it.w);
    it.y = Math.max(0, int(y, it.y));
    const hit = list.filter((other) => collides(it, other));
    /* Landing squarely on one card the same size is a swap: it takes the
       place the moved one left, the way two icons trade places. */
    if (hit.length === 1 && hit[0].w === it.w && hit[0].h === it.h) {
      const other = hit[0];
      const back = { ...other, x: from.x, y: from.y };
      if (!list.some((o) => o.id !== other.id && o.id !== it.id && collides(back, o))) {
        other.x = from.x;
        other.y = from.y;
        return compact(list, id);
      }
    }
    pushDown(list, it);
    return compact(list, id);
  }

  /* Two cards trade places: the first takes the other's corner, the other
     sits just after it on that row if there is room, or where the first one
     was. Whatever they now cover moves down. */
  function swap(items, aId, bId) {
    const list = clone(items);
    const a = list.find((i) => i.id === aId), b = list.find((i) => i.id === bId);
    if (!a || !b) return list;
    const from = { x: a.x, y: a.y };
    a.x = clamp(b.x, 0, COLS - a.w);
    a.y = b.y;
    const after = a.x + a.w;
    b.x = after + b.w <= COLS && from.y <= a.y + a.h ? after : clamp(from.x, 0, COLS - b.w);
    b.y = after + b.w <= COLS ? a.y : from.y;
    const settled = [a, b];
    for (const other of list.filter((i) => i !== a && i !== b).sort(byReading)) {
      while (settled.some((placed) => collides(other, placed))) other.y++;
      settled.push(other);
    }
    return compact(list, aId);
  }

  function resize(items, id, w, h) {
    const list = clone(items);
    const it = list.find((i) => i.id === id);
    if (!it) return list;
    const minW = it.minW || 1, minH = it.minH || 1;
    it.w = clamp(int(w, it.w), minW, Math.max(minW, Math.min(it.maxW || COLS, COLS - it.x)));
    it.h = clamp(int(h, it.h), minH, it.maxH || MAX_H);
    pushDown(list, it);
    return compact(list, id);
  }

  function firstFit(items, w, h, fromY = 0) {
    const width = clamp(w, 1, COLS);
    for (let y = fromY; ; y++) {
      for (let x = 0; x + width <= COLS; x++) {
        const probe = { id: "\u0000probe", x, y, w: width, h };
        if (!items.some((it) => collides(probe, it))) return { x, y };
      }
    }
  }

  /* A layout from storage, a backup or another device is made whole: whole
     cells, inside the grid, nothing overlapping, and a place for anything
     that has none. `defaults` gives a size to an item that lacks one. */
  function normalize(items, defaults = {}) {
    const placed = [];
    const homeless = [];
    for (const raw of items || []) {
      if (!raw || typeof raw.id !== "string") continue;
      const size = defaults[raw.id] || {};
      const it = { ...raw };
      it.w = clamp(int(it.w, size.w || 3), 1, COLS);
      it.h = clamp(int(it.h, size.h || 2), 1, MAX_H);
      if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) { homeless.push(it); continue; }
      it.x = clamp(int(it.x, 0), 0, COLS - it.w);
      it.y = Math.max(0, int(it.y, 0));
      placed.push(it);
    }
    const out = [];
    for (const it of placed.sort(byReading)) {
      while (out.some((other) => collides(it, other))) it.y++;
      out.push(it);
    }
    for (const it of homeless) {
      Object.assign(it, firstFit(out, it.w, it.h));
      out.push(it);
    }
    return compact(out);
  }

  /* Fewer columns: each item as wide as it was, or the whole row if that is
     less, placed in reading order so the page still reads the same way. */
  function reflow(items, cols) {
    const order = clone(items).sort(byReading);
    if (cols <= 1) {
      let y = 0;
      return order.map((it) => { const out = { ...it, x: 0, w: 1, y }; y += it.h; return out; });
    }
    const out = [];
    let floor = 0;
    for (const it of order) {
      const w = Math.min(cols, it.w);
      let spot = null;
      for (let y = floor; !spot; y++) {
        for (let x = 0; x + w <= cols; x++) {
          const probe = { id: "\u0000probe", x, y, w, h: it.h };
          if (!out.some((o) => collides(probe, o))) { spot = { x, y }; break; }
        }
      }
      const placed = { ...it, w, ...spot };
      out.push(placed);
      floor = placed.y;
    }
    return out;
  }

  const api = { COLS, MAX_H, collides, compact, move, swap, resize, firstFit, normalize, reflow, height };
  root.NordlysDashLayout = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
