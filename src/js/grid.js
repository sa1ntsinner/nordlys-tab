/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - GRID, TILES, FOLDER DRAG & DROP & CONTEXT MENUS
   ═══════════════════════════════════════════════════════════════════ */

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 8;

class GridController {
  constructor(app) {
    this.app = app;
    this.board = document.getElementById("board");
    this.dock = document.getElementById("hiddenDock");
    this.initDockTouch();
    // Which tile of each folder is its one stop for Tab, by folder index.
    this.rovingIndex = new Map();
    // Faces arrive late, and a window can narrow: both can cut a name short.
    document.fonts?.ready.then(() => this.relayout());
    document.fonts?.addEventListener?.("loadingdone", () => this.relayout());
    let resized = null;
    window.addEventListener("resize", () => { clearTimeout(resized); resized = setTimeout(() => this.titleCutNames(), 200); }, { passive: true });
    // The skip link lands on the board's first tile rather than on the board.
    document.querySelector(".skip-link")?.addEventListener("click", (event) => {
      const first = this.board?.querySelector('.tile[tabindex="0"]');
      if (!first) return;
      event.preventDefault();
      first.focus();
    });
    
    // Context Menus & Modals
    this.tileCtxMenu = document.getElementById("tile-ctx-menu");
    this.folderCtxMenu = document.getElementById("folder-ctx-menu");
    this.boardCtxMenu = document.getElementById("board-ctx-menu");

    this.quickModal = document.getElementById("quick-edit-modal");
    this.quickFolderModal = document.getElementById("quick-edit-folder-modal");
    this.menuControllers = new Map([
      [this.tileCtxMenu, new NordlysUI.MenuController(this.tileCtxMenu)],
      [this.folderCtxMenu, new NordlysUI.MenuController(this.folderCtxMenu)],
      [this.boardCtxMenu, new NordlysUI.MenuController(this.boardCtxMenu)]
    ]);
    this.quickDialog = new NordlysUI.DialogController(this.quickModal, { closeOnBackdrop: true });
    this.quickFolderDialog = new NordlysUI.DialogController(this.quickFolderModal, { closeOnBackdrop: true });

    this.activeTileTarget = null;   // { gIdx, lIdx }
    this.activeFolderTarget = null; // gIdx

    // Drag states (board-arrange.js owns the drag itself)
    this.isDragging = false;
    this.justDragged = false;

    /* Capture-phase click interceptor. The click that ends a drag belongs to
       the drag, and while arranging a tile is something to move, not a link. */
    window.addEventListener("click", (e) => {
      const arranging = this.arrange?.active && e.target.closest?.("#board .tile");
      if (this.justDragged || this.isDragging || arranging) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    }, true);
    // A bookmark opened, and at what hour, for the search box's "usually now" (widgets.js).
    const opened = (event) => {
      const tile = event.target.closest?.("#board a.tile");
      if (!tile || (event.type === "auxclick" && event.button !== 1)) return;
      this.app.widgets?.search?.noteOpen(this.app.config.groups[tile.dataset.groupIdx]?.links?.[tile.dataset.linkIdx]?.url);
    };
    window.addEventListener("click", opened);
    window.addEventListener("auxclick", opened);

    this.initContextMenusAndModals();
    this.initPastedLinks();
    this.showMenuKeys();
    this.drag = window.NordlysBoardDrag ? new window.NordlysBoardDrag(this) : null;
    this.arrange = window.NordlysBoardArranger ? new window.NordlysBoardArranger(this) : null;
    // Watched sites are asked about only while a tab is shown; what another tab learnt shows here too.
    document.addEventListener("visibilitychange", () => this.watchSites());
    window.addEventListener("storage", (event) => { if (event.key === GridController.STATUS_KEY) this.paintAllStatus(); });
  }

