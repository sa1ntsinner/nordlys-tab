/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SETTINGS CONTROLLER & CUSTOMIZATION
   ═══════════════════════════════════════════════════════════════════ */

/* Fallback names, and the keys that translate them. Marking the card with
   data-i18n lets a language switch retranslate it without a listener here. */
const SCENE_NAMES = {
  "aurora": "Aurora",
  "cosmos": "Cosmos",
  "mesh-gradient": "Mesh",
  "particles": "Particles",
  "custom-image": "Wallpaper",
  "custom-video": "Video",
  "solid": "Solid"
};
const SCENE_KEYS = {
  "aurora": "scene.aurora",
  "cosmos": "scene.cosmos",
  "mesh-gradient": "scene.mesh",
  "particles": "scene.particles",
  "custom-image": "scene.wallpaper",
  "custom-video": "scene.video",
  "solid": "scene.solid"
};

class SettingsController {
  constructor(app) {
    this.app = app;
    this.drawer = document.getElementById("cfg");
    this.resizer = document.getElementById("cfg-resizer");
    this.modal = document.getElementById("icon-modal");
    this.activeIconTarget = null; // { gIdx, lIdx }
    this.activeModalTab = "library";
    this.customThemes = this.loadCustomThemes();
    this.shell = new NordlysSettingsShell({
      root: this.drawer,
      opener: document.getElementById("gear")
    });
    this.bookmarkSettings = new NordlysBookmarkSettings({
      app: this.app,
      root: document.getElementById("cfg-groups-editor"),
      openIconPicker: (gIdx, lIdx, opener) => this.openIconModal(gIdx, lIdx, opener)
    });
    this.iconPicker = new NordlysIconPicker({ dialogRoot: this.modal });
    document.getElementById("gear")?.addEventListener("click", () => this.open());
    
    this.initDrawerResizer();
    this.initAppearance();
    this.initCustomThemeBuilder();
    this.initGeneral();
    this.initBackgroundSettings();
    this.initBookmarksManager();
    this.initIconPickerModal();
    this.initCustomCSSEditor();
    this.initBackupManager();
    this.initScenePicker();
    this.initTypography();
    // Every native dropdown gets a themed control drawn over it; the element
    // stays as the value source but stops painting platform chrome.
    window.NordlysUI?.enhanceSelects(document);
  }

