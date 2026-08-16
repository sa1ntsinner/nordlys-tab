/* ═══════════════════════════════════════════════════════════════════
   AURORA TAB 2.0 - GRID, TILES, FOLDER DRAG & DROP & CONTEXT MENUS
   ═══════════════════════════════════════════════════════════════════ */

class GridController {
  constructor(app) {
    this.app = app;
    this.board = document.getElementById("board");
    this.dock = document.getElementById("hiddenDock");
    
    // Context Menus & Modals
    this.tileCtxMenu = document.getElementById("tile-ctx-menu");
    this.folderCtxMenu = document.getElementById("folder-ctx-menu");
    this.boardCtxMenu = document.getElementById("board-ctx-menu");

    this.quickModal = document.getElementById("quick-edit-modal");
    this.quickFolderModal = document.getElementById("quick-edit-folder-modal");

    this.activeTileTarget = null;   // { gIdx, lIdx }
    this.activeFolderTarget = null; // gIdx

    // Drag states
    this.dragTile = null;   // { gIdx, lIdx, link }
    this.dragFolder = null; // { gIdx }
    this.isDragging = false;
    this.justDragged = false;

    // Capture-phase global click interceptor to stop any unintended link navigation after drag
    window.addEventListener("click", (e) => {
      if (this.justDragged || this.isDragging) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    }, true);

    this.hasInitialLoaded = false;

    // One delegated listener disarms folder dragging after any mouse release
    // (previously each render attached a fresh window listener per card — a leak)
    window.addEventListener("mouseup", () => {
      this.board?.querySelectorAll(".card[draggable='true']").forEach((c) => {
        c.draggable = false;
      });
    });

    this.initContextMenusAndModals();
    this.initBoardDragListeners();
  }

  render() {
    if (!this.board) return;

    const boardFragment = document.createDocumentFragment();
    const dockFragment = document.createDocumentFragment();

    const groups = this.app.config.groups || [];
    let hasHidden = false;
    let visibleIdx = 0;
    let maxLinks = 0;

    groups.forEach((group, gIdx) => {
      if (group.hidden) {
        hasHidden = true;
        this.renderDockItem(group, gIdx, dockFragment);
        return;
      }

      const card = this.createGroupCard(group, gIdx, visibleIdx++);
      maxLinks = Math.max(maxLinks, (group.links || []).length);
      boardFragment.appendChild(card);
    });

    this.board.replaceChildren(boardFragment);
    if (this.dock) {
      this.dock.replaceChildren(dockFragment);
      this.dock.style.display = hasHidden ? "inline-flex" : "none";
    }

    if (!this.hasInitialLoaded) {
      // Once the entry choreography has fully played, freeze it so later
      // re-renders (edits, drags, settings tweaks) never re-animate the board.
      const entryMs = Math.min(2000, 350 + visibleIdx * 70 + maxLinks * 15 + 700);
      setTimeout(() => {
        this.hasInitialLoaded = true;
        this.board?.classList.add("board-loaded");
      }, entryMs);
    }
  }