  /* ── Sites that say whether they answer ─────────────────────────
     A bookmark marked to be watched wears a dot: green when its site
     answered, amber when that took more than a second and a half, red when
     it did not answer at all. The question is a HEAD request that needs no
     permission and reads nothing back (no-cors), asked at most every five
     minutes for every tab together, and only while one is shown. */
  static STATUS_KEY = "nordlys_site_status";
  static WATCH_EVERY = 5 * 60e3;
  siteStatus() { try { return JSON.parse(localStorage.getItem(GridController.STATUS_KEY) || "{}") || {}; } catch (error) { return {}; } }
  saveSiteStatus(all, keep) {
    try { localStorage.setItem(GridController.STATUS_KEY, JSON.stringify(Object.fromEntries(keep.filter((url) => all[url]).map((url) => [url, all[url]])))); }
    catch (error) { /* full or blocked: shown here, not kept */ }
  }
  async probeSite(url) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), 8000);
    const began = performance.now();
    try {
      await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: control.signal });
      return { up: true, ms: Math.round(performance.now() - began), at: Date.now() };
    } catch (error) { return { up: false, ms: 0, at: Date.now() }; }
    finally { clearTimeout(timer); }
  }
  watchSites() {
    clearTimeout(this.watchTimer);
    if (document.visibilityState !== "visible") return;
    const urls = [...new Set((this.app.config.groups || []).flatMap((group) => (group.hidden ? [] : group.links || []).filter((link) => link.watch && /^https?:\/\//i.test(link.url || "")).map((link) => link.url)))];
    if (!urls.length) return;
    const seen = this.siteStatus();
    const due = urls.filter((url) => Date.now() - (seen[url]?.at || 0) >= GridController.WATCH_EVERY);
    if (due.length) {
      // Marked as asked before the answers come, so a tab opened meanwhile does not ask again.
      for (const url of due) seen[url] = { ...seen[url], at: Date.now() };
      this.saveSiteStatus(seen, urls);
      Promise.all(due.map((url) => this.probeSite(url))).then((answers) => {
        const now = this.siteStatus();
        due.forEach((url, index) => { now[url] = answers[index]; });
        this.saveSiteStatus(now, urls);
        this.paintAllStatus(now);
      });
    }
    this.watchTimer = setTimeout(() => this.watchSites(), GridController.WATCH_EVERY);
  }
  paintAllStatus(seen = this.siteStatus()) { this.board?.querySelectorAll(".tile.is-watched").forEach((tile) => this.paintStatus(tile, seen)); }
  paintStatus(tile, seen = this.siteStatus()) {
    const answer = seen[tile.dataset.watch];
    const known = answer && "up" in answer;
    tile.querySelector(".tile-status").dataset.state = !known ? "unknown" : !answer.up ? "down" : answer.ms > 1500 ? "slow" : "up";
    tile.querySelector(".tile-status-said").textContent = !known ? this.say("watch.checking", "Checking whether it answers")
      : answer.up ? this.say("watch.up", `Answers in ${answer.ms} ms`, { ms: answer.ms }) : this.say("watch.down", "Not answering");
    this.titleTile(tile);
  }

  render() {
    if (!this.board) return;
    const layout = window.NordlysBoardLayout;
    const groups = this.app.config.groups || [];
    /* Whatever edited the folders last — a list, an import, a new folder —
       may have left them in any order. The board reads them row by row, so
       they are put back into that order before anything is drawn. */
    if (layout?.normalise(groups)) this.app.saveConfig();
    // A new tab's board is laid out as its window last fitted it, from the first layout.
    this.app.pageFit?.prepare();

    const boardFragment = document.createDocumentFragment();
    const dockFragment = document.createDocumentFragment();
    const cards = new Map();
    let hasHidden = false;
    let visibleIdx = 0;

    groups.forEach((group, gIdx) => {
      if (group.hidden) {
        hasHidden = true;
        this.renderDockItem(group, gIdx, dockFragment);
        return;
      }
      cards.set(gIdx, this.createGroupCard(group, gIdx, visibleIdx++));
    });

    const rows = layout ? layout.rowsOf(groups) : (cards.size ? [[...cards.keys()]] : []);
    rows.forEach((row, index) => boardFragment.appendChild(this.createRow(row.map((gIdx) => cards.get(gIdx)), index)));

      // Deleting the last folder otherwise left a page with nothing on it and no
      // way forward but a settings tab the user had no reason to open.
      if (!groups.length) boardFragment.appendChild(this.createEmptyState());

    this.board.dataset.layout = this.app.config.boardLayout === "fitted" ? "fitted" : "natural";
    this.board.dataset.rows = layout?.hasRows(groups) ? "yours" : "auto";
    this.board.replaceChildren(boardFragment);
    if (this.dock) {
      /* Closed, the dock is one quiet mark — a folder and how many are folded
         — and it opens into the chips at a pointer, the keyboard or a tap
         (components.css). The mark is only a picture of them: the chips are
         what a screen reader and the Tab key reach. */
      const folded = dockFragment.childElementCount;
      if (folded) {
        const mark = document.createElement("span");
        mark.className = "dock-fold";
        mark.setAttribute("aria-hidden", "true");
        mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span class="dock-fold-count">${folded}</span>`;
        dockFragment.appendChild(mark);
      }
      this.dock.replaceChildren(dockFragment);
      this.dock.style.display = hasHidden ? "inline-flex" : "none";
      this.dock.classList.remove("is-open");
    }

    /* The board used to animate itself in over as much as two seconds, and this
       is where that choreography was switched off so later renders would not
       replay it. Nothing animates on arrival now, so there is nothing to switch
       off: the page is finished the moment it is painted. */
    this.flowRows();
    this.watchBoardWidth();
    this.numberShortcuts();
    this.wireRovingTiles();
    this.arrange?.refresh();
    this.watchSites();
    // The dashboard follows the board: a new profile, a restore, another tab.
    this.app.dashboard?.render();
    // A new board is fitted before it is ever painted (page-fit.js).
    this.app.pageFit?.request({ now: true });
    requestAnimationFrame(() => this.titleCutNames());
  }

  /* A row is one or more lines: one while it fits the window, more when it has
     to wrap. flowRows decides where. */
  createRow(cards, index) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.dataset.row = String(index);
    const line = document.createElement("div");
    line.className = "board-line";
    line.append(...cards);
    row.append(line);
    return row;
  }

  /* Where rows break into lines: as few as the window allows, as even as it
     allows (NordlysBoardLayout.balance). Widths are measured with every folder
     at its own size — in Fitted before the lines are stretched — so both
     layouts break in the same places, and Fitted grows each folder from the
     width it would have had.

     Before anybody has arranged anything, every line is a row of its own:
     that is what the board looks like, so it is also what arranging starts
     from. Rows somebody made keep their folders together and wrap inside
     themselves when the window is too narrow for them. Only what changes is
     rebuilt, and focus is handed back if the rebuild took it. */
  flowRows() {
    const layout = window.NordlysBoardLayout;
    if (!this.board || !layout || this.frozen) return;
    const rows = [...this.board.querySelectorAll(":scope > .board-row")];
    if (!rows.length) return;
    const auto = this.board.dataset.rows !== "yours";
    const runs = auto ? [rows] : rows.map((row) => [row]);
    const cardsOf = (line) => [...line.children].filter((child) => child.classList.contains("card"));
    const focused = this.board.contains(document.activeElement) ? document.activeElement : null;
    this.board.classList.add("is-measuring");
    /* Boxes are measured as they are drawn, and One page fit may draw the
       board zoomed; lengths the layout uses are the board's own, unzoomed. */
    const zoom = window.NordlysUI?.cssZoom(this.board) || 1;
    const plans = runs.map((run) => {
      const lines = run.flatMap((row) => [...row.querySelectorAll(":scope > .board-line")]);
      const cards = lines.flatMap(cardsOf);
      const gap = parseFloat(getComputedStyle(lines[0]).columnGap) || 0;
      const capacity = lines[0].getBoundingClientRect().width / zoom;
      const widths = cards.map((card) => card.getBoundingClientRect().width / zoom);
      return { run, lines, cards, widths, counts: capacity ? layout.balance(widths, gap, capacity) : [cards.length] };
    });
    this.board.classList.remove("is-measuring");
    const makeLine = (cards) => {
      const line = document.createElement("div");
      line.className = "board-line";
      line.append(...cards);
      return line;
    };
    for (const { run, lines, cards, widths, counts } of plans) {
      cards.forEach((card, index) => card.style.setProperty("--natural-w", `${widths[index]}px`));
      const current = lines.map((line) => cardsOf(line).length).join();
      if (auto) {
        if (run.length === counts.length && run.every((row) => row.children.length === 1) && current === counts.join()) continue;
        let at = 0;
        const next = counts.map((count, index) => {
          const row = document.createElement("div");
          row.className = "board-row";
          row.dataset.row = String(index);
          row.append(makeLine(cards.slice(at, at += count)));
          return row;
        });
        run[0].before(...next);
        run.forEach((row) => row.remove());
      } else {
        if (current === counts.join()) continue;
        let at = 0;
        run[0].replaceChildren(...counts.map((count) => makeLine(cards.slice(at, at += count))));
      }
    }
    if (focused && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
  }

  /* The lines depend on the width, so a narrower window re-breaks them — in
     the observer's own callback, which runs after layout and before paint, so
     no frame is ever shown with the old breaks squeezed into the new width.
     What is observed is a line with no height across the board rather than
     the board: re-breaking changes the board's height, and an observer that
     changes the size of what it observes loops. The probe only ever changes
     when the width does. */
  watchBoardWidth() {
    if (typeof ResizeObserver === "undefined") return;
    if (!this.widthProbe) {
      this.widthProbe = document.createElement("div");
      this.widthProbe.className = "board-width-probe";
      this.widthProbe.setAttribute("aria-hidden", "true");
    }
    if (this.widthProbe.parentNode !== this.board) this.board.prepend(this.widthProbe);
    if (this.boardWidthObserver) return;
    let width = this.widthProbe.getBoundingClientRect().width;
    this.boardWidthObserver = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (!next || Math.abs(next - width) < 0.5) return;
      width = next;
      this.flowRows();
    });
    this.boardWidthObserver.observe(this.widthProbe);
  }

  /* Anything that can change a folder's width without a render — a face that
     finishes loading, a theme, the tile size — asks for this. */
  relayout() {
    this.flowRows();
    this.titleCutNames();
    this.app.pageFit?.request();
  }

  /* A board transition changes the folders at once and draws them a frame
     later (board-arrange.js). Anything that reads the board in between draws
     it first, so it never acts on the picture that is on its way out. */
  ensureRendered() {
    if (!this.renderPending) return;
    this.renderPending = false;
    this.render();
  }

  /* Many folders changing at once: one view transition when the board can
     show it, an in-place glide otherwise. */
  together(mutate, options) {
    const move = window.NordlysBoardMotion?.boardTransition;
    if (move) move(this, mutate, options);
    else { mutate(); this.render(); this.app.settings?.renderBookmarksManager?.(); options?.after?.(); }
  }

  /* Row and position of a folder as the board shows it, counted from one. */
  placeOf(group) {
    const index = (this.app.config.groups || []).indexOf(group);
    const card = this.board?.querySelector(`.card[data-group-idx="${index}"]`);
    const row = card?.closest(".board-row");
    if (!card || !row) return null;
    const rows = [...this.board.querySelectorAll(":scope > .board-row")];
    const inRow = [...row.querySelectorAll(".card")];
    return { row: rows.indexOf(row) + 1, position: inRow.indexOf(card) + 1, count: inRow.length };
  }

  /* A name the tile has to cut short — a long name, or a wide face chosen in
     Typography — gets its whole self as a tooltip. Only when it is cut: a
     tooltip that repeats what is already on screen is noise on every hover. */
  titleCutNames() {
    if (!this.board) return;
    for (const label of this.board.querySelectorAll(".tile .lbl")) this.titleTile(label.closest(".tile"));
  }
  // A tile's tooltip: its name where the label cuts it, and how a watched site answered.
  titleTile(tile) {
    const label = tile.querySelector(".lbl");
    const title = [label && label.scrollWidth > label.clientWidth + 1 ? label.textContent : "", tile.querySelector(".tile-status-said")?.textContent].filter(Boolean).join(" · ");
    if (title) tile.title = title;
    else tile.removeAttribute("title");
  }

  /* ── The board from the keyboard ─────────────────────────────────
     Each folder is one stop for Tab, and the arrow keys move between its tiles
     by where they sit on screen, so twenty bookmarks are not twenty presses to
     get past; Home and End go to its first and last. Alt+Shift+Arrow carries
     the focused bookmark to the next place, the way a drag would. */
  wireRovingTiles() {
    if (!this.board) return;
    for (const grid of this.board.querySelectorAll(".card .grid")) {
      const tiles = [...grid.querySelectorAll(".tile")];
      const grip = grid.closest(".card")?.querySelector(".groupGrip");
      if (grip) grip.tabIndex = tiles.length ? -1 : 0;
      if (!tiles.length) continue;
      const current = Math.min(this.rovingIndex.get(Number(tiles[0].dataset.groupIdx)) ?? 0, tiles.length - 1);
      tiles.forEach((tile, index) => { tile.tabIndex = index === current ? 0 : -1; });
    }
  }

  // Focus a tile and make it its folder's stop for Tab.
  roveTo(target, options) {
    const tiles = [...target.parentElement.querySelectorAll(".tile")];
    for (const tile of tiles) tile.tabIndex = tile === target ? 0 : -1;
    this.rovingIndex.set(Number(target.dataset.groupIdx), tiles.indexOf(target));
    target.focus(options);
  }

  /* The tile the arrow points at, found by position rather than by index, so
     it is right at any column count and at any width the folder wraps to. */
  tileToward(tile, key) {
    const tiles = [...tile.parentElement.querySelectorAll(".tile")];
    const index = tiles.indexOf(tile);
    if (key === "ArrowRight") return tiles[index + 1] || null;
    if (key === "ArrowLeft") return tiles[index - 1] || null;
    if (key === "Home") return tiles[0];
    if (key === "End") return tiles[tiles.length - 1];
    if (key !== "ArrowDown" && key !== "ArrowUp") return null;
    const here = tile.getBoundingClientRect();
    const middle = rect => rect.left + rect.width / 2;
    const below = key === "ArrowDown";
    const rows = tiles.map(other => ({ other, rect: other.getBoundingClientRect() }))
      .filter(({ rect }) => (below ? rect.top > here.top + here.height / 2 : rect.bottom < here.top + here.height / 2));
    if (!rows.length) return null;
    const nearestTop = below ? Math.min(...rows.map(row => row.rect.top)) : Math.max(...rows.map(row => row.rect.top));
    return rows.filter(row => Math.abs(row.rect.top - nearestTop) < 4)
      .reduce((best, row) => (Math.abs(middle(row.rect) - middle(here)) < Math.abs(middle(best.rect) - middle(here)) ? row : best)).other;
  }

  carryTile(tile, key) {
    const gIdx = Number(tile.dataset.groupIdx);
    const lIdx = Number(tile.dataset.linkIdx);
    const group = this.app.config.groups[gIdx];
    const say = (id, fallback, params) => {
      const value = window.I18N?.t(id, params || {});
      return value && value !== id ? value : fallback;
    };
    if (!group?.links) return;
    // A folder that follows the browser keeps the browser's order.
    if (group.source) {
      NordlysUI.announce(this.ownerSays(group, "announce.followsBrowserOrder", "This folder keeps the browser's order"));
      return;
    }
    const target = this.tileToward(tile, key);
    if (!target) return;
    const to = Number(target.dataset.linkIdx);
    const [link] = group.links.splice(lIdx, 1);
    group.links.splice(to, 0, link);
    this.app.saveConfig();
    this.render();
    const moved = this.board.querySelector(`.tile[data-group-idx="${gIdx}"][data-link-idx="${to}"]`);
    if (moved) this.roveTo(moved);
    NordlysUI.announce(say("announce.movedToPosition", `${link.name} moved to position ${to + 1}`, { name: link.name, position: to + 1 }));
  }

  /* The first nine tiles on the board, in reading order across every folder on
     it, answer to Alt+1 to Alt+9 — they say so to assistive technology, and
     show their number while Alt is held. It used to be the first folder only,
     so a board that opened with a two-bookmark folder had seven dead chords. */
  numberShortcuts() {
    if (!this.board) return;
    this.board.querySelectorAll(".card .tile").forEach((tile, index) => {
      if (index < 9) {
        tile.dataset.shortcut = String(index + 1);
        tile.setAttribute("aria-keyshortcuts", `Alt+${index + 1}`);
      } else {
        delete tile.dataset.shortcut;
        tile.removeAttribute("aria-keyshortcuts");
      }
    });
  }

  /* The one folder-creation path the board has. The empty state calls it, and
     anything else that needs a folder should call it rather than push its own
     shape into config.groups. */
  addFolder() {
    const label = window.I18N ? window.I18N.t("bookmarks.newFolder") : "New folder";
    (this.app.config.groups ||= []).push({ label, cols: 4, hidden: false, links: [] });
    this.app.saveConfig();
    this.render();
    this.app.settings?.renderBookmarksManager();
    NordlysUI.announce(window.I18N ? window.I18N.t("board.folderAdded") : "Folder added");
  }

  /* What a new install opens on, and what is left when the last folder goes.
     Both are the same moment — a board with nothing on it — and neither is an
     error, so this is an invitation: the atmosphere and the type stay the hero,
     one line says why the page is empty, and two actions say where to begin.

     No tour, no cards, no sample links. The second action hands off to the
     import the Backup tab already owns, by asking its controller for it. */
  createEmptyState() {
    const t = (key, fallback) => (window.I18N ? window.I18N.t(key) : fallback);
    const empty = document.createElement("div");
    empty.className = "board-empty";

    const title = document.createElement("h2");
    title.className = "board-empty-title";
    title.textContent = t("board.emptyTitle", "Make this space yours");

    const line = document.createElement("p");
    line.className = "board-empty-text";
    line.textContent = t("board.empty", "Nordlys starts empty. Add a folder, or bring the bookmarks you already have.");

    const actions = document.createElement("div");
    actions.className = "board-empty-actions";

    /* The wall at the beginning of every start page is that the bookmarks are
       already somewhere else. Where the browser can hand them over, that is the
       first thing offered, and the folders it makes follow the browser — so
       nothing brought in this way can be lost here. */
    const canBring = Boolean(window.NordlysBookmarks && typeof chrome !== "undefined" && chrome.permissions);
    if (canBring) {
      const bring = document.createElement("button");
      bring.type = "button";
      bring.id = "board-empty-browser";
      bring.className = "glass-btn accent";
      bring.textContent = t("board.emptyBrowser", "Bring my browser's bookmarks");
      bring.addEventListener("click", () => this.bringBrowserBookmarks(bring));
      actions.append(bring);
    }

    /* Someone with no bookmarks worth bringing can start from the sites they
       open most, which the browser already knows. Asked for on the click. */
    if (canBring && window.NordlysPlatform?.name !== "safari") {
      const visited = document.createElement("button");
      visited.type = "button";
      visited.id = "board-empty-visited";
      visited.className = "glass-btn";
      visited.textContent = t("board.emptyVisited", "Start from my most visited sites");
      visited.addEventListener("click", () => this.bringMostVisited(visited));
      actions.append(visited);
    }

    const create = document.createElement("button");
    create.type = "button";
    create.id = "board-empty-create";
    create.className = canBring ? "glass-btn" : "glass-btn accent";
    create.textContent = t("board.emptyCreate", "Create a folder");
    create.addEventListener("click", () => this.addFolder());
    actions.append(create);

    /* Offered only when there is something to open it with: a button that
       cannot do what it says would be worse than one fewer way in. Asking
       whether settings can be built, not building them, keeps them out of
       the first frame. */
    if (typeof SettingsController === "function") {
      const bring = document.createElement("button");
      bring.type = "button";
      bring.id = "board-empty-import";
      bring.className = "glass-btn";
      bring.textContent = t("board.emptyImport", "Import bookmarks");
      bring.addEventListener("click", () => this.app.settings.openImportPicker(bring));
      actions.append(bring);
    }

    empty.append(title, line, actions);
    return empty;
  }

  /* The bookmarks bar, and each folder in it, as folders that follow the
     browser. Asked for on the click, as the permission has to be; read before
     anything is written; said in numbers afterwards, with a way back. */
  // The browser's most visited sites, as one folder of copies.
  async bringMostVisited(opener) {
    const say = (key, fallback, params) => { const value = window.I18N?.t(key, params || {}); return value && value !== key ? value : fallback; };
    const api = typeof chrome !== "undefined" ? chrome : null;
    const granted = await new Promise((resolve) => {
      if (!api?.permissions?.request) { resolve(Boolean(api?.topSites)); return; }
      try { api.permissions.request({ permissions: ["topSites"] }, (ok) => resolve(Boolean(ok))); } catch (error) { resolve(false); }
    });
    if (!granted || !api?.topSites?.get) { toast(say("board.visitedRefused", "Nordlys was not allowed to see your most visited sites."), "info"); return; }
    const sites = await new Promise((resolve) => { try { api.topSites.get((list) => resolve(list || [])); } catch (error) { resolve([]); } });
    const links = sites.filter((site) => /^https?:\/\//i.test(site.url || "")).slice(0, 12).map((site) => ({ name: site.title || site.url, url: site.url, icon: "", color: "" }));
    if (!links.length) { toast(say("board.visitedEmpty", "Your browser has no most visited sites yet."), "info"); return; }
    const before = this.app.config.groups;
    this.app.config.groups = [...before, { label: say("board.visitedFolder", "Most visited"), cols: Math.min(6, Math.max(2, Math.ceil(Math.sqrt(links.length)))), hidden: false, links }];
    this.app.saveConfig();
    this.render();
    NordlysUI.showUndoToast({
      message: say("board.visitedDone", `${links.length} sites came in, yours to change here.`, { count: links.length }),
      duration: 9000,
      onAction: () => { this.app.config.groups = before; this.app.saveConfig(); this.render(); }
    });
    this.focusTile(this.app.config.groups.length - 1, 0) || opener?.focus?.();
  }

  async bringBrowserBookmarks(opener) {
    const sync = window.NordlysBookmarks;
    const say = (key, fallback, params) => {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    };
    if (!(await sync.granted()) && !(await sync.request())) {
      toast(say("board.browserRefused", "Nordlys was not allowed to read your bookmarks."), "info");
      return;
    }
    /* Copies, not mirrors: a first board is one to make your own, and a copy
       can be renamed here and goes to sync. The bar comes with every folder
       inside it, each named by its path; a bar with nothing in it gives way
       to Other bookmarks. Settings → Bookmarks can still make a folder
       follow the browser. */
    let sets = [];
    try {
      const tree = await sync.folders();
      const below = (root) => root ? [root, ...tree.filter((folder) => folder.path.startsWith(`${root.path} / `))] : [];
      const bar = tree.find((folder) => folder.id === "1") || tree[0];
      const other = tree.find((folder) => folder.id === "2") || tree.find((folder) => folder !== bar && !folder.path.includes(" / "));
      for (const root of [bar, other]) {
        const found = [];
        for (const folder of below(root).slice(0, 24)) {
          let links;
          try { links = await sync.linksIn(folder.id); } catch { continue; }
          if (!links.length) continue;
          const label = folder === root ? folder.title : folder.path.slice(root.path.length + 3);
          found.push({ label, cols: Math.min(6, Math.max(2, Math.ceil(Math.sqrt(links.length)))), hidden: false,
            links: links.map(({ name, url }) => ({ name, url, icon: "", color: "" })) });
        }
        if (found.length) { sets = found; break; }
      }
    } catch {
      toast(say("bookmarks.linkUnavailable", "Browser bookmarks are not available"), "info");
      return;
    }
    const groups = sets;
    if (!groups.length) {
      toast(say("board.browserEmpty", "Your browser has no bookmarks to bring."), "info");
      return;
    }
    const before = this.app.config.groups;
    this.app.config.groups = [...before, ...groups];
    this.app.saveConfig();
    this.render();
    const count = groups.reduce((sum, group) => sum + group.links.length, 0);
    NordlysUI.showUndoToast({
      message: say("board.broughtCopies", `${groups.length} folders and ${count} bookmarks came in, yours to change here.`, { folders: groups.length, count }),
      duration: 9000,
      onAction: () => {
        this.app.config.groups = before;
        this.app.saveConfig();
        this.render();
      }
    });
    this.focusTile(this.app.config.groups.indexOf(groups[0]), 0) || opener?.focus?.();
  }

  createGroupCard(group, gIdx, visibleIdx = gIdx) {
    const card = document.createElement("section");
    card.className = "card";
    card.style.setProperty("--i", visibleIdx);
    card.dataset.groupIdx = gIdx;
    // Kept only here, or different here: a quiet mark (sync-client.js).
    this.app.sync?.decorate(card, group, "g");

    // Card Header
    const cat = document.createElement("div");
    cat.className = "cat";
    cat.title = window.I18N ? window.I18N.t('hint.dragReorderFolder') : "Drag to move the folder, or right-click to edit it";
    cat.innerHTML = `
      <s></s>
      <b>${esc(group.label || this.say("bookmarks.newFolder", "New folder"))}</b>
      <i></i>
      <button type="button" class="groupGrip">⋮⋮</button>
      <button class="foldBtn" title="${esc(window.I18N ? window.I18N.t('hint.foldFolder') : 'Hide this folder')}" aria-label="${esc(window.I18N ? window.I18N.t('hint.foldFolder') : 'Hide this folder')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M6.61 6.61A18.4 18.4 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg></button>
    `;

    // Folder Fold action
    const foldBtn = cat.querySelector(".foldBtn");
    /* One Tab stop per folder: its tiles. The grip and the hide button sit
       one arrow up from the top row, and Left and Right move between them;
       Down goes back. A folder with no tiles keeps its grip as its stop. */
    const headControls = [cat.querySelector(".groupGrip"), foldBtn];
    headControls.forEach((control) => {
      control.tabIndex = -1;
      control.addEventListener("keydown", (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const at = headControls.indexOf(control);
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          headControls[(at + (event.key === "ArrowRight" ? 1 : headControls.length - 1)) % headControls.length].focus();
        } else if (event.key === "ArrowDown" || event.key === "Escape") {
          const tile = card.querySelector('.tile[tabindex="0"]');
          if (tile) { event.preventDefault(); tile.focus(); }
        }
      });
    });
    // Folded, the folder shrinks into its chip in the dock (board-arrange.js).
    foldBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.arrange?.remember();
      this.together(() => {
        group.hidden = true;
        this.app.saveConfig();
      });
    });

    // Folder Right-Click Context Menu
    cat.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openFolderContextMenu(e, gIdx);
    });

    /* Moving the folder. Dragging the header picks it up anywhere on the
       board; the grip is also the door into arranging — pressed, it opens the
       arrangement with this folder in hand, and there its arrow keys move it. */
    const groupGrip = cat.querySelector(".groupGrip");
    const gripName = group.label || this.say("bookmarks.newFolder", "Folder");
    groupGrip.setAttribute("aria-label", this.say("arrange.gripLabel", `Move ${gripName}`, { name: gripName }));
    groupGrip.title = this.say("arrange.gripTitle", "Drag to move — or press to arrange folders");
    groupGrip.setAttribute("aria-describedby", "arrange-grip-help");
    groupGrip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.arrange?.active) this.arrange?.enter({ focusGroup: group });
    });
    groupGrip.addEventListener("keydown", (e) => {
      if (!this.arrange?.active || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      this.arrange.moveByKey(gIdx, e.key);
    });
    this.drag?.bindFolder(card, cat);

    card.appendChild(cat);

    // Tiles Grid
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.dataset.cols = group.cols || 4;
    grid.dataset.groupIdx = gIdx;
    this.shareColumns(card, grid, group);

    grid.addEventListener("dragover", (e) => this.onGridDragOver(e, grid));
    grid.addEventListener("dragleave", (e) => { if (!grid.contains(e.relatedTarget)) card.classList.remove("dropping"); });
    grid.addEventListener("drop", (e) => this.onGridDrop(e, grid, gIdx));

    const gridFragment = document.createDocumentFragment();
    (group.links || []).forEach((link, lIdx) => {
      const tile = this.createTileElement(link, gIdx, lIdx);
      gridFragment.appendChild(tile);
    });
    grid.appendChild(gridFragment);
    card.appendChild(grid);

    // Mouse Drag-to-Resize for Folders
    // One control, both input methods. The corner is draggable and is also a
    // slider, so removing the +/- buttons does not take column resizing away
    // from the keyboard.
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "card-resize-handle";
    resizeHandle.title = window.I18N ? window.I18N.t('hint.dragResizeFolder') : "Drag to resize folder columns";
    resizeHandle.setAttribute("role", "slider");
    resizeHandle.tabIndex = -1;
    const folderName = group.label || (window.I18N ? window.I18N.t('bookmarks.newFolder') : 'folder');
    resizeHandle.setAttribute("aria-label", window.I18N?.t('hint.columnsFor', { name: folderName }) || `Columns for ${folderName}`);
    resizeHandle.setAttribute("aria-valuemin", String(MIN_COLUMNS));
    resizeHandle.setAttribute("aria-valuemax", String(MAX_COLUMNS));
    resizeHandle.setAttribute("aria-valuenow", String(group.cols || 4));
    resizeHandle.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { const tile = card.querySelector('.tile[tabindex="0"]'); if (tile) { event.preventDefault(); tile.focus(); } return; }
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
      let next;
      if (event.key in step) next = (group.cols || 4) + step[event.key];
      else if (event.key === "Home") next = MIN_COLUMNS;
      else if (event.key === "End") next = MAX_COLUMNS;
      else return;
      event.preventDefault();
      this.setFolderColumns(group, grid, resizeHandle, next);
    });
    this.attachCardResize(card, grid, resizeHandle, group, gIdx);
    card.appendChild(resizeHandle);


    return card;
  }

  createTileElement(link, gIdx, lIdx) {
    const a = document.createElement("a");
    a.className = "tile";
    a.href = link.url || "#";
    a.target = this.app.config.openNewTab ? "_blank" : "_self";
    a.rel = "noopener noreferrer";
    // No explicit color -> stable per-name hue so monograms stay distinctive
    const fallbackHue = typeof getDeterministicHue === "function" ? getDeterministicHue(link.name || link.url || "aurora") : 220;
    a.style.setProperty("--c", link.color || `hsl(${fallbackHue} 64% 66%)`);
    a.style.setProperty("--j", lIdx);
    a.dataset.groupIdx = gIdx;
    a.dataset.linkIdx = lIdx;
    this.app.sync?.decorate(a, link, "l");

    // Render Box & Icon
    const box = document.createElement("div");
    box.className = "box";

    // Smart Icon Resolution (Custom image / Monogram / Vector SVG)
    const iconDef = resolveIcon(link.url, link.icon);

    const presentation = window.NordlysIcons.resolvePresentation({
      source: link,
      key: link.icon,
      metadata: iconDef || {},
      isLight: this.app.isLightTheme()
    });
    const renderedIcon = window.NordlysIcons.renderIcon(presentation);
    renderedIcon.querySelector("img")?.addEventListener("error", () => {
      renderedIcon.replaceChildren();
      const mono = document.createElement("span"); mono.className = "mono";
      mono.textContent = (link.name || "A").trim().charAt(0).toUpperCase(); renderedIcon.append(mono);
      window.NordlysIcons.applyIconContrast(box, renderedIcon);
    }, { once: true });
    box.appendChild(renderedIcon);
    window.NordlysIcons.applyIconContrast(box, renderedIcon);

    // Label
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = link.name || "Link";

    a.appendChild(box);
    a.appendChild(lbl);

    // A site asked to be watched says whether it answers (watchSites).
    if (link.watch) {
      a.classList.add("is-watched");
      a.dataset.watch = link.url;
      const dot = document.createElement("span");
      dot.className = "tile-status";
      dot.setAttribute("aria-hidden", "true");
      const said = document.createElement("span");
      said.className = "nl-visually-hidden tile-status-said";
      box.appendChild(dot);
      a.appendChild(said);
      this.paintStatus(a);
    }

    /* Picked up and carried by board-arrange.js. A folder that follows the
       browser owns its order and its contents, so its tiles stay put. */
    this.drag?.bindTile(a);

    // Bookmark Right-Click Context Menu Trigger
    a.addEventListener("contextmenu", (e) => {
      if (this.menuKeyEcho(e)) return;
      e.preventDefault();
      e.stopPropagation();
      this.openTileContextMenu(e, gIdx, lIdx);
    });
    a.addEventListener("keydown", (e) => {
      const arrow = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key);
      if (arrow && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "Home" || e.key === "End") return;
        e.preventDefault();
        this.carryTile(a, e.key);
        return;
      }
      if (arrow && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const target = this.tileToward(a, e.key);
        if (target) { e.preventDefault(); this.roveTo(target); }
        // Past the top row, the folder's own controls; past the bottom, its columns.
        else if (e.key === "ArrowUp") { e.preventDefault(); a.closest(".card")?.querySelector(".groupGrip")?.focus(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); a.closest(".card")?.querySelector(".card-resize-handle")?.focus(); }
        return;
      }
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        e.stopPropagation();
        const rect = a.getBoundingClientRect();
        this.menuKeyAt = performance.now();
        setTimeout(() => this.openTileContextMenu({ clientX: rect.left + 12, clientY: rect.bottom - 8, currentTarget: a }, gIdx, lIdx), 0);
      }
    });

    return a;
  }

  /* The folded folders open at a pointer or the keyboard (components.css). A
     touch has no hover, so there the first tap only opens the dock — whatever
     chip it lands on keeps its folder folded — and the dock closes again a few
     seconds later, or at a tap anywhere else. */
  initDockTouch() {
    const dock = this.dock;
    if (!dock) return;
    let fold = null;
    // The tap that opened the dock, whose click must bring nothing back; only for as long as a tap takes.
    let opening = 0;
    const close = () => {
      clearTimeout(fold);
      dock.classList.remove("is-open");
    };
    dock.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || dock.classList.contains("is-open")) return;
      dock.classList.add("is-open");
      opening = performance.now();
      clearTimeout(fold);
      fold = setTimeout(close, 6000);
    });
    dock.addEventListener("click", (click) => {
      if (!opening) return;
      const fresh = performance.now() - opening < 800;
      opening = 0;
      if (fresh) { click.stopPropagation(); click.preventDefault(); }
    }, { capture: true });
    document.addEventListener("pointerdown", (event) => {
      if (!dock.contains(event.target)) close();
    }, { passive: true });
  }

  /* ── Discreet Minimalist Floating Dock Chip ─────────────────── */
  renderDockItem(group, gIdx, container) {
    const btn = document.createElement("button");
    btn.className = "restoreFolder";
    btn.type = "button";
    btn.dataset.groupIdx = gIdx;
    const dockName = group.label || (window.I18N ? window.I18N.t('bookmarks.newFolder') : 'Folder');
    btn.title = window.I18N?.t('hint.restoreFolder', { name: dockName }) || `Show “${dockName}” on the board again — right-click for more`;

    const count = (group.links || []).length;
    btn.innerHTML = `
      <svg class="dockFolderIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="dockFolderName">${esc(group.label || this.say("bookmarks.newFolder", "New folder"))}</span>
      <span class="dockFolderCount">${count}</span>
    `;

    // Brought back, the chip grows into its folder.
    btn.addEventListener("click", () => {
      this.together(() => {
        group.hidden = false;
        this.app.saveConfig();
      });
    });

    container.appendChild(btn);
  }

  /* ── Context Menus & Quick Edit Modals ──────────────────────── */
  /* The Menu key opens a bookmark's menu itself (its keydown, above). The
     browser sends its own contextmenu event for that key too, on Windows at
     the keyup: the same request a second time, which opened the menu twice
     and, when the timer ran late, again after it had been used. */
  menuKeyEcho(event) {
    if (performance.now() - (this.menuKeyAt ?? -Infinity) > 500) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  initContextMenusAndModals() {
    // Window click to close context menus
    window.addEventListener("click", (e) => {
      if (!e.target.closest(".glass-context-menu")) {
        this.closeContextMenus();
      }
    });

    // Intelligent Context Menu Event Routing (Tile vs Folder vs Board Wallpaper)
    window.addEventListener("contextmenu", (e) => {
      if (this.menuKeyEcho(e)) return;
      // 1. Ignore if right-clicked inside an active modal, settings drawer, or form inputs
      if (e.target.closest("#cfg, .quick-modal-backdrop, .modal-backdrop, input, textarea, select")) {
        return;
      }

      // 2. Target Check: Bookmark Tile
      const tileEl = e.target.closest(".tile");
      if (tileEl && tileEl.dataset.groupIdx !== undefined && tileEl.dataset.linkIdx !== undefined) {
        e.preventDefault();
        e.stopPropagation();
        const gIdx = parseInt(tileEl.dataset.groupIdx, 10);
        const lIdx = parseInt(tileEl.dataset.linkIdx, 10);
        this.openTileContextMenu(e, gIdx, lIdx);
        return;
      }

      // 3. Target Check: Folder Card (header, padding, gap between tiles, resize handle)
      const cardEl = e.target.closest(".card");
      if (cardEl && cardEl.dataset.groupIdx !== undefined) {
        e.preventDefault();
        e.stopPropagation();
        const gIdx = parseInt(cardEl.dataset.groupIdx, 10);
        this.openFolderContextMenu(e, gIdx);
        return;
      }

      // 4. Target Check: Minimalist Dock Chip (Hidden Folder)
      const dockChip = e.target.closest(".restoreFolder");
      if (dockChip && dockChip.dataset.groupIdx !== undefined) {
        e.preventDefault();
        e.stopPropagation();
        const gIdx = parseInt(dockChip.dataset.groupIdx, 10);
        this.openFolderContextMenu(e, gIdx);
        return;
      }

      // 5. Target Check: Empty Board Space / Wallpaper
      e.preventDefault();
      this.openBoardContextMenu(e);
    });

    // 1. Bookmark Context Menu Actions
    this.tileCtxMenu?.querySelectorAll(".ctx-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.dataset.action;
        if (item.hasAttribute("disabled") || !this.activeTileTarget) return;
        const { gIdx, lIdx } = this.activeTileTarget;
        const group = this.app.config.groups[gIdx];
        const link = group?.links[lIdx];
        if (!link) return;

        this.closeContextMenus();

        if (action === "quick-edit") {
          this.openQuickEditModal(gIdx, lIdx);
        } else if (action === "change-icon") {
          this.app.settings?.openIconModal(gIdx, lIdx);
        } else if (action === "open-tab") {
          window.open(link.url, "_blank", "noopener,noreferrer");
        } else if (action === "copy-url") {
          if (link.url) {
            navigator.clipboard?.writeText(link.url);
            if (typeof toast === "function") {
              toast(window.I18N ? window.I18N.t("toast.linkCopied") : "Link copied to clipboard", "success", 1800);
            }
          }
        } else if (action === "watch") {
          // A dot on the tile that says whether the site answers; again to take it off.
          if (link.watch) delete link.watch;
          else link.watch = true;
          this.app.saveConfig();
          this.render();
        } else if (action === "delete") {
          this.deleteBookmarkWithUndo(gIdx, lIdx);
        }
      });
    });

    // 2. Folder Context Menu Actions
    this.folderCtxMenu?.querySelectorAll(".ctx-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.dataset.action;
        if (this.activeFolderTarget === null || this.activeFolderTarget === undefined) return;
        const gIdx = this.activeFolderTarget;
        const group = this.app.config.groups[gIdx];
        if (!group) return;

        this.closeContextMenus();

        if (action === "quick-edit-folder") {
          this.openQuickFolderModal(gIdx);
        } else if (action === "arrange") {
          this.arrange?.enter({ focusGroup: group });
        } else if (action === "add-link") {
          group.links.push({
            name: "New Bookmark",
            url: "https://",
            color: "#35d6c0",
            icon: "globe"
          });
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
          this.openQuickEditModal(gIdx, group.links.length - 1);
        } else if (action === "open-all") {
          /* What a middle click on a browser bookmark folder does, which is
             the thing people say they miss most in a start page. Confirmed
             past a handful, because opening twenty tabs by accident is not
             something a page should be able to do quietly. */
          this.openEveryBookmark(group);
        } else if (action === "hide-folder") {
          this.together(() => {
            group.hidden = !group.hidden;
            this.app.saveConfig();
          });
        } else if (action === "delete-folder") {
          this.confirmFolderDelete(group).then((ok) => {
            if (ok) this.deleteFolderWithUndo(gIdx);
          });
        }
      });
    });

    // 3. Board / Empty Space Context Menu Actions
    this.boardCtxMenu?.querySelectorAll(".ctx-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.dataset.action;
        this.closeContextMenus();

        if (action === "arrange") {
          this.arrange?.enter();
        } else if (action === "new-folder") {
          const newGIdx = this.app.config.groups.length;
          this.app.config.groups.push({
            id: `g_${Date.now()}`,
            label: this.say("bookmarks.newFolder", "New folder"),
            cols: 4,
            links: []
          });
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
          this.openQuickFolderModal(newGIdx);
        } else if (action === "new-bookmark") {
          if (!this.app.config.groups.length) {
            this.app.config.groups.push({ id: `g_${Date.now()}`, label: "Favorites", cols: 4, links: [] });
          }
          const targetGIdx = 0;
          const targetGroup = this.app.config.groups[targetGIdx];
          targetGroup.links.push({ name: "New Bookmark", url: "https://", color: "#35d6c0", icon: "globe" });
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
          this.openQuickEditModal(targetGIdx, targetGroup.links.length - 1);
        } else if (action === "restore-all-folders") {
          this.together(() => {
            this.app.config.groups.forEach((g) => { g.hidden = false; });
            this.app.saveConfig();
          });
        } else if (action === "open-settings") {
          this.app.settings?.open();
        }
      });
    });

    // Quick Bookmark Modal controls
    const quickModalX = document.getElementById("quick-modal-x");
    const quickIconPreview = document.getElementById("quick-icon-preview");
    const quickSaveBtn = document.getElementById("quick-save-btn");

    quickModalX?.addEventListener("click", () => this.closeQuickEditModal());
    document.getElementById("quick-cancel-btn")?.addEventListener("click", () => this.closeQuickEditModal());
    document.getElementById("quick-delete-btn")?.addEventListener("click", () => {
      if (!this.activeTileTarget) return;
      const { gIdx, lIdx } = this.activeTileTarget;
      if (this.app.config.groups[gIdx]?.source) return;
      this.closeQuickEditModal();
      this.deleteBookmarkWithUndo(gIdx, lIdx);
    });
    // Enter in a field saves, as it does in every other form.
    this.quickModal?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input:not([type=color])")) { e.preventDefault(); quickSaveBtn?.click(); }
    });
    this.quickModal?.addEventListener("click", (e) => {
      if (e.target === this.quickModal) this.closeQuickEditModal();
    });

    const triggerIconPicker = () => {
      if (!this.activeTileTarget) return;
      let { gIdx, lIdx } = this.activeTileTarget;
      const oldGroup = this.app.config.groups[gIdx];
      const link = oldGroup?.links[lIdx];
      if (!link) return;

      // 1. Flush currently typed fields into the link
      const typedTitle = document.getElementById("quick-title-input")?.value.trim();
      let typedUrl = document.getElementById("quick-url-input")?.value.trim();
      if (typedUrl && !/^https?:\/\//i.test(typedUrl)) typedUrl = `https://${typedUrl}`;
      const typedColor = document.getElementById("quick-color-input")?.value;
      const targetFolderIdx = parseInt(document.getElementById("quick-folder-select")?.value, 10);

      if (typedTitle) link.name = typedTitle;
      if (typedUrl) link.url = typedUrl;
      if (typedColor) link.color = typedColor;

      // 2. If folder was changed in the dropdown, move it immediately
      // Nothing moves out of a folder that follows the browser, or into one.
      const destination = this.app.config.groups[targetFolderIdx];
      if (!oldGroup.source && !isNaN(targetFolderIdx) && targetFolderIdx !== gIdx && destination && !destination.source) {
        oldGroup.links.splice(lIdx, 1);
        this.app.config.groups[targetFolderIdx].links.push(link);
        this.updateGridDOM(gIdx, targetFolderIdx);
        gIdx = targetFolderIdx;
        lIdx = this.app.config.groups[targetFolderIdx].links.length - 1;
        this.activeTileTarget = { gIdx, lIdx };
      } else {
        this.updateTileDOM(gIdx, lIdx);
      }

      this.app.saveConfig();
      this.app.settings?.renderBookmarksManager();

      // 3. Mark return target so closing icon modal returns cleanly to Quick Edit
      this.quickEditReturnTarget = { gIdx, lIdx };
      this.closeQuickEditModal();

      // 4. Open Icon Picker for this exact bookmark
      this.app.settings?.openIconModal(gIdx, lIdx);
    };
    /* The preview was already the button; a second one underneath saying
       "Choose Icon..." was the same action twice, competing with Save. */
    quickIconPreview?.addEventListener("click", triggerIconPicker);

    quickSaveBtn?.addEventListener("click", () => {
      if (!this.activeTileTarget) return;
      const { gIdx, lIdx } = this.activeTileTarget;
      const oldGroup = this.app.config.groups[gIdx];
      const link = oldGroup?.links[lIdx];
      if (!link) return;

      const followed = Boolean(oldGroup.source);
      const newTitle = followed ? link.name : document.getElementById("quick-title-input")?.value.trim() || link.name;
      let newUrl = followed ? link.url : document.getElementById("quick-url-input")?.value.trim() || link.url;
      if (newUrl && !/^https?:\/\//i.test(newUrl)) newUrl = `https://${newUrl}`;
      const newColor = document.getElementById("quick-color-input")?.value || link.color;
      const targetFolderIdx = parseInt(document.getElementById("quick-folder-select")?.value, 10);

      link.name = newTitle;
      link.url = newUrl;
      link.color = newColor;
      // "auto" is the absence of a choice, so it is stored as nothing rather than
      // as a value the rest of the code would have to keep special-casing.
      const chosenTone = document.getElementById("quick-tone-select")?.value;
      if (chosenTone && chosenTone !== "auto") link.tone = chosenTone; else delete link.tone;

      // Nothing moves out of a folder that follows the browser, or into one.
      const destination = this.app.config.groups[targetFolderIdx];
      if (!oldGroup.source && !isNaN(targetFolderIdx) && targetFolderIdx !== gIdx && destination && !destination.source) {
        oldGroup.links.splice(lIdx, 1);
        this.app.config.groups[targetFolderIdx].links.push(link);
        this.updateGridDOM(gIdx, targetFolderIdx);
      } else {
        this.updateTileDOM(gIdx, lIdx);
      }

      this.app.saveConfig();
      this.app.settings?.renderBookmarksManager();
      this.closeQuickEditModal();
    });

    // Quick Folder Modal controls
    const quickFolderModalX = document.getElementById("quick-folder-modal-x");
    const quickFolderSaveBtn = document.getElementById("quick-folder-save-btn");
    const quickFolderDeleteBtn = document.getElementById("quick-folder-delete-btn");

    quickFolderModalX?.addEventListener("click", () => this.closeQuickFolderModal());
    document.getElementById("quick-folder-cancel-btn")?.addEventListener("click", () => this.closeQuickFolderModal());
    this.quickFolderModal?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); quickFolderSaveBtn?.click(); }
    });
    this.quickFolderModal?.addEventListener("click", (e) => {
      if (e.target === this.quickFolderModal) this.closeQuickFolderModal();
    });

    quickFolderSaveBtn?.addEventListener("click", () => {
      if (this.activeFolderTarget === null || this.activeFolderTarget === undefined) return;
      const gIdx = this.activeFolderTarget;
      const group = this.app.config.groups[gIdx];
      if (!group) return;

      const newName = document.getElementById("quick-folder-name-input")?.value.trim() || group.label;
      const newCols = parseInt(document.getElementById("quick-folder-cols-select")?.value, 10) || group.cols || 4;

      group.label = newName;
      group.cols = newCols;

      this.app.saveConfig();
      this.updateFolderDOM(gIdx);
      this.app.settings?.renderBookmarksManager();
      this.closeQuickFolderModal();
    });

    quickFolderDeleteBtn?.addEventListener("click", () => {
      if (this.activeFolderTarget === null || this.activeFolderTarget === undefined) return;
      const gIdx = this.activeFolderTarget;
      const group = this.app.config.groups[gIdx];
      this.confirmFolderDelete(group).then((ok) => {
        if (!ok) return;
        this.deleteFolderWithUndo(gIdx);
        this.closeQuickFolderModal();
      });
    });
  }

  /* Deleting a bookmark from the board was instant, silent and final: no
     confirm, no toast, nothing said out loud, nothing to press. The same act in
     the settings drawer has offered an undo for releases, so which door you
     came through decided whether a misclick was recoverable — and the board is
     the door people actually use.

     The same seam as everywhere else, NordlysUI.showUndoToast, rather than a
     second one: it is the thing that says what happened, on screen and to a
     screen reader, and holds the way back for five seconds. No confirm dialog
     here on purpose — a question in front of every single tile deletion is the
     nag this product refuses, and an undo is the better answer to a misclick
     than a modal you learn to dismiss without reading. */
  deleteBookmarkWithUndo(gIdx, lIdx) {
    const folder = this.app.config.groups[gIdx];
    const links = folder?.links;
    if (!Array.isArray(links) || lIdx < 0 || lIdx >= links.length) return;
    if (folder.source) {
      NordlysUI.announce(this.ownerSays(folder, "bookmarks.linkedRemoveHint", "Remove it in the browser; this folder follows along"));
      return;
    }
    const snapshot = JSON.parse(JSON.stringify(links[lIdx]));
    const name = snapshot.name || snapshot.url || "Bookmark";
    const say = (key, fallback) => (window.I18N ? window.I18N.t(key, { name }) : fallback);
    // The tile fades where it stood and its neighbours close the gap.
    this.together(() => {
      links.splice(lIdx, 1);
      this.app.saveConfig();
    }, {
      glide: true,
      tilesOf: () => [folder],
      /* The context menu hands focus back to the tile it was opened from, and
         that tile is the one that just went. Without this, focus falls to
         <body> and a keyboard user starts the board again from the top. */
      after: () => { if (!this.focusTile(gIdx, lIdx)) this.focusFolder(gIdx); }
    });
    window.NordlysUI?.showUndoToast({
      message: say("toast.itemDeleted", `${name} deleted`),
      onAction: () => {
        const group = this.app.config.groups[gIdx];
        if (!group || !Array.isArray(group.links)) return;
        const at = Math.min(lIdx, group.links.length);
        this.together(() => {
          group.links.splice(at, 0, snapshot);
          this.app.saveConfig();
        }, { glide: true, tilesOf: () => [group], after: () => this.focusTile(gIdx, at) });
        window.NordlysUI?.announce?.(say("toast.itemRestored", `${name} restored`));
      }
    });
  }

  /* Both return whether they found something to focus, so a caller can fall
     through to the next-best landing place in one line. */
  focusTile(gIdx, lIdx) {
    const tile = document.querySelector(`#board .tile[data-group-idx="${gIdx}"][data-link-idx="${lIdx}"]`);
    if (tile) this.roveTo(tile, { preventScroll: true });
    return Boolean(tile);
  }

  focusFolder(gIdx) {
    const card = document.querySelector(`#board .card[data-group-idx="${gIdx}"]`);
    const target = card?.querySelector(".groupGrip") || document.getElementById("board-empty-create");
    target?.focus({ preventScroll: true });
    return Boolean(target);
  }

  /* A folder holds a whole set of links, and a confirm dialog only protects
     against the click you were paying attention to. A single bookmark has had
     Undo since the redesign; the folder that contains it had none. */
  deleteFolderWithUndo(gIdx) {
    const groups = this.app.config.groups;
    if (!Array.isArray(groups) || gIdx < 0 || gIdx >= groups.length) return;
    const snapshot = JSON.parse(JSON.stringify(groups[gIdx]));
    const name = snapshot.label || "Folder";
    const say = (key, fallback) => (window.I18N ? window.I18N.t(key, { name }) : fallback);
    // The folder fades where it stood and the others close the gap.
    this.together(() => {
      groups.splice(gIdx, 1);
      this.app.saveConfig();
    }, {
      glide: true,
      // Same reason as a bookmark: the menu's opener went with the folder.
      after: () => { if (!this.focusFolder(gIdx)) this.focusFolder(Math.max(0, gIdx - 1)); }
    });
    window.NordlysUI?.showUndoToast({
      message: say("toast.itemDeleted", `${name} deleted`),
      onAction: () => {
        const at = Math.min(gIdx, groups.length);
        this.together(() => {
          groups.splice(at, 0, snapshot);
          this.app.saveConfig();
        }, { glide: true, after: () => this.focusFolder(at) });
        window.NordlysUI?.announce?.(say("toast.itemRestored", `${name} restored`));
      }
    });
  }

  /* ── Links from elsewhere ──────────────────────────────────────────
     A link dragged in from a page or the address bar, or an address pasted
     with nothing else in hand, becomes a bookmark. Tiles move by the board's
     own arranging (board-arrange.js), so only addresses come in this way. */
  linkFrom(data) {
    const line = String(data?.getData("text/uri-list") || data?.getData("text/plain") || "").split(/\r?\n/).map((part) => part.trim()).find((part) => part && !part.startsWith("#"));
    let url;
    try { url = new URL(line); } catch (error) { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    // A dragged link carries its words as HTML; they name it when they are its.
    const anchor = data.getData("text/html") ? new DOMParser().parseFromString(data.getData("text/html"), "text/html").querySelector("a[href]") : null;
    let named = "";
    try { if (anchor && new URL(anchor.getAttribute("href"), url).href === url.href) named = anchor.textContent.trim(); } catch (error) { /* no name, then */ }
    return { url: url.href, name: (named || url.hostname.replace(/^www\./, "")).slice(0, 120) };
  }

  // Into a folder, before a tile of it or at its end, with a way back.
  addLinkFrom(gIdx, link, at) {
    const group = this.app.config.groups[gIdx];
    if (!group || !link) return false;
    if (group.source) {
      const message = this.ownerSays(group, "bookmarks.linkedNoDrop", "This folder follows the browser. Add the bookmark there instead.");
      if (typeof toast === "function") toast(message, "danger", 2800); else NordlysUI.announce(message);
      return false;
    }
    const added = { name: link.name, url: link.url, color: "#38bdf8" };
    const index = Math.max(0, Math.min(at ?? group.links.length, group.links.length));
    group.links.splice(index, 0, added);
    const inHand = this.board?.contains(document.activeElement);
    const redraw = () => { this.app.saveConfig(); this.render(); this.app.settings?.renderBookmarksManager?.(); };
    redraw();
    // The keyboard stays where it was working: on the bookmark just added.
    if (inHand) this.focusTile(gIdx, index);
    NordlysUI.showUndoToast({
      message: this.say("bookmarks.addedTo", `${link.name} added to ${group.label || ""}`, { name: link.name, folder: group.label || "" }),
      onAction: () => {
        const index = group.links.indexOf(added);
        if (index < 0) return;
        group.links.splice(index, 1);
        redraw();
      }
    });
    return true;
  }

  onGridDragOver(e, grid) {
    if (this.isDragging || ![...(e.dataTransfer?.types || [])].some((type) => type === "text/uri-list" || type === "text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    grid.closest(".card")?.classList.add("dropping");
  }

  onGridDrop(e, grid, gIdx) {
    grid.closest(".card")?.classList.remove("dropping");
    const link = this.linkFrom(e.dataTransfer);
    if (!link) return;
    e.preventDefault();
    const tile = e.target.closest?.(".tile[data-link-idx]");
    this.addLinkFrom(gIdx, link, tile ? Number(tile.dataset.linkIdx) : undefined);
  }

  /* Pasted with nothing else in hand: into the folder of the focused tile,
     or else the first folder that can take it. */
  initPastedLinks() {
    document.addEventListener("paste", (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable], dialog, #cfg") || document.body.classList.contains("cfgopen")) return;
      const link = this.linkFrom(e.clipboardData);
      if (!link) return;
      const held = Number(document.activeElement?.closest?.("#board .card")?.dataset.groupIdx);
      const groups = this.app.config.groups || [];
      const gIdx = groups[held] && !groups[held].source ? held : groups.findIndex((group) => !group.source && !group.hidden);
      if (gIdx < 0) return;
      e.preventDefault();
      this.addLinkFrom(gIdx, link);
    });
  }

  async openEveryBookmark(group) {
    const links = (group.links || []).filter((link) => link && link.url);
    if (!links.length) return;

    const t = (key, fallback) => (window.I18N ? window.I18N.t(key, { count: links.length }) : fallback);
    if (links.length > 5) {
      const ok = await confirmDialog({
        // Opening tabs is not destructive; the confirm button may take focus.
        danger: false,
        title: t("confirm.openAllTitle", `Open ${links.length} tabs?`),
        message: `${group.label || "Folder"}`,
        confirmText: t("confirm.openAllConfirm", "Open them"),
        cancelText: t("confirm.cancel", "Cancel")
      });
      if (!ok) return;
    }
    window.NordlysUI?.announce?.(t("toast.openedAll", `Opened ${links.length} tabs`));
    // As a tab group under the folder's name, where the browser has them (ui-kit.js).
    await openTabs(links.map((link) => link.url), group.label || "");
  }

  confirmFolderDelete(group) {
    const t = (k, fb) => (window.I18N ? window.I18N.t(k) : fb);
    return confirmDialog({
      title: t("confirm.deleteFolderTitle", "Delete folder?"),
      message: `"${group?.label || "Folder"}" — ${(group?.links || []).length} ${t("confirm.bookmarksInside", "bookmarks inside will be removed too.")}`,
      confirmText: t("confirm.delete", "Delete"),
      cancelText: t("confirm.cancel", "Cancel")
    });
  }

  /* A menu item that has a shortcut shows its keys at the right, drawn as
     keys, as the hover labels and the ? sheet draw them. */
  showMenuKeys() {
    const mod = String(navigator.platform || "").toUpperCase().includes("MAC") ? "⌘" : "Ctrl";
    for (const item of document.querySelectorAll(".glass-context-menu .ctx-item[data-keys]")) {
      if (item.querySelector(".ctx-keys")) continue;
      const keys = document.createElement("span");
      keys.className = "ctx-keys";
      keys.setAttribute("aria-hidden", "true");
      for (const cap of item.dataset.keys.split("+")) {
        const kbd = document.createElement("kbd");
        kbd.textContent = cap === "mod" ? mod : cap;
        keys.append(kbd);
      }
      item.append(keys);
    }
  }

  openTileContextMenu(e, gIdx, lIdx) {
    this.closeContextMenus();
    if (!this.tileCtxMenu) return;
    this.activeTileTarget = { gIdx, lIdx };

    const link = this.app.config.groups[gIdx]?.links[lIdx];
    this.activeTileLink = link;
    const titleEl = this.tileCtxMenu.querySelector(".ctx-target-title");
    // The menu is headed by what it acts on, by name; the items need no noun.
    if (titleEl) titleEl.textContent = link?.name || (window.I18N ? window.I18N.t('ctx.link') : "Link");
    /* A followed bookmark is removed in the browser: deleted here, the next
       refresh would bring it straight back. */
    const followed = Boolean(this.app.config.groups[gIdx]?.source);
    const remove = this.tileCtxMenu.querySelector('[data-action="delete"]');
    remove?.toggleAttribute("disabled", followed);
    remove?.setAttribute("aria-disabled", String(followed));
    if (remove) remove.title = followed ? this.ownerSays(this.app.config.groups[gIdx], "bookmarks.linkedRemoveHint", "Remove it in the browser; this folder follows along") : "";
    const watch = this.tileCtxMenu.querySelector('[data-action="watch"] span');
    if (watch) watch.textContent = link?.watch ? this.say("ctx.unwatch", "Stop showing if it is up") : this.say("ctx.watch", "Show if it is up");

    this.positionMenu(this.tileCtxMenu, e.clientX, e.clientY, e.currentTarget || document.activeElement);
  }

  openFolderContextMenu(e, gIdx) {
    this.closeContextMenus();
    if (!this.folderCtxMenu) return;
    this.activeFolderTarget = gIdx;

    const group = this.app.config.groups[gIdx];
    this.activeFolderGroup = group;
    const titleEl = this.folderCtxMenu.querySelector(".ctx-target-title");
    if (titleEl) {
      const folderWord = window.I18N ? window.I18N.t('ctx.folder') : "Folder";
      titleEl.textContent = group?.label || `${folderWord} ${gIdx + 1}`;
    }

    this.positionMenu(this.folderCtxMenu, e.clientX, e.clientY, e.currentTarget || document.activeElement);
  }

  openBoardContextMenu(e) {
    this.closeContextMenus();
    if (!this.boardCtxMenu) return;
    // Nothing on the board is nothing to arrange.
    const arrange = this.boardCtxMenu.querySelector('[data-action="arrange"]');
    if (arrange) arrange.hidden = !this.board?.querySelector(".card");
    // Offered only when something is folded away.
    const unhide = this.boardCtxMenu.querySelector('[data-action="restore-all-folders"]');
    if (unhide) unhide.hidden = !(this.app.config.groups || []).some((group) => group.hidden);

    this.positionMenu(this.boardCtxMenu, e.clientX, e.clientY, e.currentTarget || document.activeElement);
  }

  positionMenu(menuEl, mouseX, mouseY, opener = document.activeElement) {
    this.menuControllers.get(menuEl)?.open(opener, { x: mouseX, y: mouseY });
  }

  closeContextMenus() {
    this.menuControllers.forEach((controller) => controller.close());
  }

  openQuickEditModal(gIdx, lIdx) {
    this.activeTileTarget = { gIdx, lIdx };
    const link = this.app.config.groups[gIdx]?.links[lIdx];
    if (!link || !this.quickModal) return;
    this.activeTileLink = link;

    const titleInput = document.getElementById("quick-title-input");
    const urlInput = document.getElementById("quick-url-input");
    const colorInput = document.getElementById("quick-color-input");
    const folderSelect = document.getElementById("quick-folder-select");
    const iconPreview = document.getElementById("quick-icon-preview");

    if (titleInput) titleInput.value = link.name || "";
    if (urlInput) urlInput.value = link.url || "";
    /* The browser owns a followed bookmark's name, address and folder; what
       it looks like is set here. The fields say so instead of taking an edit
       the next refresh would quietly undo. */
    const followed = Boolean(this.app.config.groups[gIdx]?.source);
    for (const input of [titleInput, urlInput]) if (input) input.readOnly = followed;
    // Removed in the browser, not here (the next refresh would bring it back).
    const deleteButton = document.getElementById("quick-delete-btn");
    if (deleteButton) deleteButton.hidden = followed;
    const linkedNote = document.getElementById("quick-edit-linked-note");
    if (linkedNote) {
      linkedNote.hidden = !followed;
      if (followed) linkedNote.textContent = this.ownerSays(this.app.config.groups[gIdx], "bookmarks.linkedEditHint", "This folder follows the browser: rename or change the address there. The icon and colour are yours to set here.", "follow.editHint");
    }
    if (colorInput) colorInput.value = link.color || "#35d6c0";
    const toneSelect = document.getElementById("quick-tone-select");
    if (toneSelect) toneSelect.value = link.tone || "auto";

    if (folderSelect) this.fillQuickFolders(this.app.config.groups[gIdx]);

    if (iconPreview) {
      const iconDef = resolveIcon(link.url, link.icon);
      if (link.customImg) {
        iconPreview.innerHTML = `<img src="${esc(link.customImg)}" style="width: 100%; height: 100%; object-fit: contain;">`;
      } else if (link.monogram) {
        iconPreview.innerHTML = `<span style="font-weight: 700; font-size: 16px;">${esc(link.monogram)}</span>`;
      } else if (iconDef) {
        iconPreview.innerHTML = `<svg viewBox="${iconDef.vb || '0 0 24 24'}" style="width: 22px; height: 22px; fill: ${esc(link.color || 'var(--accent)')};"><path d="${iconDef.p}"/></svg>`;
      } else {
        iconPreview.innerHTML = `<span style="font-weight: 700; font-size: 16px;">${esc((link.name || 'A').charAt(0))}</span>`;
      }
    }

    this.quickDialog.open(document.querySelector(`.tile[data-group-idx="${gIdx}"][data-link-idx="${lIdx}"]`) || document.activeElement, titleInput);
  }

  /* The editor's folder list, with `chosen` selected. Rebuilt on every open,
     and again when another tab's board moves the folders under an open
     editor — otherwise its choice points at whatever folder took the place. */
  fillQuickFolders(chosen) {
    const folderSelect = document.getElementById("quick-folder-select");
    if (!folderSelect) return;
    const groups = this.app.config.groups || [];
    const at = Math.max(0, groups.indexOf(chosen));
    const home = groups[this.activeTileTarget?.gIdx];
    const followed = Boolean(home?.source);
    folderSelect.innerHTML = groups
      .map((g, idx) => `<option value="${idx}" ${idx === at ? "selected" : ""}>${esc(g.label || this.say("bookmarks.newFolder", "New folder"))}</option>`)
      .join("");
    folderSelect.value = String(at);
    folderSelect.disabled = followed;
    // A folder that follows the browser is not a destination either.
    [...folderSelect.options].forEach((option) => {
      option.disabled = groups[Number(option.value)] !== home && Boolean(groups[Number(option.value)]?.source);
    });
    this.quickFolderChoices = [...groups];
    // The options are rebuilt, so the themed control has to be told —
    // otherwise it keeps showing the value it read the first time.
    window.NordlysUI?.refreshSelects(this.quickModal);
  }

  closeQuickEditModal() {
    this.quickDialog.close();
  }

  openQuickFolderModal(gIdx) {
    this.activeFolderTarget = gIdx;
    const group = this.app.config.groups[gIdx];
    if (!group || !this.quickFolderModal) return;
    this.activeFolderGroup = group;

    const nameInput = document.getElementById("quick-folder-name-input");
    const colsSelect = document.getElementById("quick-folder-cols-select");

    if (nameInput) nameInput.value = group.label || "";
    if (colsSelect) colsSelect.value = String(group.cols || 4);
    // The themed list drawn over the select shows its value, not the first option.
    window.NordlysUI?.refreshSelects(this.quickFolderModal);

    this.quickFolderDialog.open(document.querySelector(`.card[data-group-idx="${gIdx}"] .cat`) || document.activeElement, nameInput);
  }

  closeQuickFolderModal() {
    this.quickFolderDialog.close();
  }

  /* ── Interactive Card & Folder Resizing ──────────────────────── */
  /* What Fitted needs to know about a folder: its share of a line is its
     columns, and it spreads as many tiles as it has, up to its columns. */
  shareColumns(cardEl, gridEl, group) {
    const cols = group.cols || 4;
    cardEl?.style.setProperty("--span", String(cols));
    gridEl?.style.setProperty("--cols-used", String(Math.max(1, Math.min(cols, (group.links || []).length || 1))));
  }

  /* Single owner of a column change, so pointer and keyboard cannot drift apart. */
  setFolderColumns(group, gridEl, handleEl, requested) {
    const next = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Number(requested) || MIN_COLUMNS));
    if (next === group.cols) return;
    this.arrange?.remember();
    NordlysUI.animateReflow(gridEl, () => {
      group.cols = next;
      gridEl.dataset.cols = next;
      this.shareColumns(gridEl.closest(".card"), gridEl, group);
    });
    handleEl?.setAttribute("aria-valuenow", String(next));
    this.flowRows();
    this.app.saveConfig();
    this.app.settings?.renderBookmarksManager();
    const name = group.label || (window.I18N ? window.I18N.t('bookmarks.newFolder') : 'Folder');
    const said = window.I18N?.t('announce.resized', { name, count: next });
    NordlysUI.announce(said && said !== 'announce.resized' ? said : `${name} resized to ${next} columns`);
  }

  attachCardResize(cardEl, gridEl, handleEl, group, gIdx) {
    let startX = 0;
    let startCols = group.cols || 4;
    let currentCols = startCols;
    let isResizing = false;
    let pillEl = null;

    let before = null;
    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startCols = group.cols || 4;
      currentCols = startCols;
      // Undo gets the folder as it was, if the drag turns out to change it.
      before = this.arrange?.active ? this.arrange.snapshot() : null;

      cardEl.classList.add("is-resizing");
      handleEl.setPointerCapture(e.pointerId);

      // Create Floating Live Pill Indicator
      pillEl = document.createElement("div");
      pillEl.className = "card-resize-pill";
      pillEl.textContent = currentCols === 1
        ? (window.I18N ? window.I18N.t('hint.columnSingle') : `1 column (list)`)
        : (window.I18N ? window.I18N.t('hint.columnsCount', { count: currentCols }) : `${currentCols} columns`);
      cardEl.appendChild(pillEl);
    };

    const onPointerMove = (e) => {
      if (!isResizing) return;
      e.preventDefault();
      e.stopPropagation();

      const deltaX = e.clientX - startX;
      // Step interval of 75px per column
      const colDelta = Math.round(deltaX / 75);
      const targetCols = Math.max(1, Math.min(8, startCols + colDelta));

      if (targetCols !== currentCols) {
        currentCols = targetCols;
        gridEl.dataset.cols = currentCols;
        group.cols = currentCols;
        this.shareColumns(cardEl, gridEl, group);
        // The same handle reports the value to assistive tech, so dragging must
        // keep it truthful rather than let the two paths drift.
        handleEl.setAttribute("aria-valuenow", String(currentCols));
        if (pillEl) {
          pillEl.textContent = currentCols === 1
            ? (window.I18N ? window.I18N.t('hint.columnSingle') : `1 column (list)`)
            : (window.I18N ? window.I18N.t('hint.columnsCount', { count: currentCols }) : `${currentCols} columns`);
        }
      }
    };

    const onPointerUp = (e) => {
      if (!isResizing) return;
      isResizing = false;
      try { handleEl.releasePointerCapture(e.pointerId); } catch(err) {}

      cardEl.classList.remove("is-resizing");
      if (pillEl) {
        pillEl.remove();
        pillEl = null;
      }

      group.cols = currentCols;
      if (before && currentCols !== startCols) this.arrange.remember(before);
      before = null;
      this.flowRows();
      this.app.saveConfig();
      this.app.settings?.renderBookmarksManager();
    };

    handleEl.addEventListener("pointerdown", onPointerDown);
    handleEl.addEventListener("pointermove", onPointerMove);
    handleEl.addEventListener("pointerup", onPointerUp);
    handleEl.addEventListener("pointercancel", onPointerUp);
  }

  updateGridDOM(sourceGIdx, targetGIdx) {
    const updateCardGrid = (gIdx) => {
      const card = this.board?.querySelector(`.card[data-group-idx="${gIdx}"]`);
      const grid = card?.querySelector(".grid");
      if (!grid) return;
      const group = this.app.config.groups[gIdx];
      if (!group) return;

      const gridFragment = document.createDocumentFragment();
      (group.links || []).forEach((link, lIdx) => {
        const tile = this.createTileElement(link, gIdx, lIdx);
        gridFragment.appendChild(tile);
      });
      grid.replaceChildren(gridFragment);
      this.shareColumns(card, grid, group);
    };

    updateCardGrid(sourceGIdx);
    if (sourceGIdx !== targetGIdx && targetGIdx !== undefined) {
      updateCardGrid(targetGIdx);
    }
  }

  updateTileDOM(gIdx, lIdx) {
    const card = this.board?.querySelector(`.card[data-group-idx="${gIdx}"]`);
    const tile = card?.querySelector(`.tile[data-link-idx="${lIdx}"]`);
    const group = this.app.config.groups[gIdx];
    const link = group?.links[lIdx];
    if (!tile || !link) {
      this.updateGridDOM(gIdx);
      return;
    }

    const newTile = this.createTileElement(link, gIdx, lIdx);
    newTile.classList.add("tile-updated");
    tile.replaceWith(newTile);
    setTimeout(() => { newTile.classList.remove("tile-updated"); }, 500);
  }

  /* A sentence in the user's language, or the English it stands for. */
  say(key, fallback, params) {
    const value = window.I18N?.t(key, params || {});
    return value && value !== key ? value : fallback;
  }

  // The site of the list a folder follows (lists.js); empty for any other folder.
  siteOf(group) {
    if (group?.source?.type !== "list") return "";
    try { return new URL(group.source.url).hostname; } catch (error) { return ""; }
  }

  /* What a followed folder says when it is asked to change: the browser
     owns it, or the list it follows (lists.js) does, at its site. */
  ownerSays(group, key, fallback, listKey = "follow.owned") {
    if (group?.source?.type !== "list") return this.say(key, fallback);
    const site = this.siteOf(group);
    return this.say(listKey, `This folder follows a list at ${site}. Change the list there.`, { site });
  }

  /* ── Moving folders and bookmarks ───────────────────────────── */
  /* Every folder move ends here — a drop, an arrow key, Tidy up — so they all
     save the same way, animate the same way and can all be undone: from the
     arrangement's own Undo while arranging, from a toast otherwise. */
  commitLines(lines, moved, { group = null, lift = null, focus = false, say = "", together = false } = {}) {
    const layout = window.NordlysBoardLayout;
    const groups = this.app.config.groups || [];
    if (!layout) return;
    const undo = this.arrange && !this.arrange.active ? this.arrange.snapshot() : null;
    this.arrange?.remember();
    const change = () => {
      layout.commit(groups, lines, moved);
      layout.normalise(groups);
      this.app.saveConfig();
    };
    const finish = () => {
      const card = group ? this.board.querySelector(`.card[data-group-idx="${groups.indexOf(group)}"]`) : null;
      if (lift) this.flyHome(lift, card);
      // A folder moved by the keyboard may have left the screen; it is followed.
      if (focus) card?.querySelector(".groupGrip")?.focus();
      const place = group ? this.placeOf(group) : null;
      const name = group?.label || "";
      NordlysUI.announce(say || (place
        ? this.say("arrange.movedTo", `${name}: row ${place.row}, position ${place.position} of ${place.count}`, { name, ...place })
        : ""));
      if (undo) {
        NordlysUI.showUndoToast({
          message: group ? this.say("arrange.folderMoved", `${name} moved`, { name }) : this.say("arrange.arranged", "Board arranged"),
          onAction: () => this.arrange.restore(undo)
        });
      }
      this.app.settings?.syncBoardLayout?.();
    };
    /* A whole board rearranged at once is one transition. A single folder put
       down or stepped by a key glides in place instead, at once: the next key
       press or drag must find the board already where it is going. */
    if (together) { this.together(change, { after: finish }); return; }
    const before = window.NordlysBoardMotion?.captureCards(this);
    change();
    this.render();
    this.app.settings?.renderBookmarksManager?.();
    window.NordlysBoardMotion?.settleCards(this, before, { skip: lift ? group : null });
    finish();
  }

  /* A bookmark from one place to another, in the same folder or not. */
  moveLink(from, fromIndex, to, toIndex, { lift = null } = {}) {
    const groups = this.app.config.groups || [];
    const link = from?.links?.[fromIndex];
    if (!link || !to) { lift?.remove(); return; }
    if (from.source || to.source) {
      lift?.remove();
      this.updateGridDOM(groups.indexOf(from), groups.indexOf(to));
      const message = this.ownerSays(from.source ? from : to, "bookmarks.linkedNoDrop", "This folder follows the browser. Add the bookmark there instead.");
      if (typeof toast === "function") toast(message, "danger", 2800); else NordlysUI.announce(message);
      return;
    }
    const undo = this.arrange && !this.arrange.active && from !== to ? this.arrange.snapshot() : null;
    this.arrange?.remember();
    from.links.splice(fromIndex, 1);
    (to.links ||= []).splice(Math.min(toIndex, to.links.length), 0, link);
    this.app.saveConfig();
    const fromIdx = groups.indexOf(from);
    const toIdx = groups.indexOf(to);
    this.updateGridDOM(fromIdx, toIdx);
    this.numberShortcuts();
    this.wireRovingTiles();
    this.arrange?.refresh();
    this.app.settings?.renderBookmarksManager?.();
    const landed = this.board.querySelector(`.tile[data-group-idx="${toIdx}"][data-link-idx="${to.links.indexOf(link)}"]`);
    this.flyHome(lift, landed);
    const name = link.name || "";
    const folder = to.label || "";
    NordlysUI.announce(from === to
      ? this.say("announce.movedToPosition", `${name} moved to position ${to.links.indexOf(link) + 1}`, { name, position: to.links.indexOf(link) + 1 })
      : this.say("announce.movedToFolder", `${name} moved to ${folder}`, { name, folder }));
    if (undo) {
      NordlysUI.showUndoToast({
        message: this.say("announce.movedToFolder", `${name} moved to ${folder}`, { name, folder }),
        onAction: () => this.arrange.restore(undo)
      });
    }
  }

  /* The copy in hand settles onto the real thing, which waits unseen until it
     lands. Without a target the copy simply fades where it is. */
  flyHome(lift, target) {
    if (!lift) return;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      lift.remove();
      target?.classList.remove("drag-landing");
    };
    const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motion) { done(); return; }
    const width = parseFloat(lift.style.width) || 1;
    const height = parseFloat(lift.style.height) || 1;
    const baseLeft = parseFloat(lift.style.left) || 0;
    const baseTop = parseFloat(lift.style.top) || 0;
    // A copy zoomed to the board's scale (PageFit.dress) moves in its own lengths.
    const zoom = parseFloat(lift.style.zoom) || 1;
    const from = getComputedStyle(lift).transform;
    let to;
    if (target?.isConnected) {
      target.classList.add("drag-landing");
      const box = target.getBoundingClientRect();
      to = `translate3d(${box.left / zoom - baseLeft}px, ${box.top / zoom - baseTop}px, 0) scale(${box.width / (width * zoom)}, ${box.height / (height * zoom)})`;
    }
    lift.classList.add("is-landing");
    const frames = to
      ? [{ transform: from === "none" ? "none" : from }, { transform: to }]
      : [{ opacity: 1 }, { opacity: 0 }];
    // Set down on the spring, the way it was picked up; a copy with nowhere to go just fades.
    const animation = lift.animate(frames, { ...NordlysUI.motion(to ? "settle-fast" : "fast"), fill: "forwards" });
    animation.onfinish = done;
    animation.oncancel = done;
    setTimeout(done, 600);
  }

  updateFolderDOM(gIdx) {
    const card = this.board?.querySelector(`.card[data-group-idx="${gIdx}"]`);
    const group = this.app.config.groups[gIdx];
    if (!card || !group) {
      this.render();
      return;
    }

    const labelEl = card.querySelector(".cat b");
    if (labelEl) labelEl.textContent = group.label || "Folder";

    const grid = card.querySelector(".grid");
    if (grid) {
      grid.dataset.cols = group.cols || 4;
    }

    this.updateGridDOM(gIdx);
    // A new name or a new column count changes the folder's width.
    this.flowRows();
  }

}
