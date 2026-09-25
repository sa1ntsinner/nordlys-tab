/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - ONE PAGE FIT
   ═══════════════════════════════════════════════════════════════════

   An opt-in promise: the clock, the search field, every visible folder and
   the hidden-folder dock sit inside the window at once, with no scrollbar.
   It is not the Fitted layout — Fitted decides how folders share a row;
   this decides how much of the window the whole page may take.

   Two stages, the gentlest first, and nothing that is worked out is ever
   saved into the settings: they keep what somebody chose, and the page only
   borrows smaller values while the window is too short for them.

   1. Compact. Spacing and the page's own chrome — the padding above and
      below, the gaps, the clock — close up toward readable floors, and only
      then do the bookmarks shrink, never below the 56px the grid already
      keeps as its smallest tile. One number, t, walks the way from what was
      chosen (0) to every floor (1); the least t that fits is searched for.
   2. Scale. If even the floors do not fit, one surface that holds the normal
      page content — and nothing else — is zoomed as a whole, by as much as it
      needs. CSS zoom is layout-aware: the page really is that much shorter,
      so there is nothing to scroll. The board keeps the width it had on
      screen, so a dense board gains columns as it is zoomed out instead of
      only shrinking. Pointer coordinates stay the ones the browser reports;
      grid.js and board-arrange.js divide by currentCSSZoom wherever they turn
      a measured box back into CSS lengths.

   The settings drawer, the gear, dialogs, menus, toasts and the copy in hand
   during a drag live outside that surface and are never scaled. Nothing is
   hidden to make room: a board too dense to read at the size it needs is
   one switch away from the ordinary scrolling page.

   Cost. Every trial size restyles the whole board (an inherited custom
   property, or a zoom, reaches every tile), so the search is built to need
   few of them: the page already wears the last answer, and a pass that
   finds it still fits stops there. A new tab has nothing on yet, so the
   answer this window and board settled on last time is kept aside
   (localStorage, a few windows' worth, not the config) and worn from the
   first layout; one measurement confirms it or sends the pass on to search.
   The search is false position between two measured points, and for the
   zoom a model of how a board reflows, then a correction. The work runs
   when something that changes the answer happens — a resize, the visual
   viewport, fonts, the board, a setting, a config from storage — coalesced
   to one pass a frame (spaced out while a window is dragged, when a pass is
   expensive), never while a drag is in the air or the board is being
   arranged, and never on an idle frame. */
(function () {
  "use strict";

  /* The floors compaction may reach, in CSS pixels. A measure that already
     starts below its floor stays where it is. */
  const FLOORS = Object.freeze({
    padTop: 12, padBottom: 12, gap: 10, clock: 48, dateTop: 2, searchTop: 0,
    cardTop: 8, cardBottom: 10, cardGap: 6, tileGap: 4,
    gridGap: 6, boardGap: 8, tile: 56
  });
  // Spacing (the first half of t) goes before the bookmarks themselves shrink.
  const SPACING = ["padTop", "padBottom", "gap", "clock", "dateTop", "searchTop", "cardTop", "cardBottom", "cardGap", "tileGap", "gridGap", "boardGap"];
  // Sub-pixel rounding may leave a fraction over; the fit keeps a pixel spare.
  const SPARE = 1;
  const MIN_ZOOM = 0.01;
  /* Below this width the stylesheet gives every folder a line of its own
     (main.css, max-width: 860px). Zoomed, such a board may instead be laid
     out as a desktop board, or it could never gain a column from the room
     zooming gives it; whichever fits at the larger zoom is worn. */
  const NARROW = 860;
  /* A stack is kept over the desktop flow unless the flow fits at more than
     this much larger a zoom: a few percent is not worth a different page. */
  const STACK_PREFERRED = 0.92;
  // A pass that took longer than this waits a little before the next one.
  const EXPENSIVE_MS = 24;
  const SPACING_MS = 160;

  const lerp = (from, to, amount) => from + (to - from) * amount;
  const round = (value, places = 2) => { const f = 10 ** places; return Math.round(value * f) / f; };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  /* The measures at a point t along the way from what was chosen (0) to the
     floors (1). Spacing closes up over the first half; the bookmarks shrink
     over the second. */
  function measuresAt(base, t, floors = FLOORS) {
    const amount = clamp(Number(t) || 0, 0, 1);
    const spacing = Math.min(1, amount * 2);
    const tiles = Math.max(0, amount * 2 - 1);
    const out = {};
    for (const key of Object.keys(base)) {
      const start = Number(base[key]);
      if (!Number.isFinite(start)) continue;
      const floor = Math.min(start, floors[key] ?? start);
      out[key] = round(lerp(start, floor, key === "tile" ? tiles : SPACING.includes(key) ? spacing : 0));
    }
    return out;
  }

  /* How close to the window a fit has to come before it stops looking: a
     couple of percent of the height, never less than eight pixels. */
  const toleranceFor = (room) => Math.max(8, room * 0.02);

  /* The point nearest the room that still fits, for a height that moves one
     way with x. `good` fits and `bad` does not, each { x, need }; measure(x)
     lays the page out at x and returns its height. False position, kept away
     from the ends so it cannot stall, for at most `probes` layouts. Returns
     the best fitting point and the last one measured, so the caller knows
     whether the page is still wearing the answer. */
  function solveFit(measure, good, bad, target, { tolerance = 8, probes = 4 } = {}) {
    let fit = good;
    let miss = bad;
    let last = null;
    for (let i = 0; i < probes; i++) {
      if (target - fit.need <= tolerance) break;
      const span = Math.abs(miss.x - fit.x);
      if (span < 1e-3) break;
      const low = Math.min(fit.x, miss.x) + span * 0.1;
      const high = Math.max(fit.x, miss.x) - span * 0.1;
      const slope = (miss.need - fit.need) || 1e-6;
      const x = clamp(fit.x + (miss.x - fit.x) * (target - tolerance / 2 - fit.need) / slope, low, high);
      last = { x, need: measure(x) };
      if (last.need <= target) fit = last;
      else miss = last;
    }
    return { fit, last };
  }

  /* The zoom at which a surface fits, from one measurement of it unzoomed.
     The parts above the board just scale: z · rest. The board keeps its
     width on screen, so zoomed out it has 1/z more room across and needs
     about z as many lines, each z as tall: z² · board. */
  function zoomModel(room, rest, board) {
    if (!(room > 0)) return MIN_ZOOM;
    if (!(board > 0)) return clamp(room / (rest || room), MIN_ZOOM, 1);
    const z = (-rest + Math.sqrt(rest * rest + 4 * board * room)) / (2 * board);
    return clamp(z, MIN_ZOOM, 1);
  }

  /* How tall a board is with `capacity` across: each run (the whole board,
     or one row somebody made) breaks into lines as grid.js breaks it, a line
     is as tall as its tallest folder, and one gap sits between lines and
     between rows alike. */
  function boardHeight(plan, capacity) {
    let total = 0;
    let lines = 0;
    for (const run of plan.runs) {
      const counts = plan.balance(run.widths, plan.gap, capacity);
      let at = 0;
      for (const count of counts) {
        total += Math.max(...run.heights.slice(at, at + count));
        at += count;
        lines++;
      }
    }
    return total + plan.gap * Math.max(0, lines - 1);
  }

  /* The largest zoom at which predict(z) still fits, where a taller page is
     mostly a larger zoom but a line breaking differently can make it jump:
     walked down from 1 in small steps to the first that fits, then narrowed
     between it and the step above. Pure arithmetic — no layout. */
  function largestZoom(predict, target, min = MIN_ZOOM, max = 1) {
    let above = max;
    if (predict(max) <= target) return max;
    let z = max;
    while (z > min) {
      above = z;
      z = Math.max(min, z * 0.98);
      if (predict(z) <= target) break;
    }
    if (predict(z) > target) return min;
    let good = z;
    let bad = above;
    for (let i = 0; i < 14; i++) {
      const middle = (good + bad) / 2;
      if (predict(middle) <= target) good = middle;
      else bad = middle;
    }
    return good;
  }

  const px = (value) => parseFloat(value) || 0;

  /* The answer a window settled on, remembered for the next new tab so it
     can wear it from the first layout instead of searching again. A few
     windows' worth, newest first; never part of the config or a backup. */
  const HINT_STORE = "nordlys_fit_hint";
  const HINT_VERSION = 1;
  const HINTS_KEPT = 4;
  // How long a window has to stay one size before its answer is kept.
  const HINT_SETTLE_MS = 600;

  // FNV-1a over the text, with its length: short, stable, not secret.
  function fingerprint(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`;
  }

  /* A remembered answer is written straight into the page's style, so only
     custom properties with short values pass. */
  function validHint(hint) {
    if (!hint || typeof hint.key !== "string" || (hint.stage !== "compact" && hint.stage !== "scaled")) return false;
    if (!Number.isFinite(hint.need) || !Number.isFinite(hint.zoom) || !Number.isFinite(hint.t) || !hint.values || typeof hint.values !== "object") return false;
    return Object.entries(hint.values).every(([name, value]) => /^--[a-z-]+$/.test(name) && typeof value === "string" && value.length < 200);
  }

  class PageFit {
    constructor(app) {
      this.app = app;
      this.root = document.documentElement;
      this.page = document.getElementById("page");
      this.surface = document.getElementById("fit-surface");
      this.suggestions = document.getElementById("sugg");
      this.suspended = new Set();
      this.state = { stage: "off", t: 0, zoom: 1 };
      this.written = [];
      this.frame = 0;
      this.timer = 0;
      this.fitting = false;
      this.pending = false;
      this.observed = null;
      this.cost = 0;
      this.endedAt = -Infinity;
      // Trial layouts since the page opened; the tests read it to see a pass stop early.
      this.trials = 0;
      // Whether the first pass wore a remembered answer: "none", "used" or "stale".
      this.hinted = "none";
      this.opened = null;
      this.remembered = null;
      this.hintTimer = 0;
      if (!this.page || !this.surface) return;

      const soon = () => this.request();
      window.addEventListener("resize", soon, { passive: true });
      window.visualViewport?.addEventListener("resize", soon, { passive: true });
      document.fonts?.addEventListener?.("loadingdone", soon);
      document.fonts?.ready?.then(soon);
      /* A catch-all for whatever changes the page's height without telling
         anybody — a greeting that wraps, an icon, Custom CSS. The surface's
         own size is what a fit changes, so the size a fit leaves behind is
         taken as the new normal rather than as a reason to fit again. */
      if (typeof ResizeObserver === "function") {
        this.observer = new ResizeObserver(([entry]) => {
          const box = entry.borderBoxSize?.[0];
          const size = box ? { w: box.inlineSize, h: box.blockSize } : { w: entry.contentRect.width, h: entry.contentRect.height };
          const known = this.observed;
          this.observed = size;
          if (known && (Math.abs(known.w - size.w) > 1 || Math.abs(known.h - size.h) > 1)) this.request();
        });
        this.observer.observe(this.surface);
      }
    }

    get enabled() { return this.app?.config?.onePageFit === true; }
    get active() { return this.enabled && this.suspended.size === 0; }
    get zoom() { return this.state.zoom; }

    /* One pass on the next frame however many things ask, or now. A pass
       that was expensive spaces the next one out, so dragging a window's edge
       over a dense board is a few fits rather than one a frame. */
    request({ now = false } = {}) {
      if (now) {
        cancelAnimationFrame(this.frame);
        clearTimeout(this.timer);
        this.frame = 0;
        this.timer = 0;
        this.fit();
        return;
      }
      if (this.frame || this.timer) return;
      const run = () => {
        this.frame = 0;
        const wait = this.cost > EXPENSIVE_MS ? SPACING_MS - (performance.now() - this.endedAt) : 0;
        if (wait > 0) {
          this.timer = setTimeout(() => { this.timer = 0; this.request(); }, wait);
          return;
        }
        this.fit();
      };
      this.frame = requestAnimationFrame(run);
    }

    /* Arranging edits the very sizes compaction borrows smaller copies of,
       and drags on a board at its own scale; while it is open the page is the
       ordinary one. */
    suspend(reason, on) {
      const had = this.suspended.has(reason);
      if (on) this.suspended.add(reason);
      else this.suspended.delete(reason);
      if (had !== Boolean(on)) this.request({ now: true });
    }

    /* A new tab, about to lay its board out for the first time. If this
       window and this board settled somewhere before, the page wears that
       before the board is built, so the first layout the board ever gets is
       the fitted one; the pass that follows the render only confirms it. */
    prepare() {
      if (!this.page || !this.active || this.state.stage !== "off" || this.written.length || this.fitting) return;
      // Read before the board is built, while the page has nothing to scroll.
      const room = this.root.clientHeight;
      const width = this.root.clientWidth;
      const hint = this.recall(this.hintKey(room, width));
      if (!hint) return;
      this.hold();
      this.trials++;
      this.write(hint.values, { wide: hint.wide });
      this.prepared = { hint, room, width };
    }

    /* A copy lifted off the board wears the board's measures and scale, so it
       is the same size in hand as it was in place. Returns the scale. */
    dress(node) {
      if (!node || !this.page || (this.state.stage !== "compact" && this.state.stage !== "scaled")) return 1;
      for (const name of this.written) node.style.setProperty(name, this.page.style.getPropertyValue(name));
      node.setAttribute("data-fit-compact", "");
      // A folder from a board laid out wide keeps its columns in hand.
      node.toggleAttribute("data-fit-wide", this.page.hasAttribute("data-fit-wide"));
      if (this.state.zoom < 1) node.style.zoom = String(this.state.zoom);
      return this.state.zoom;
    }

    /* Every trial writes its whole set at once: one restyle, not one per
       property. Only what changed is touched. */
    write(values, { wide = false } = {}) {
      const style = this.page.style;
      const names = Object.keys(values);
      for (const name of this.written) if (!(name in values)) style.removeProperty(name);
      for (const name of names) if (style.getPropertyValue(name) !== values[name]) style.setProperty(name, values[name]);
      this.written = names;
      this.page.toggleAttribute("data-fit-compact", names.length > 0);
      this.page.toggleAttribute("data-fit-wide", wide);
    }

    clear() {
      this.write({});
      this.page.removeAttribute("data-fit-stage");
      this.suggestions?.style.removeProperty("--fit-sugg-max");
      // Off leaves the markup exactly as it was, not an empty style="".
      for (const node of [this.page, this.suggestions]) if (node && !node.style.length) node.removeAttribute("style");
    }

    /* The page's own measures as the stylesheet gives them for this window
       and these settings, read with nothing borrowed. */
    readBase() {
      const cfg = this.app.config || {};
      const style = (selector) => {
        const node = this.surface.querySelector(selector);
        return node ? getComputedStyle(node) : null;
      };
      const page = getComputedStyle(this.page);
      const clock = style("#clock");
      const date = style("#date");
      const search = style("#searchwrap");
      const card = style("#board .card");
      const tile = style("#board .tile");
      const board = style("#board");
      const base = {
        padTop: px(page.paddingTop),
        padBottom: px(page.paddingBottom),
        gap: px(page.rowGap),
        gridGap: Number.isFinite(cfg.cardGap) ? cfg.cardGap : 12,
        tile: Math.max(56, Number.isFinite(cfg.tileSize) ? cfg.tileSize : 78)
      };
      if (clock) base.clock = px(clock.fontSize);
      if (date) base.dateTop = px(date.marginTop);
      if (search) base.searchTop = px(search.marginTop);
      if (card) Object.assign(base, { cardTop: px(card.paddingTop), cardBottom: px(card.paddingBottom), cardGap: px(card.rowGap) });
      if (tile) base.tileGap = px(tile.rowGap);
      if (board) base.boardGap = px(board.rowGap);
      return base;
    }

    /* What sits over the page's corners and is never scaled: the gear
       (bottom right, or top right on a phone) and the One page fit switch
       above the clock (beside the gear on a phone). */
    chrome() {
      return ["gear", "fit-toggle"]
        .map((id) => document.getElementById(id))
        .filter((node) => node && node.getClientRects().length)
        .map((node) => node.getBoundingClientRect())
        .filter((box) => box.width);
    }

    /* A board wide enough to pass under a piece of chrome keeps that much
       room clear below it (or above it). A clock that reaches across under
       one at the top keeps the room above it at every step (head): the clock
       is always at the top of the page, so that is never a question. */
    gearRoom() {
      const room = { top: 0, bottom: 0, head: 0 };
      const height = this.root.clientHeight;
      const across = (a, b) => a.width && a.right > b.left - 8 && a.left < b.right + 8;
      const board = document.getElementById("board")?.getBoundingClientRect();
      const hero = [...this.surface.querySelectorAll("#hero > *")].filter((node) => node.getClientRects().length).map((node) => node.getBoundingClientRect());
      for (const g of this.chrome()) {
        const top = g.top < height / 2;
        if (top && hero.some((box) => across(box, g))) room.head = Math.max(room.head, g.bottom + 8);
        if (!board || !across(board, g)) continue;
        if (top) room.top = Math.max(room.top, g.bottom + 8);
        else room.bottom = Math.max(room.bottom, height - g.top + 8);
      }
      return room;
    }

    compactValues(m) {
      const values = {};
      if (m.tile !== undefined) values["--tw"] = `clamp(56px, 12vw, ${m.tile}px)`;
      if (m.gridGap !== undefined) values["--grid-gap"] = `${m.gridGap}px`;
      if (m.boardGap !== undefined) values["--board-gap-set"] = `${m.boardGap}px`;
      /* A squircle's corner is a share of the tile, declared on the root
         against the root's tile size; declared again here it follows the
         smaller one. */
      const radius = this.root.style.getPropertyValue("--tile-radius");
      if (m.tile !== undefined && radius.includes("var(--tw)")) values["--tile-radius"] = radius;
      const own = { padTop: "--fit-pad-top", padBottom: "--fit-pad-bottom", gap: "--fit-gap", clock: "--fit-clock", dateTop: "--fit-date-top", searchTop: "--fit-search-top", cardTop: "--fit-card-top", cardBottom: "--fit-card-bottom", cardGap: "--fit-card-gap", tileGap: "--fit-tile-gap" };
      for (const [key, name] of Object.entries(own)) if (m[key] !== undefined) values[name] = `${m[key]}px`;
      return values;
    }

    pads() {
      const page = getComputedStyle(this.page);
      return px(page.paddingTop) + px(page.paddingBottom);
    }

    // What the page needs from the top of the window to its last pixel.
    need() {
      return this.pads() + this.surface.getBoundingClientRect().height;
    }

    /* The whole pass. Ends on a state it measured to fit or — for a board
       that cannot fit even at 1% — on the smallest it tried, which then
       scrolls rather than hiding anything. */
    fit() {
      if (!this.page || !this.surface || this.fitting) return;
      const grid = this.app.grid;
      if (grid?.isDragging || grid?.frozen) { this.pending = true; return; }
      this.pending = false;
      const started = performance.now();
      if (!this.active) {
        if (this.root.getAttribute("data-page-fit") === "on" || this.state.stage !== "off") {
          this.root.removeAttribute("data-page-fit");
          this.clear();
          this.state = { stage: "off", t: 0, zoom: 1 };
          grid?.flowRows?.();
          this.finish(started);
        }
        return;
      }
      // A trial made before the render (prepare) belongs to this pass.
      const trials = this.trials - (this.prepared ? 1 : 0);
      this.fitting = true;
      this.page.classList.add("fit-measuring");
      try {
        this.root.setAttribute("data-page-fit", "on");
        this.solve();
      } finally {
        this.page.classList.remove("fit-measuring");
        this.root.removeAttribute("data-fit-measuring");
        this.fitting = false;
      }
      this.finish(started);
      // The first pass of the page, as a new tab pays for it; the tests read it.
      this.opened ??= { trials: this.trials - trials, ms: round(this.cost, 1), hint: this.hinted, stage: this.state.stage, zoom: this.state.zoom };
    }

    /* While trial layouts run the document may not grow a scrollbar: a
       classic one would narrow the window the board is measured in, and cost
       a layout of its own each time it came or went. Held only for the length
       of a pass that measures, so a page that ends up taller than the window
       (a board past the 1% floor) still scrolls. */
    hold() {
      if (!this.root.hasAttribute("data-fit-measuring")) this.root.setAttribute("data-fit-measuring", "");
    }

    solve() {
      const reflow = () => this.app.grid?.flowRows?.();
      const room = this.root.clientHeight;
      const width = this.root.clientWidth;
      const target = room - SPARE;
      const tolerance = toleranceFor(room);
      const previous = this.state;
      // A new tab, or the switch just turned on: nothing borrowed yet.
      const cold = previous.stage === "off";
      let key = null;
      const keyed = () => (key ??= this.hintKey(room, width));
      // What a searching pass leaves for the next: at once for a new tab.
      const keep = () => ({ key: keyed().key, now: cold });

      /* If this window and this board settled somewhere before — when a tab
         last opened, or when the window was last this size — that is tried
         before any search: one layout confirms it, and anything but a close
         fit sends the pass on. A new tab wears it from its very first layout,
         so its first frame is fitted either way. */
      let hint = null;
      const tryHint = (worn = false) => {
        if (!worn) {
          this.trials++;
          this.write(hint.values, { wide: hint.wide });
          reflow();
        }
        worn = this.need();
        // Kept when it fits and is the page it was worked out for, give or take
        // a hairline, or fits closely whatever changed.
        const kept = worn <= target && (Math.abs(worn - hint.need) <= tolerance / 2 || target - worn <= tolerance);
        if (cold) this.hinted = kept ? "used" : "stale";
        return kept ? worn : null;
      };
      if (cold) {
        this.hold();
        this.hinted = "none";
        // Worn since before the render (prepare), and laid out with it: only measured.
        const ready = this.prepared;
        this.prepared = null;
        const early = ready && ready.room === room && ready.width === width;
        hint = early ? ready.hint : this.written.length ? null : this.recall(keyed());
        if (hint) {
          const worn = tryHint(early);
          if (worn !== null) return this.settleOn(hint.stage, hint.t, hint.zoom, room, width, worn);
        }
      }
      if (!hint) reflow();

      /* The page already wears the last answer. After a render, a font or a
         small resize it usually still fits, closely enough to keep. */
      const wearing = this.written.length > 0;
      let need = this.need();
      const sameWindow = previous.room === room && previous.width === width;
      if (!wearing && need <= target && !this.underGear()) return this.settleOn("natural", 0, 1, room, width, need, cold ? keep() : null);
      /* Kept when it is the height the last pass settled on — nothing that
         matters has changed — or when it still fits closely enough. */
      const unchanged = Math.abs(need - (previous.need ?? -Infinity)) < 1;
      if (wearing && !hint && sameWindow && need <= target && (unchanged || target - need <= tolerance)) {
        return this.settleOn(previous.stage, previous.t, previous.zoom, room, width, need);
      }

      // From here the pass would search; an open tab looks for an answer first.
      this.hold();
      if (!cold) {
        hint = this.recall(keyed());
        if (hint) {
          const worn = tryHint();
          if (worn !== null) return this.settleOn(hint.stage, hint.t, hint.zoom, room, width, worn);
        }
      }

      // Otherwise from the page as the stylesheet draws it.
      if (wearing || hint) { this.clear(); reflow(); need = this.need(); }
      if (need <= target && !this.underGear()) return this.settleOn("natural", 0, 1, room, width, need, keep());

      /* The gear and the One page fit switch sit over corners of the window.
         The page is fitted as the stylesheet spaces it (and with the clock
         kept below a switch it would reach under); only if a folder then lies
         under one of them is it fitted again keeping that corner clear at
         every step, however little padding the page has there. Most boards
         end in a centred line that stops short of it. The top and the bottom
         are each taken up once, as they are found. */
      const base = this.readBase();
      const corner = this.gearRoom();
      const context = { reflow, target, tolerance, need, base };
      let gear = { top: Math.min(base.padTop, corner.head), bottom: Math.min(base.padBottom, corner.bottom) };
      let found = this.search({ ...context, gear });
      for (let i = 0; i < 2; i++) {
        const hit = this.underChrome();
        const next = {
          top: hit.top ? Math.max(gear.top, corner.top, corner.head) : gear.top,
          bottom: hit.bottom ? Math.max(gear.bottom, corner.bottom) : gear.bottom
        };
        if (next.top === gear.top && next.bottom === gear.bottom) break;
        gear = next;
        found = this.search({ ...context, gear, again: found.floor });
      }
      return this.settleOn(found.stage, found.t, found.zoom, room, width, found.need, keep());
    }

    /* Compaction, then zoom, from the page as the stylesheet draws it. Ends
       with the page wearing what it returns: { stage, t, zoom, need }, and
       for a zoom, what the page measured with every floor on. A second
       search for the gear's corner starts from that (again): padding is
       outside the surface, so none of it changes but the height. */
    search({ reflow, target, tolerance, need, base, gear, again = null }) {
      const compactAt = (t) => {
        const m = measuresAt(base, t);
        if (gear.bottom > m.padBottom) m.padBottom = round(gear.bottom);
        if (gear.top > m.padTop) m.padTop = round(gear.top);
        return this.compactValues(m);
      };
      const trial = (t) => { this.trials++; this.write(compactAt(t)); reflow(); return this.need(); };

      let floor;
      if (again) {
        const all = compactAt(1);
        const more = Math.max(0, px(all["--fit-pad-bottom"]) - again.padBottom);
        const above = Math.max(0, px(all["--fit-pad-top"]) - again.padTop);
        floor = { ...again, need: again.need + more + above, pads: again.pads + more + above, padBottom: again.padBottom + more, padTop: again.padTop + above };
      } else {
        // Padding is outside the surface, so the chrome's share adds straight on.
        const start = { x: 0, need: need + Math.max(0, gear.bottom - base.padBottom) + Math.max(0, gear.top - base.padTop) };
        if (start.need <= target) {
          const at = trial(0);
          if (at <= target) return { stage: "compact", t: 0, zoom: 1, need: at };
        }
        const floorNeed = trial(1);
        if (floorNeed <= target) {
          const { fit, last } = solveFit(trial, { x: 1, need: floorNeed }, start, target, { tolerance });
          if (last && last !== fit) trial(fit.x);
          return { stage: "compact", t: fit.x, zoom: 1, need: fit.need };
        }
        const boardNode = document.getElementById("board");
        const box = boardNode?.getBoundingClientRect();
        // Below 860px the stylesheet stacks folders, one to a line.
        const stacked = typeof matchMedia === "function" && matchMedia(`(max-width: ${NARROW}px)`).matches;
        /* The shortest a stack of these folders could ever be: each of them
           a single line of bookmarks, as short as the shortest is now. */
        const heights = stacked && boardNode ? [...boardNode.querySelectorAll(".card")].map((card) => card.getBoundingClientRect().height) : [];
        const measured = getComputedStyle(this.page);
        floor = {
          need: floorNeed, pads: this.pads(), padBottom: px(measured.paddingBottom), padTop: px(measured.paddingTop),
          boardWidth: box?.width || 0, boardTall: box?.height || 0, stacked,
          shortest: heights.length ? heights.length * Math.min(...heights) * 0.9 : 0,
          plan: box?.width ? this.boardPlan(stacked) : null
        };
      }

      /* Every floor and still too tall: zoom, holding the board's width on
         screen. How tall the board is at any zoom is worked out here rather
         than laid out: the lines break exactly as grid.js breaks them
         (NordlysBoardLayout.balance over each folder's own width), and a
         line is as tall as its tallest folder. One layout confirms it. */
      const all = compactAt(1);
      const { boardWidth, boardTall, stacked, shortest } = floor;
      /* On a phone the gear is over the top corner, and the switch is above
         the clock everywhere. Zoomed out, the board rises toward them, so the
         page keeps its top clear of them too: compactAt holds the top padding
         at gear.top, and the floor was measured (or, handed on, corrected)
         with it, so its pads already count it. */
      const pads = floor.pads;
      const rest = Math.max(0, floor.need - floor.pads - boardTall);
      let worn = null;
      // Wide: folders flow at their own widths across the held board.
      const scaled = (z, wide = boardWidth > 0) => {
        this.trials++;
        const values = Object.assign({}, all, { "--fit-zoom": String(round(z, 4)) });
        if (wide) values["--fit-board-w"] = `${round(boardWidth / z)}px`;
        this.write(values, { wide });
        reflow();
        worn = { x: z, wide };
        return { x: z, need: this.need(), wide };
      };

      /* The prediction is made from a plan of the board read at some zoom.
         Read at 1 it is exact, bar one thing: zoomed far out, Chrome keeps a
         hairline border at least one device pixel wide, so every folder
         grows by a pixel or two of its own lengths and lines break a little
         sooner. A guess that turns out over is re-planned from the zoom it
         was tried at, which carries that growth, and guessed again a little
         below it: a guess that lands on the very edge of a line breaking
         (where the growth decides) would otherwise miss again by a hair. */
      const predictor = (plan, restAt) => {
        const lines = new Map();
        const boardAt = (z) => {
          if (!plan) return boardTall;
          const capacity = Math.round(boardWidth / z * 2) / 2;
          if (!lines.has(capacity)) lines.set(capacity, boardHeight(plan, capacity));
          return lines.get(capacity);
        };
        return (z) => pads + z * (restAt + boardAt(z));
      };
      let plan = floor.plan;
      let predict = predictor(plan, rest);
      /* It must reproduce the page it was read from, or it is not this page's
         (Custom CSS, a layout it does not know): then the measured search
         below does the work alone. A stacking window was measured stacked,
         so there the confirming layout is the check. */
      const trusted = plan && (stacked || Math.abs(predict(1) - floor.need) <= 2);
      let fit = null;
      let miss = { x: 1, need: floor.need };
      let last = null;
      for (let i = 0; trusted && i < 3; i++) {
        const z = largestZoom(predict, target - 0.5, MIN_ZOOM, miss.x * (i ? 0.995 : 0.999));
        last = scaled(z);
        if (last.need <= target) { fit = last; break; }
        miss = last;
        plan = this.boardPlan();
        if (!plan) break;
        const surfaceHere = this.surface.getBoundingClientRect().height;
        const boardHere = document.getElementById("board").getBoundingClientRect().height;
        predict = predictor(plan, Math.max(0, (surfaceHere - boardHere) / z));
      }
      if (!fit) {
        /* Measured search: a zoom that is over is taken down by what it
           measured (height falls at least as fast as the zoom), then false
           position between the best that fits and the least that does not. */
        const inside = target - pads;
        let z = last ? last.x * inside / Math.max(1, last.need - pads) * 0.99 : zoomModel(inside, rest, boardTall);
        for (let i = 0; i < 5; i++) {
          z = clamp(z, MIN_ZOOM, 1);
          last = scaled(z);
          if (last.need <= target) fit = !fit || last.x > fit.x ? last : fit;
          else if (last.x < miss.x) miss = last;
          // Close enough, or what is left is a line breaking one way or the other.
          if (fit && (target - fit.need <= tolerance || miss.x - fit.x < fit.x * 0.05)) break;
          const next = fit
            ? clamp(fit.x + (miss.x - fit.x) * (target - tolerance / 2 - fit.need) / Math.max(1e-6, miss.need - fit.need), fit.x + (miss.x - fit.x) * 0.1, miss.x - (miss.x - fit.x) * 0.1)
            : z * inside / Math.max(1, last.need - pads) * 0.99;
          if (Math.abs(next - z) < 1e-3 || (next <= MIN_ZOOM && z <= MIN_ZOOM)) break;
          z = next;
        }
      }

      /* A narrow window stacks its folders, and zoomed out a stack is wider
         in its own lengths: its folders take more bookmarks to a line, so it
         is shorter than it was measured at 1. A stack is the page's own look
         for a narrow window, so where one fits at nearly the zoom the flow
         reached, or larger, it is kept, walked up to the largest zoom that
         fits. Most boards cannot — even their shortest possible stack is too
         tall — and that is known without a layout. */
      if (stacked && boardWidth > 0) {
        const tallest = (z) => pads + z * (rest + boardTall);
        const from = Math.max(largestZoom(tallest, target - 0.5), fit ? fit.x * STACK_PREFERRED : MIN_ZOOM);
        if (pads + from * (rest + shortest) <= target) {
          const at = scaled(from, false);
          if (at.need <= target) {
            const found = solveFit((z) => scaled(z, false).need, at, { x: 1, need: floor.need }, target, { tolerance, probes: 3 }).fit;
            fit = { ...found, wide: false };
          }
        }
      }
      // Nothing fitted even at the smallest: stay there, and it scrolls.
      if (!fit) return { stage: "scaled", t: 1, zoom: last.x, need: last.need, floor };
      if (!worn || worn.x !== fit.x || worn.wide !== fit.wide) scaled(fit.x, fit.wide);
      return { stage: "scaled", t: 1, zoom: fit.x, need: fit.need, floor };
    }

    /* Every folder's own width and height, in the board's lengths, grouped
       the way flowRows groups them: one run for automatic rows, a run per row
       somebody made. Read with nothing stretched, as flowRows measures. */
    boardPlan(stacked = false) {
      const board = document.getElementById("board");
      const layout = window.NordlysBoardLayout;
      if (!board || !layout) return null;
      const lay = () => {
        const rows = [...board.querySelectorAll(":scope > .board-row")];
        const cardsOf = (row) => [...row.querySelectorAll(":scope > .board-line > .card")];
        const runs = board.dataset.rows !== "yours" ? [rows.flatMap(cardsOf)] : rows.map(cardsOf);
        const zoom = board.currentCSSZoom || 1;
        return {
          gap: parseFloat(getComputedStyle(board).rowGap) || 0,
          runs: runs.filter((run) => run.length).map((run) => ({
            widths: run.map((card) => card.getBoundingClientRect().width / zoom),
            heights: run.map((card) => card.getBoundingClientRect().height / zoom)
          })),
          balance: layout.balance
        };
      };
      board.classList.add("is-measuring");
      // In a stacking window, folders are measured as they will flow.
      const wide = this.page.hasAttribute("data-fit-wide");
      if (stacked) this.page.toggleAttribute("data-fit-wide", true);
      const plan = lay();
      if (stacked) this.page.toggleAttribute("data-fit-wide", wide);
      board.classList.remove("is-measuring");
      return plan.runs.length ? plan : null;
    }

    /* A pass that searched hands its answer on (keep = { key, now }): a new
       tab's at once, so the next one opens fitted; any other a moment after
       the window stops changing, so a window being dragged does not fill
       the few remembered windows with sizes it only passed through. One
       that kept what the page wore has nothing new to say. */
    settleOn(stage, t, zoom, room, width, need, keep = null) {
      this.state = { stage, t: round(t, 4), zoom: round(zoom, 4), room, width, need };
      this.page.setAttribute("data-fit-stage", stage);
      this.limitSuggestions(room);
      if (keep) this.remember(keep);
    }

    /* What a remembered answer is for: this window, at this pixel ratio,
       with this board and these settings, in this build, with the bundled
       faces loaded or not — a new tab's first pass often runs before they
       are, and its next once they are. A fingerprint, not the config itself:
       a long value (an icon, Custom CSS) is taken by its length and ends,
       and the one measurement that confirms a hint catches what this misses.
       Returns the key for the page as it is, and the one it will have once
       every face has loaded: whether they have by a tab's first pass varies,
       so that answer is the one to try next. */
    hintKey(room, width) {
      const short = (name, value) => (typeof value === "string" && value.length > 160 ? `${value.length}:${value.slice(0, 48)}:${value.slice(-48)}` : value);
      let config;
      try { config = JSON.stringify(this.app.config || {}, short); } catch { config = String(performance.now()); }
      const build = globalThis.chrome?.runtime?.getManifest?.().version || "";
      let faces = "";
      if (document.fonts?.forEach) document.fonts.forEach((face) => { faces += face.status === "loaded" ? "1" : "0"; });
      const at = (state) => fingerprint([HINT_VERSION, build, room, width, window.devicePixelRatio || 1, this.root.lang, state, config].join("|"));
      const key = at(faces);
      return { key, loaded: faces.includes("0") ? at(faces.replace(/0/g, "1")) : key };
    }

    hints() {
      if (!this.remembered) {
        try {
          const saved = JSON.parse(localStorage.getItem(HINT_STORE) || "[]");
          this.remembered = Array.isArray(saved) ? saved.filter(validHint).slice(0, HINTS_KEPT) : [];
        } catch { this.remembered = []; }
        this.hintText = JSON.stringify(this.remembered);
      }
      return this.remembered;
    }

    recall({ key, loaded }) {
      const hints = this.hints();
      return hints.find((hint) => hint.key === key) || hints.find((hint) => hint.key === loaded) || null;
    }

    /* Only what the page wears is kept: its custom properties, the wide flag
       and the height it measured. Natural needs nothing, so it forgets. */
    remember({ key, now }) {
      const { stage, t, zoom, need } = this.state;
      let entry = null;
      if (stage === "compact" || stage === "scaled") {
        const values = {};
        for (const name of this.written) values[name] = this.page.style.getPropertyValue(name);
        entry = { key, stage, t, zoom, need: round(need), wide: this.page.hasAttribute("data-fit-wide"), values };
      }
      clearTimeout(this.hintTimer);
      this.hintTimer = 0;
      const commit = () => {
        this.hintTimer = 0;
        const others = this.hints().filter((hint) => hint.key !== key);
        const next = entry ? [entry, ...others].slice(0, HINTS_KEPT) : others;
        const text = JSON.stringify(next);
        if (text === this.hintText) return;
        this.remembered = next;
        this.hintText = text;
        try {
          if (next.length) localStorage.setItem(HINT_STORE, text);
          else localStorage.removeItem(HINT_STORE);
        } catch { /* no room, or no storage: the next tab searches, as it always could */ }
      };
      if (now) commit();
      else this.hintTimer = setTimeout(commit, HINT_SETTLE_MS);
    }

    /* Which of the chrome at the top and at the bottom a folder, the dock
       or the clock, laid out as they are, lies under or within a few pixels
       of: { top, bottom }. */
    underChrome() {
      const hit = { top: false, bottom: false };
      const height = this.root.clientHeight;
      const nodes = [...this.surface.querySelectorAll("#board .card, #hiddenDock, #hero > *")];
      for (const g of this.chrome()) {
        const side = g.top < height / 2 ? "top" : "bottom";
        if (hit[side]) continue;
        hit[side] = nodes.some((node) => {
          const b = node.getBoundingClientRect();
          return b.width && b.right > g.left - 8 && b.left < g.right + 8 && b.bottom > g.top - 8 && b.top < g.bottom + 8;
        });
      }
      return hit;
    }

    underGear() {
      const hit = this.underChrome();
      return hit.top || hit.bottom;
    }

    finish(started) {
      this.observed = { w: this.surface.offsetWidth, h: this.surface.offsetHeight };
      this.endedAt = performance.now();
      this.cost = this.endedAt - started;
      this.announce();
      this.app.queueQuietZones?.();
      this.app.grid?.titleCutNames?.();
    }

    // Settings shows what the fit is doing; it listens rather than being called.
    announce() {
      const key = `${this.state.stage}:${this.state.zoom}:${this.suspended.size}`;
      if (key === this.announced) return;
      this.announced = key;
      window.dispatchEvent(new CustomEvent("nordlys:pagefit", { detail: { ...this.state } }));
    }

    /* Suggestions open under the field and scroll inside themselves, so a
       long list never gives the page a scrollbar of its own. Set on the list
       itself: on the page it would restyle every tile to reach one element. */
    limitSuggestions(room) {
      const search = document.getElementById("search");
      if (!search || !this.suggestions) return;
      const zoom = this.state.zoom || 1;
      const below = room - search.getBoundingClientRect().bottom - 12 * zoom - 12;
      this.suggestions.style.setProperty("--fit-sugg-max", `${Math.max(120, Math.floor(below / zoom))}px`);
    }
  }

  const NordlysPageFit = { FLOORS, MIN_ZOOM, HINT_STORE, measuresAt, solveFit, zoomModel, boardHeight, largestZoom, toleranceFor, fingerprint, validHint, PageFit };
  if (typeof window !== "undefined") window.NordlysPageFit = NordlysPageFit;
  if (typeof module === "object" && module.exports) module.exports = NordlysPageFit;
})();