  /* ── 0a. Background scenes ────────────────────────────────────── */
  /* The old control was a dropdown of engine names, which told the user nothing
     about what they would get — and the procedural scenes looked so alike that
     switching read as no change. Now the choice is shown, and two sliders that
     apply to every scene make the difference something you can actually dial. */
  initScenePicker() {
    const select = document.getElementById("cfg-bg-mode");
    const grid = document.getElementById("bg-scene-grid");
    if (!select || !grid) return;

    const paint = () => {
      grid.replaceChildren();
      for (const option of select.options) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "scene-card";
        card.dataset.scene = option.value;
        card.setAttribute("role", "radio");
        card.setAttribute("aria-checked", String(option.value === select.value));
        const preview = document.createElement("span");
        preview.className = "scene-preview";
        preview.dataset.scene = option.value;
        preview.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "scene-name";
        // The stored labels are engine descriptions ("Dynamic Aurora Borealis
        // (Ribbons & Meteors)"). A card is a picture with a name under it.
        const sceneKey = SCENE_KEYS[option.value];
        if (sceneKey) name.dataset.i18n = sceneKey;
        name.textContent = (sceneKey && window.I18N?.t(sceneKey))
          || SCENE_NAMES[option.value]
          || option.textContent.replace(/\s*\(.*\)\s*$/, "").trim();
        card.append(preview, name);
        card.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          paint();
        });
        grid.append(card);
      }
    };

    select.addEventListener("change", () => {
      grid.querySelectorAll(".scene-card").forEach((card) => {
        card.setAttribute("aria-checked", String(card.dataset.scene === select.value));
      });
      showRelevant();
    });

    /* Offering an Upload Wallpaper button while Aurora is running, or a blur
       slider with nothing to blur, is noise the user has to read and dismiss.
       Each control declares the scenes it belongs to and the rest step aside. */
    const SCENE_GROUPS = {
      procedural: ["aurora", "cosmos", "mesh-gradient", "particles"],
      media: ["custom-image", "custom-video"],
      image: ["custom-image"]
    };
    const showRelevant = () => {
      const scene = select.value;
      for (const node of document.querySelectorAll("#sec-background [data-scene-only]")) {
        const belongs = SCENE_GROUPS[node.dataset.sceneOnly] || [];
        node.hidden = !belongs.includes(scene);
      }
    };

    const applyAtmosphere = () => {
      const motion = Number(document.getElementById("cfg-bg-motion")?.value ?? 100) / 100;
      const intensity = Number(document.getElementById("cfg-bg-intensity")?.value ?? 100) / 100;
      this.app.config.bgMotion = motion;
      this.app.config.bgIntensity = intensity;
      this.app.bgEngine?.setAtmosphere({ motion, intensity });
      const motionLabel = document.getElementById("lbl-bg-motion");
      const intensityLabel = document.getElementById("lbl-bg-intensity");
      if (motionLabel) motionLabel.textContent = `${Math.round(motion * 100)}%`;
      if (intensityLabel) intensityLabel.textContent = `${Math.round(intensity * 100)}%`;
    };

    for (const id of ["cfg-bg-motion", "cfg-bg-intensity"]) {
      const slider = document.getElementById(id);
      if (!slider) continue;
      slider.value = String(Math.round((id === "cfg-bg-motion"
        ? this.app.config.bgMotion ?? 1
        : this.app.config.bgIntensity ?? 1) * 100));
      slider.addEventListener("input", applyAtmosphere);
      slider.addEventListener("change", () => { applyAtmosphere(); this.app.saveConfig(); });
    }
    applyAtmosphere();
    showRelevant();
    paint();
  }

  /* ── 0. Typography slots ──────────────────────────────────────── */
  initTypography() {
    const DEVICE = "__device__";
    const SLOTS = [["display", "cfg-font-display"], ["interface", "cfg-font-interface"], ["mono", "cfg-font-mono"]];
    const note = document.getElementById("cfg-font-note");
    let device = [];

    const fill = () => {
      for (const [key, id] of SLOTS) {
        const select = document.getElementById(id);
        if (!select) continue;
        const current = this.app.config.fonts?.[key] || NordlysType.DEFAULT;
        select.replaceChildren();
        let groupName = null, holder = select;
        for (const row of NordlysType.optionsFor(key, device)) {
          if (row.group !== groupName) {
            groupName = row.group;
            holder = document.createElement("optgroup");
            holder.label = row.group;
            select.append(holder);
          }
          const option = document.createElement("option");
          option.value = row.value;
          option.textContent = row.label;
          // Lets the themed list render each option in the face it offers.
          if (row.value !== NordlysType.DEFAULT) option.dataset.fontPreview = row.value;
          holder.append(option);
        }
        const more = document.createElement("option");
        more.value = DEVICE;
        more.textContent = device.length ? "Refresh device fonts…" : "All fonts on this device…";
        select.append(more);
        select.value = current;
        if (!select.value) select.value = NordlysType.DEFAULT;
      }
      window.NordlysUI?.refreshSelects();
    };

    for (const [key, id] of SLOTS) {
      document.getElementById(id)?.addEventListener("change", async (event) => {
        const select = event.target;
        if (select.value === DEVICE) {
          // Chrome only reveals the inventory from a user gesture, and this
          // handler still runs inside the click that chose the option.
          const found = await NordlysType.listLocalFonts();
          device = found.families;
          if (note) {
            note.textContent = found.granted
              ? `${device.length} fonts found on this device.`
              : "Device fonts are unavailable — permission was not granted.";
          }
          fill();
          return;
        }
        this.app.config.fonts = Object.assign({}, this.app.config.fonts, { [key]: select.value });
        this.app.saveConfig();
        this.app.applyThemeTokens();
      });
    }
    fill();
  }

  /* ── 1. Resizable Drawer & Width Presets ──────────────────────── */
  initDrawerResizer() {
    const savedWidth = localStorage.getItem("aurora_drawer_width");
    if (savedWidth && this.drawer) {
      this.drawer.style.width = savedWidth;
    }

    if (this.resizer && this.drawer) {
      let isResizing = false;

      this.resizer.addEventListener("pointerdown", (e) => {
        isResizing = true;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
        this.resizer.classList.add("dragging");
      });

      window.addEventListener("pointermove", (e) => {
        if (!isResizing) return;
        const newWidth = Math.max(380, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.95));
        this.drawer.style.width = `${newWidth}px`;
      }, { passive: true });

      window.addEventListener("pointerup", () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        this.resizer.classList.remove("dragging");
        localStorage.setItem("aurora_drawer_width", this.drawer.style.width);
      });
    }

  }

  open(targetTab = null) {
    this.syncFormValues();
    this.renderBookmarksManager();
    const mapped = targetTab ? this.mapTab(targetTab) : null;
    this.shell.open(mapped);
  }

  openDrawer(targetTab = null) {
    this.open(targetTab);
  }

  close() {
    this.shell.close();
  }

  mapTab(targetTab) {
    const tabMap = { "themes":"appearance", "theme":"appearance", "appearance":"appearance", "shaders":"background", "background":"background", "custom-theme":"appearance", "general":"general", "bookmarks":"bookmarks", "custom-css":"custom-css", "backup":"backup" };
    return tabMap[targetTab] || targetTab;
  }

  switchTab(targetTab) {
    if (!targetTab) return;
    const key = this.mapTab(targetTab);
    if (this.shell) { this.shell.select(key); return; }
    const tabs = document.querySelectorAll(".ctab");
    const sections = document.querySelectorAll(".csec");
    const targetBtn = document.querySelector(`.ctab[data-tab="${key}"]`);
    const targetSec = document.getElementById(`sec-${key}`);

    if (targetBtn && targetSec) {
      tabs.forEach((t) => t.classList.toggle("active", t === targetBtn));
      sections.forEach((s) => s.classList.toggle("active", s === targetSec));
      targetBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  syncColorModeSwitcher() {
    const colorMode = this.app.config.colorMode || "dark";
    document.querySelectorAll("#color-mode-switcher .mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === colorMode);
    });
  }

  syncFormValues() {
    const cfg = this.app.config;
    
    // Color Mode
    this.syncColorModeSwitcher();

    // User Name & General
    const userName = document.getElementById("cfg-user-name");
    const timeFormat = document.getElementById("cfg-time-format");
    const showSeconds = document.getElementById("cfg-show-seconds");
    const openNewTab = document.getElementById("cfg-open-newtab");
    const showSuggestions = document.getElementById("cfg-show-suggestions");
    const defaultEngine = document.getElementById("cfg-default-engine");
    const languageSelect = document.getElementById("cfg-language-select");

    if (languageSelect) languageSelect.value = cfg.language || "en";
    if (userName) userName.value = cfg.userName || "";
    if (timeFormat) timeFormat.value = cfg.timeFormat || "24h";
    if (showSeconds) showSeconds.checked = !!cfg.showSeconds;
    if (openNewTab) openNewTab.checked = !!cfg.openNewTab;
    if (showSuggestions) showSuggestions.checked = cfg.showSuggestions !== false;
    if (defaultEngine) defaultEngine.value = cfg.defaultEngine || "google";

    // Aesthetics Sliders & Selects
    const glassBlur = document.getElementById("cfg-glass-blur");
    const glassSaturate = document.getElementById("cfg-glass-saturate");
    const glassOpacity = document.getElementById("cfg-glass-opacity");
    const glassSheen = document.getElementById("cfg-glass-sheen");
    const cardRadius = document.getElementById("cfg-card-radius");
    const tileSize = document.getElementById("cfg-tile-size");
    const cardGap = document.getElementById("cfg-card-gap");
    const cardGlow = document.getElementById("cfg-card-glow");
    const hoverEffect = document.getElementById("cfg-hover-effect");
    const iconShape = document.getElementById("cfg-icon-shape");

    if (glassBlur) glassBlur.value = cfg.glassBlur != null ? cfg.glassBlur : 28;
    if (glassSaturate) glassSaturate.value = cfg.glassSaturate != null ? cfg.glassSaturate : 190;
    if (glassOpacity) glassOpacity.value = Math.round((cfg.glassOpacity !== undefined ? cfg.glassOpacity : 0.7) * 100);
    if (glassSheen) glassSheen.value = Math.round((cfg.glassSheen !== undefined ? cfg.glassSheen : 0.45) * 100);
    if (cardRadius) cardRadius.value = cfg.cardRadius != null ? cfg.cardRadius : 24;
    if (tileSize) tileSize.value = cfg.tileSize != null ? cfg.tileSize : 78;
    if (cardGap) cardGap.value = cfg.cardGap != null ? cfg.cardGap : 12;
    if (cardGlow) cardGlow.value = cfg.cardGlow != null ? cfg.cardGlow : 40;
    if (hoverEffect) hoverEffect.value = cfg.hoverEffect || "lift";
    if (iconShape) iconShape.value = cfg.iconShape || "squircle";

    this.updateSliderLabels();
    this.updateMiniPreview();
    this.syncBackgroundControls?.();
    // syncFormValues writes select.value directly, which fires no event.
    window.NordlysUI?.refreshSelects();
  }

  updateSliderLabels() {
    const cfg = this.app.config;
    const lblBlur = document.getElementById("lbl-blur");
    const lblSat = document.getElementById("lbl-sat");
    const lblOpac = document.getElementById("lbl-opac");
    const lblSheen = document.getElementById("lbl-sheen");
    const lblRadius = document.getElementById("lbl-radius");
    const lblTile = document.getElementById("lbl-tile");
    const lblGap = document.getElementById("lbl-gap");
    const lblGlow = document.getElementById("lbl-glow");
    const lblBgBlur = document.getElementById("lbl-bgblur");
    const lblBgDim = document.getElementById("lbl-bgdim");

    if (lblBlur) lblBlur.textContent = `${cfg.glassBlur != null ? cfg.glassBlur : 28}px`;
    if (lblSat) lblSat.textContent = `${cfg.glassSaturate != null ? cfg.glassSaturate : 190}%`;
    if (lblOpac) lblOpac.textContent = `${Math.round((cfg.glassOpacity !== undefined ? cfg.glassOpacity : 0.7) * 100)}%`;
    if (lblSheen) lblSheen.textContent = `${Math.round((cfg.glassSheen !== undefined ? cfg.glassSheen : 0.45) * 100)}%`;
    if (lblRadius) lblRadius.textContent = `${cfg.cardRadius != null ? cfg.cardRadius : 24}px`;
    if (lblTile) lblTile.textContent = `${cfg.tileSize != null ? cfg.tileSize : 78}px`;
    if (lblGap) lblGap.textContent = `${cfg.cardGap != null ? cfg.cardGap : 12}px`;
    if (lblGlow) lblGlow.textContent = `${cfg.cardGlow != null ? cfg.cardGlow : 40}%`;
    if (lblBgBlur) lblBgBlur.textContent = `${cfg.bgBlur != null ? cfg.bgBlur : 0}px`;
    if (lblBgDim) lblBgDim.textContent = `${cfg.bgDim != null ? cfg.bgDim : 0}%`;
  }

  updateMiniPreview() {
    const previewCard = document.getElementById("preview-interactive-card") || document.getElementById("liquid-preview-pill");
    const iconBox = document.getElementById("preview-icon-box");
    if (!previewCard) return;

    const cfg = this.app.config;
    const blurVal = `${cfg.glassBlur != null ? cfg.glassBlur : 28}px`;
    const satVal = `${cfg.glassSaturate != null ? cfg.glassSaturate : 190}%`;
    const opacVal = cfg.glassOpacity !== undefined ? cfg.glassOpacity : 0.70;
    const sheenVal = cfg.glassSheen !== undefined ? cfg.glassSheen : 0.45;
    const radiusVal = `${cfg.cardRadius != null ? cfg.cardRadius : 24}px`;

    previewCard.style.backdropFilter = `blur(${blurVal}) saturate(${satVal}) contrast(94%) brightness(106%)`;
    previewCard.style.webkitBackdropFilter = `blur(${blurVal}) saturate(${satVal}) contrast(94%) brightness(106%)`;
    previewCard.style.borderRadius = radiusVal;

    if (iconBox) {
      if (cfg.iconShape === "circle") {
        iconBox.style.borderRadius = "50%";
      } else if (cfg.iconShape === "rounded") {
        iconBox.style.borderRadius = "6px";
      } else {
        iconBox.style.borderRadius = "10px";
      }
    }
  }

  /* ── 3. Appearance & Authentic Frosted Glass ────── */
  initAppearance() {
    this.renderThemeCards();

    // Color Mode Switcher — the app owns the dark/light/auto semantics
    const modeSwitcher = document.getElementById("color-mode-switcher");
    modeSwitcher?.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.app.setColorMode(btn.dataset.mode || "dark");
      });
    });

    // Close Custom Theme Studio button (also reverts any unsaved live preview)
    const closeEditorBtn = document.getElementById("close-custom-theme-editor");
    closeEditorBtn?.addEventListener("click", () => {
      const editor = document.getElementById("custom-theme-editor-card");
      if (editor) editor.style.display = "none";
      this.app.applyThemeTokens();
    });

    // Glass Sliders
    const glassBlur = document.getElementById("cfg-glass-blur");
    const glassSaturate = document.getElementById("cfg-glass-saturate");
    const glassOpacity = document.getElementById("cfg-glass-opacity");
    const glassSheen = document.getElementById("cfg-glass-sheen");

    glassBlur?.addEventListener("input", (e) => {
      const val = `${e.target.value}px`;
      document.documentElement.style.setProperty("--glass-blur", val);
      this.app.config.glassBlur = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    glassSaturate?.addEventListener("input", (e) => {
      const val = `${e.target.value}%`;
      document.documentElement.style.setProperty("--glass-saturate", val);
      this.app.config.glassSaturate = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    glassOpacity?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) / 100;
      document.documentElement.style.setProperty("--glass-opacity", val);
      this.app.config.glassOpacity = val;
      this.updateSliderLabels();
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    glassSheen?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) / 100;
      document.documentElement.style.setProperty("--glass-border-sheen", val);
      this.app.config.glassSheen = val;
      this.updateSliderLabels();
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    // Geometry & Layout controls
    const cardRadius = document.getElementById("cfg-card-radius");
    const tileSize = document.getElementById("cfg-tile-size");
    const cardGap = document.getElementById("cfg-card-gap");
    const iconShape = document.getElementById("cfg-icon-shape");

    cardRadius?.addEventListener("input", (e) => {
      const val = `${e.target.value}px`;
      document.documentElement.style.setProperty("--card-radius", val);
      this.app.config.cardRadius = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    tileSize?.addEventListener("input", (e) => {
      document.documentElement.style.setProperty("--tw", `min(${e.target.value}px, 12vw)`);
      this.app.config.tileSize = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      this.app.saveConfig();
    });

    cardGap?.addEventListener("input", (e) => {
      const val = `${e.target.value}px`;
      document.documentElement.style.setProperty("--grid-gap", val);
      this.app.config.cardGap = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      this.app.saveConfig();
    });

    iconShape?.addEventListener("change", (e) => {
      this.app.config.iconShape = e.target.value;
      if (e.target.value === "circle") {
        document.documentElement.style.setProperty("--tile-radius", "50%");
      } else if (e.target.value === "rounded") {
        document.documentElement.style.setProperty("--tile-radius", "8px");
      } else {
        document.documentElement.style.setProperty("--tile-radius", "calc(var(--tw) * 0.25)");
      }
      this.updateMiniPreview();
      this.app.saveConfig();
    });

    // Glow & Hover Effect controls
    const cardGlow = document.getElementById("cfg-card-glow");
    const hoverEffect = document.getElementById("cfg-hover-effect");

    cardGlow?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      document.documentElement.style.setProperty("--card-glow-intensity", `${val / 100}`);
      this.app.config.cardGlow = val;
      this.updateSliderLabels();
      this.app.saveConfig();
    });

    hoverEffect?.addEventListener("change", (e) => {
      const val = e.target.value;
      this.app.config.hoverEffect = val;
      document.body.classList.remove("hover-lift", "hover-glow", "hover-scale", "hover-none");
      document.body.classList.add(`hover-${val}`);
      this.app.saveConfig();
    });
  }

  renderThemeCards() {
    const darkGrid = document.getElementById("theme-dark-grid");
    const lightGrid = document.getElementById("theme-light-grid");
    const customGrid = document.getElementById("theme-custom-grid");
    const legacyGrid = document.getElementById("theme-presets-grid");

    if (!darkGrid && !legacyGrid) return;

    // Swatch gradients mirror each theme's actual --void ground with a
    // corner of its accent, so the preview matches what you actually get.
    const darkThemes = [
      { key: "aurora-void", name: "Aurora Void", i18nKey: "theme.auroraVoid", bg: "linear-gradient(135deg, #0d152a 0%, #060a14 62%, #35d6c0 135%)" },
      { key: "frosted-glass", name: "Frosted Glass", i18nKey: "theme.frostedGlass", bg: "linear-gradient(135deg, #152037 0%, #0b1220 55%, rgba(255,255,255,0.55) 135%)" },
      { key: "cyberpunk-neon", name: "Cyberpunk Neon", i18nKey: "theme.cyberpunk", bg: "linear-gradient(135deg, #24103a 0%, #08060e 58%, #ff007f 128%)" },
      { key: "tokyo-night", name: "Tokyo Night", i18nKey: "theme.tokyoNight", bg: "linear-gradient(135deg, #1e2030 0%, #0d0f1a 62%, #7aa2f7 135%)" },
      { key: "catppuccin-mocha", name: "Catppuccin Mocha", i18nKey: "theme.catppuccinMocha", bg: "linear-gradient(135deg, #313244 0%, #1e1e2e 62%, #cba6f7 135%)" },
      { key: "oled-obsidian", name: "OLED Obsidian", i18nKey: "theme.oled", bg: "linear-gradient(135deg, #1a1a1d 0%, #000000 60%, #52525b 140%)" },
      { key: "nord-frost", name: "Nord Frost", i18nKey: "theme.nord", bg: "linear-gradient(135deg, #2e3440 0%, #242933 62%, #88c0d0 135%)" },
      { key: "gruvbox-dark", name: "Gruvbox Dark", i18nKey: "theme.gruvboxDark", bg: "linear-gradient(135deg, #3c3836 0%, #1d2021 62%, #fabd2f 135%)" },
      { key: "boreal-emerald", name: "Boreal Emerald", i18nKey: "theme.borealEmerald", bg: "linear-gradient(135deg, #0b2a1a 0%, #040f09 62%, #10b981 132%)" },
      { key: "sunset-amber", name: "Sunset Amber", i18nKey: "theme.sunset", bg: "linear-gradient(135deg, #331109 0%, #120704 60%, #f97316 128%)" },
      { key: "dracula-velvet", name: "Dracula Velvet", i18nKey: "theme.draculaVelvet", bg: "linear-gradient(135deg, #362a4d 0%, #1e1b2e 62%, #bd93f9 135%)" }
    ];

    const lightThemes = [
      { key: "porcelain-light", name: "Porcelain Pure", i18nKey: "theme.porcelain", bg: "linear-gradient(135deg, #ffffff 0%, #e9f0fb 62%, #3b82f6 145%)" },
      { key: "warm-ivory", name: "Warm Ivory", i18nKey: "theme.warmIvory", bg: "linear-gradient(135deg, #fffdf8 0%, #f0e6cf 62%, #d97706 145%)" },
      { key: "sage-light", name: "Sage Garden", i18nKey: "theme.sageLight", bg: "linear-gradient(135deg, #fbfdfb 0%, #dcecdf 62%, #16a34a 145%)" },
      { key: "sakura-daylight", name: "Sakura Blossom", i18nKey: "theme.sakuraDaylight", bg: "linear-gradient(135deg, #fffafd 0%, #f8dceb 62%, #ec4899 145%)" },
      { key: "solarized-light", name: "Solarized Light", i18nKey: "theme.solarizedLight", bg: "linear-gradient(135deg, #fefaf0 0%, #eee8d5 62%, #2aa198 145%)" },
      { key: "nordic-snow", name: "Nordic Snow", i18nKey: "theme.nordicSnow", bg: "linear-gradient(135deg, #ffffff 0%, #cfe0ef 62%, #0284c7 145%)" },
      { key: "lavender-mist", name: "Lavender Mist", i18nKey: "theme.lavenderMist", bg: "linear-gradient(135deg, #fbfaff 0%, #e2d9fa 62%, #8b5cf6 145%)" },
      { key: "gruvbox-light", name: "Gruvbox Light", i18nKey: "theme.gruvboxLight", bg: "linear-gradient(135deg, #fdf6d8 0%, #e9d9ab 62%, #d65d0e 145%)" },
      { key: "peach-sunset", name: "Peach Sunset", i18nKey: "theme.peachSunset", bg: "linear-gradient(135deg, #fffcf7 0%, #ffe2cc 62%, #f43f5e 145%)" },
      { key: "mint-breeze", name: "Mint Breeze", i18nKey: "theme.mintBreeze", bg: "linear-gradient(135deg, #f7fdf9 0%, #cdf2e5 62%, #0d9488 145%)" }
    ];

    // Section badges reflect the real counts
    const badges = document.querySelectorAll(".theme-section-header .theme-section-badge");
    if (badges[0]) badges[0].textContent = String(darkThemes.length);
    if (badges[1]) badges[1].textContent = String(lightThemes.length);

    const activeTheme = this.app.config.theme;
    const activeCustomId = this.app.config.customTheme?.id;

    const createPresetCard = (t, isLightSection = false) => {
      const card = document.createElement("button");
      card.type = "button";
      const isActive = (activeTheme === t.key) || (t.key === "frosted-glass" && (activeTheme === "liquid-glass" || activeTheme === "liquid-tahoe"));
      card.className = `theme-card ${isActive ? "active" : ""}`;
      card.dataset.theme = t.key;
      card.setAttribute("aria-pressed", String(isActive));
      const themeLabel = (window.I18N && t.i18nKey) ? window.I18N.t(t.i18nKey) : t.name;
      card.innerHTML = `
        <div class="theme-preview" style="background: ${t.bg};"></div>
        <b data-i18n="${t.i18nKey || ''}">${themeLabel}</b>
      `;
      card.addEventListener("click", () => {
        this.app.setTheme(t.key);
        const editor = document.getElementById("custom-theme-editor-card");
        if (editor) editor.style.display = "none";
      });
      return card;
    };

    if (darkGrid && lightGrid && customGrid) {
      // 1. Render Dark Themes
      darkGrid.innerHTML = "";
      darkThemes.forEach((t) => darkGrid.appendChild(createPresetCard(t, false)));

      // 2. Render Light Themes
      lightGrid.innerHTML = "";
      lightThemes.forEach((t) => lightGrid.appendChild(createPresetCard(t, true)));

      // 3. Render Custom Themes & + Add Button
      customGrid.innerHTML = "";
      this.customThemes.forEach((t) => {
        const isCurrent = activeTheme === "custom" && activeCustomId === t.id;
        const card = document.createElement("div");
        card.className = `theme-card custom-theme-item ${isCurrent ? "active" : ""}`;
        card.dataset.themeId = t.id;
        card.style.position = "relative";
        card.innerHTML = `
          <div class="theme-preview" style="background: linear-gradient(135deg, ${esc(t.bg)}, ${esc(t.accent)});"></div>
          <b>${esc(t.name)}</b>
          <button class="del-custom-thm-btn" title="Delete custom theme">✕</button>
        `;

        card.addEventListener("click", (e) => {
          if (e.target.closest(".del-custom-thm-btn")) return;
          this.applyCustomTheme(t);
        });

        card.querySelector(".del-custom-thm-btn")?.addEventListener("click", (e) => {
          e.stopPropagation();
          /* A saved theme is minutes of colour picking and there is no confirm
             step in front of this button, so losing one to a stray click was
             unrecoverable. It goes back where it was, in order. */
          const position = this.customThemes.findIndex((x) => x.id === t.id);
          if (position < 0) return;
          const snapshot = JSON.parse(JSON.stringify(this.customThemes[position]));
          const wasActive = activeTheme === "custom" && activeCustomId === t.id;
          this.customThemes.splice(position, 1);
          this.saveCustomThemes();
          if (wasActive) this.app.setTheme("aurora-void"); else this.renderThemeCards();

          const name = snapshot.name || "Theme";
          const say = (key, fallback) => (window.I18N ? window.I18N.t(key, { name }) : fallback);
          window.NordlysUI?.showUndoToast({
            message: say("toast.itemDeleted", `${name} deleted`),
            onAction: () => {
              this.customThemes.splice(Math.min(position, this.customThemes.length), 0, snapshot);
              this.saveCustomThemes();
              if (wasActive) this.applyCustomTheme(snapshot); else this.renderThemeCards();
              window.NordlysUI?.announce?.(say("toast.itemRestored", `${name} restored`));
            }
          });
        });

        customGrid.appendChild(card);
      });

      // Append '+' Create Theme Card
      const addCard = document.createElement("div");
      addCard.id = "btn-create-custom-theme";
      addCard.className = "theme-card add-custom-theme";
      addCard.title = window.I18N ? window.I18N.t('appearance.newTheme') : "Create your own custom theme preset";
      const newThemeText = window.I18N ? window.I18N.t('appearance.newTheme') : 'New Theme';
      addCard.innerHTML = `
        <div class="theme-preview add-custom-preview">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <b data-i18n="appearance.newTheme">${newThemeText}</b>
      `;

      addCard.addEventListener("click", () => {
        const customEditorCard = document.getElementById("custom-theme-editor-card");
        if (customEditorCard) {
          const isHidden = customEditorCard.style.display === "none";
          customEditorCard.style.display = isHidden ? "block" : "none";
          if (isHidden) {
            customEditorCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
            document.getElementById("thm-name-input")?.focus();
          } else {
            this.app.applyThemeTokens();
          }
        }
      });

      customGrid.appendChild(addCard);
    } else if (legacyGrid) {
      legacyGrid.innerHTML = "";
      [...darkThemes, ...lightThemes].forEach((t) => legacyGrid.appendChild(createPresetCard(t)));
    }
  }

  /* ── 4. Custom Theme Creator Engine ──────────────────────────── */
  loadCustomThemes() {
    try {
      const raw = localStorage.getItem("aurora_custom_themes");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveCustomThemes() {
    localStorage.setItem("aurora_custom_themes", JSON.stringify(this.customThemes));
  }

  initCustomThemeBuilder() {
    /* Read the whole studio form into a theme object */
    const readStudioTheme = () => ({
      bg: document.getElementById("thm-bg-hex")?.value || "#0a0f1d",
      card: document.getElementById("thm-card-hex")?.value || "#111c35",
      border: document.getElementById("thm-border-hex")?.value || "#2a3f6d",
      accent: document.getElementById("thm-accent-hex")?.value || "#35d6c0",
      glow: document.getElementById("thm-glow-hex")?.value || "#5b6cff",
      text: document.getElementById("thm-text-hex")?.value || "#f1f5f9",
      dim: document.getElementById("thm-dim-hex")?.value || "#8ca0c4"
    });

    /* Live preview: every edit re-derives the full token set (real tokens,
       not the legacy names — so background, cards and borders update live) */
    const livePreview = () => {
      const theme = readStudioTheme();
      this.app.applyCustomTokens(theme);
      const warning = document.getElementById("custom-theme-contrast-warning");
      if (warning) {
        const ratio = (a, b) => {
          const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
          return (light + 0.05) / (dark + 0.05);
        };
        warning.hidden = Math.min(ratio(theme.text, theme.bg), ratio(theme.text, theme.card), ratio(theme.dim, theme.bg), ratio(theme.dim, theme.card)) >= 4.5;
      }
    };

    const bindColorPair = (wellId, hexId) => {
      const well = document.getElementById(wellId);
      const hex = document.getElementById(hexId);
      if (!well || !hex) return;

      well.addEventListener("input", (e) => {
        hex.value = e.target.value;
        livePreview();
      });

      hex.addEventListener("input", (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
          well.value = e.target.value;
          livePreview();
        }
      });
    };

    bindColorPair("thm-bg-color", "thm-bg-hex");
    bindColorPair("thm-card-color", "thm-card-hex");
    bindColorPair("thm-border-color", "thm-border-hex");
    bindColorPair("thm-accent-color", "thm-accent-hex");
    bindColorPair("thm-glow-color", "thm-glow-hex");
    bindColorPair("thm-text-color", "thm-text-hex");
    bindColorPair("thm-dim-color", "thm-dim-hex");

    document.getElementById("thm-save-btn")?.addEventListener("click", () => {
      const name = document.getElementById("thm-name-input")?.value.trim() || `Custom ${this.customThemes.length + 1}`;
      const preset = Object.assign({ id: `thm_${Date.now()}`, name }, readStudioTheme());

      this.customThemes.push(preset);
      this.saveCustomThemes();
      this.applyCustomTheme(preset);
      const customEditorCard = document.getElementById("custom-theme-editor-card");
      if (customEditorCard) customEditorCard.style.display = "none";
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.themeSaved") : "Theme saved & applied", "success");
      }
    });
  }

  applyCustomTheme(theme) {
    this.app.setTheme("custom", theme);
  }

  /* ── 5. General Settings (Full Persistence Across All Events) ── */
  initGeneral() {
    const languageSelect = document.getElementById("cfg-language-select");
    const userName = document.getElementById("cfg-user-name");
    const timeFormat = document.getElementById("cfg-time-format");
    const showSeconds = document.getElementById("cfg-show-seconds");
    const openNewTab = document.getElementById("cfg-open-newtab");
    const showSuggestions = document.getElementById("cfg-show-suggestions");
    const defaultEngine = document.getElementById("cfg-default-engine");

    if (defaultEngine) defaultEngine.value = this.app.config.defaultEngine || "google";
    if (languageSelect) languageSelect.value = this.app.config.language || "en";

    languageSelect?.addEventListener("change", (e) => {
      const lang = e.target.value;
      this.app.config.language = lang;
      this.app.saveConfig();
      if (window.I18N) {
        window.I18N.setLanguage(lang);
      }
      this.app.widgets?.updateClock();
    });

    const saveName = (val) => {
      this.app.config.userName = val;
      this.app.saveConfig();
      this.app.widgets?.updateClock();
    };

    userName?.addEventListener("input", (e) => saveName(e.target.value));
    userName?.addEventListener("change", (e) => saveName(e.target.value));
    userName?.addEventListener("keyup", (e) => saveName(e.target.value));

    defaultEngine?.addEventListener("change", (e) => {
      const eng = e.target.value;
      this.app.config.defaultEngine = eng;
      this.app.saveConfig();
      this.app.widgets?.search?.setEngine(eng);
    });

    timeFormat?.addEventListener("change", (e) => {
      this.app.config.timeFormat = e.target.value;
      this.app.saveConfig();
      this.app.widgets?.updateClock();
    });

    showSeconds?.addEventListener("change", (e) => {
      this.app.config.showSeconds = e.target.checked;
      if (e.target.checked) {
        document.body.classList.add("seconds");
      } else {
        document.body.classList.remove("seconds");
      }
      this.app.saveConfig();
      this.app.widgets?.updateClock();
    });

    openNewTab?.addEventListener("change", (e) => {
      this.app.config.openNewTab = e.target.checked;
      this.app.saveConfig();
      this.app.grid?.render();
    });

    showSuggestions?.addEventListener("change", (e) => {
      this.app.config.showSuggestions = e.target.checked;
      this.app.saveConfig();
    });
  }

  /* ── 6. Multi-Shader Background Engine Settings ───────────────── */
  initBackgroundSettings() {
    const bgMode = document.getElementById("cfg-bg-mode");
    const customMedia = document.getElementById("cfg-custom-media");
    const fileLabel = document.getElementById("cfg-file-label");
    const removeBtn = document.getElementById("cfg-remove-media");
    const blurSlider = document.getElementById("cfg-bg-blur");
    const dimSlider = document.getElementById("cfg-bg-dim");
    const lblBlur = document.getElementById("lbl-bgblur");
    const lblDim = document.getElementById("lbl-bgdim");

    const syncControls = async () => {
      const cfg = this.app.config;
      if (bgMode) bgMode.value = cfg.bgMode || "aurora";
      if (blurSlider) blurSlider.value = cfg.bgBlur || 0;
      if (dimSlider) dimSlider.value = cfg.bgDim || 0;
      if (lblBlur) lblBlur.textContent = `${cfg.bgBlur || 0}px`;
      if (lblDim) lblDim.textContent = `${cfg.bgDim || 0}%`;
      /* Picking the Wallpaper scene is not the same as having a wallpaper.
         Keying off the mode alone offered "Remove Wallpaper" with nothing to
         remove, on a fresh profile that had never uploaded anything. */
      if (removeBtn) {
        const wantsMedia = cfg.bgMode === "custom-image" || cfg.bgMode === "custom-video";
        let stored = false;
        if (wantsMedia) {
          try { stored = Boolean(await MediaVault.getMedia("custom_bg")); } catch (error) { stored = false; }
        }
        removeBtn.style.display = stored ? "inline-flex" : "none";
      }
    };
    this.syncBackgroundControls = syncControls;
    syncControls();

    bgMode?.addEventListener("change", (e) => {
      this.app.config.bgMode = e.target.value;
      this.app.saveConfig();
      this.app.updateBackgroundMode();
      syncControls();
    });

    blurSlider?.addEventListener("input", (e) => {
      this.app.config.bgBlur = parseInt(e.target.value, 10) || 0;
      this.app.applyWallpaperEffects();
      this.app.saveConfig();
      if (lblBlur) lblBlur.textContent = `${this.app.config.bgBlur}px`;
    });

    dimSlider?.addEventListener("input", (e) => {
      this.app.config.bgDim = parseInt(e.target.value, 10) || 0;
      this.app.applyWallpaperEffects();
      this.app.saveConfig();
      if (lblDim) lblDim.textContent = `${this.app.config.bgDim}%`;
    });

    customMedia?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return;

      if (fileLabel) fileLabel.textContent = file.name;

      try {
        await MediaVault.saveMedia("custom_bg", file, file.type);
        this.app.config.bgMode = file.type.startsWith("video/") ? "custom-video" : "custom-image";
        this.app.saveConfig();
        this.app.updateBackgroundMode();
        syncControls();
        if (typeof toast === "function") {
          toast(window.I18N ? window.I18N.t("toast.wallpaperSet") : "Wallpaper applied", "success");
        }
      } catch (err) {
        console.error("Failed to save wallpaper to MediaVault:", err);
        if (typeof toast === "function") {
          toast(window.I18N ? window.I18N.t("toast.wallpaperFail") : "Could not save wallpaper", "danger");
        }
      }
    });

    removeBtn?.addEventListener("click", async () => {
      try { await MediaVault.deleteMedia("custom_bg"); } catch (e) {}
      if (customMedia) customMedia.value = "";
      if (fileLabel) fileLabel.textContent = window.I18N ? window.I18N.t("background.uploadBtn") : "Select Image File...";
      this.app.config.bgMode = "aurora";
      this.app.saveConfig();
      this.app.updateBackgroundMode();
      syncControls();
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.wallpaperRemoved") : "Wallpaper removed", "info");
      }
    });
  }

  /* ── 7. In-Settings Bookmarks & Folder Manager (Move / Reorder) ── */
  initBookmarksManager() {
    document.getElementById("cfg-add-group")?.addEventListener("click", () => {
      this.app.config.groups.push({
        id: `g_${Date.now()}`,
        label: `Folder ${this.app.config.groups.length + 1}`,
        cols: 4,
        links: []
      });
      this.app.saveConfig();
      this.app.grid?.render();
      this.renderBookmarksManager();
    });
  }

  renderBookmarksManager() {
    if (this.bookmarkSettings) {
      this.bookmarkSettings.render();
      return;
    }
    const container = document.getElementById("cfg-groups-editor");
    if (!container) return;

    container.innerHTML = "";
    const groups = this.app.config.groups || [];

    groups.forEach((group, gIdx) => {
      const gBox = document.createElement("div");
      gBox.className = `group-editor-card ${group.hidden ? 'is-hidden-folder' : ''}`;
      const folderPlaceholder = window.I18N ? window.I18N.t('modal.folderName') : 'Folder Name';
      const addBkmText = window.I18N ? window.I18N.t('bookmarks.addBookmark') : '+ Add Bookmark';
      gBox.innerHTML = `
        <div class="group-editor-head">
          <input type="text" class="group-label-input" value="${esc(group.label || '')}" placeholder="${esc(folderPlaceholder)}">
          <div style="display: flex; gap: 5px; align-items: center;">
            <select class="cols-select" title="Columns">
              ${[1,2,3,4,5,6,7,8].map(c => `<option value="${c}" ${group.cols == c ? 'selected' : ''}>${c} Cols</option>`).join('')}
            </select>
            <button class="move-btn btn-group-toggle-vis" title="${group.hidden ? 'Show folder on board' : 'Hide folder to tray'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${group.hidden ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'}
              </svg>
            </button>
            <button class="move-btn btn-group-up" title="Move folder up" ${gIdx === 0 ? 'disabled' : ''}>▲</button>
            <button class="move-btn btn-group-down" title="Move folder down" ${gIdx === groups.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="glass-btn danger btn-del-group" style="padding: 4px 8px; font-size: 11px;" title="Delete folder">✕</button>
          </div>
        </div>
        <div class="links-list"></div>
        <button class="glass-btn btn-add-link" style="width: 100%; margin-top: 8px; font-size: 12px;">${addBkmText}</button>
      `;

      // Folder Visibility Toggle
      gBox.querySelector(".btn-group-toggle-vis")?.addEventListener("click", () => {
        group.hidden = !group.hidden;
        this.app.saveConfig();
        this.app.grid?.render();
        this.renderBookmarksManager();
      });

      // Folder Rename (input & change)
      const labelInput = gBox.querySelector(".group-label-input");
      const updateLabel = (val) => {
        group.label = val || "Folder";
        this.app.saveConfig();
        this.app.grid?.render();
      };
      labelInput.addEventListener("input", (e) => updateLabel(e.target.value));
      labelInput.addEventListener("change", (e) => updateLabel(e.target.value));

      // Columns select
      gBox.querySelector(".cols-select").addEventListener("change", (e) => {
        group.cols = parseInt(e.target.value, 10);
        this.app.saveConfig();
        this.app.grid?.render();
      });

      // Folder Move Up
      gBox.querySelector(".btn-group-up").addEventListener("click", () => {
        if (gIdx > 0) {
          const [moved] = groups.splice(gIdx, 1);
          groups.splice(gIdx - 1, 0, moved);
          this.app.saveConfig();
          this.app.grid?.render();
          this.renderBookmarksManager();
        }
      });

      // Folder Move Down
      gBox.querySelector(".btn-group-down").addEventListener("click", () => {
        if (gIdx < groups.length - 1) {
          const [moved] = groups.splice(gIdx, 1);
          groups.splice(gIdx + 1, 0, moved);
          this.app.saveConfig();
          this.app.grid?.render();
          this.renderBookmarksManager();
        }
      });

      // Folder Delete
      gBox.querySelector(".btn-del-group").addEventListener("click", () => {
        this.app.grid?.confirmFolderDelete(group).then((ok) => {
          if (!ok) return;
          groups.splice(gIdx, 1);
          this.app.saveConfig();
          this.app.grid?.render();
          this.renderBookmarksManager();
        });
      });

      // Links inside folder
      const linksList = gBox.querySelector(".links-list");
      (group.links || []).forEach((link, lIdx) => {
        const lRow = document.createElement("div");
        lRow.className = "link-editor-row";

        // Render mini icon preview
        const iconDef = resolveIcon(link.url, link.icon);
        let iconHtml = `<span style="font-size: 11px; font-weight: 700; color: ${esc(link.color || '#35d6c0')};">${esc((link.name || 'A').charAt(0))}</span>`;
        if (link.customImg) {
          iconHtml = `<img src="${esc(link.customImg)}" style="width: 16px; height: 16px; object-fit: contain; border-radius: 3px;">`;
        } else if (iconDef) {
          iconHtml = `<svg viewBox="${iconDef.vb || '0 0 24 24'}" style="width: 16px; height: 16px; fill: ${esc(link.color || '#35d6c0')};"><path d="${iconDef.p}"/></svg>`;
        }

        lRow.innerHTML = `
          <button class="icon-trigger-btn" title="Change icon">${iconHtml}</button>
          <input type="text" class="link-name-ipt" value="${esc(link.name || '')}" placeholder="Title" style="width: 90px;">
          <input type="url" class="link-url-ipt" value="${esc(link.url || '')}" placeholder="URL" style="flex: 1; min-width: 80px;">
          <input type="color" class="link-color-ipt" value="${esc(link.color || '#35d6c0')}" title="Accent Color">
          <div class="move-controls">
            <button class="move-btn btn-link-up" title="Move bookmark up" ${lIdx === 0 ? 'disabled' : ''}>▲</button>
            <button class="move-btn btn-link-down" title="Move bookmark down" ${lIdx === group.links.length - 1 ? 'disabled' : ''}>▼</button>
            <select class="folder-transfer-select" title="Move to another folder">
              <option value="" disabled selected>Move to...</option>
              ${groups.map((g, idx) => `<option value="${idx}" ${idx === gIdx ? 'disabled' : ''}>${esc(g.label)}</option>`).join('')}
            </select>
            <button class="glass-btn danger btn-del-link" style="padding: 3px 6px; font-size: 11px;" title="Delete bookmark">✕</button>
          </div>
        `;

        // Icon Picker Modal Trigger
        lRow.querySelector(".icon-trigger-btn").addEventListener("click", () => {
          this.openIconModal(gIdx, lIdx);
        });

        // Link Name Change
        const nameIpt = lRow.querySelector(".link-name-ipt");
        const updateName = (val) => {
          link.name = val.trim() || "Link";
          this.app.saveConfig();
          this.app.grid?.render();
        };
        nameIpt.addEventListener("input", (e) => updateName(e.target.value));
        nameIpt.addEventListener("change", (e) => updateName(e.target.value));

        // Link URL Change
        const urlIpt = lRow.querySelector(".link-url-ipt");
        const updateUrl = (val) => {
          let url = val.trim();
          if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
          link.url = url;
          this.app.saveConfig();
          this.app.grid?.render();
        };
        urlIpt.addEventListener("input", (e) => updateUrl(e.target.value));
        urlIpt.addEventListener("change", (e) => updateUrl(e.target.value));

        // Link Color Change
        lRow.querySelector(".link-color-ipt").addEventListener("input", (e) => {
          link.color = e.target.value;
          this.app.saveConfig();
          this.app.grid?.render();
        });

        // Link Move Up
        lRow.querySelector(".btn-link-up").addEventListener("click", () => {
          if (lIdx > 0) {
            const [moved] = group.links.splice(lIdx, 1);
            group.links.splice(lIdx - 1, 0, moved);
            this.app.saveConfig();
            this.app.grid?.render();
            this.renderBookmarksManager();
          }
        });

        // Link Move Down
        lRow.querySelector(".btn-link-down").addEventListener("click", () => {
          if (lIdx < group.links.length - 1) {
            const [moved] = group.links.splice(lIdx, 1);
            group.links.splice(lIdx + 1, 0, moved);
            this.app.saveConfig();
            this.app.grid?.render();
            this.renderBookmarksManager();
          }
        });

        // Transfer to another folder
        lRow.querySelector(".folder-transfer-select").addEventListener("change", (e) => {
          const targetGIdx = parseInt(e.target.value, 10);
          if (!isNaN(targetGIdx) && groups[targetGIdx]) {
            groups[targetGIdx].links = groups[targetGIdx].links || [];
            const [moved] = group.links.splice(lIdx, 1);
            groups[targetGIdx].links.push(moved);
            this.app.saveConfig();
            this.app.grid?.render();
            this.renderBookmarksManager();
          }
        });

        // Link Delete
        lRow.querySelector(".btn-del-link").addEventListener("click", () => {
          group.links.splice(lIdx, 1);
          this.app.saveConfig();
          this.app.grid?.render();
          this.renderBookmarksManager();
        });

        linksList.appendChild(lRow);
      });

      // Add link button
      gBox.querySelector(".btn-add-link").addEventListener("click", () => {
        group.links = group.links || [];
        group.links.push({
          name: "New Link",
          url: "https://",
          color: "#35d6c0",
          icon: "globe"
        });
        this.app.saveConfig();
        this.app.grid?.render();
        this.renderBookmarksManager();
      });

      container.appendChild(gBox);
    });
  }

  /* ── 8. Universal 5-Source Icon Picker Modal ─────────────────── */
  initIconPickerModal() {
    const modalX = document.getElementById("modal-x");

    modalX?.addEventListener("click", () => this.closeIconModal());

    // Tab 1: Library Search & Categories
    const iconSearch = document.getElementById("icon-search");
    const catChips = document.querySelectorAll(".icon-chip");

    iconSearch?.addEventListener("input", (e) => {
      this.filterIconLibrary(e.target.value.toLowerCase(), "all");
    });

    catChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        catChips.forEach((c) => c.classList.toggle("active", c === chip));
        this.filterIconLibrary(iconSearch?.value.toLowerCase() || "", chip.dataset.cat);
      });
    });

    // Tab 2: Smart Favicon & High-Res Fetcher
    const favUrlInput = document.getElementById("favicon-url-input");
    const favFetchBtn = document.getElementById("favicon-fetch-btn");
    const favImgBox = document.getElementById("favicon-preview-img-box");
    const favDomainName = document.getElementById("favicon-domain-name");
    const favStatus = document.getElementById("favicon-status");
    const favApplyBtn = document.getElementById("favicon-apply-btn");
    const favCropBtn = document.getElementById("favicon-crop-btn");
    const favSourceChips = document.querySelectorAll("[data-fav-source]");
    this.currentFaviconSource = "google";
    this.currentFetchedFaviconUrl = null;

    const buildFaviconUrl = (rawUrl, provider) => {
      if (!rawUrl) return null;
      try {
        let domain = rawUrl.trim();
        if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
        const parsed = new URL(domain);
        const host = parsed.hostname;
        
        switch (provider) {
          case "google":
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
          case "duckduckgo":
            return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
          case "chrome":
            if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
              return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(parsed.origin)}&size=64`);
            }
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
          case "direct":
            return `${parsed.origin}/apple-touch-icon.png`;
          default:
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
        }
      } catch (e) {
        return null;
      }
    };

    const fetchAndDisplayFavicon = async (customProvider = null) => {
      const provider = customProvider || this.currentFaviconSource || "google";
      const rawUrl = favUrlInput?.value.trim();
      if (!rawUrl) return;

      try {
        let domain = rawUrl;
        if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
        const host = new URL(domain).hostname;
        if (favDomainName) favDomainName.textContent = host;
      } catch(e) {
        if (favDomainName) favDomainName.textContent = rawUrl;
      }

      if (favStatus) favStatus.textContent = "Fetching high-resolution icon...";
      const resolvedFavUrl = buildFaviconUrl(rawUrl, provider);
      if (!resolvedFavUrl) {
        if (favStatus) favStatus.textContent = "Invalid site URL or domain.";
        return;
      }

      this.currentFetchedFaviconUrl = resolvedFavUrl;
      if (favImgBox) {
        favImgBox.replaceChildren();
        const img = document.createElement("img");
        img.alt = "Favicon";
        img.style.cssText = "width: 100%; height: 100%; object-fit: contain; cursor: pointer;";
        // Fallback to the DuckDuckGo icon service for the *target* host
        img.addEventListener("error", () => {
          try {
            let d = rawUrl;
            if (!/^https?:\/\//i.test(d)) d = `https://${d}`;
            const host = new URL(d).hostname;
            const fallbackUrl = `https://icons.duckduckgo.com/ip3/${host}.ico`;
            if (img.src !== fallbackUrl) {
              img.src = fallbackUrl;
              this.currentFetchedFaviconUrl = fallbackUrl;
            }
          } catch (e) {}
        }, { once: true });
        img.src = resolvedFavUrl;
        favImgBox.appendChild(img);
        favImgBox.onclick = () => this.openCropper(this.currentFetchedFaviconUrl, "favicon");
      }
      if (favStatus) favStatus.textContent = "High-resolution icon ready!";
    };

    favFetchBtn?.addEventListener("click", () => fetchAndDisplayFavicon());
    favUrlInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchAndDisplayFavicon();
      }
    });

    favSourceChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        favSourceChips.forEach((c) => c.classList.toggle("active", c === chip));
        this.currentFaviconSource = chip.dataset.favSource || "google";
        fetchAndDisplayFavicon(this.currentFaviconSource);
      });
    });

    favApplyBtn?.addEventListener("click", () => {
      const url = this.currentFetchedFaviconUrl || buildFaviconUrl(favUrlInput?.value.trim(), this.currentFaviconSource);
      if (url && this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          link.customImg = url;
          delete link.icon;
          delete link.monogram;
          this.app.saveConfig();
          this.app.grid?.updateTileDOM(gIdx, lIdx);
          this.renderBookmarksManager();
          this.closeIconModal();
        }
      }
    });

    favCropBtn?.addEventListener("click", () => {
      const url = this.currentFetchedFaviconUrl || buildFaviconUrl(favUrlInput?.value.trim(), this.currentFaviconSource);
      if (url) {
        this.openCropper(url, "favicon");
      }
    });

    // Tab 3: Web Image / URL Preview & Cropper Trigger
    const urlInput = document.getElementById("icon-url-input");
    const urlCheckBtn = document.getElementById("icon-url-check-btn");
    const urlImgBox = document.getElementById("icon-url-preview-img-box");
    const urlStatus = document.getElementById("icon-url-status");
    const urlActions = document.getElementById("icon-url-actions");
    const urlCropBtn = document.getElementById("icon-url-crop-btn");
    const urlApplyBtn = document.getElementById("icon-url-apply-btn");
    this.currentLoadedUrl = null;

    const handleUrlLoaded = (url) => {
      this.currentLoadedUrl = url;
      if (urlImgBox) {
        this.setPreviewImage(urlImgBox, url, () => this.openCropper(url, "url"));
      }
      if (urlStatus) urlStatus.textContent = "Image loaded successfully!";
      if (urlActions) urlActions.style.display = "flex";
    };

    urlCheckBtn?.addEventListener("click", async () => {
      const url = urlInput?.value.trim();
      if (!url) return;

      if (urlStatus) urlStatus.textContent = "Loading and optimizing image...";
      const cleanDataUrl = await this.loadImageAsCleanBase64(url);
      handleUrlLoaded(cleanDataUrl);
    });

    urlCropBtn?.addEventListener("click", () => {
      if (this.currentLoadedUrl) {
        this.openCropper(this.currentLoadedUrl, "url");
      }
    });

    urlApplyBtn?.addEventListener("click", () => {
      const url = this.currentLoadedUrl || urlInput?.value.trim();
      if (url && this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          link.customImg = url;
          delete link.icon;
          delete link.monogram;
          this.app.saveConfig();
          this.app.grid?.updateTileDOM(gIdx, lIdx);
          this.renderBookmarksManager();
          this.closeIconModal();
        }
      }
    });

    // Tab 4: File Upload & Drag-and-Drop Cropper Trigger
    const fileInput = document.getElementById("icon-file-input");
    const fileDropZone = document.getElementById("icon-drop-zone");
    const filePreviewWrap = document.getElementById("icon-file-preview-wrap");
    const fileImgBox = document.getElementById("icon-file-preview-img-box");
    const fileNameEl = document.getElementById("icon-file-name");
    const fileCropBtn = document.getElementById("icon-file-crop-btn");
    const fileApplyBtn = document.getElementById("icon-file-apply-btn");
    this.uploadedDataUrl = null;

    const processUploadedFile = (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        this.uploadedDataUrl = evt.target.result;
        if (filePreviewWrap) filePreviewWrap.style.display = "flex";
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileImgBox) {
          this.setPreviewImage(fileImgBox, this.uploadedDataUrl, () => this.openCropper(this.uploadedDataUrl, "upload"));
        }
      };
      reader.readAsDataURL(file);
    };

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      processUploadedFile(file);
    });

    // Drag-and-Drop Event Listeners for local files
    if (fileDropZone) {
      ["dragenter", "dragover"].forEach((evtName) => {
        fileDropZone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropZone.classList.add("drag-over");
        });
      });

      ["dragleave", "drop"].forEach((evtName) => {
        fileDropZone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropZone.classList.remove("drag-over");
        });
      });

      fileDropZone.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        processUploadedFile(file);
      });
    }

    fileCropBtn?.addEventListener("click", () => {
      if (this.uploadedDataUrl) {
        this.openCropper(this.uploadedDataUrl, "upload");
      }
    });

    fileApplyBtn?.addEventListener("click", () => {
      if (this.uploadedDataUrl && this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          link.customImg = this.uploadedDataUrl;
          delete link.icon;
          delete link.monogram;
          this.app.saveConfig();
          this.app.grid?.updateTileDOM(gIdx, lIdx);
          this.renderBookmarksManager();
          this.closeIconModal();
        }
      }
    });

    // Tab 5: Monogram Initial
    const monogramInput = document.getElementById("monogram-input");
    const monogramBox = document.getElementById("monogram-preview-box");
    const monogramApplyBtn = document.getElementById("icon-monogram-apply-btn");

    monogramInput?.addEventListener("input", (e) => {
      const val = e.target.value.toUpperCase();
      if (monogramBox) monogramBox.textContent = val || "A";
    });

    monogramApplyBtn?.addEventListener("click", () => {
      if (this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          delete link.customImg;
          delete link.icon;
          link.monogram = monogramInput?.value.trim().toUpperCase() || (link.name || "A").charAt(0);
          this.app.saveConfig();
          this.app.grid?.updateTileDOM(gIdx, lIdx);
          this.renderBookmarksManager();
          this.closeIconModal();
        }
      }
    });

    // Interactive Cropper Studio Engine
    this.initCropperEngine();
  }

  /* ── Interactive Icon Cropper Engine ─────────────────────────── */
  initCropperEngine() {
    this.cropperCanvas = document.getElementById("cropper-canvas");
    this.cropperCtx = this.cropperCanvas ? this.cropperCanvas.getContext("2d") : null;
    this.previewCanvas = document.getElementById("cropper-tile-preview-canvas");
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext("2d") : null;

    this.cropperImage = null;
    this.cropperZoom = 1.0;
    this.cropperPanX = 0;
    this.cropperPanY = 0;
    this.cropperRotation = 0;
    this.isCropperDragging = false;
    this.cropperDragStartX = 0;
    this.cropperDragStartY = 0;
    this.cropperPrevSourceTab = "url";
    this.cropperOriginalSource = null;

    const zoomSlider = document.getElementById("cropper-zoom-slider");
    const zoomValLabel = document.getElementById("cropper-zoom-val");
    const zoomInBtn = document.getElementById("cropper-zoom-in");
    const zoomOutBtn = document.getElementById("cropper-zoom-out");
    const toolFitBtn = document.getElementById("cropper-tool-fit");
    const toolCenterBtn = document.getElementById("cropper-tool-center");
    const toolRotateBtn = document.getElementById("cropper-tool-rotate");
    const toolResetBtn = document.getElementById("cropper-tool-reset");
    const backBtn = document.getElementById("cropper-back-btn");
    const applyBtn = document.getElementById("cropper-apply-btn");
    const useOrigBtn = document.getElementById("cropper-use-original-btn");

    // Zoom Slider & Buttons. The bounds come from the image, not from constants:
    // a fixed 0.3 floor meant a 1024px logo could never be zoomed out far enough
    // to see, and Fit View hit the same floor.
    const setZoom = (val) => {
      this.cropperZoom = Math.max(this.cropperMinZoom ?? 0.05, Math.min(this.cropperMaxZoom ?? 5, val));
      if (zoomSlider) zoomSlider.value = this.cropperZoom;
      if (zoomValLabel) zoomValLabel.textContent = `${Math.round(this.cropperZoom * 100)}%`;
      this.drawCropper();
    };

    zoomSlider?.addEventListener("input", (e) => setZoom(parseFloat(e.target.value)));
    const zoomStep = () => Math.max(0.02, (this.cropperFitZoom ?? 1) * 0.2);
    zoomInBtn?.addEventListener("click", () => setZoom(this.cropperZoom + zoomStep()));
    zoomOutBtn?.addEventListener("click", () => setZoom(this.cropperZoom - zoomStep()));

    toolFitBtn?.addEventListener("click", () => {
      if (!this.cropperImage) return;
      this.cropperPanX = 0;
      this.cropperPanY = 0;
      setZoom(this.cropperFitZoom ?? 1);
    });

    toolCenterBtn?.addEventListener("click", () => {
      this.cropperPanX = 0;
      this.cropperPanY = 0;
      this.drawCropper();
    });

    toolRotateBtn?.addEventListener("click", () => {
      this.cropperRotation = (this.cropperRotation + 90) % 360;
      this.drawCropper();
    });

    toolResetBtn?.addEventListener("click", () => {
      if (!this.cropperImage) return;
      const imgW = this.cropperImage.naturalWidth || this.cropperImage.width || 260;
      const imgH = this.cropperImage.naturalHeight || this.cropperImage.height || 260;
      const baseScale = Math.min(260 / imgW, 260 / imgH);
      this.cropperPanX = 0;
      this.cropperPanY = 0;
      this.cropperRotation = 0;
      setZoom(Math.max(0.4, Number((baseScale * 1.15).toFixed(2))));
    });

    backBtn?.addEventListener("click", () => {
      const modalTabs = document.querySelectorAll(".icon-tab-btn");
      const modalPanes = document.querySelectorAll(".modal-tab-pane");
      modalTabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === this.cropperPrevSourceTab));
      modalPanes.forEach((p) => p.classList.toggle("active", p.id === `modal-pane-${this.cropperPrevSourceTab}`));
    });

    // Apply Cropped Output
    applyBtn?.addEventListener("click", () => {
      if (!this.cropperImage) {
        this.closeIconModal();
        return;
      }

      if (!this.activeIconTarget) {
        if (this.app.config.groups?.[0]?.links?.[0]) {
          this.activeIconTarget = { gIdx: 0, lIdx: 0 };
        } else {
          this.closeIconModal();
          return;
        }
      }

      const exportSize = 256;
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportSize;
      exportCanvas.height = exportSize;
      const expCtx = exportCanvas.getContext("2d");

      const imgW = this.cropperImage.naturalWidth || this.cropperImage.width || 260;
      const imgH = this.cropperImage.naturalHeight || this.cropperImage.height || 260;

      const factor = exportSize / 260;
      expCtx.save();
      expCtx.translate(exportSize / 2 + this.cropperPanX * factor, exportSize / 2 + this.cropperPanY * factor);
      expCtx.rotate((this.cropperRotation * Math.PI) / 180);
      expCtx.scale(this.cropperZoom * factor, this.cropperZoom * factor);

      expCtx.drawImage(
        this.cropperImage,
        -imgW / 2,
        -imgH / 2
      );
      expCtx.restore();

      let finalUrl = this.cropperOriginalSource;
      try {
        finalUrl = exportCanvas.toDataURL("image/png");
      } catch (err) {
        console.warn("Canvas toDataURL failed, using original source:", err);
      }

      const { gIdx, lIdx } = this.activeIconTarget;
      const group = this.app.config.groups[gIdx];
      const link = group?.links[lIdx];
      if (link) {
        link.customImg = finalUrl;
        delete link.icon;
        delete link.monogram;
        this.app.saveConfig();
        this.app.grid?.updateTileDOM(gIdx, lIdx);
        this.renderBookmarksManager();
      }
      this.closeIconModal();
    });

    // Use Original Image (Bypass crop)
    useOrigBtn?.addEventListener("click", () => {
      if (this.cropperOriginalSource) {
        if (!this.activeIconTarget) {
          if (this.app.config.groups?.[0]?.links?.[0]) {
            this.activeIconTarget = { gIdx: 0, lIdx: 0 };
          }
        }
        if (this.activeIconTarget) {
          const { gIdx, lIdx } = this.activeIconTarget;
          const link = this.app.config.groups[gIdx]?.links[lIdx];
          if (link) {
            link.customImg = this.cropperOriginalSource;
            delete link.icon;
            delete link.monogram;
            this.app.saveConfig();
            this.app.grid?.updateTileDOM(gIdx, lIdx);
            this.renderBookmarksManager();
          }
        }
      }
      this.closeIconModal();
    });

    // Viewport Pointer Interactions (Pan & Drag)
    const viewport = document.querySelector(".cropper-viewport-wrap");
    if (viewport) {
      viewport.addEventListener("pointerdown", (e) => {
        this.isCropperDragging = true;
        this.cropperDragStartX = e.clientX - this.cropperPanX;
        this.cropperDragStartY = e.clientY - this.cropperPanY;
        viewport.setPointerCapture?.(e.pointerId);
      });

      viewport.addEventListener("pointermove", (e) => {
        if (!this.isCropperDragging) return;
        this.cropperPanX = e.clientX - this.cropperDragStartX;
        this.cropperPanY = e.clientY - this.cropperDragStartY;
        this.drawCropper();
      });

      const endDrag = (e) => {
        this.isCropperDragging = false;
        try { viewport.releasePointerCapture?.(e.pointerId); } catch(err) {}
      };
      viewport.addEventListener("pointerup", endDrag);
      viewport.addEventListener("pointercancel", endDrag);

      // Mouse Wheel Zoom
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(this.cropperZoom * factor);
      }, { passive: false });
    }
  }

  /* XSS-safe preview injection: the URL is assigned as a property, never
     interpolated into markup, so quotes in user input can't break out. */
  setPreviewImage(box, url, onClick) {
    box.replaceChildren();
    const img = document.createElement("img");
    img.style.cssText = "width: 100%; height: 100%; object-fit: contain; cursor: pointer;";
    img.src = url;
    box.appendChild(img);
    box.onclick = onClick || null;
  }

  async loadImageAsCleanBase64(url) {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
      return url;
    }

    // Attempt 1: Direct fetch (works natively in Chrome Extension with host_permissions)
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const blob = await resp.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {}

    // Attempt 2: High-speed CORS proxy via images.weserv.nl
    try {
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&output=png`;
      const resp = await fetch(proxyUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {}

    return url;
  }

  async openCropper(imageSource, sourceTab) {
    this.cropperPrevSourceTab = sourceTab || "url";
    this.cropperOriginalSource = imageSource;

    const modalTabs = document.querySelectorAll(".icon-tab-btn");
    const modalPanes = document.querySelectorAll(".modal-tab-pane");
    modalTabs.forEach((t) => t.classList.remove("active"));
    modalPanes.forEach((p) => p.classList.toggle("active", p.id === "modal-pane-cropper"));

    this.cropperCanvas = document.getElementById("cropper-canvas");
    this.cropperCtx = this.cropperCanvas ? this.cropperCanvas.getContext("2d") : null;
    this.previewCanvas = document.getElementById("cropper-tile-preview-canvas");
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext("2d") : null;

    if (this.cropperCanvas) {
      this.cropperCanvas.width = 260;
      this.cropperCanvas.height = 260;
    }
    if (this.previewCanvas) {
      this.previewCanvas.width = 60;
      this.previewCanvas.height = 60;
    }

    if (this.activeIconTarget) {
      const { gIdx, lIdx } = this.activeIconTarget;
      const link = this.app.config.groups[gIdx]?.links[lIdx];
      const tileNameEl = document.getElementById("cropper-tile-name");
      if (tileNameEl) tileNameEl.textContent = link?.name || "Bookmark";
      const tileBox = document.getElementById("cropper-tile-box");
      if (tileBox && link?.color) {
        tileBox.style.setProperty("--c", link.color);
      }
    }

    const initImageReady = (img) => {
      this.cropperImage = img;
      const imgW = img.naturalWidth || img.width || 260;
      const imgH = img.naturalHeight || img.height || 260;

      // Open showing the whole image, and let the range reach well past that in
      // both directions so any source can be framed.
      const canvas = document.getElementById("cropper-canvas");
      const frame = Math.min(canvas?.width || 260, canvas?.height || 260);
      this.cropperFitZoom = Math.min(frame / imgW, frame / imgH);
      this.cropperMinZoom = Math.min(0.05, this.cropperFitZoom * 0.5);
      this.cropperMaxZoom = Math.max(5, this.cropperFitZoom * 12);
      this.cropperZoom = this.cropperFitZoom;
      this.cropperPanX = 0;
      this.cropperPanY = 0;
      this.cropperRotation = 0;

      const zoomSlider = document.getElementById("cropper-zoom-slider");
      const zoomValLabel = document.getElementById("cropper-zoom-val");
      if (zoomSlider) {
        zoomSlider.min = String(this.cropperMinZoom);
        zoomSlider.max = String(this.cropperMaxZoom);
        zoomSlider.step = String(Math.max(0.005, this.cropperFitZoom / 40));
        zoomSlider.value = this.cropperZoom;
      }
      if (zoomValLabel) zoomValLabel.textContent = `${Math.round(this.cropperZoom * 100)}%`;

      this.drawCropper();
    };

    // Load as guaranteed clean Base64 data URL
    const cleanSource = await this.loadImageAsCleanBase64(imageSource);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => initImageReady(img);
    img.onerror = () => {
      const plainImg = new Image();
      plainImg.onload = () => initImageReady(plainImg);
      plainImg.src = imageSource;
    };
    img.src = cleanSource;
  }

  drawCropper() {
    if (!this.cropperCtx || !this.cropperCanvas || !this.cropperImage) return;

    const w = this.cropperCanvas.width || 260;
    const h = this.cropperCanvas.height || 260;

    this.cropperCtx.clearRect(0, 0, w, h);

    const imgW = this.cropperImage.naturalWidth || this.cropperImage.width;
    const imgH = this.cropperImage.naturalHeight || this.cropperImage.height;

    this.cropperCtx.save();
    this.cropperCtx.translate(w / 2 + this.cropperPanX, h / 2 + this.cropperPanY);
    this.cropperCtx.rotate((this.cropperRotation * Math.PI) / 180);
    this.cropperCtx.scale(this.cropperZoom, this.cropperZoom);

    this.cropperCtx.drawImage(
      this.cropperImage,
      -imgW / 2,
      -imgH / 2
    );
    this.cropperCtx.restore();

    // Render Tile Live Preview with exact matching transformation hierarchy
    if (this.previewCtx && this.previewCanvas) {
      const pw = this.previewCanvas.width || 60;
      const ph = this.previewCanvas.height || 60;
      this.previewCtx.clearRect(0, 0, pw, ph);

      const factor = pw / w;
      this.previewCtx.save();
      this.previewCtx.translate(pw / 2 + this.cropperPanX * factor, ph / 2 + this.cropperPanY * factor);
      this.previewCtx.rotate((this.cropperRotation * Math.PI) / 180);
      this.previewCtx.scale(this.cropperZoom * factor, this.cropperZoom * factor);

      this.previewCtx.drawImage(
        this.cropperImage,
        -imgW / 2,
        -imgH / 2
      );
      this.previewCtx.restore();
    }
  }

  openIconModal(gIdx, lIdx, opener = document.activeElement) {
    this.activeIconTarget = { gIdx, lIdx };
    const link = this.app.config.groups[gIdx]?.links[lIdx];
    if (!link) return;

    // 1. Update Modal Title with Bookmark Name
    const titleEl = document.querySelector("#icon-modal .modal-head b");
    if (titleEl) {
      titleEl.textContent = `Choose Icon for "${link.name || 'Bookmark'}"`;
    }

    // 2. Pre-fill Tab 2 Smart Favicon
    const favUrlInput = document.getElementById("favicon-url-input");
    const favDomainName = document.getElementById("favicon-domain-name");
    const favImgBox = document.getElementById("favicon-preview-img-box");
    const favStatus = document.getElementById("favicon-status");
    if (favUrlInput) {
      favUrlInput.value = link.url || "";
      if (link.url && /^https?:\/\//i.test(link.url)) {
        try {
          const host = new URL(link.url).hostname;
          if (favDomainName) favDomainName.textContent = host;
          const favUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
          this.currentFetchedFaviconUrl = favUrl;
          if (favImgBox) {
            this.setPreviewImage(favImgBox, favUrl, () => this.openCropper(favUrl, "favicon"));
          }
          if (favStatus) favStatus.textContent = "High-resolution icon ready!";
        } catch(e) {}
      } else {
        if (favImgBox) favImgBox.innerHTML = `<span style="font-size: 11px; color: var(--dim);">No icon</span>`;
        if (favStatus) favStatus.textContent = "Enter site URL or domain above";
      }
    }

    // 3. Reset and Pre-fill URL Tab
    const urlInput = document.getElementById("icon-url-input");
    const urlImgBox = document.getElementById("icon-url-preview-img-box");
    const urlStatus = document.getElementById("icon-url-status");
    const urlActions = document.getElementById("icon-url-actions");
    this.currentLoadedUrl = null;

    if (link.customImg && (link.customImg.startsWith("http") || link.customImg.startsWith("data:"))) {
      if (urlInput) urlInput.value = link.customImg.startsWith("data:") ? "" : link.customImg;
      if (urlImgBox) {
        this.setPreviewImage(urlImgBox, link.customImg, () => this.openCropper(link.customImg, "url"));
      }
      if (urlStatus) urlStatus.textContent = "Current bookmark icon loaded";
      if (urlActions) urlActions.style.display = "flex";
      this.currentLoadedUrl = link.customImg;
    } else {
      if (urlInput) urlInput.value = link.url || "";
      if (urlImgBox) urlImgBox.innerHTML = `<span style="font-size: 11px; color: var(--dim);">No image</span>`;
      if (urlStatus) urlStatus.textContent = link.url ? "Click 'Preview' to load image from URL" : "Enter an image URL above to test";
      if (urlActions) urlActions.style.display = "none";
    }

    // 4. Reset Local File Upload Tab
    const fileInput = document.getElementById("icon-file-input");
    const filePreviewWrap = document.getElementById("icon-file-preview-wrap");
    const fileImgBox = document.getElementById("icon-file-preview-img-box");
    const fileNameEl = document.getElementById("icon-file-name");
    this.uploadedDataUrl = null;
    if (fileInput) fileInput.value = "";
    if (filePreviewWrap) filePreviewWrap.style.display = "none";
    if (fileImgBox) fileImgBox.innerHTML = "";
    if (fileNameEl) fileNameEl.textContent = "";

    // 5. Reset Monogram Tab
    const monogramInput = document.getElementById("monogram-input");
    const monogramBox = document.getElementById("monogram-preview-box");
    const initialChar = link.monogram || (link.name || "A").trim().charAt(0).toUpperCase() || "A";
    if (monogramInput) monogramInput.value = initialChar;
    if (monogramBox) {
      monogramBox.textContent = initialChar;
      monogramBox.style.background = `linear-gradient(135deg, ${link.color || '#6366f1'}, #35d6c0)`;
    }

    // 6. Reset Cropper Workspace
    this.cropperImage = null;
    this.cropperOriginalSource = null;
    this.cropperZoom = 1.0;
    this.cropperPanX = 0;
    this.cropperPanY = 0;
    this.cropperRotation = 0;
    if (this.cropperCtx && this.cropperCanvas) {
      this.cropperCtx.clearRect(0, 0, this.cropperCanvas.width, this.cropperCanvas.height);
    }
    if (this.previewCtx && this.previewCanvas) {
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    // 7. Intelligent Tab Selection
    const modalTabs = document.querySelectorAll(".icon-tab-btn");
    const modalPanes = document.querySelectorAll(".modal-tab-pane");
    
    let defaultTab = "library";
    if (link.customImg) {
      defaultTab = link.customImg.startsWith("data:") ? "upload" : "url";
    } else if (link.monogram) {
      defaultTab = "monogram";
    }

    this.iconPicker.select(defaultTab);
    this.activeModalTab = defaultTab;

    // 8. Reset Search Filter and Render Library
    const searchIpt = document.getElementById("icon-search");
    if (searchIpt) searchIpt.value = "";
    document.querySelectorAll(".icon-chip").forEach((c, idx) => c.classList.toggle("active", idx === 0));
    this.filterIconLibrary("", "all", link.icon);

    this.iconPicker.open(link, opener);
  }

  closeIconModal() {
    this.iconPicker.close();
    this.activeIconTarget = null;

    if (this.app.grid?.quickEditReturnTarget) {
      const { gIdx, lIdx } = this.app.grid.quickEditReturnTarget;
      this.app.grid.quickEditReturnTarget = null;
      this.app.grid.openQuickEditModal(gIdx, lIdx);
    }
  }

  filterIconLibrary(query, cat, highlightIconKey = null) {
    const grid = document.getElementById("modal-icon-grid");
    if (!grid) return;

    /* Picking a library icon keeps the bookmark's own colour, so drawing the
       grid in plain white showed something the user would never get: YouTube
       read white here and arrived red on the board. Paint the grid in the
       colour the choice will actually produce. */
    const target = this.activeIconTarget;
    const editing = target ? this.app.config.groups?.[target.gIdx]?.links?.[target.lIdx] : null;
    grid.style.setProperty("--icon-preview-accent", editing?.color || "var(--nl-text-primary)");

    grid.innerHTML = "";
    for (const key in ICONS_DB) {
      const item = ICONS_DB[key];
      const matchQ = !query || item.name.toLowerCase().includes(query) || key.toLowerCase().includes(query);
      const matchCat = cat === "all" || item.cat === cat;

      if (matchQ && matchCat) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", item.name);
        btn.className = "icon-item";
        if (key === highlightIconKey) {
          btn.classList.add("active");
          btn.style.boxShadow = "0 0 0 2px var(--accent)";
          setTimeout(() => btn.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
        }
        btn.innerHTML = `
          <svg viewBox="${item.vb || '0 0 24 24'}"><path d="${item.p}"/></svg>
          <span>${item.name}</span>
        `;

        btn.addEventListener("click", () => {
          if (this.activeIconTarget) {
            const { gIdx, lIdx } = this.activeIconTarget;
            const link = this.app.config.groups[gIdx].links[lIdx];
            link.icon = key;
            delete link.customImg;
            delete link.monogram;
            this.app.saveConfig();
            this.app.grid?.updateTileDOM(gIdx, lIdx);
            this.renderBookmarksManager();
            this.closeIconModal();
          }
        });

        grid.appendChild(btn);
      }
    }
  }

  /* ── 9. Live Custom CSS Editor ───────────────────────────────── */
  initCustomCSSEditor() {
    const editor = document.getElementById("css-editor");
    const injectBtn = document.getElementById("cfg-inject-css");
    const clearBtn = document.getElementById("cfg-clear-css");

    if (editor) editor.value = this.app.config.customCss || "";

    injectBtn?.addEventListener("click", () => {
      const css = editor?.value || "";
      this.app.config.customCss = css;
      this.app.injectCustomCSS(css);
      this.app.saveConfig();
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.cssApplied") : "Custom CSS applied & saved", "success");
      }
    });

    clearBtn?.addEventListener("click", () => {
      if (editor) editor.value = "";
      this.app.config.customCss = "";
      this.app.injectCustomCSS("");
      this.app.saveConfig();
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.cssCleared") : "Custom CSS cleared", "info");
      }
    });

    editor?.addEventListener("input", (e) => {
      this.app.injectCustomCSS(e.target.value);
    });

    // Preset Snippets
    const CSS_PRESETS = {
      "compact-6col": `/* === Preset: Compact 6-Column Grid === */\n.grid { grid-template-columns: repeat(6, 1fr) !important; gap: 8px !important; }\n.tile { width: 68px !important; height: 68px !important; border-radius: 14px !important; }`,
      "tahoe-glass": `/* === Preset: Ultra-blur Tahoe Liquid Glass === */\n:root {\n  --glass-blur: 36px !important;\n  --glass-saturate: 210% !important;\n  --glass-opacity: 0.85 !important;\n}\n.card, .glass-btn {\n  box-shadow: 0 16px 40px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.4) !important;\n}`,
      "monochrome": `/* === Preset: Monochrome Minimalist Tiles === */\n.tile {\n  filter: grayscale(100%) brightness(0.9);\n  transition: filter 0.25s ease, transform 0.25s ease !important;\n}\n.tile:hover {\n  filter: grayscale(0%) brightness(1.1) !important;\n  transform: scale(1.06) !important;\n}`,
      "square-tiles": `/* === Preset: Square Sharp Tiles === */\n:root {\n  --card-radius: 4px !important;\n}\n.tile, .card {\n  border-radius: 4px !important;\n}`,
      "hide-clock": `/* === Preset: Hide Hero Clock === */\n#hero { display: none !important; }\n#searchwrap { margin-top: 60px !important; }`
    };

    document.querySelectorAll(".css-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        if (CSS_PRESETS[key] && editor) {
          editor.value = (editor.value.trim() ? editor.value + "\n\n" : "") + CSS_PRESETS[key];
          this.app.injectCustomCSS(editor.value);
          this.app.config.customCss = editor.value;
          this.app.saveConfig();
        }
      });
    });

    // CSS Docs Modal Logic
    const cssDocsBtn = document.getElementById("btn-open-css-docs");
    const cssDocsModal = document.getElementById("css-docs-modal");
    const cssDocsModalX = document.getElementById("css-docs-modal-x");
    this.cssDocsDialog = cssDocsModal ? new NordlysUI.DialogController(cssDocsModal, { closeOnBackdrop: true }) : null;

    cssDocsBtn?.addEventListener("click", () => {
      this.cssDocsDialog?.open(cssDocsBtn);
    });

    cssDocsModalX?.addEventListener("click", () => {
      this.cssDocsDialog?.close();
    });

    // Modal Tabs
    const cssTabs = cssDocsModal?.querySelectorAll(".icon-tab-btn");
    const cssPanes = cssDocsModal?.querySelectorAll(".css-tab-pane");

    cssTabs?.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.cssTab;
        cssTabs.forEach((t) => t.classList.toggle("active", t === tab));
        cssPanes?.forEach((p) => p.classList.toggle("active", p.id === `css-pane-${target}`));
      });
    });

    // Copy Recipe Buttons
    cssDocsModal?.querySelectorAll(".btn-copy-recipe").forEach((btn) => {
      btn.addEventListener("click", () => {
        const recipe = btn.dataset.recipe;
        if (recipe) {
          navigator.clipboard.writeText(recipe).then(() => {
            const oldText = btn.textContent;
            btn.textContent = "✔ Copied!";
            btn.classList.add("copied");
            setTimeout(() => {
              btn.textContent = oldText;
              btn.classList.remove("copied");
            }, 2000);
          });
        }
      });
    });

    // Download Docs (.md)
    document.getElementById("btn-download-docs")?.addEventListener("click", () => {
      const mdContent = `# Nordlys Custom CSS Guide\n\n## Core Selectors & Hierarchy\n- \`#hero\`, \`#clock\`, \`#date\`, \`#greet\` — Clock, date & greeting\n- \`#hh\`, \`#mm\`, \`#ss\` — Individual clock digits\n- \`#searchwrap\`, \`#search\`, \`#q\` — Search bar & input\n- \`#sugg\`, \`.sugg-item\` — Suggestions dropdown rows\n- \`#board\` — Bento board container\n- \`.card\` — Folder glass container\n- \`.cat\`, \`.cat b\` — Folder header & title text\n- \`.grid\` — Tile grid (\`[data-cols="1..8"]\`)\n- \`.tile\` — Bookmark tile (\`--c\` holds its accent color)\n- \`.box\` — Icon glass box, \`.lbl\` — bookmark label\n- \`#hiddenDock\`, \`.restoreFolder\` — Hidden folder dock & chips\n- \`#gear\` — Settings gear button\n- \`#cfg\`, \`.ctab\`, \`.csec\` — Settings drawer components\n\n## CSS Variables & Theming Tokens (override on :root)\n- \`--void\` — page background color\n- \`--void-gradient\` — page background gradient\n- \`--card-tint\` / \`--card-tint-deep\` — folder card glass tints\n- \`--glass\` — search bar / gear glass fill\n- \`--glass-border\` — card border color\n- \`--accent\` / \`--accent-glow\`\n- \`--ink\` / \`--dim\` / \`--faint\` — text colors\n- \`--font-main\` / \`--font-display\`\n- \`--tw\` (tile size), \`--tile-radius\`, \`--card-radius\`\n- \`--glass-blur\`, \`--glass-saturate\`, \`--glass-opacity\` (0-1), \`--glass-border-sheen\` (0-1)\n- \`--bg-blur\`, \`--bg-dim\` — custom wallpaper effects\n\n## Recipes\n\n### Transparent Minimal Cards\n\`\`\`css\n.card { background: transparent !important; box-shadow: none !important; border: none !important; }\n\`\`\`\n\n### Cyberpunk Neon Borders\n\`\`\`css\n.card { border: 2px solid #ff007f !important; box-shadow: 0 0 10px #00f3ff, inset 0 0 10px #00f3ff !important; }\n\`\`\`\n\n### Compact Grid & Hover Zoom\n\`\`\`css\n.tile { transition: transform 0.2s !important; } .tile:hover { transform: scale(1.1) !important; z-index: 10; }\n\`\`\`\n\n### Square Sharp Modernist\n\`\`\`css\n:root { --card-radius: 0px !important; --tile-radius: 0px !important; }\n\`\`\`\n\n### Monochrome Matte Black\n\`\`\`css\n:root { --card-tint: #111 !important; --card-tint-deep: #0a0a0a !important; --glass-border: #333 !important; } .tile { filter: grayscale(100%); }\n\`\`\`\n\n### Floating Gradient Text Header\n\`\`\`css\n#clock { background: linear-gradient(90deg, #ff8a00, #e52e71); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n\`\`\`\n\n### Hide Clock & Center Bento\n\`\`\`css\n#hero { display: none !important; } #board { margin: auto; }\n\`\`\`\n`;
      const blob = new Blob([mdContent], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Nordlys-Custom-CSS-Guide.md";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Download Starter CSS (.css)
    document.getElementById("btn-download-css")?.addEventListener("click", () => {
      const cssContent = `/* 
  Nordlys Custom Styles
  Apply these styles in the Settings -> Custom CSS tab.
*/

/* Example: Change card backgrounds */
/* 
.card {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(10px) !important;
} 
*/

/* Example: Customize bookmark tiles */
/* 
.tile {
  border-radius: 12px !important;
} 
.tile:hover {
  transform: translateY(-2px) !important;
}
*/
`;
      const blob = new Blob([cssContent], { type: "text/css" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nordlys-custom-styles.css";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ── 10. Backup & Browser Bookmarks Migration ─────────────────── */
  initBackupManager() {
    // Export JSON Backup
    document.getElementById("cfg-export")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(this.app.config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nordlys-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Export Universal Netscape HTML Bookmarks
    document.getElementById("cfg-export-html")?.addEventListener("click", () => {
      let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- This is an automatically generated file. DO NOT EDIT! -->\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Nordlys Bookmarks</TITLE>\n<H1>Nordlys Bookmarks</H1>\n<DL><p>\n`;

      for (const group of this.app.config.groups || []) {
        html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}">${esc(group.label || 'Folder')}</H3>\n    <DL><p>\n`;
        for (const link of group.links || []) {
          html += `        <DT><A HREF="${esc(link.url)}" ADD_DATE="${Math.floor(Date.now()/1000)}">${esc(link.name || link.url)}</A>\n`;
        }
        html += `    </DL><p>\n`;
      }
      html += `</DL><p>\n`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nordlys-bookmarks-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Universal File Import (.html / .json)
    const importInput = document.getElementById("cfg-import-universal") || document.getElementById("cfg-import");
    importInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      const reader = new FileReader();

      reader.onload = (evt) => {
        const text = evt.target.result;
        try {
          if (fileName.endsWith(".html") || fileName.endsWith(".htm") || text.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1") || text.includes("<DL>")) {
            // Netscape HTML Parser
            const dom = new DOMParser().parseFromString(text, "text/html");
            const newGroups = [];
            const folderHeaders = dom.querySelectorAll("h3, H3");

            if (folderHeaders.length > 0) {
              folderHeaders.forEach((h3) => {
                const folderTitle = h3.textContent.trim() || "Imported Folder";
                const links = [];
                let next = h3.parentElement?.querySelector("dl, DL") || h3.nextElementSibling;
                if (next && next.tagName.toLowerCase() === "dl") {
                  next.querySelectorAll("a, A").forEach((a) => {
                    const url = a.getAttribute("href") || a.href;
                    if (url && !url.startsWith("javascript:")) {
                      const name = a.textContent.trim() || url;
                      links.push({ name, url, color: "#38bdf8" });
                    }
                  });
                }
                if (links.length > 0) {
                  newGroups.push({
                    label: folderTitle.toUpperCase(),
                    cols: Math.min(4, Math.max(2, Math.ceil(Math.sqrt(links.length)))),
                    hidden: false,
                    links
                  });
                }
              });
            } else {
              // Flat list of anchors
              const links = [];
              dom.querySelectorAll("a, A").forEach((a) => {
                const url = a.getAttribute("href") || a.href;
                if (url && !url.startsWith("javascript:")) {
                  links.push({ name: a.textContent.trim() || url, url, color: "#38bdf8" });
                }
              });
              if (links.length > 0) {
                newGroups.push({
                  label: "IMPORTED BOOKMARKS",
                  cols: 4,
                  hidden: false,
                  links
                });
              }
            }

            if (newGroups.length > 0) {
              this.app.config.groups = (this.app.config.groups || []).concat(newGroups);
              this.app.saveConfig();
              location.reload();
            } else if (typeof toast === "function") {
              toast(window.I18N ? window.I18N.t("toast.importEmpty") : "No bookmarks found in HTML file", "danger");
            }
          } else {
            // JSON Format
            const imported = JSON.parse(text);
            if (imported && (imported.groups || imported.theme)) {
              this.app.config = Object.assign({}, DEFAULT_CONFIG, imported);
              this.app.saveConfig();
              location.reload();
            } else if (typeof toast === "function") {
              toast(window.I18N ? window.I18N.t("toast.importInvalid") : "Invalid JSON configuration structure", "danger");
            }
          }
        } catch (err) {
          if (typeof toast === "function") {
            toast(`${window.I18N ? window.I18N.t("toast.importError") : "Import failed"}: ${err.message}`, "danger", 4000);
          }
        }
      };

      reader.readAsText(file);
    });

    // Reset Defaults
    document.getElementById("cfg-reset")?.addEventListener("click", () => {
      const t = (k, fb) => (window.I18N ? window.I18N.t(k) : fb);
      confirmDialog({
        title: t("confirm.resetTitle", "Reset everything?"),
        message: t("backup.confirmReset", "Reset all Nordlys settings to factory defaults? This cannot be undone."),
        confirmText: t("confirm.reset", "Reset"),
        cancelText: t("confirm.cancel", "Cancel")
      }).then(async (ok) => {
        if (!ok) return;
        [
          "aether_tab_config",
          "aurora_tab_config",
          "aurora_custom_themes",
          "aurora_drawer_width",
          "aurora_language",
          "aurora_search_history"
        ].forEach((key) => localStorage.removeItem(key));
        try { await MediaVault.deleteMedia("custom_bg"); } catch (e) {}
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.clear(() => location.reload());
          setTimeout(() => location.reload(), 400); // fallback if callback never fires
        } else {
          location.reload();
        }
      });
    });
  }
}