  createGroupCard(group, gIdx, visibleIdx = gIdx) {
    const card = document.createElement("section");
    card.className = "card";
    card.style.setProperty("--i", visibleIdx);
    card.dataset.groupIdx = gIdx;

    // Card Header
    const cat = document.createElement("div");
    cat.className = "cat";
    cat.title = window.I18N ? window.I18N.t('hint.dragReorderFolder') : "Drag to reorder or Right-Click to edit folder";
    cat.innerHTML = `
      <s></s>
      <b>${esc(group.label || "Group")}</b>
      <i></i>
      <button class="groupGrip" title="${esc(window.I18N ? window.I18N.t('hint.dragFolder') : 'Drag folder')}" aria-label="Drag folder">⋮⋮</button>
      <button class="foldBtn" title="${esc(window.I18N ? window.I18N.t('hint.foldFolder') : 'Hide/Fold this folder')}" aria-label="Fold folder">−</button>
    `;

    // Folder Fold action
    const foldBtn = cat.querySelector(".foldBtn");
    foldBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      card.style.animation = "foldaway 0.22s cubic-bezier(0.2, 0.7, 0.2, 1) forwards";
      setTimeout(() => {
        group.hidden = true;
        this.app.saveConfig();
        this.render();
      }, 200);
    });

    // Folder Right-Click Context Menu
    cat.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openFolderContextMenu(e, gIdx);
    });

    // Folder Dragging
    const groupGrip = cat.querySelector(".groupGrip");
    this.attachFolderDrag(card, cat, groupGrip, gIdx);

    card.appendChild(cat);

    // Tiles Grid
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.dataset.cols = group.cols || 4;
    grid.dataset.groupIdx = gIdx;

    grid.addEventListener("dragover", (e) => this.onGridDragOver(e, grid));
    grid.addEventListener("drop", (e) => this.onGridDrop(e, grid, gIdx));

    const gridFragment = document.createDocumentFragment();
    (group.links || []).forEach((link, lIdx) => {
      const tile = this.createTileElement(link, gIdx, lIdx);
      gridFragment.appendChild(tile);
    });
    grid.appendChild(gridFragment);
    card.appendChild(grid);

    // Mouse Drag-to-Resize for Folders
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "card-resize-handle";
    resizeHandle.title = window.I18N ? window.I18N.t('hint.dragResizeFolder') : "Drag to resize folder columns";
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
    a.draggable = true;

    // Render Box & Icon
    const box = document.createElement("div");
    box.className = "box";

    // Smart Icon Resolution (Custom image / Monogram / Vector SVG)
    const iconDef = resolveIcon(link.url, link.icon);

    if (link.customImg) {
      const img = document.createElement("img");
      img.src = link.customImg;
      img.alt = link.name || "";
      img.loading = "lazy";
      img.draggable = false;
      img.onerror = () => {
        img.remove();
        const initial = (link.name || "A").trim().charAt(0).toUpperCase();
        const mono = document.createElement("span");
        mono.className = "mono";
        mono.textContent = initial;
        box.appendChild(mono);
      };
      box.appendChild(img);
    } else if (link.monogram) {
      const mono = document.createElement("span");
      mono.className = "mono";
      mono.textContent = link.monogram;
      box.appendChild(mono);
    } else if (iconDef) {
      box.innerHTML = `<svg viewBox="${iconDef.vb || '0 0 24 24'}" style="pointer-events: none;"><path d="${iconDef.p}"/></svg>`;
    } else {
      const initial = (link.name || "A").trim().charAt(0).toUpperCase();
      const mono = document.createElement("span");
      mono.className = "mono";
      mono.textContent = initial;
      box.appendChild(mono);
    }

    // Label
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = link.name || "Link";

    a.appendChild(box);
    a.appendChild(lbl);

    // Native Drag-and-Drop on whole tile
    this.attachTileDrag(a, gIdx, lIdx);

    // Bookmark Right-Click Context Menu Trigger
    a.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openTileContextMenu(e, gIdx, lIdx);
    });

    return a;
  }

  /* ── Discreet Minimalist Floating Dock Chip ─────────────────── */
  renderDockItem(group, gIdx, container) {
    const btn = document.createElement("button");
    btn.className = "restoreFolder";
    btn.type = "button";
    btn.dataset.groupIdx = gIdx;
    btn.title = `Click to restore "${group.label || 'Folder'}" to board (or Right Click for options)`;

    const count = (group.links || []).length;
    btn.innerHTML = `
      <svg class="dockFolderIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="dockFolderName">${esc(group.label || "Folder")}</span>
      <span class="dockFolderCount">${count}</span>
    `;

    btn.addEventListener("click", () => {
      btn.style.transform = "scale(0.92)";
      btn.style.opacity = "0";
      setTimeout(() => {
        group.hidden = false;
        this.app.saveConfig();
        this.render();
      }, 140);
    });

    container.appendChild(btn);
  }

  /* ── Context Menus & Quick Edit Modals ──────────────────────── */
  initContextMenusAndModals() {
    // Window click to close context menus
    window.addEventListener("click", (e) => {
      if (!e.target.closest(".glass-context-menu")) {
        this.closeContextMenus();
      }
    });

    // Intelligent Context Menu Event Routing (Tile vs Folder vs Board Wallpaper)
    window.addEventListener("contextmenu", (e) => {
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

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeContextMenus();
        this.closeQuickEditModal();
        this.closeQuickFolderModal();
      }
    });

    // 1. Bookmark Context Menu Actions
    this.tileCtxMenu?.querySelectorAll(".ctx-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.dataset.action;
        if (!this.activeTileTarget) return;
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
        } else if (action === "delete") {
          group.links.splice(lIdx, 1);
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
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
        } else if (action === "hide-folder") {
          group.hidden = !group.hidden;
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
        } else if (action === "delete-folder") {
          this.confirmFolderDelete(group).then((ok) => {
            if (!ok) return;
            this.app.config.groups.splice(gIdx, 1);
            this.app.saveConfig();
            this.render();
            this.app.settings?.renderBookmarksManager();
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

        if (action === "new-folder") {
          const newGIdx = this.app.config.groups.length;
          this.app.config.groups.push({
            id: `g_${Date.now()}`,
            label: `Folder ${newGIdx + 1}`,
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
          this.app.config.groups.forEach((g) => { g.hidden = false; });
          this.app.saveConfig();
          this.render();
          this.app.settings?.renderBookmarksManager();
        } else if (action === "open-settings") {
          this.app.settings?.openDrawer("general");
        } else if (action === "toggle-themes") {
          this.app.settings?.openDrawer("appearance");
        }
      });
    });

    // Quick Bookmark Modal controls
    const quickModalX = document.getElementById("quick-modal-x");
    const quickChangeIconBtn = document.getElementById("quick-change-icon-btn");
    const quickIconPreview = document.getElementById("quick-icon-preview");
    const quickSaveBtn = document.getElementById("quick-save-btn");

    quickModalX?.addEventListener("click", () => this.closeQuickEditModal());
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
      if (!isNaN(targetFolderIdx) && targetFolderIdx !== gIdx && this.app.config.groups[targetFolderIdx]) {
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
    quickChangeIconBtn?.addEventListener("click", triggerIconPicker);
    quickIconPreview?.addEventListener("click", triggerIconPicker);

    quickSaveBtn?.addEventListener("click", () => {
      if (!this.activeTileTarget) return;
      const { gIdx, lIdx } = this.activeTileTarget;
      const oldGroup = this.app.config.groups[gIdx];
      const link = oldGroup?.links[lIdx];
      if (!link) return;

      const newTitle = document.getElementById("quick-title-input")?.value.trim() || link.name;
      let newUrl = document.getElementById("quick-url-input")?.value.trim() || link.url;
      if (newUrl && !/^https?:\/\//i.test(newUrl)) newUrl = `https://${newUrl}`;
      const newColor = document.getElementById("quick-color-input")?.value || link.color;
      const targetFolderIdx = parseInt(document.getElementById("quick-folder-select")?.value, 10);

      link.name = newTitle;
      link.url = newUrl;
      link.color = newColor;

      if (!isNaN(targetFolderIdx) && targetFolderIdx !== gIdx && this.app.config.groups[targetFolderIdx]) {
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
        this.app.config.groups.splice(gIdx, 1);
        this.app.saveConfig();
        this.render();
        this.app.settings?.renderBookmarksManager();
        this.closeQuickFolderModal();
      });
    });
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

  openTileContextMenu(e, gIdx, lIdx) {
    this.closeContextMenus();
    if (!this.tileCtxMenu) return;
    this.activeTileTarget = { gIdx, lIdx };

    const link = this.app.config.groups[gIdx]?.links[lIdx];
    const titleEl = this.tileCtxMenu.querySelector(".ctx-target-title");
    if (titleEl) {
      const bmkWord = window.I18N ? window.I18N.t('ctx.bookmark') : "Bookmark";
      const linkWord = window.I18N ? window.I18N.t('ctx.link') : "Link";
      titleEl.textContent = `${bmkWord} • ${link?.name || linkWord}`;
    }

    this.positionMenu(this.tileCtxMenu, e.clientX, e.clientY);
  }

  openFolderContextMenu(e, gIdx) {
    this.closeContextMenus();
    if (!this.folderCtxMenu) return;
    this.activeFolderTarget = gIdx;

    const group = this.app.config.groups[gIdx];
    const titleEl = this.folderCtxMenu.querySelector(".ctx-target-title");
    if (titleEl) {
      const folderWord = window.I18N ? window.I18N.t('ctx.folder') : "Folder";
      titleEl.textContent = `${folderWord} • ${group?.label || `${folderWord} ${gIdx + 1}`}`;
    }

    this.positionMenu(this.folderCtxMenu, e.clientX, e.clientY);
  }

  openBoardContextMenu(e) {
    this.closeContextMenus();
    if (!this.boardCtxMenu) return;

    this.positionMenu(this.boardCtxMenu, e.clientX, e.clientY);
  }

  positionMenu(menuEl, mouseX, mouseY) {
    // Measure the real rendered size (menus differ in height) while invisible
    menuEl.style.visibility = "hidden";
    menuEl.classList.add("open");
    const menuW = menuEl.offsetWidth || 220;
    const menuH = menuEl.offsetHeight || 220;
    menuEl.classList.remove("open");
    menuEl.style.visibility = "";

    let posX = mouseX;
    let posY = mouseY;
    const flipX = posX + menuW > window.innerWidth - 12;
    const flipY = posY + menuH > window.innerHeight - 12;
    if (flipX) posX = Math.max(10, mouseX - menuW);
    if (flipY) posY = Math.max(10, mouseY - menuH);

    menuEl.style.left = `${Math.max(10, posX)}px`;
    menuEl.style.top = `${Math.max(10, posY)}px`;
    // Menu unfolds from the cursor corner it was invoked at
    menuEl.style.setProperty("--origin", `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`);

    requestAnimationFrame(() => menuEl.classList.add("open"));
  }

  closeContextMenus() {
    this.tileCtxMenu?.classList.remove("open");
    this.folderCtxMenu?.classList.remove("open");
    this.boardCtxMenu?.classList.remove("open");
  }

  openQuickEditModal(gIdx, lIdx) {
    this.activeTileTarget = { gIdx, lIdx };
    const link = this.app.config.groups[gIdx]?.links[lIdx];
    if (!link || !this.quickModal) return;

    const titleInput = document.getElementById("quick-title-input");
    const urlInput = document.getElementById("quick-url-input");
    const colorInput = document.getElementById("quick-color-input");
    const folderSelect = document.getElementById("quick-folder-select");
    const iconPreview = document.getElementById("quick-icon-preview");

    if (titleInput) titleInput.value = link.name || "";
    if (urlInput) urlInput.value = link.url || "";
    if (colorInput) colorInput.value = link.color || "#35d6c0";

    if (folderSelect) {
      folderSelect.innerHTML = (this.app.config.groups || [])
        .map((g, idx) => `<option value="${idx}" ${idx === gIdx ? "selected" : ""}>${esc(g.label || `Folder ${idx + 1}`)}</option>`)
        .join("");
      folderSelect.value = String(gIdx);
    }

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

    this.quickModal.classList.add("open");
    setTimeout(() => { titleInput?.focus(); titleInput?.select(); }, 50);
  }

  closeQuickEditModal() {
    this.quickModal?.classList.remove("open");
  }

  openQuickFolderModal(gIdx) {
    this.activeFolderTarget = gIdx;
    const group = this.app.config.groups[gIdx];
    if (!group || !this.quickFolderModal) return;

    const nameInput = document.getElementById("quick-folder-name-input");
    const colsSelect = document.getElementById("quick-folder-cols-select");

    if (nameInput) nameInput.value = group.label || "";
    if (colsSelect) colsSelect.value = String(group.cols || 4);

    this.quickFolderModal.classList.add("open");
    setTimeout(() => { nameInput?.focus(); nameInput?.select(); }, 50);
  }

  closeQuickFolderModal() {
    this.quickFolderModal?.classList.remove("open");
  }

  /* ── SOTA Fluid Folder & Tile Drag and Drop ─────────────────── */
  initBoardDragListeners() {
    if (!this.board) return;

    this.board.addEventListener("dragover", (e) => {
      if (this.dragFolder) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    });

    this.board.addEventListener("drop", (e) => {
      if (!this.dragFolder) return;
      e.preventDefault();
      this.handleFolderDropOnBoard(e);
    });
  }

  attachFolderDrag(cardEl, catEl, gripEl, gIdx) {
    cardEl.draggable = false;

    const enableDrag = () => { cardEl.draggable = true; };

    gripEl?.addEventListener("mousedown", enableDrag);
    catEl?.addEventListener("mousedown", (e) => {
      if (!e.target.closest("button") && !e.target.closest("input")) {
        enableDrag();
      }
    });
    // (drag is disarmed by the single delegated window mouseup listener)

    cardEl.addEventListener("dragstart", (e) => {
      if (this.dragTile) return;
      this.isDragging = true;
      this.dragFolder = { gIdx };
      cardEl.classList.add("ghost");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `folder:${gIdx}`);
    });

    cardEl.addEventListener("dragend", () => {
      cardEl.classList.remove("ghost");
      cardEl.draggable = false;
      this.isDragging = false;
      this.dragFolder = null;
      this.clearDropHighlights();
    });

    cardEl.addEventListener("dragover", (e) => {
      if (!this.dragFolder) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = cardEl.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      cardEl.classList.remove("group-before", "group-after");

      if (e.clientX < mid) {
        cardEl.classList.add("group-before");
      } else {
        cardEl.classList.add("group-after");
      }
    });

    cardEl.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget || !cardEl.contains(e.relatedTarget)) {
        cardEl.classList.remove("group-before", "group-after");
      }
    });

    cardEl.addEventListener("drop", (e) => {
      if (!this.dragFolder) return;
      e.preventDefault();
      e.stopPropagation();

      const srcIdx = this.dragFolder.gIdx;
      let tgtIdx = gIdx;
      if (cardEl.classList.contains("group-after")) {
        tgtIdx++;
      }
      if (srcIdx < tgtIdx) {
        tgtIdx--;
      }

      this.reorderFolder(srcIdx, tgtIdx);
    });
  }

  handleFolderDropOnBoard(e) {
    if (!this.dragFolder) return;
    const cards = Array.from(this.board.querySelectorAll(".card"));
    if (!cards.length) return;

    const hoveredCard = e.target.closest(".card");
    const srcIdx = this.dragFolder.gIdx;
    let tgtIdx = cards.length;

    if (hoveredCard && hoveredCard.dataset.groupIdx !== undefined) {
      const idx = parseInt(hoveredCard.dataset.groupIdx, 10);
      const isAfter = hoveredCard.classList.contains("group-after");
      tgtIdx = isAfter ? idx + 1 : idx;
      if (srcIdx < tgtIdx) tgtIdx--;
    }

    this.reorderFolder(srcIdx, tgtIdx);
  }

  reorderFolder(srcIdx, tgtIdx) {
    if (srcIdx === tgtIdx || srcIdx === undefined || tgtIdx === undefined) {
      this.clearDropHighlights();
      return;
    }

    const [movedGroup] = this.app.config.groups.splice(srcIdx, 1);
    this.app.config.groups.splice(tgtIdx, 0, movedGroup);

    this.app.saveConfig();
    this.clearDropHighlights();
    this.render();
    this.app.settings?.renderBookmarksManager();
  }

  /* ── Interactive Card & Folder Resizing ──────────────────────── */
  attachCardResize(cardEl, gridEl, handleEl, group, gIdx) {
    let startX = 0;
    let startCols = group.cols || 4;
    let currentCols = startCols;
    let isResizing = false;
    let pillEl = null;

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startCols = group.cols || 4;
      currentCols = startCols;

      cardEl.classList.add("is-resizing");
      handleEl.setPointerCapture(e.pointerId);

      // Create Floating Live Pill Indicator
      pillEl = document.createElement("div");
      pillEl.className = "card-resize-pill";
      pillEl.textContent = currentCols === 1
        ? (window.I18N ? window.I18N.t('hint.columnSingle') : `✦ 1 Column (List)`)
        : (window.I18N ? window.I18N.t('hint.columnsCount', { count: currentCols }) : `✦ ${currentCols} Columns`);
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
        if (pillEl) {
          pillEl.textContent = currentCols === 1
            ? (window.I18N ? window.I18N.t('hint.columnSingle') : `✦ 1 Column (List)`)
            : (window.I18N ? window.I18N.t('hint.columnsCount', { count: currentCols }) : `✦ ${currentCols} Columns`);
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
      this.app.saveConfig();
      this.app.settings?.renderBookmarksManager();
    };

    handleEl.addEventListener("pointerdown", onPointerDown);
    handleEl.addEventListener("pointermove", onPointerMove);
    handleEl.addEventListener("pointerup", onPointerUp);
    handleEl.addEventListener("pointercancel", onPointerUp);
  }

  /* ── Clean Whole-Tile Drag & Drop ────────────────────────────── */
  attachTileDrag(tileEl, gIdx, lIdx) {
    tileEl.addEventListener("dragstart", (e) => {
      if (this.dragFolder) return;
      this.isDragging = true;
      this.justDragged = true;
      this.dragTile = { gIdx, lIdx, link: this.app.config.groups[gIdx]?.links[lIdx] };
      
      // Delay ghost class application by 1 frame so native drag image captures properly
      setTimeout(() => {
        if (this.isDragging) {
          tileEl.classList.add("ghost");
        }
      }, 0);

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(this.dragTile));
    });

    tileEl.addEventListener("dragend", () => {
      tileEl.classList.remove("ghost");
      this.isDragging = false;
      this.justDragged = true;
      setTimeout(() => { this.justDragged = false; }, 450);
      this.clearDropHighlights();
    });

    tileEl.addEventListener("dragover", (e) => {
      if (!this.dragTile || this.dragFolder) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = tileEl.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      tileEl.classList.remove("drop-before", "drop-after");

      if (e.clientX < mid) {
        tileEl.classList.add("drop-before");
      } else {
        tileEl.classList.add("drop-after");
      }
      tileEl.closest(".card")?.classList.add("dropping");
    });

    tileEl.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget || !tileEl.contains(e.relatedTarget)) {
        tileEl.classList.remove("drop-before", "drop-after");
      }
    });

    tileEl.addEventListener("drop", (e) => {
      if (!this.dragTile || this.dragFolder) return;
      e.preventDefault();
      e.stopPropagation();
      const grid = tileEl.closest(".grid");
      const targetGIdx = parseInt(tileEl.dataset.groupIdx, 10);
      this.onGridDrop(e, grid, targetGIdx);
    });

    tileEl.addEventListener("click", (e) => {
      if (this.isDragging || this.justDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  onGridDragOver(e, grid) {
    if (!this.dragTile || this.dragFolder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    grid.closest(".card")?.classList.add("dropping");
  }

  onGridDrop(e, grid, targetGIdx) {
    if (!this.dragTile || this.dragFolder) return;
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    this.justDragged = true;
    setTimeout(() => { this.justDragged = false; }, 450);
    grid?.closest(".card")?.classList.remove("dropping");

    const sourceGIdx = this.dragTile.gIdx;
    const sourceLIdx = this.dragTile.lIdx;
    const sourceGroup = this.app.config.groups[sourceGIdx];
    const targetGroup = this.app.config.groups[targetGIdx];
    if (!sourceGroup || !targetGroup) {
      this.clearDropHighlights();
      return;
    }

    const hoveredTile = e.target.closest(".tile");
    let targetLIdx = targetGroup.links.length;

    if (hoveredTile && hoveredTile.dataset.linkIdx !== undefined) {
      const idx = parseInt(hoveredTile.dataset.linkIdx, 10);
      const isAfter = hoveredTile.classList.contains("drop-after");
      targetLIdx = isAfter ? idx + 1 : idx;
    }

    // If dropped on same position in same group, do nothing
    if (sourceGIdx === targetGIdx) {
      if (sourceLIdx === targetLIdx || sourceLIdx + 1 === targetLIdx) {
        this.clearDropHighlights();
        return;
      }
    }

    const [movedLink] = sourceGroup.links.splice(sourceLIdx, 1);
    if (!movedLink) {
      this.clearDropHighlights();
      return;
    }

    if (sourceGIdx === targetGIdx && sourceLIdx < targetLIdx) {
      targetLIdx--;
    }
    targetGroup.links.splice(targetLIdx, 0, movedLink);

    this.app.saveConfig();
    this.clearDropHighlights();

    // Seamless DOM update without full page re-render/flicker
    this.updateGridDOM(sourceGIdx, targetGIdx);
    this.app.settings?.renderBookmarksManager();
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
  }

  clearDropHighlights() {
    this.dragTile = null;
    this.dragFolder = null;
    document.querySelectorAll(".drop-before, .drop-after, .group-before, .group-after, .dropping").forEach((el) => {
      el.classList.remove("drop-before", "drop-after", "group-before", "group-after", "dropping");
    });
  }
}
