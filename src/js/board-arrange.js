/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - MOVING THINGS ON THE BOARD
   ═══════════════════════════════════════════════════════════════════

   One way of picking something up, for folders and bookmarks alike, and one
   place to arrange the board deliberately.

   Picking up. The browser's own drag and drop gave a translucent screenshot,
   a pulsing line and no idea where a folder would go once rows were involved;
   it did nothing at all on a touch screen. This follows the pointer instead.

   - A bookmark slides through the tiles as it moves, the way icons do on a
     phone: tiles are all one size, so making room for it never moves the
     folder under the pointer. A folder it passes keeps its height until the
     drop, so nothing below the pointer can jump up into it.
   - A folder is too big to reflow under the pointer without the board
     jumping about, so the board holds still and a marker shows exactly where
     it will land: in a gap between folders, or across the gap between rows
     with the words "New row". It settles into place on the drop.

   Arranging. A mode, entered on purpose, that shows the board's structure —
   the rows, every folder's handle and edge — and holds the few choices that
   shape it: how rows are filled, tidying up, handing rows back to the board,
   undo. Everything in it is also reachable from the keyboard. */
(function () {
  "use strict";

  const text = (key, fallback, params) => {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layout = () => window.NordlysBoardLayout;

  /* Where every folder on the board is, keyed by the folder itself: indices
     change when folders move, objects do not. */
  function captureCards(grid) {
    const groups = grid.app.config.groups || [];
    const rects = new Map();
    for (const card of grid.board?.querySelectorAll(".card") || []) {
      const group = groups[Number(card.dataset.groupIdx)];
      if (group) rects.set(group, card.getBoundingClientRect());
    }
    return rects;
  }

  /* The other half of FLIP: each folder slides from where it was to where it
     is. A folder that changed size — Fitted shares a row out afresh — scales
     from its old box, briefly enough that nobody reads the stretched text. */
  function settleCards(grid, before, { skip } = {}) {
    if (reduced() || !before) return;
    const groups = grid.app.config.groups || [];
    for (const card of grid.board?.querySelectorAll(".card") || []) {
      const group = groups[Number(card.dataset.groupIdx)];
      const was = before.get(group);
      if (!was || group === skip) continue;
      const now = card.getBoundingClientRect();
      if (!now.width || !now.height) continue;
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      const sx = was.width / now.width;
      const sy = was.height / now.height;
      const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      const resized = Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02;
      if (!moved && !resized) continue;
      const from = resized ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : `translate(${dx}px, ${dy}px)`;
      card.animate(
        [{ transformOrigin: "0 0", transform: from }, { transformOrigin: "0 0", transform: "none" }],
        NordlysUI.motion("settle")
      );
    }
  }

  /* ── Folders that move together ─────────────────────────────────
     A change to the whole board — a layout, Tidy up, a folder folded into
     the dock, brought back or deleted — is one view transition. Every folder
     and every chip in the dock is named by the folder it stands for, so the
     browser carries each one from where it was to where it is, and a folder
     folding away shrinks into its chip.

     The folders change at once; only the drawing waits a frame, for the
     old picture to be taken, and anything that reads the board before then
     draws it first (grid.ensureRendered), so a quick second action never
     acts on a board that is out of date. View transitions paint above the
     whole page, so when the drawer or a dialog covers the board, the same
     change glides in place instead (FLIP), under what covers it. Reduced
     motion gets the change at once. */
  const folderNames = new WeakMap();
  const linkNames = new WeakMap();
  let named = 0;
  const nameFor = (map, key, prefix) => {
    if (!map.has(key)) map.set(key, `${prefix}-${++named}`);
    return map.get(key);
  };
  function tagBoard(grid, { clear = false, tilesOf = null } = {}) {
    const groups = grid.app.config.groups || [];
    for (const node of document.querySelectorAll("#board .card, #hiddenDock .restoreFolder")) {
      const group = clear ? null : groups[Number(node.dataset.groupIdx)];
      node.style.viewTransitionName = group ? nameFor(folderNames, group, "nl-folder") : "";
      node.style.viewTransitionClass = group ? "nl-folder" : "";
    }
    if (!tilesOf && !clear) return;
    const wanted = new Set(clear ? [] : tilesOf());
    for (const tile of grid.board?.querySelectorAll(".tile") || []) {
      const group = groups[Number(tile.dataset.groupIdx)];
      const link = wanted.has(group) ? group.links?.[Number(tile.dataset.linkIdx)] : null;
      tile.style.viewTransitionName = link ? nameFor(linkNames, link, "nl-tile") : "";
      tile.style.viewTransitionClass = link ? "nl-tile" : "";
    }
  }
  /* Where every tile of some folders is, keyed by the bookmark itself. */
  function captureTiles(grid, folders) {
    const groups = grid.app.config.groups || [];
    const wanted = new Set(folders);
    const rects = new Map();
    for (const tile of grid.board?.querySelectorAll(".tile") || []) {
      const group = groups[Number(tile.dataset.groupIdx)];
      const link = wanted.has(group) ? group.links?.[Number(tile.dataset.linkIdx)] : null;
      if (link) rects.set(link, { rect: tile.getBoundingClientRect(), node: tile });
    }
    return rects;
  }

  /* The tiles that stayed slide to their new places; a tile that went shrinks
     away where it stood, as a copy, so the gap it leaves is seen to close. */
  function settleTiles(grid, before) {
    if (reduced() || !before?.size) return;
    const groups = grid.app.config.groups || [];
    const present = new Set();
    for (const tile of grid.board?.querySelectorAll(".tile") || []) {
      const link = groups[Number(tile.dataset.groupIdx)]?.links?.[Number(tile.dataset.linkIdx)];
      const was = link && before.get(link);
      if (!was) continue;
      present.add(link);
      const now = tile.getBoundingClientRect();
      const dx = was.rect.left - now.left, dy = was.rect.top - now.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) tile.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], NordlysUI.motion("settle-fast"));
    }
    for (const [link, { rect, node }] of before) {
      if (present.has(link)) continue;
      const ghost = node.cloneNode(true);
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      Object.assign(ghost.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", pointerEvents: "none", zIndex: "var(--nl-z-float)" });
      document.body.append(ghost);
      const leaving = ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.82)" }], { ...NordlysUI.motion("enter"), fill: "forwards" });
      leaving.onfinish = () => ghost.remove();
      leaving.oncancel = () => ghost.remove();
    }
  }

  function boardTransition(grid, mutate, { after = null, tilesOf = null, glide = false } = {}) {
    const redraw = () => {
      grid.renderPending = false;
      grid.render();
      grid.app.settings?.renderBookmarksManager?.();
    };
    /* A view transition takes the page's clicks while it plays. So a change
       that is followed by an Undo — a deletion — glides in place instead,
       and its Undo can be pressed the instant it appears. */
    const covered = document.body.classList.contains("cfgopen") || (NordlysUI.layers?.length || 0) > 0;
    if (glide || !document.startViewTransition || reduced() || document.visibilityState !== "visible" || covered) {
      const before = captureCards(grid);
      const tiles = tilesOf ? captureTiles(grid, tilesOf()) : null;
      mutate();
      redraw();
      settleCards(grid, before);
      if (tiles) settleTiles(grid, tiles);
      after?.();
      return;
    }
    tagBoard(grid, { tilesOf });
    mutate();
    grid.renderPending = true;
    const transition = document.startViewTransition(() => {
      if (grid.renderPending) redraw();
      tagBoard(grid, { tilesOf });
    });
    const done = () => after?.();
    transition.updateCallbackDone.then(done, done);
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => tagBoard(grid, { clear: true }));
  }

  function flipTiles(tiles, mutate) {
    const before = new Map(tiles.map((tile) => [tile, tile.getBoundingClientRect()]));
    mutate();
    if (reduced()) return;
    for (const [tile, was] of before) {
      if (!tile.isConnected || tile.classList.contains("drag-source")) continue;
      const now = tile.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      tile.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], NordlysUI.motion("settle-fast"));
    }
  }

  /* ── Picking up ───────────────────────────────────────────────── */
  class BoardDrag {
    constructor(grid) {
      this.grid = grid;
      this.pending = null;
      this.session = null;
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onKey = this.onKey.bind(this);
      this.onScroll = this.onScroll.bind(this);
      // Leaving the window mid-drag — another app, another tab — lets go of nothing.
      this.onBlur = () => { if (this.session) this.cancel(); };
    }

    get groups() { return this.grid.app.config.groups || []; }

    /* A folder is picked up by its header — while arranging, by any part of
       it that is not a tile, a button or its edge. */
    bindFolder(card, header) {
      header.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button:not(.groupGrip), input")) return;
        this.arm(event, "folder", card);
      });
      card.addEventListener("pointerdown", (event) => {
        if (!this.grid.arrange?.active) return;
        if (event.target.closest(".cat, .tile, .card-resize-handle, button, input")) return;
        this.arm(event, "folder", card);
      });
    }

    bindTile(tile) {
      // The browser's own link drag would carry the tile off as a URL.
      tile.draggable = false;
      tile.addEventListener("dragstart", (event) => event.preventDefault());
      tile.addEventListener("pointerdown", (event) => this.arm(event, "tile", tile));
    }

    folderOf(tile) { return this.groups[Number(tile.dataset.groupIdx)]; }

    arm(event, kind, element) {
      if (this.session || this.pending) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (document.body.classList.contains("searching")) return;
      /* A long press on a touch screen is the context menu, and a finger on a
         tile is usually the start of a scroll. Touch picks things up only
         while arranging, where the board says that is what a touch does. */
      if (event.pointerType === "touch" && !this.grid.arrange?.active) return;
      // A folder that follows the browser owns its order and its contents.
      if (kind === "tile" && this.folderOf(element)?.source?.folderId) return;
      this.pending = { kind, element, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      window.addEventListener("pointermove", this.onMove, true);
      window.addEventListener("pointerup", this.onUp, true);
      window.addEventListener("pointercancel", this.onUp, true);
    }

    unlisten() {
      window.removeEventListener("pointermove", this.onMove, true);
      window.removeEventListener("pointerup", this.onUp, true);
      window.removeEventListener("pointercancel", this.onUp, true);
      window.removeEventListener("keydown", this.onKey, true);
      window.removeEventListener("scroll", this.onScroll);
      window.removeEventListener("blur", this.onBlur);
    }

    onMove(event) {
      const pending = this.pending;
      if (pending && event.pointerId === pending.pointerId) {
        if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= 6) this.begin(event.clientX, event.clientY);
        return;
      }
      const session = this.session;
      if (!session || event.pointerId !== session.pointerId) return;
      event.preventDefault();
      this.follow(event.clientX, event.clientY);
    }

    onUp(event) {
      if (this.pending && event.pointerId === this.pending.pointerId) {
        // It was a click, and the click is the tile's or the header's own.
        this.pending = null;
        this.unlisten();
        return;
      }
      const session = this.session;
      if (!session || event.pointerId !== session.pointerId) return;
      if (event.type === "pointercancel") this.cancel();
      else this.drop();
    }

    onKey(event) {
      if (event.key !== "Escape" || !this.session) return;
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }

    onScroll() {
      if (this.session) this.retarget();
    }

    begin(x, y) {
      const { kind, element, pointerId, x: startX, y: startY } = this.pending;
      this.pending = null;
      if (!element.isConnected) { this.unlisten(); return; }
      const grid = this.grid;
      const rect = element.getBoundingClientRect();
      const lift = this.makeLift(kind, element, rect);
      element.classList.add("drag-source");
      this.session = {
        kind, element, pointerId, lift, rect, startX, startY, x, y,
        index: Number(element.dataset.groupIdx), target: null, frame: 0, scrollFrame: 0
      };
      grid.isDragging = true;
      grid.justDragged = true;
      grid.frozen = true;
      grid.closeContextMenus?.();
      document.body.classList.add("board-dragging", `board-dragging-${kind}`);
      window.addEventListener("keydown", this.onKey, true);
      window.addEventListener("scroll", this.onScroll, { passive: true });
      window.addEventListener("blur", this.onBlur);
      if (kind === "folder") this.startFolder();
      else this.startTile();
      this.follow(x, y);
    }

    /* The thing in hand: a copy of it, lifted off the page. It carries its
       own ancestry where the look depends on it — a tile in a one-column
       folder is a row, not a square. */
    makeLift(kind, element, rect) {
      const lift = document.createElement("div");
      lift.className = `drag-lift drag-lift-${kind}`;
      lift.setAttribute("aria-hidden", "true");
      lift.inert = true;
      const copy = element.cloneNode(true);
      copy.classList.remove("drag-source");
      copy.removeAttribute("tabindex");
      copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      if (kind === "tile") {
        const shell = document.createElement("div");
        shell.className = "grid";
        shell.dataset.cols = element.closest(".grid")?.dataset.cols || "4";
        shell.append(copy);
        lift.append(shell);
      } else {
        lift.dataset.layout = this.grid.board?.dataset.layout || "natural";
        lift.append(copy);
      }
      Object.assign(lift.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      document.body.append(lift);
      return lift;
    }

    follow(x, y) {
      const session = this.session;
      session.x = x;
      session.y = y;
      session.lift.style.transform = `translate3d(${x - session.startX}px, ${y - session.startY}px, 0)`;
      this.edgeScroll();
      if (!session.frame) {
        session.frame = requestAnimationFrame(() => {
          if (!this.session) return;
          this.session.frame = 0;
          this.retarget();
        });
      }
    }

    /* Near the top or bottom of the window the page scrolls itself, faster
       the closer the pointer is to the edge. */
    edgeScroll() {
      const session = this.session;
      const edge = 72;
      const { y } = session;
      const speed = y < edge ? -(edge - y) / 3 : y > innerHeight - edge ? (y - (innerHeight - edge)) / 3 : 0;
      session.scrollSpeed = speed;
      if (!speed || session.scrollFrame) return;
      const tick = () => {
        const live = this.session;
        if (!live || !live.scrollSpeed) { if (live) live.scrollFrame = 0; return; }
        window.scrollBy(0, live.scrollSpeed);
        live.scrollFrame = requestAnimationFrame(tick);
      };
      session.scrollFrame = requestAnimationFrame(tick);
    }

    retarget() {
      if (this.session.kind === "folder") this.retargetFolder();
      else this.retargetTile();
    }

    /* ── Folders: the board holds still, a marker shows the landing ── */
    startFolder() {
      const board = this.grid.board;
      const scrollY = window.scrollY;
      const page = (rect) => ({ left: rect.left, right: rect.right, top: rect.top + scrollY, bottom: rect.bottom + scrollY });
      const rows = [...board.querySelectorAll(":scope > .board-row")].map((row) => ({
        box: page(row.getBoundingClientRect()),
        lines: [...row.querySelectorAll(":scope > .board-line")].map((line) => {
          const cards = [...line.querySelectorAll(":scope > .card")].map((card) => ({ index: Number(card.dataset.groupIdx), ...page(card.getBoundingClientRect()) }));
          const box = page(line.getBoundingClientRect());
          /* A line's cards can wrap once more inside it on a window narrower
             than the plan; group them by the top edge they share. */
          const visual = [];
          for (const card of cards) {
            const last = visual[visual.length - 1];
            if (last && Math.abs(last.top - card.top) < 2) { last.cards.push(card); last.bottom = Math.max(last.bottom, card.bottom); }
            else visual.push({ top: card.top, bottom: card.bottom, cards: [card] });
          }
          return { box, visual };
        })
      }));
      const session = this.session;
      session.rows = rows;
      session.board = page(board.getBoundingClientRect());
      session.gap = parseFloat(getComputedStyle(board).rowGap) || 14;
      session.lines = rows.map((row) => row.lines.flatMap((line) => line.visual.flatMap((visual) => visual.cards.map((card) => card.index))));
      session.row = session.lines.findIndex((line) => line.includes(session.index));
      session.alone = session.lines[session.row]?.length === 1;
      const marker = document.createElement("div");
      marker.className = "board-marker";
      marker.hidden = true;
      const label = document.createElement("span");
      label.className = "board-marker-label";
      label.textContent = text("arrange.newRow", "New row");
      marker.append(label);
      document.body.append(marker);
      session.marker = marker;
    }

    folderTarget() {
      const session = this.session;
      const px = session.x;
      const py = session.y + window.scrollY;
      const { rows, board, gap } = session;
      if (!rows.length) return null;
      const reach = (row) => Math.min(24, (row.box.bottom - row.box.top) * 0.2);
      const horizontal = px >= board.left - 64 && px <= board.right + 64;

      /* The new-row zones first: the gap between two rows and a little of
         each, the band above the first row, and the space below the last. */
      for (let i = 0; i <= rows.length && horizontal; i++) {
        const above = rows[i - 1];
        const below = rows[i];
        const top = above ? above.box.bottom - reach(above) : below.box.top - 64;
        const bottom = below ? below.box.top + reach(below) : above.box.bottom + 120;
        if (py < top || py > bottom) continue;
        // Alone in its row, a folder opening a row beside its own goes nowhere.
        if (session.alone && (i === session.row || i === session.row + 1)) return { none: true };
        const y = above && below ? (above.box.bottom + below.box.top) / 2 : above ? above.box.bottom + gap / 2 : below.box.top - gap / 2;
        return { newRow: i, marker: { kind: "row", y, left: board.left, right: board.right } };
      }

      /* Otherwise a row: the one the pointer is in, or the nearest. Then the
         line of it, then the gap along that line. */
      let rowIndex = rows.findIndex((row) => py >= row.box.top && py <= row.box.bottom);
      if (rowIndex < 0) {
        let best = Infinity;
        rows.forEach((row, index) => {
          const distance = py < row.box.top ? row.box.top - py : py - row.box.bottom;
          if (distance < best) { best = distance; rowIndex = index; }
        });
      }
      const visuals = rows[rowIndex].lines.flatMap((line) => line.visual);
      let visual = visuals.find((candidate) => py >= candidate.top - gap / 2 && py <= candidate.bottom + gap / 2);
      if (!visual) visual = py < visuals[0].top ? visuals[0] : visuals[visuals.length - 1];
      const cards = visual.cards;
      let at = cards.findIndex((card) => px < (card.left + card.right) / 2);
      if (at < 0) at = cards.length;
      const previous = cards[at - 1];
      const next = cards[at];
      // Either side of the folder in hand is where it already is.
      if (previous?.index === session.index || next?.index === session.index) return { none: true };
      const order = session.lines[rowIndex];
      const before = next ? next.index : (order[order.indexOf(previous.index) + 1] ?? null);
      // The end of one line of a row is the start of the next.
      if (before === session.index) return { none: true };
      const x = previous && next ? (previous.right + next.left) / 2
        : previous ? previous.right + gap / 2
        : next.left - gap / 2;
      return { row: rowIndex, before, marker: { kind: "gap", x, top: visual.top, bottom: visual.bottom } };
    }

    retargetFolder() {
      const session = this.session;
      const target = this.folderTarget();
      const same = (a, b) => a && b && a.none === b.none && a.newRow === b.newRow && a.row === b.row && a.before === b.before;
      if (same(target, session.target) && target?.marker && session.target?.marker) {
        this.placeMarker(target.marker);
        return;
      }
      session.target = target;
      session.element.classList.toggle("drag-source-home", Boolean(target?.none));
      if (!target || target.none) { session.marker.hidden = true; return; }
      this.placeMarker(target.marker);
    }

    placeMarker(spot) {
      const marker = this.session.marker;
      const scrollY = window.scrollY;
      marker.hidden = false;
      marker.classList.toggle("is-row", spot.kind === "row");
      if (spot.kind === "row") {
        Object.assign(marker.style, { left: `${spot.left}px`, width: `${spot.right - spot.left}px`, top: `${spot.y - scrollY - 2}px`, height: "4px" });
        const x = Math.max(spot.left + 60, Math.min(spot.right - 60, this.session.x));
        marker.style.setProperty("--label-x", `${x - spot.left}px`);
      } else {
        Object.assign(marker.style, { left: `${spot.x - 2}px`, width: "4px", top: `${spot.top - scrollY}px`, height: `${spot.bottom - spot.top}px` });
      }
    }

    /* ── Bookmarks: the tiles make room as it passes ─────────────── */
    startTile() {
      const session = this.session;
      const tile = session.element;
      session.from = { group: this.folderOf(tile), index: Number(tile.dataset.linkIdx) };
      session.reserved = new Set();
      this.reserve(tile.closest(".grid"));
    }

    /* A folder the bookmark has been in keeps the height it had with it, so
       leaving it never pulls the rows below up under the pointer. */
    reserve(gridEl) {
      if (!gridEl || this.session.reserved.has(gridEl)) return;
      gridEl.style.minHeight = `${gridEl.getBoundingClientRect().height}px`;
      this.session.reserved.add(gridEl);
    }

    tileTarget() {
      const session = this.session;
      const hit = document.elementFromPoint(session.x, session.y);
      const card = hit?.closest?.("#board .card");
      if (!card) return null;
      const gridEl = card.querySelector(".grid");
      const folder = this.groups[Number(gridEl?.dataset.groupIdx)];
      if (!gridEl || !folder) return null;
      if (folder.source?.folderId) return { refused: card };
      const tiles = [...gridEl.querySelectorAll(":scope > .tile")];
      const hole = session.element;
      if (!tiles.length) return { grid: gridEl, before: null };
      let nearest = null;
      let best = Infinity;
      for (const tile of tiles) {
        const box = tile.getBoundingClientRect();
        const cx = (box.left + box.right) / 2;
        const cy = (box.top + box.bottom) / 2;
        const distance = Math.hypot(session.x - cx, session.y - cy);
        if (distance < best) { best = distance; nearest = { tile, cx, cy }; }
      }
      if (nearest.tile === hole) return { grid: gridEl, same: true };
      const list = gridEl.dataset.cols === "1";
      const after = list ? session.y > nearest.cy : session.x > nearest.cx;
      let before = after ? nearest.tile.nextElementSibling : nearest.tile;
      if (before === hole) before = hole.nextElementSibling;
      return { grid: gridEl, before };
    }

    retargetTile() {
      const session = this.session;
      const target = this.tileTarget();
      const refused = target?.refused || null;
      if (session.refused !== refused) {
        session.refused?.classList.remove("drop-refused");
        refused?.classList.add("drop-refused");
        session.refused = refused;
      }
      if (!target || target.refused || target.same) return;
      const hole = session.element;
      if (hole.parentNode === target.grid && hole.nextElementSibling === target.before) return;
      if (target.before === hole) return;
      const home = hole.closest(".grid");
      this.reserve(target.grid);
      const tiles = [...new Set([...home.querySelectorAll(":scope > .tile"), ...target.grid.querySelectorAll(":scope > .tile")])];
      flipTiles(tiles, () => target.grid.insertBefore(hole, target.before));
    }

    /* ── Landing ──────────────────────────────────────────────────── */
    drop() {
      const session = this.session;
      if (session.kind === "folder") this.dropFolder();
      else this.dropTile();
    }

    dropFolder() {
      const session = this.session;
      const target = session.target;
      if (!target || target.none) { this.cancel(); return; }
      const lines = layout().place(session.lines, session.index, target);
      const group = this.groups[session.index];
      const lift = session.lift;
      this.cleanup({ keepLift: true });
      this.grid.commitLines(lines, session.index, { group, lift });
    }

    dropTile() {
      const session = this.session;
      const hole = session.element;
      const gridEl = hole.closest(".grid");
      const to = this.groups[Number(gridEl?.dataset.groupIdx)];
      const { group: from, index } = session.from;
      const link = from?.links?.[index];
      const position = gridEl ? [...gridEl.querySelectorAll(":scope > .tile")].indexOf(hole) : -1;
      const unchanged = !to || !link || position < 0 || (to === from && position === index);
      const lift = session.lift;
      this.cleanup({ keepLift: true });
      if (unchanged) { this.putBack(from, index, gridEl, lift); return; }
      this.grid.moveLink(from, index, to, position, { lift });
    }

    cancel() {
      const session = this.session;
      if (!session) return;
      const lift = session.lift;
      const kind = session.kind;
      const from = session.from;
      const passing = kind === "tile" ? session.element.closest(".grid") : null;
      this.cleanup({ keepLift: true });
      if (kind === "tile") this.putBack(from.group, from.index, passing, lift);
      else this.grid.flyHome(lift, session.element);
    }

    /* The tiles as the config has them — the drag only ever moved the hole —
       and the copy flown back to where the bookmark still is. */
    putBack(group, index, passing, lift) {
      const home = this.groups.indexOf(group);
      const through = Number(passing?.dataset.groupIdx);
      this.grid.updateGridDOM(home, Number.isInteger(through) && through !== home ? through : undefined);
      const tile = this.grid.board?.querySelector(`.tile[data-group-idx="${home}"][data-link-idx="${index}"]`);
      this.grid.flyHome(lift, tile);
    }

    cleanup({ keepLift = false } = {}) {
      const session = this.session;
      if (!session) return;
      cancelAnimationFrame(session.frame);
      cancelAnimationFrame(session.scrollFrame);
      session.element.classList.remove("drag-source", "drag-source-home");
      session.marker?.remove();
      session.refused?.classList.remove("drop-refused");
      for (const gridEl of session.reserved || []) gridEl.style.minHeight = "";
      if (!keepLift) session.lift.remove();
      document.body.classList.remove("board-dragging", `board-dragging-${session.kind}`);
      this.session = null;
      this.unlisten();
      const grid = this.grid;
      grid.isDragging = false;
      grid.frozen = false;
      // The click that ends a drag belongs to the drag, not to the tile under it.
      setTimeout(() => { grid.justDragged = false; }, 60);
    }
  }

  /* ── Arranging ────────────────────────────────────────────────── */
  class BoardArranger {
    constructor(grid) {
      this.grid = grid;
      this.active = false;
      this.history = [];
      this.bar = document.getElementById("arrange-bar");
      this.hint = document.getElementById("arrange-hint");
      this.wire();
    }

    get app() { return this.grid.app; }

    wire() {
      const bar = this.bar;
      if (!bar) return;
      this.radios = [...bar.querySelectorAll(".arrange-layout")];
      for (const radio of this.radios) {
        radio.addEventListener("click", () => this.setLayout(radio.dataset.layout));
        radio.addEventListener("keydown", (event) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          const next = this.radios[(this.radios.indexOf(radio) + step + this.radios.length) % this.radios.length];
          next.focus();
          this.setLayout(next.dataset.layout);
        });
      }
      /* The hint above the bar says what the control under the pointer or the
         focus will do — the same words its description gives a screen reader,
         so there is one sentence to translate — and goes back to how to move
         things otherwise. */
      // A new sentence fades in over the last; the words never jump.
      const say = (words) => {
        if (!this.hint || this.hint.textContent === words) return;
        this.hint.textContent = words;
        if (!reduced()) this.hint.animate([{ opacity: 0.35 }, { opacity: 1 }], NordlysUI.motion("fast"));
      };
      const rest = () => say(text("arrange.hint", "Drag a folder by its name to move it, or its edge to widen it. Bookmarks move between folders the same way."));
      this.restHint = rest;
      for (const node of bar.querySelectorAll("[aria-describedby]")) {
        const explain = () => {
          const description = document.getElementById(node.getAttribute("aria-describedby"));
          if (description) say(description.textContent);
        };
        node.addEventListener("pointerenter", explain);
        node.addEventListener("focus", explain);
        node.addEventListener("pointerleave", rest);
        node.addEventListener("blur", rest);
      }
      document.getElementById("arrange-tidy")?.addEventListener("click", () => this.tidy());
      document.getElementById("arrange-auto")?.addEventListener("click", () => this.autoRows());
      document.getElementById("arrange-undo")?.addEventListener("click", () => this.undo());
      document.getElementById("arrange-done")?.addEventListener("click", () => this.exit());
      window.addEventListener("keydown", (event) => {
        if (!this.active || event.key !== "Escape" || this.grid.drag?.session) return;
        // A menu or a dialog open over the board closes first.
        if (NordlysUI.layers?.length) return;
        event.preventDefault();
        this.exit();
      });
      window.addEventListener("nordlys:languagechange", () => { if (this.active) rest(); });
    }

    /* The arrangement and nothing else: order, columns, rows, which bookmark
       is in which folder, and the layout. Links are kept by reference, so a
       step back costs a few arrays, never a copy of anyone's icons. */
    snapshot() {
      const config = this.app.config;
      return {
        layout: config.boardLayout,
        groups: (config.groups || []).map((group) => ({ group, cols: group.cols, row: group.row, hidden: group.hidden, links: [...(group.links || [])] }))
      };
    }

    restore(shot) {
      const config = this.app.config;
      const alive = new Set(config.groups);
      const kept = shot.groups.filter((entry) => alive.has(entry.group));
      const known = new Set(kept.map((entry) => entry.group));
      const added = config.groups.filter((group) => !known.has(group));
      boardTransition(this.grid, () => {
        config.groups.splice(0, config.groups.length, ...kept.map((entry) => entry.group), ...added);
        for (const entry of kept) {
          entry.group.cols = entry.cols;
          if (entry.row === undefined) delete entry.group.row;
          else entry.group.row = entry.row;
          entry.group.hidden = entry.hidden;
          entry.group.links = entry.links;
        }
        config.boardLayout = shot.layout;
        this.app.saveConfig();
      }, { after: () => this.app.settings?.syncBoardLayout?.() });
    }

    /* One step of Undo, taken before a change — or handed in, when the change
       was a gesture that began before anyone knew it would change anything. */
    remember(shot = null) {
      if (!this.active) return;
      this.history.push(shot || this.snapshot());
      if (this.history.length > 50) this.history.shift();
      this.refresh();
    }

    undo() {
      const shot = this.history.pop();
      if (!shot) return;
      this.restore(shot);
      NordlysUI.announce(text("arrange.undone", "Undone"));
      this.refresh();
    }

    toggle(options) { if (this.active) this.exit(); else this.enter(options); }

    enter({ focusGroup } = {}) {
      if (!this.bar || this.active) {
        if (this.active && focusGroup) this.focusGrip(focusGroup);
        return;
      }
      this.app.settings?.close?.();
      this.grid.closeContextMenus?.();
      document.getElementById("q")?.blur();
      this.active = true;
      this.history = [];
      this.entry = this.snapshot();
      document.body.classList.add("arranging");
      this.bar.hidden = false;
      this.refresh();
      if (focusGroup) this.focusGrip(focusGroup);
      else this.radios.find((radio) => radio.getAttribute("aria-checked") === "true")?.focus({ preventScroll: true });
      NordlysUI.announce(text("arrange.entered", "Arranging folders. On a folder's handle the arrow keys move it; Escape finishes."));
      this.watchOutside();
    }

    exit() {
      if (!this.active) return;
      this.active = false;
      document.body.classList.remove("arranging");
      this.bar.hidden = true;
      this.stopWatchingOutside();
      const changed = this.history.length > 0;
      const entry = this.entry;
      this.history = [];
      this.entry = null;
      this.grid.wireRovingTiles();
      this.grid.relayout();
      if (changed && entry) {
        NordlysUI.showUndoToast({
          message: text("arrange.arranged", "Board arranged"),
          onAction: () => this.restore(entry)
        });
      }
    }

    /* Starting to search, or opening settings, is leaving the arrangement. */
    watchOutside() {
      this.onOutside = (event) => {
        if (event.target?.id === "q" || event.target?.closest?.("#cfg")) this.exit();
      };
      document.addEventListener("focusin", this.onOutside);
    }

    stopWatchingOutside() {
      if (this.onOutside) document.removeEventListener("focusin", this.onOutside);
      this.onOutside = null;
    }

    /* After every render: the controls tell the truth about the board, and
       while arranging, Tab walks folders rather than every tile. */
    refresh() {
      if (!this.bar) return;
      const config = this.app.config;
      const current = config.boardLayout === "fitted" ? "fitted" : "natural";
      for (const radio of this.radios || []) {
        const on = radio.dataset.layout === current;
        radio.setAttribute("aria-checked", String(on));
        radio.tabIndex = on ? 0 : -1;
      }
      const auto = document.getElementById("arrange-auto");
      if (auto) auto.hidden = !layout()?.hasRows(config.groups || []);
      const undo = document.getElementById("arrange-undo");
      if (undo) undo.disabled = !this.history.length;
      const layouts = this.bar.querySelector(".arrange-layouts");
      NordlysUI.trackThumb(layouts, layouts?.querySelector('[aria-checked="true"]'));
      if (!this.active) return;
      for (const tile of this.grid.board?.querySelectorAll(".tile") || []) tile.tabIndex = -1;
    }

    focusGrip(group) {
      const index = (this.app.config.groups || []).indexOf(group);
      this.grid.board?.querySelector(`.card[data-group-idx="${index}"] .groupGrip`)?.focus({ preventScroll: false });
    }

    /* The rows as they are drawn right now, as lists of folder indices. */
    currentLines() {
      this.grid.ensureRendered();
      return [...(this.grid.board?.querySelectorAll(":scope > .board-row") || [])]
        .map((row) => [...row.querySelectorAll(".card")].map((card) => Number(card.dataset.groupIdx)))
        .filter((line) => line.length);
    }

    /* The keyboard's move: one step on the board, the same step the settings
       list takes, said out loud with where the folder is now. */
    moveByKey(index, key) {
      const lines = this.currentLines();
      const next = layout()?.step(lines, index, key);
      const group = this.app.config.groups[index];
      if (!next || !group) {
        NordlysUI.announce(text("arrange.cannotMove", "{name} cannot move further that way", { name: group?.label || "" }));
        return;
      }
      this.grid.commitLines(next, index, { group, focus: true });
    }

    setLayout(name) {
      const config = this.app.config;
      const next = name === "fitted" ? "fitted" : "natural";
      if ((config.boardLayout === "fitted" ? "fitted" : "natural") === next) return;
      this.remember();
      boardTransition(this.grid, () => {
        config.boardLayout = next;
        this.app.saveConfig();
      });
      this.app.settings?.syncBoardLayout?.();
      NordlysUI.announce(next === "fitted"
        ? text("arrange.fittedHint", "Fitted: every row runs edge to edge, and folders in a row share one height.")
        : text("arrange.naturalHint", "Natural: folders keep their own size and wrap like words."));
    }

    /* Folders of a similar height side by side, rows chosen for the window as
       it is now, and kept: they are the user's rows from here on. */
    tidy() {
      this.grid.ensureRendered();
      const board = this.grid.board;
      const cards = [...board.querySelectorAll(".card")];
      if (cards.length < 2) return;
      const line = board.querySelector(".board-line");
      board.classList.add("is-measuring");
      const items = cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { index: Number(card.dataset.groupIdx), width: box.width, height: box.height };
      });
      const capacity = line.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
      board.classList.remove("is-measuring");
      const lines = layout().tidy(items, gap, capacity);
      const same = JSON.stringify(lines) === JSON.stringify(this.currentLines());
      if (same) {
        NordlysUI.announce(text("arrange.alreadyTidy", "Already tidy"));
        return;
      }
      this.grid.commitLines(lines, -1, { say: text("arrange.tidied", "Tidied: folders of a similar height share a row"), together: true });
    }

    autoRows() {
      const groups = this.app.config.groups || [];
      if (!layout()?.hasRows(groups)) return;
      this.remember();
      boardTransition(this.grid, () => {
        layout().clearRows(groups);
        this.app.saveConfig();
      }, { after: () => this.app.settings?.syncBoardLayout?.() });
      NordlysUI.announce(text("arrange.rowsAuto", "The board chooses the rows again"));
    }
  }

  window.NordlysBoardDrag = BoardDrag;
  window.NordlysBoardArranger = BoardArranger;
  window.NordlysBoardMotion = { captureCards, settleCards, boardTransition };
})();
