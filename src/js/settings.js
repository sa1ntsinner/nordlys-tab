/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SETTINGS CONTROLLER & CUSTOMIZATION
   ═══════════════════════════════════════════════════════════════════ */

/* The settings a shared look may change (look-share.js). */
const LOOK_SETTINGS = ["bgMode", "bgMotion", "bgIntensity", "bgSeed", "boardLayout", "pageLayout", "glassLevel", "cardRadius", "tileSize", "cardGap", "boardGap", "boardWidth", "tileLabels", "cardGlow", "iconShape", "hoverEffect", "cornerShape"];

class SettingsController {
  constructor(app) {
    this.app = app;
    this.drawer = document.getElementById("cfg");
    this.resizer = document.getElementById("cfg-resizer");
    this.modal = document.getElementById("icon-modal");
    this.activeIconTarget = null; // { gIdx, lIdx }
    this.customThemes = this.loadCustomThemes();
    this.shell = new NordlysSettingsShell({
      root: this.drawer,
      opener: document.getElementById("gear"),
      // However the panel closes — Escape, the cross, a click outside — a look
      // being tried on and never kept is put back.
      onClosed: () => { if (this.lookTrial) this.revertLook(); }
    });
    this.bookmarkSettings = new NordlysBookmarkSettings({
      app: this.app,
      root: document.getElementById("cfg-groups-editor"),
      openIconPicker: (gIdx, lIdx, opener) => this.openIconModal(gIdx, lIdx, opener)
    });
    this.support = new NordlysSupportSettings({
      root: document.getElementById("sec-support"),
      // For the one number the About block prints, and nothing else.
      app: this.app
    });
    this.iconPicker = new NordlysIconPicker({
      dialogRoot: this.modal,
      // Looked up each time: another tab's save can move the bookmark.
      target: () => (this.activeIconTarget ? this.app.config.groups[this.activeIconTarget.gIdx]?.links[this.activeIconTarget.lIdx] : null),
      changed: () => {
        const { gIdx, lIdx } = this.activeIconTarget;
        this.app.saveConfig();
        this.app.grid?.updateTileDOM(gIdx, lIdx);
        this.renderBookmarksManager();
      },
      closed: () => this.iconModalClosed()
    });
    document.getElementById("gear")?.addEventListener("click", () => this.open());
    
    this.initDrawerResizer();
    this.initAppearance();
    this.initCustomThemeBuilder();
    this.initGeneral();
    // The sky's part of the Background panel (settings-sky.js), before the controls that read its choices.
    this.skySettings = window.NordlysSkySettings ? new NordlysSkySettings(this.app, this) : null;
    this.initBackgroundSettings();
    this.initBookmarksManager();
    this.initCustomCSSEditor();
    this.initBackupManager();
    this.initRestorePoint();
    this.initScenePicker();
    this.initTypography();
    this.initLookShare();
    this.showSkyLoad();
    // Every native dropdown gets a themed control drawn over it; the element
    // stays as the value source but stops painting platform chrome.
    window.NordlysUI?.enhanceSelects(document);
  }

  /* A photo is kept at the size this screen can show, not the size the camera
     took it: every new tab decodes it, and a 6000 by 4000 picture is about
     96 MB of memory per open tab. Animated and vector pictures are kept as
     they are, and so is one that is already small enough. */
  async fitWallpaper(file) {
    if (/image\/(gif|svg)/i.test(file.type) || typeof createImageBitmap !== "function") return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch (error) { return file; }
    const longest = Math.min(3840, Math.max(1920, Math.round(Math.max(screen.width || 0, screen.height || 0) * (window.devicePixelRatio || 1))));
    const scale = longest / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) { bitmap.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
    // Safari cannot write WebP and hands back a PNG, larger than the photo it came from.
    let smaller = await encode("image/webp");
    if (smaller?.type !== "image/webp") smaller = await encode("image/jpeg");
    return smaller && smaller.size < file.size ? smaller : file;
  }

  // The note that this sky is held still for being too heavy here, with the way out.
  showSkyLoad() {
    const row = document.getElementById("bg-heavy-row");
    if (!row) return;
    const engine = this.app.bgEngine;
    row.hidden = !engine?.heavy;
    const button = document.getElementById("cfg-bg-keep-moving");
    if (button && !button.dataset.wired) {
      button.dataset.wired = "1";
      button.addEventListener("click", () => this.app.keepSkyMoving(this.app.bgEngine?.mode));
    }
  }

  /* ── 0a. Background: the atmosphere of a drawn sky ────────────── */
  /* The skies themselves are chosen in settings-sky.js; here are the two
     sliders that apply to every drawn sky, the colour moods, the time of day
     and the real moon. */
  initScenePicker() {
    const sky = this.skySettings;
    if (!sky) return;

    const applyAtmosphere = () => {
      const motion = Number(document.getElementById("cfg-bg-motion")?.value ?? 100) / 100;
      const intensity = Number(document.getElementById("cfg-bg-intensity")?.value ?? 100) / 100;
      const palette = this.app.config.bgPalette || "theme";
      this.app.config.bgMotion = motion;
      this.app.config.bgIntensity = intensity;
      this.app.bgEngine?.setAtmosphere({ motion, intensity, palette });
      const motionLabel = document.getElementById("lbl-bg-motion");
      const intensityLabel = document.getElementById("lbl-bg-intensity");
      /* Zero is a state, not a quantity, and it is the one people reach for
         when they want the colour without the movement. Reading "0%" leaves
         them guessing whether anything is still there; naming it says the
         scene is painted and held. It is also the only way that state is
         discoverable — there is no card for it, by design, because it is the
         same scene with the motion taken out. */
      if (motionLabel) {
        motionLabel.textContent = motion === 0
          ? (window.I18N ? window.I18N.t("background.motionStill", {}) : "Still")
          : `${Math.round(motion * 100)}%`;
        if (motionLabel.textContent === "background.motionStill") motionLabel.textContent = "Still";
      }
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

    /* ── Colour moods ───────────────────────────────────────────────
       Eleven that ship and as many as somebody cares to mix. A mood is three
       colours and a name — nothing else about a scene changes with it — which
       is why this is a row of chips and not a second theme studio. */
    const paletteGrid = document.getElementById("bg-palette-grid");
    const moodEditor = document.getElementById("bg-palette-editor");
    const moodColours = document.getElementById("bg-palette-colors");
    const moodName = document.getElementById("bg-palette-name");
    const moodBar = document.getElementById("bg-palette-preview");
    const moodError = document.getElementById("bg-palette-error");
    const moodNew = document.getElementById("bg-palette-new");
    const moodEdit = document.getElementById("bg-palette-edit");
    const moodRemove = document.getElementById("bg-palette-remove");
    const BUILT_IN_MOODS = [
      ["theme", "Theme", "background.paletteTheme"],
      ["polar", "Polar", "background.palettePolar"],
      ["violet", "Violet", "background.paletteViolet"],
      ["ember", "Ember", "background.paletteEmber"],
      ["mono", "Mono", "background.paletteMono"],
      ["twilight", "Twilight", "background.paletteTwilight"],
      ["patina", "Patina", "background.palettePatina"],
      ["tundra", "Tundra", "background.paletteTundra"],
      ["gilt", "Gilt", "background.paletteGilt"],
      ["sepia", "Sepia", "background.paletteSepia"],
      ["mars", "Mars", "background.paletteMars"],
      ["daylight", "Time of day", "background.paletteDaylight"]
    ];
    // Enough for anyone with a mood per season and a few spare; past this the
    // row stops being a row and the chips stop being findable.
    const MOOD_LIMIT = 12;
    let moodDraft = null;

    const say = (key, fallback, params) => {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    };
    const moods = () => (Array.isArray(this.app.config.bgPalettes) ? this.app.config.bgPalettes : []);
    const moodById = (id) => moods().find((mood) => mood && mood.id === id) || null;

    const moodChip = (id, label, i18nKey, colors) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "palette-chip";
      chip.dataset.palette = id;
      chip.setAttribute("role", "radio");
      const swatch = document.createElement("i");
      // The theme's swatch follows the theme in CSS; every other mood shows its own three colours.
      if (colors) swatch.style.background = `conic-gradient(from 215deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[0]})`;
      const text = document.createElement("span");
      if (i18nKey) text.dataset.i18n = i18nKey;
      text.textContent = i18nKey ? say(i18nKey, label) : label;
      chip.append(swatch, text);
      chip.addEventListener("click", () => chooseMood(id));
      return chip;
    };

    const paintPalette = () => {
      if (!paletteGrid) return;
      const selected = this.app.config.bgPalette || "theme";
      paletteGrid.replaceChildren();
      for (const [id, label, key] of BUILT_IN_MOODS) paletteGrid.append(moodChip(id, label, key, NORDLYS_BACKGROUND_PALETTES[id] || NORDLYS_DAYLIGHT_SWATCH[id]));
      for (const mood of moods()) {
        if (mood && mood.id) paletteGrid.append(moodChip(mood.id, mood.name || say("background.moodUntitled", "My mood"), null, mood.colors));
      }
      for (const chip of paletteGrid.querySelectorAll("[data-palette]")) {
        chip.setAttribute("aria-checked", String(chip.dataset.palette === selected));
      }
      const mine = Boolean(moodById(selected));
      if (moodEdit) moodEdit.hidden = !mine;
      if (moodRemove) moodRemove.hidden = !mine;
      // The theme's own mood is the theme already; any other can become one.
      const themeFrom = document.getElementById("bg-palette-theme");
      if (themeFrom) themeFrom.hidden = selected === "theme";
    };

    const commitMoods = () => {
      this.app.bgEngine?.setPalettes(moods());
      applyAtmosphere();
      paintPalette();
      this.app.saveConfig();
    };

    const chooseMood = (id) => {
      this.app.config.bgPalette = id;
      closeMoodEditor(false);
      applyAtmosphere();
      paintPalette();
      this.app.saveConfig();
    };

    const drawMoodDraft = () => {
      if (!moodDraft) return;
      const [one, two, three] = moodDraft.colors;
      if (moodBar) moodBar.style.background = `linear-gradient(100deg, ${one}, ${two} 52%, ${three})`;
      // The sky itself is the swatch: colours are tried on the real canvas
      // rather than on a rectangle that only resembles it.
      this.app.bgEngine?.previewPalette(moodDraft.colors);
    };

    const buildMoodColours = () => {
      if (!moodColours || !moodDraft) return;
      moodColours.replaceChildren();
      moodDraft.colors.forEach((value, index) => {
        const field = document.createElement("div");
        field.className = "palette-color";
        const label = say("background.moodColour", `Colour ${index + 1}`, { index: index + 1 });
        const well = document.createElement("input");
        well.type = "color";
        well.className = "color-well";
        well.value = value;
        well.setAttribute("aria-label", label);
        const hex = document.createElement("input");
        hex.type = "text";
        hex.className = "hex-text";
        hex.value = value;
        hex.maxLength = 7;
        hex.spellcheck = false;
        hex.autocomplete = "off";
        hex.setAttribute("aria-label", label);
        well.addEventListener("input", () => {
          moodDraft.colors[index] = well.value.toLowerCase();
          hex.value = moodDraft.colors[index];
          if (moodError) moodError.textContent = "";
          drawMoodDraft();
        });
        hex.addEventListener("input", () => {
          const typed = hex.value.trim().toLowerCase();
          if (!/^#[0-9a-f]{6}$/.test(typed)) return;
          moodDraft.colors[index] = typed;
          well.value = typed;
          if (moodError) moodError.textContent = "";
          drawMoodDraft();
        });
        field.append(well, hex);
        moodColours.append(field);
      });
    };

    /* Two harmonies of the first colour, and the three colours a stored
       wallpaper is mostly made of. All three only fill the draft: the sky shows
       it at once, and nothing is kept until Save. */
    const fillDraft = (colors) => {
      if (!moodDraft || !Array.isArray(colors) || colors.length !== 3) return;
      moodDraft.colors = colors.map((hex) => hex.toLowerCase());
      if (moodError) moodError.textContent = "";
      buildMoodColours();
      drawMoodDraft();
    };
    document.querySelectorAll("#bg-palette-editor [data-harmony]").forEach((button) => {
      button.addEventListener("click", () => fillDraft(window.NordlysColour?.harmony(moodDraft?.colors[0], button.dataset.harmony)));
    });
    const wallpaperButton = document.getElementById("bg-palette-wallpaper");
    const wallpaperPixels = async () => {
      const blob = await MediaVault.getMedia("custom_bg").catch(() => null);
      if (!blob || !String(blob.type || "").startsWith("image/")) return null;
      const bitmap = await createImageBitmap(blob).catch(() => null);
      if (!bitmap) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = Math.max(1, Math.round((64 * bitmap.height) / bitmap.width));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) pixels.push([data[i], data[i + 1], data[i + 2]]);
      return pixels;
    };
    wallpaperButton?.addEventListener("click", async () => {
      const pixels = await wallpaperPixels();
      if (pixels) fillDraft(window.NordlysColour?.paletteFromPixels(pixels));
    });
    const offerWallpaper = async () => {
      if (!wallpaperButton) return;
      const blob = await MediaVault.getMedia("custom_bg").catch(() => null);
      wallpaperButton.hidden = !blob || !String(blob.type || "").startsWith("image/");
    };

    const openMoodEditor = (mood) => {
      if (!moodEditor) return;
      offerWallpaper();
      /* A new mood starts from the one on screen rather than from three
         arbitrary colours: the first move is a nudge away from something the
         person already chose, which is a much easier first move. */
      const live = this.app.bgEngine?.palette;
      const from = mood ? mood.colors : (Array.isArray(live) && live.length === 3 ? live : ["#68e1d1", "#6ea8fe", "#9d8cff"]);
      moodDraft = {
        id: mood ? mood.id : `mood_${Date.now().toString(36)}`,
        colors: from.map((value) => String(value).toLowerCase())
      };
      if (moodName) moodName.value = mood ? (mood.name || "") : "";
      if (moodError) moodError.textContent = "";
      buildMoodColours();
      moodEditor.hidden = false;
      if (moodNew) moodNew.hidden = true;
      drawMoodDraft();
      moodName?.focus();
    };

    const closeMoodEditor = (restore = true) => {
      if (!moodEditor || moodEditor.hidden) return;
      moodDraft = null;
      moodEditor.hidden = true;
      if (moodNew) moodNew.hidden = false;
      if (moodError) moodError.textContent = "";
      // Whatever was actually chosen comes back; nothing was written.
      if (restore) this.app.bgEngine?.refreshPalette();
    };

    const saveMood = () => {
      if (!moodDraft) return;
      const colors = NordlysBackgroundEngine.paletteColors({ colors: moodDraft.colors });
      if (!colors) {
        if (moodError) moodError.textContent = say("background.moodBadColour", "Each colour needs a hex value such as #68e1d1.");
        return;
      }
      const list = moods().slice();
      const at = list.findIndex((mood) => mood && mood.id === moodDraft.id);
      if (at < 0 && list.length >= MOOD_LIMIT) {
        if (moodError) moodError.textContent = say("background.moodLimit", `You can keep ${MOOD_LIMIT} moods. Remove one to make another.`, { count: MOOD_LIMIT });
        return;
      }
      const saved = { id: moodDraft.id, name: (moodName?.value || "").trim() || say("background.moodUntitled", "My mood"), colors };
      if (at >= 0) list[at] = saved; else list.push(saved);
      this.app.config.bgPalettes = list;
      this.app.config.bgPalette = saved.id;
      closeMoodEditor(false);
      commitMoods();
      window.NordlysUI?.announce?.(say("background.moodSaved", `${saved.name} saved`, { name: saved.name }));
      paletteGrid?.querySelector(`[data-palette="${saved.id}"]`)?.focus();
    };

    /* Three colours are cheap to mix again, so removing one is done rather than
       asked about — and taken back with the same undo every other deletion in
       the product offers. */
    const removeMood = () => {
      const mood = moodById(this.app.config.bgPalette);
      if (!mood) return;
      const list = moods();
      const at = list.findIndex((entry) => entry && entry.id === mood.id);
      const snapshot = JSON.parse(JSON.stringify(mood));
      this.app.config.bgPalettes = list.filter((entry) => entry !== mood);
      this.app.config.bgPalette = "theme";
      closeMoodEditor(false);
      commitMoods();
      window.NordlysUI?.showUndoToast?.({
        message: say("background.moodRemoved", `${snapshot.name} removed`, { name: snapshot.name }),
        onAction: () => {
          const back = moods().slice();
          back.splice(Math.min(at < 0 ? back.length : at, back.length), 0, snapshot);
          this.app.config.bgPalettes = back;
          this.app.config.bgPalette = snapshot.id;
          commitMoods();
          window.NordlysUI?.announce?.(say("background.moodRestored", `${snapshot.name} restored`, { name: snapshot.name }));
        }
      });
    };

    moodNew?.addEventListener("click", () => openMoodEditor(null));
    moodEdit?.addEventListener("click", () => openMoodEditor(moodById(this.app.config.bgPalette)));
    moodRemove?.addEventListener("click", removeMood);
    document.getElementById("bg-palette-cancel")?.addEventListener("click", () => {
      closeMoodEditor();
      moodNew?.focus();
    });
    document.getElementById("bg-palette-save")?.addEventListener("click", saveMood);

    /* A mood can become a whole theme: the theme studio opens with its three
       base colours taken from the mood — a deep ground in the second colour's
       hue, cards a step up from it, the first colour as the accent — and the
       studio derives the rest and holds the text above AA as it always does.
       Nothing is kept until it is saved there. */
    document.getElementById("bg-palette-theme")?.addEventListener("click", () => {
      const colors = this.app.bgEngine?.palette;
      const C = window.NordlysColour;
      if (!colors || !C) return;
      const light = this.app.isLightTheme();
      const hue = C.toOklch(C.hexToRgb(colors[1]))[2];
      const base = {
        bg: C.rgbToHex(C.displayable(light ? 0.97 : 0.16, light ? 0.012 : 0.03, hue)),
        card: C.rgbToHex(C.displayable(light ? 0.995 : 0.22, light ? 0.008 : 0.038, hue)),
        accent: colors[0]
      };
      this.shell.select("appearance");
      const editor = document.getElementById("custom-theme-editor-card");
      if (editor && editor.style.display === "none") document.getElementById("btn-create-custom-theme")?.click();
      for (const [key, value] of Object.entries(base)) {
        const hex = document.getElementById(`thm-${key}-hex`);
        const well = document.getElementById(`thm-${key}-color`);
        if (well) well.value = value;
        if (hex) hex.value = value;
      }
      const name = document.getElementById("thm-name-input");
      const mood = moodById(this.app.config.bgPalette);
      if (name) name.value = mood?.name || document.querySelector(`[data-palette="${this.app.config.bgPalette}"] span`)?.textContent || "";
      // One input re-derives the other four and previews the whole theme.
      document.getElementById("thm-accent-hex")?.dispatchEvent(new Event("input", { bubbles: true }));
      editor?.scrollIntoView({ block: "nearest" });
    });

    /* The Time of day mood: what the sun is doing now in words, and a day
       played through in a few seconds so the mood shows what it does
       instead of promising it. */
    const daylightBlock = document.getElementById("bg-daylight");
    const daylightNow = document.getElementById("bg-daylight-now");
    const daylightPlay = document.getElementById("bg-daylight-play");
    // Spelled out so every phase's message key can be found by searching for it.
    const DAYLIGHT_WORDS = {
      night: ["daylight.night", "night"], dawn: ["daylight.dawn", "dawn"], sunrise: ["daylight.sunrise", "sunrise"],
      morning: ["daylight.morning", "morning"], afternoon: ["daylight.afternoon", "afternoon"],
      sunset: ["daylight.sunset", "sunset"], dusk: ["daylight.dusk", "dusk"]
    };
    const sayDaylight = (sky = this.app.bgEngine?.sky, clock = null) => {
      const on = this.app.config.bgPalette === "daylight";
      if (daylightBlock) daylightBlock.hidden = !on;
      if (!daylightNow) return;
      daylightNow.hidden = !on || !sky;
      if (!on || !sky) return;
      const [key, english] = DAYLIGHT_WORDS[sky.phase] || DAYLIGHT_WORDS.night;
      const phase = say(key, english);
      daylightNow.textContent = clock
        ? say("background.daylightAt", `${clock}: ${phase}`, { time: clock, phase })
        : say("background.daylightNow", `Now: ${phase}`, { phase });
    };
    sayDaylight();
    window.addEventListener("nordlys:palette", () => { if (!this.playingDay) sayDaylight(); });
    window.addEventListener("nordlys:languagechange", () => sayDaylight());
    /* Twenty-four hours in fourteen seconds, from now, on the real sky. With
       reduced motion the day goes by as seven held moments instead. */
    daylightPlay?.addEventListener("click", () => {
      const engine = this.app.bgEngine;
      if (!engine || this.playingDay) return;
      this.playingDay = true;
      daylightPlay.disabled = true;
      const clock = engine.now;
      const start = clock().getTime();
      const span = 24 * 3600000;
      // The hours as the clock on the page shows them, 12- or 24-hour.
      const time = new Intl.DateTimeFormat(window.I18N?.currentLang || undefined, { hour: "2-digit", minute: "2-digit", hourCycle: this.app.config.timeFormat === "12h" ? "h12" : "h23" });
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const show = (fraction) => {
        const moment = new Date(start + span * fraction);
        engine.now = () => moment;
        engine.followSun();
        sayDaylight(engine.sky, time.format(moment));
      };
      const finish = () => {
        engine.now = clock;
        engine.followSun();
        this.playingDay = false;
        daylightPlay.disabled = false;
        sayDaylight();
      };
      if (still) {
        let step = 0;
        const next = () => { if (step > 7) { finish(); return; } show(step / 7); step++; setTimeout(next, 1100); };
        next();
        return;
      }
      /* Every step regrades the sky and repaints the scene thumbnails beside
         the button, so the day is drawn about twenty-five times a second
         rather than at the display's full rate. */
      const began = performance.now();
      let drawn = -Infinity;
      const frame = (now) => {
        const fraction = Math.min(1, (now - began) / 14000);
        if (now - drawn >= 40 || fraction === 1) { drawn = now; show(fraction); }
        if (fraction < 1) requestAnimationFrame(frame); else finish();
      };
      requestAnimationFrame(frame);
    });
    sayDaylight();

    moodEditor?.addEventListener("keydown", (event) => {
      // The drawer closes on Escape too, and the editor is the nearer layer.
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMoodEditor();
        moodNew?.focus();
      } else if (event.key === "Enter" && event.target.tagName === "INPUT" && event.target.type !== "color") {
        event.preventDefault();
        saveMood();
      }
    });

    // The engine has to know the mixed moods before it is asked to wear one.
    this.app.bgEngine?.setPalettes(moods());
    /* Uploading a wallpaper or removing one sets the mode from code rather than
       from a card, and the picker has to follow: otherwise Wallpaper stays
       highlighted while Aurora is already running behind it. */
    this.syncScenePicker = () => { sky.sync(); paintPalette(); };

    applyAtmosphere();
    this.syncScenePicker();
  }

  /* ── 0. Typography slots ──────────────────────────────────────── */
  initTypography() {
    const DEVICE = "__device__";
    const SLOTS = [["display", "cfg-font-display"], ["interface", "cfg-font-interface"], ["mono", "cfg-font-mono"]];
    const note = document.getElementById("cfg-font-note");
    let device = [];
    const say = (key, fallback, params) => {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    };
    // typography.js names its groups in English; they are shown translated.
    const GROUPS = {
      "Recommended": () => say("typography.groupRecommended", "Recommended"),
      "Bundled with Nordlys": () => say("typography.groupBundled", "Bundled with Nordlys"),
      "Common system fonts": () => say("typography.groupSystem", "Common system fonts"),
      "Installed on this device": () => say("typography.groupDevice", "Installed on this device")
    };

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
            holder.label = GROUPS[row.group]?.() || row.group;
            select.append(holder);
          }
          const option = document.createElement("option");
          option.value = row.value;
          option.textContent = row.value === NordlysType.DEFAULT ? say("typography.default", "Default") : row.label;
          // Lets the themed list render each option in the face it offers.
          if (row.value !== NordlysType.DEFAULT) option.dataset.fontPreview = row.value;
          holder.append(option);
        }
        const more = document.createElement("option");
        more.value = DEVICE;
        more.textContent = device.length
          ? say("typography.refreshDevice", "Refresh device fonts…")
          : say("typography.allDevice", "All fonts on this device…");
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
              ? say("typography.deviceFound", `${device.length} fonts found on this device.`, { count: device.length })
              : say("typography.deviceRefused", "Device fonts are unavailable — permission was not granted.");
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
    window.addEventListener("nordlys:languagechange", fill);
  }

  /* ── 1. Resizable Drawer & Width Presets ──────────────────────── */
  initDrawerResizer() {
    const savedWidth = localStorage.getItem("nordlys_drawer_width");
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
        // Same bounds the stylesheet enforces, so the handle never travels
        // through a range where min-width is quietly discarding the result.
        const newWidth = Math.max(600, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.95));
        this.drawer.style.width = `${newWidth}px`;
      }, { passive: true });

      window.addEventListener("pointerup", () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        this.resizer.classList.remove("dragging");
        localStorage.setItem("nordlys_drawer_width", this.drawer.style.width);
      });
    }

  }

  /* ── Share this look ─────────────────────────────────────────────
     Copy writes the look as a line of text; Try puts a pasted one on the page
     without saving anything, and the person keeps it or puts theirs back. A
     look left undecided when the panel closes is put back: nothing is written
     that nobody chose. */
  initLookShare() {
    const Look = window.NordlysLook;
    const status = document.getElementById("look-status");
    const field = document.getElementById("look-paste");
    const decide = document.getElementById("look-decide");
    if (!Look || !status || !field || !decide) return;
    const say = (key, fallback) => {
      const value = window.I18N?.t(key);
      return value && value !== key ? value : fallback;
    };
    const tell = (key, fallback, refused = false) => {
      status.textContent = say(key, fallback);
      status.classList.toggle("refused", refused);
      window.NordlysUI?.announce?.(status.textContent);
    };

    document.getElementById("look-copy")?.addEventListener("click", async () => {
      const code = Look.encode(Look.capture(this.app.config));
      try {
        await navigator.clipboard.writeText(code);
        tell("look.copied", "Copied. Paste it anywhere to share it.");
      } catch {
        // No clipboard here: hand the line over to be copied by hand.
        field.value = code;
        field.select();
        tell("look.copyManually", "Copy the line in the field below.");
      }
    });

    document.getElementById("look-try")?.addEventListener("click", () => {
      const { look, error } = Look.decode(field.value);
      if (error) {
        const reasons = { notALook: ["look.notALook", "That isn't a Nordlys look."], damaged: ["look.damaged", "That look is damaged — part of it is missing."], empty: ["look.empty", "That look has nothing in it this version can use."] };
        tell(...reasons[error], true);
        return;
      }
      if (!this.lookTrial) this.lookTrial = this.lookSnapshot();
      const knownTheme = look.theme === "custom" || Boolean(document.querySelector(`.theme-card[data-theme="${CSS.escape(look.theme || "")}"]`));
      this.wearLook(look, knownTheme);
      decide.hidden = false;
      status.textContent = "";
      if (look.theme && !knownTheme) tell("look.unknownTheme", "That look's theme isn't in this version, so yours was kept.");
    });

    document.getElementById("look-keep")?.addEventListener("click", () => {
      this.lookTrial = null;
      decide.hidden = true;
      this.app.saveConfig();
      field.value = "";
      tell("look.kept", "This look is yours now.");
    });
    document.getElementById("look-revert")?.addEventListener("click", () => {
      this.revertLook();
      tell("look.reverted", "Your own look is back.");
    });

    document.getElementById("look-picture")?.addEventListener("click", async () => {
      const blob = await this.lookPicture();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: "nordlys-look.png" });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      tell("look.pictureSaved", "Picture saved.");
    });
  }

  // Put a look on the page, in memory only.
  wearLook(look, knownTheme = true) {
    const config = this.app.config;
    for (const key of LOOK_SETTINGS) {
      if (key in look) config[key] = look[key];
    }
    if (look.fonts) config.fonts = { ...(config.fonts || {}), ...look.fonts };
    if (look.theme === "custom" && look.customTheme) {
      config.theme = "custom";
      config.customTheme = look.customTheme;
    } else if (look.theme && knownTheme) {
      config.theme = look.theme;
      delete config.customTheme;
    }
    if (look.mood) {
      // A shared mood arrives as a mood of its own, or as the one already here.
      const moods = Array.isArray(config.bgPalettes) ? config.bgPalettes : (config.bgPalettes = []);
      const same = moods.find((mood) => mood && JSON.stringify(mood.colors) === JSON.stringify(look.mood.colors));
      const mood = same || { id: `shared-${look.mood.colors.join("").replace(/#/g, "")}`, name: look.mood.name, colors: look.mood.colors };
      if (!same) moods.push(mood);
      config.bgPalette = mood.id;
    } else if (look.bgPalette === "theme" || Object.prototype.hasOwnProperty.call(NORDLYS_BACKGROUND_PALETTES, look.bgPalette)) {
      config.bgPalette = look.bgPalette;
    }
    this.refreshLookEverywhere();
  }

  /* What trying a look on can change, and so all that Revert puts back. The
     whole config used to be kept and restored, so a bookmark added while a
     look was being tried — or saved by another tab — went back with it. */
  lookSnapshot() {
    const config = this.app.config;
    const keys = [...LOOK_SETTINGS, "fonts", "theme", "customTheme", "bgPalette", "bgPalettes"];
    return JSON.stringify(Object.fromEntries(keys.map((key) => [key, config[key] === undefined ? null : config[key]])));
  }

  revertLook() {
    if (!this.lookTrial) return;
    const kept = JSON.parse(this.lookTrial);
    for (const [key, value] of Object.entries(kept)) {
      if (value === null) delete this.app.config[key];
      else this.app.config[key] = value;
    }
    this.lookTrial = null;
    document.getElementById("look-decide").hidden = true;
    // Anything saved during the trial was saved wearing the look.
    this.app.saveConfig();
    this.refreshLookEverywhere();
  }

  refreshLookEverywhere() {
    this.app.applyThemeTokens();
    this.app.applyGeometryTokens();
    this.app.applyGlassLevel();
    this.app.applyLegibility();
    this.app.updateBackgroundMode();
    this.app.grid?.render();
    this.renderThemeCards();
    this.syncFormValues();
  }

  /* A picture of the look, 1200 by 630: the sky, painted by the scene itself,
     and a glass card naming the theme, the sky, the mood and the faces. */
  async lookPicture() {
    const engine = this.app.bgEngine;
    const config = this.app.config;
    const width = 1200, height = 630;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const root = getComputedStyle(document.documentElement);
    const token = (name, fallback) => root.getPropertyValue(name).trim() || fallback;
    ctx.fillStyle = token("--void", "#060a14");
    ctx.fillRect(0, 0, width, height);
    const scene = NORDLYS_GENERATIVE_SCENES.has(config.bgMode) ? config.bgMode : null;
    if (engine && scene) {
      const sky = document.createElement("canvas");
      if (engine.paintStill(sky, scene, { width, height, dpr: 1, zoom: 1 })) ctx.drawImage(sky, 0, 0, width, height);
    }
    await document.fonts.ready;
    const display = token("--font-display", "sans-serif");
    const body = token("--font-main", "sans-serif");
    const ink = token("--ink", "#e9effb");
    const dim = token("--dim", "#a7b5d0");
    // The card: the theme's own glass colour, solid enough to read on any sky.
    const x = 56, y = height - 56 - 250, w = 560, h = 250, r = 28;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = token("--card-tint-deep", "#070d18");
    ctx.globalAlpha = 0.82;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = token("--accent", "#35d6c0");
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    const themeName = config.theme === "custom" ? say("theme.custom", "My theme") : (document.querySelector(`.theme-card[data-theme="${CSS.escape(config.theme || "")}"] b`)?.textContent || config.theme);
    function say(key, fallback) {
      const value = window.I18N?.t(key);
      return value && value !== key ? value : fallback;
    }
    const sceneName = scene ? (document.querySelector(`.scene-card[data-scene="${scene}"] .scene-name`)?.textContent || scene) : "";
    const mood = (config.bgPalettes || []).find((entry) => entry && entry.id === config.bgPalette);
    const moodName = mood?.name || document.querySelector(`[data-palette="${CSS.escape(config.bgPalette || "theme")}"] span`)?.textContent || "";
    ctx.fillStyle = ink;
    ctx.font = `600 48px ${display}`;
    ctx.fillText(themeName, x + 36, y + 76, w - 72);
    ctx.fillStyle = dim;
    ctx.font = `500 26px ${body}`;
    ctx.fillText([sceneName, moodName].filter(Boolean).join("  ·  "), x + 36, y + 122, w - 72);
    (engine?.palette || []).forEach((hex, index) => {
      ctx.beginPath();
      ctx.arc(x + 52 + index * 44, y + 170, 15, 0, Math.PI * 2);
      ctx.fillStyle = hex;
      ctx.fill();
    });
    const fonts = config.fonts || {};
    const faces = [fonts.display, fonts.interface].map((family) => (family && family !== "default" ? family : null));
    ctx.fillStyle = dim;
    ctx.font = `400 20px ${body}`;
    ctx.fillText(faces.map((family, index) => family || ["Outfit", "Instrument Sans"][index]).join("  /  "), x + 36, y + 222, w - 72);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.72;
    ctx.font = `600 22px ${display}`;
    ctx.textAlign = "right";
    ctx.fillText("Nordlys", width - 48, 60);
    ctx.globalAlpha = 1;
    return new Promise((done) => canvas.toBlob(done, "image/png"));
  }

  open(targetTab = null, opener = null) {
    this.syncFormValues();
    this.renderBookmarksManager();
    this.renderAppearancePreview();
    const mapped = targetTab ? this.mapTab(targetTab) : null;
    this.shell.open(mapped, opener);
  }

  /* The Appearance preview shows the person's own first bookmarks, so a change
     of shape, size or glow is judged on the tiles it is about to change. It
     used to be one invented tile called "Nordlys Studio", which read as a
     feature rather than a preview. The copies are inert — a preview is not a
     link — and an empty board keeps the single sample. */
  renderAppearancePreview() {
    const card = document.querySelector("#appearance-shared-preview .appearance-preview-card");
    if (!card) return;
    if (!this.appearanceSample) this.appearanceSample = [...card.childNodes].map((node) => node.cloneNode(true));
    const tiles = [...document.querySelectorAll("#board .card .tile")].slice(0, 3);
    if (!tiles.length) {
      card.replaceChildren(...this.appearanceSample.map((node) => node.cloneNode(true)));
      return;
    }
    const row = document.createElement("div");
    row.className = "appearance-preview-row";
    const SKIP = new Set(["href", "id", "tabindex", "draggable", "role", "target", "rel", "data-shortcut"]);
    for (const tile of tiles) {
      const copy = document.createElement("div");
      for (const { name, value } of tile.attributes) {
        if (!SKIP.has(name) && !name.startsWith("aria-")) copy.setAttribute(name, value);
      }
      copy.append(...[...tile.childNodes].map((node) => node.cloneNode(true)));
      copy.setAttribute("aria-hidden", "true");
      row.append(copy);
    }
    card.replaceChildren(row);
  }

  openDrawer(targetTab = null) {
    this.open(targetTab);
  }

  /* The board's empty state offers the same import the Backup tab does, and
     asks for it here rather than reaching across a closed drawer to click a
     hidden file input: one owner for the flow, one parser, and nothing that
     breaks the next time the markup moves.

     The drawer is opened on Backup first, so cancelling the file dialog leaves
     the user where importing lives instead of back on an empty board. The
     picker is raised synchronously, inside the gesture that asked for it —
     browsers refuse a file dialog that arrives after an await. */
  openImportPicker(opener = null) {
    const input = document.getElementById("cfg-import-universal");
    if (!input) return false;
    this.open("backup", opener);
    input.click();
    return true;
  }

  close() {
    this.shell.close();
  }

  mapTab(targetTab) {
    const tabMap = { "themes":"appearance", "theme":"appearance", "appearance":"appearance", "shaders":"background", "background":"background", "custom-theme":"appearance", "general":"general", "bookmarks":"bookmarks", "dashboard":"dashboard", "custom-css":"appearance", "backup":"backup" };
    return tabMap[targetTab] || targetTab;
  }

  switchTab(targetTab) {
    if (!targetTab) return;
    const key = this.mapTab(targetTab);
    // Custom CSS lives at the foot of Appearance now: asked for by name, it is opened.
    if (targetTab === "custom-css") { const block = document.getElementById("custom-css-block"); if (block) block.open = true; }
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
    const switcher = document.getElementById("color-mode-switcher");
    window.NordlysUI?.trackThumb(switcher, switcher?.querySelector(".mode-btn.active"));
  }

  syncFormValues() {
    const cfg = this.app.config;
    this.syncBoardLayout();
    this.syncPageLayout();
    this.syncSearchSources();
    this.syncGolinks();

    // Color Mode
    this.syncColorModeSwitcher();

    // User Name & General
    const userName = document.getElementById("cfg-user-name");
    const timeFormat = document.getElementById("cfg-time-format");
    const showSeconds = document.getElementById("cfg-show-seconds");
    const openNewTab = document.getElementById("cfg-open-newtab");
    const languageSelect = document.getElementById("cfg-language-select");

    if (languageSelect) languageSelect.value = cfg.language || "en";
    if (userName) userName.value = cfg.userName || "";
    if (timeFormat) timeFormat.value = cfg.timeFormat || "24h";
    const headerStyle = document.getElementById("cfg-header-style");
    if (headerStyle) headerStyle.value = cfg.headerStyle || "full";
    if (showSeconds) showSeconds.checked = !!cfg.showSeconds;
    if (openNewTab) openNewTab.checked = !!cfg.openNewTab;
    const showSearch = document.getElementById("cfg-show-search");
    if (showSearch) showSearch.checked = cfg.showSearch !== false;
    const shortcutHints = document.getElementById("cfg-shortcut-hints");
    if (shortcutHints) shortcutHints.checked = cfg.shortcutHints !== false;
    const rememberSearches = document.getElementById("cfg-remember-searches");
    if (rememberSearches) rememberSearches.checked = cfg.rememberSearches !== false;
    const suggestUsual = document.getElementById("cfg-suggest-usual");
    if (suggestUsual) suggestUsual.checked = cfg.suggestUsual !== false;

    // Aesthetics Sliders & Selects
    const glassLevel = document.getElementById("cfg-glass-level");
    const cardRadius = document.getElementById("cfg-card-radius");
    const tileSize = document.getElementById("cfg-tile-size");
    const cardGap = document.getElementById("cfg-card-gap");
    const iconShape = document.getElementById("cfg-icon-shape");

    if (glassLevel) glassLevel.value = cfg.glassLevel || "full";
    const highLegibility = document.getElementById("cfg-high-legibility");
    if (highLegibility) highLegibility.checked = Boolean(cfg.highLegibility);
    if (cardRadius) cardRadius.value = cfg.cardRadius != null ? cfg.cardRadius : 18;
    if (tileSize) tileSize.value = cfg.tileSize != null ? cfg.tileSize : 78;
    if (cardGap) cardGap.value = cfg.cardGap != null ? cfg.cardGap : 12;
    if (iconShape) iconShape.value = cfg.iconShape || "squircle";
    const cornerShape = document.getElementById("cfg-corner-shape");
    if (cornerShape) cornerShape.value = cfg.cornerShape === "smooth" ? "smooth" : "round";
    // Smooth corners need CSS corner-shape (Chrome and Edge); elsewhere the
    // choice would change nothing, so it isn't offered.
    if (cornerShape && typeof CSS !== "undefined" && !CSS.supports("corner-shape: squircle")) cornerShape.closest(".row")?.setAttribute("hidden", "");

    this.updateSliderLabels();
    this.syncBackgroundControls?.();
    // syncFormValues writes select.value directly, which fires no event.
    window.NordlysUI?.refreshSelects();
  }

  /* The Appearance sliders for the measures Arrange can change too. */
  syncGeometry() {
    const cfg = this.app.config;
    const tile = document.getElementById("cfg-tile-size");
    const gap = document.getElementById("cfg-card-gap");
    if (tile) tile.value = String(cfg.tileSize ?? 78);
    if (gap) gap.value = String(cfg.cardGap ?? 12);
    this.updateSliderLabels();
  }

  updateSliderLabels() {
    const cfg = this.app.config;
    const lblRadius = document.getElementById("lbl-radius");
    const lblTile = document.getElementById("lbl-tile");
    const lblGap = document.getElementById("lbl-gap");
    const lblBgBlur = document.getElementById("lbl-bgblur");
    const lblBgDim = document.getElementById("lbl-bgdim");

    if (lblRadius) lblRadius.textContent = `${cfg.cardRadius != null ? cfg.cardRadius : 18}px`;
    if (lblTile) lblTile.textContent = `${cfg.tileSize != null ? cfg.tileSize : 78}px`;
    if (lblGap) lblGap.textContent = `${cfg.cardGap != null ? cfg.cardGap : 12}px`;
    if (lblBgBlur) lblBgBlur.textContent = `${cfg.bgBlur != null ? cfg.bgBlur : 0}px`;
    if (lblBgDim) lblBgDim.textContent = `${cfg.bgDim != null ? cfg.bgDim : 0}%`;
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
    this.roveRadios([...document.querySelectorAll(".page-layout-option")], (option) => this.setPageLayout(option.dataset.pageLayout));
    this.syncPageLayout();

    // Close Custom Theme Studio button (also reverts any unsaved live preview)
    const closeEditorBtn = document.getElementById("close-custom-theme-editor");
    closeEditorBtn?.addEventListener("click", () => {
      const editor = document.getElementById("custom-theme-editor-card");
      if (editor) editor.style.display = "none";
      this.app.applyThemeTokens();
    });

    // Glass Sliders
    const glassLevel = document.getElementById("cfg-glass-level");





    // Geometry & Layout controls
    const cardRadius = document.getElementById("cfg-card-radius");
    const tileSize = document.getElementById("cfg-tile-size");
    const cardGap = document.getElementById("cfg-card-gap");
    const iconShape = document.getElementById("cfg-icon-shape");

    /* Three levels of one material, rather than four raw filter knobs. The
       knobs were a decision nobody made, handed to the user in the form the
       renderer happens to take, and they reached states where text stopped
       being readable. */
    glassLevel?.addEventListener("change", (e) => {
      this.app.config.glassLevel = e.target.value;
      this.app.applyGlassLevel();
      this.app.saveConfig();
      });

    document.getElementById("cfg-high-legibility")?.addEventListener("change", (e) => {
      this.app.config.highLegibility = e.target.checked;
      this.app.applyLegibility();
      this.app.updateBackgroundMode();
      this.app.saveConfig();
    });

    cardRadius?.addEventListener("input", (e) => {
      const val = `${e.target.value}px`;
      document.documentElement.style.setProperty("--card-radius", val);
      this.app.config.cardRadius = parseInt(e.target.value, 10);
      this.updateSliderLabels();
      });
    /* A slider is drawn on every step and saved once, when it is let go: the
       config is written whole — megabytes, with icons in it — and every other
       open tab takes each write. */
    for (const slider of [cardRadius, tileSize, cardGap]) slider?.addEventListener("change", () => this.app.saveConfig());

    /* Both go through applyGeometryTokens, the one place the page turns these
       settings into CSS — the slider used to write its own, different rule —
       and both change folder widths, so the rows are broken again. */
    tileSize?.addEventListener("input", (e) => {
      this.app.config.tileSize = parseInt(e.target.value, 10);
      this.app.applyGeometryTokens();
      this.updateSliderLabels();
      this.app.grid?.relayout();
    });

    cardGap?.addEventListener("input", (e) => {
      this.app.config.cardGap = parseInt(e.target.value, 10);
      this.app.applyGeometryTokens();
      this.updateSliderLabels();
      this.app.grid?.relayout();
    });

    document.getElementById("cfg-corner-shape")?.addEventListener("change", (e) => {
      this.app.config.cornerShape = e.target.value === "smooth" ? "smooth" : "round";
      document.documentElement.dataset.corners = this.app.config.cornerShape;
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
          <button class="del-custom-thm-btn" title="${esc(window.I18N?.t("customTheme.delete") || "Delete this theme")}" aria-label="${esc(window.I18N?.t("customTheme.deleteNamed", { name: t.name }) || `Delete ${t.name}`)}">✕</button>
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
      const newThemeText = window.I18N ? window.I18N.t('appearance.newTheme') : 'New theme';
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
      const raw = localStorage.getItem("nordlys_custom_themes");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((theme) => window.NordlysConfigSchema?.isStudioTheme(theme) !== false) : [];
    } catch {
      return [];
    }
  }

  saveCustomThemes() {
    localStorage.setItem("nordlys_custom_themes", JSON.stringify(this.customThemes));
  }

  initCustomThemeBuilder() {
    /* Read the whole studio form into a theme object */
    // A half-typed hex in a text field gives way to its colour well, which always holds a colour.
    const studioColour = (name, fallback) => {
      const typed = document.getElementById(`thm-${name}-hex`)?.value || "";
      return /^#[0-9a-f]{6}$/i.test(typed) ? typed : document.getElementById(`thm-${name}-color`)?.value || fallback;
    };
    const readStudioTheme = () => ({
      bg: studioColour("bg", "#0a0f1d"),
      card: studioColour("card", "#111c35"),
      border: studioColour("border", "#2a3f6d"),
      accent: studioColour("accent", "#35d6c0"),
      glow: studioColour("glow", "#5b6cff"),
      text: studioColour("text", "#f1f5f9"),
      dim: studioColour("dim", "#8ca0c4")
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

    /* Seven colour wells asked for a designer before they would give you a
       theme, and the one with an actual correctness requirement — text you can
       read on the background you picked — was left to taste like the rest.
       Three colours carry the idea; the other four follow, and the text pair is
       pushed until it clears WCAG AA rather than merely looking plausible. */
    const toRgb = (hex) => {
      const match = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!match) return [0, 0, 0];
      const value = parseInt(match[1], 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    };
    const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
    const channel = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const luminance = ([r, g, b]) => 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
    const ratio = (a, b) => {
      const la = luminance(a), lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

    /* Text has to be readable on the page and on the cards, which the user
       chooses separately. Walking from a starting colour towards white or black
       cannot solve that: when the two surfaces straddle the middle — a dark page
       with light cards — the best answer is neither extreme but a mid tone, and
       against pure black and pure white even the optimum only reaches 4.58:1.
       So the whole greyscale is searched and the worst of the two surfaces is
       what counts. */
    const RAMP = Array.from({ length: 33 }, (unused, step) => {
      const value = Math.round((step / 32) * 255);
      return [value, value, value];
    });
    const worstAgainst = (colour, surfaces) => Math.min(...surfaces.map((surface) => ratio(colour, surface)));

    const pickInk = (surfaces, target, wantLight, subdued) => {
      const qualifying = RAMP.filter((candidate) => worstAgainst(candidate, surfaces) >= target);
      if (!qualifying.length) {
        // No colour serves both surfaces. Return the best available and let the
        // contrast warning say so rather than shipping a quiet failure.
        return RAMP.reduce((best, candidate) =>
          worstAgainst(candidate, surfaces) > worstAgainst(best, surfaces) ? candidate : best);
      }
      /* Primary text takes the end of the qualifying range that suits the theme,
         so a dark theme still reads light. Subdued text takes the qualifying
         colour closest to the bar, which is what makes it subdued while keeping
         it above AA rather than at the 3:1 meant for large text. */
      if (subdued) {
        return qualifying.reduce((best, candidate) =>
          worstAgainst(candidate, surfaces) < worstAgainst(best, surfaces) ? candidate : best);
      }
      return wantLight ? qualifying[qualifying.length - 1] : qualifying[0];
    };

    const deriveTheme = () => {
      const bg = toRgb(document.getElementById("thm-bg-hex")?.value || "#0a0f1d");
      const card = toRgb(document.getElementById("thm-card-hex")?.value || "#111c35");
      const accent = toRgb(document.getElementById("thm-accent-hex")?.value || "#35d6c0");
      const surfaces = [bg, card];
      const wantLight = (luminance(bg) + luminance(card)) / 2 < 0.4;

      const text = pickInk(surfaces, 4.5, wantLight, false);
      const dim = pickInk(surfaces, 4.5, wantLight, true);
      // A border is a boundary, not text: 3:1 is the bar that applies to it.
      const border = mix(card, wantLight ? [255, 255, 255] : [0, 0, 0], wantLight ? 0.16 : 0.24);

      return { border: toHex(border), glow: toHex(accent), text: toHex(text), dim: toHex(dim) };
    };

    const applyDerived = () => {
      const derived = deriveTheme();
      for (const [key, value] of Object.entries(derived)) {
        const hex = document.getElementById(`thm-${key}-hex`);
        const well = document.getElementById(`thm-${key}-color`);
        if (hex) hex.value = value;
        if (well) well.value = value;
      }
      livePreview();
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
    bindColorPair("thm-accent-color", "thm-accent-hex");
    bindColorPair("thm-border-color", "thm-border-hex");
    bindColorPair("thm-glow-color", "thm-glow-hex");
    bindColorPair("thm-text-color", "thm-text-hex");
    bindColorPair("thm-dim-color", "thm-dim-hex");

    /* Changing one of the three re-derives the four. An edit made inside
       Fine-tune stands until a base colour moves again, which is the moment it
       stopped describing that base. */
    for (const id of ["thm-bg-hex", "thm-card-hex", "thm-accent-hex", "thm-bg-color", "thm-card-color", "thm-accent-color"]) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        if (event.target.type === "text" && !/^#[0-9A-F]{6}$/i.test(event.target.value)) return;
        applyDerived();
      });
    }

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
    this.initSearchSources();
    this.initGolinks();
    const languageSelect = document.getElementById("cfg-language-select");
    const userName = document.getElementById("cfg-user-name");
    const timeFormat = document.getElementById("cfg-time-format");
    const showSeconds = document.getElementById("cfg-show-seconds");
    const openNewTab = document.getElementById("cfg-open-newtab");
    if (languageSelect) languageSelect.value = this.app.config.language || "en";

    /* A browser with no search API of its own (Safari) asks which engine the
       box should use. Chrome, Edge and Firefox use the one set in the browser. */
    const engineRow = document.getElementById("cfg-search-engine-row");
    const engine = document.getElementById("cfg-search-engine");
    const noSearchApi = !(typeof chrome !== "undefined" && chrome.search);
    if (engineRow && engine && noSearchApi && window.NordlysPlatform) {
      engineRow.hidden = false;
      for (const [key, e] of Object.entries(window.NordlysPlatform.ENGINES)) engine.append(Object.assign(document.createElement("option"), { value: key, textContent: e.name }));
      engine.value = this.app.config.searchEngine || "";
      engine.addEventListener("change", () => { this.app.config.searchEngine = engine.value || undefined; this.app.saveConfig(); });
    }
    // Without the browser's icon cache, its chip has nothing to show.
    if (window.NordlysPlatform?.faviconCache === false) {
      document.querySelector('[data-fav-source="chrome"]')?.setAttribute("hidden", "");
      document.querySelector('[data-fav-source="chrome"]')?.classList.remove("active");
      document.querySelector('[data-fav-source="duckduckgo"]')?.classList.add("active");
    }

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

    timeFormat?.addEventListener("change", (e) => {
      this.app.config.timeFormat = e.target.value;
      this.app.saveConfig();
      this.app.widgets?.updateClock();
    });

    document.getElementById("cfg-header-style")?.addEventListener("change", (e) => {
      this.app.config.headerStyle = e.target.value;
      this.app.applyHeaderStyle();
      this.app.saveConfig();
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

    document.getElementById("cfg-show-search")?.addEventListener("change", (e) => {
      this.app.config.showSearch = e.target.checked;
      this.app.saveConfig();
      this.app.applyHeaderStyle();
    });

    document.getElementById("cfg-shortcut-hints")?.addEventListener("change", (e) => {
      this.app.config.shortcutHints = e.target.checked;
      this.app.saveConfig();
    });

    document.getElementById("cfg-remember-searches")?.addEventListener("change", (e) => {
      this.app.config.rememberSearches = e.target.checked;
      // Off means forgotten, not just hidden.
      if (!e.target.checked) { try { localStorage.removeItem("nordlys_search_history"); } catch (error) { /* nothing kept */ } }
      this.app.saveConfig();
    });

    document.getElementById("cfg-suggest-usual")?.addEventListener("change", (e) => {
      this.app.config.suggestUsual = e.target.checked;
      // Off means forgotten here too: what was opened when.
      if (!e.target.checked) { try { localStorage.removeItem("nordlys_rhythm"); } catch (error) { /* nothing kept */ } }
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
         Keying off the mode alone offered "Remove wallpaper" with nothing to
         remove, on a fresh profile that had never uploaded anything. */
      this.syncScenePicker?.();
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
      if (lblBlur) lblBlur.textContent = `${this.app.config.bgBlur}px`;
    });

    dimSlider?.addEventListener("input", (e) => {
      this.app.config.bgDim = parseInt(e.target.value, 10) || 0;
      this.app.applyWallpaperEffects();
      if (lblDim) lblDim.textContent = `${this.app.config.bgDim}%`;
    });
    for (const slider of [blurSlider, dimSlider]) slider?.addEventListener("change", () => this.app.saveConfig());

    customMedia?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return;

      if (fileLabel) fileLabel.textContent = file.name;

      // A loop larger than this is more than a new tab should read each time.
      if (file.type.startsWith("video/") && file.size > 200 * 1024 * 1024) {
        if (typeof toast === "function") toast(this.text("toast.videoTooLarge", "That video is over 200 MB. A shorter or smaller loop works better as a wallpaper."), "danger", 6000);
        return;
      }

      try {
        const kept = file.type.startsWith("image/") ? await this.fitWallpaper(file) : file;
        await MediaVault.saveMedia("custom_bg", kept, kept.type);
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
  /* The board's layout and rows, mirrored here from the arrangement that owns
     them, and the door into it. */
  initBoardLayout() {
    this.roveRadios([...document.querySelectorAll(".board-layout-option:not(.page-layout-option)")], (option) => {
      this.app.grid?.arrange?.setLayout(option.dataset.layout);
      this.syncBoardLayout();
    });
    document.getElementById("cfg-arrange")?.addEventListener("click", () => {
      this.close();
      this.app.grid?.arrange?.enter();
    });
    // Size and spacing live where the board is arranged, with the board as
    // their preview; this goes straight there.
    document.getElementById("cfg-size")?.addEventListener("click", () => {
      this.close();
      const arrange = this.app.grid?.arrange;
      arrange?.enter();
      if (arrange?.active) arrange.showSize(true);
    });
    document.getElementById("board-rows-auto")?.addEventListener("click", () => {
      this.app.grid?.arrange?.autoRows();
      this.syncBoardLayout();
    });
    /* One page fit has two switches, this one and the one on the page
       (#fit-toggle), and one saved value between them. */
    document.getElementById("cfg-one-page-fit")?.addEventListener("change", (event) => this.setPageFit(event.target.checked));
    this.initFitStar(document.getElementById("fit-toggle"));
    window.addEventListener("nordlys:pagefit", () => this.syncPageFit());
    window.addEventListener("nordlys:languagechange", () => this.syncBoardLayout());
    this.syncBoardLayout();
  }

  /* The switch on the page, which rests as a star until a pointer or the
     keyboard comes to it (components.css). A touch has no hover to unfold it,
     so there the first tap only opens the star and the next one works the
     switch; it folds again a few seconds later, or at a tap anywhere else. And
     it glints once as the page opens, so the eye finds it (glintStar). */
  initFitStar(quick) {
    if (!quick) return;
    // The tap that opened the star, whose click must not work the switch; only for as long as a tap takes.
    let opening = 0;
    let fold = null;
    const close = () => {
      clearTimeout(fold);
      quick.classList.remove("is-open");
    };
    quick.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || quick.classList.contains("is-open")) return;
      opening = performance.now();
      quick.classList.add("is-open");
      clearTimeout(fold);
      fold = setTimeout(close, 5000);
    });
    quick.addEventListener("click", () => {
      const fresh = opening && performance.now() - opening < 800;
      opening = 0;
      if (fresh) return;
      this.setPageFit(this.app.config.onePageFit !== true);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!quick.contains(event.target)) close();
    }, { passive: true });
    // Found, it needs no glint: one still playing stops where the pointer or the keyboard arrives.
    const found = () => quick.classList.remove("glint");
    quick.addEventListener("pointerenter", found);
    quick.addEventListener("focus", found);
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTimeout(() => this.glintStar(), 1200);
    }
  }

  /* Only for a star nobody has found yet. A glint over the open switch would
     draw the star on top of its knob, and a pointer or the keyboard already on
     it has found it. */
  glintStar() {
    const quick = document.getElementById("fit-toggle");
    if (!quick || quick.matches(":hover, :focus-visible, .is-open")) return;
    quick.addEventListener("animationend", () => quick.classList.remove("glint"), { once: true });
    quick.classList.add("glint");
  }

  /* The switch is saved; what the fit works out never is. The state line
     describes the switch, so it is read whenever the switch is; it is spoken
     once, here, when somebody turns the fit on, and never again as a window
     is dragged and the percentage follows it. */
  setPageFit(on) {
    this.app.config.onePageFit = on === true;
    this.app.saveConfig();
    this.app.pageFit?.request({ now: true });
    this.syncPageFit();
    const words = on === true ? document.getElementById("page-fit-state")?.textContent : "";
    if (words) NordlysUI.announce(words);
  }

  /* Both switches, and a line under the drawer's saying what the fit is doing
     for this window right now — so a board shown at a third of its size says
     so where the way back to the ordinary page is. The switch on the page
     says the same as its description, or what it would do while it is off. */
  syncPageFit() {
    const on = this.app.config.onePageFit === true;
    const input = document.getElementById("cfg-one-page-fit");
    if (input) input.checked = on;
    const state = document.getElementById("page-fit-state");
    const quick = document.getElementById("fit-toggle");
    const quickState = document.getElementById("fit-toggle-state");
    const say = (key, fallback, params) => {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    };
    const fit = this.app.pageFit?.state;
    let words = "";
    if (on && fit) {
      if (this.app.pageFit.suspended.size) words = say("bookmarks.onePageFitPaused", "Paused while you arrange the board.");
      else if (fit.stage === "natural") words = say("bookmarks.onePageFitNatural", "Everything fits this window as it is.");
      else if (fit.stage === "compact") words = say("bookmarks.onePageFitCompact", "Spacing and bookmarks are closed up to fit this window.");
      else if (fit.stage === "scaled") {
        const percent = Math.round(fit.zoom * 100);
        words = say("bookmarks.onePageFitScaled", `Shown at ${percent}% to fit this window.`, { percent });
      }
    }
    if (state) {
      if (state.textContent !== words) state.textContent = words;
      state.hidden = !words;
    }
    if (quick) {
      const checked = String(on);
      if (quick.getAttribute("aria-checked") !== checked) quick.setAttribute("aria-checked", checked);
      const hint = words || say("bookmarks.onePageFitHint", "Keeps the clock, the search and every folder in the window, with nothing to scroll.");
      if (quick.title !== hint) quick.title = hint;
      if (quickState && quickState.textContent !== hint) quickState.textContent = hint;
    }
  }

  /* General → The search box also finds. Turning a source on asks the
     browser for its leave there and then, while the click still counts as
     the person's; refused, the switch goes back off. Chrome puts a list on
     the page only once its leave is given, so a switch is offered by what
     this build may ask for: Safari's cannot ask for the bookmarks or the
     history, and does not offer them. */
  initSearchSources() {
    const sources = window.NordlysSearchSources;
    const api = typeof chrome !== "undefined" ? chrome : null;
    const manifest = api?.runtime?.getManifest?.() || {};
    const askable = new Set([...(manifest.optional_permissions || []), ...(manifest.permissions || [])]);
    for (const input of document.querySelectorAll("#search-from input[data-source]")) {
      const source = input.dataset.source;
      input.closest(".row").hidden = !api?.[source] && !askable.has(sources.PERMISSION[source]);
      input.addEventListener("change", async () => {
        let on = input.checked;
        if (on) {
          on = await new Promise((resolve) => {
            try { api.permissions.request({ permissions: [sources.PERMISSION[source]] }, (granted) => resolve(Boolean(granted))); }
            catch (error) { resolve(false); }
          });
          sources.forget(source);
        }
        const chosen = new Set(this.app.config.searchFrom || []);
        if (on) chosen.add(source);
        else chosen.delete(source);
        this.app.config.searchFrom = sources.SOURCES.filter((name) => chosen.has(name));
        input.checked = on;
        this.app.saveConfig();
      });
    }
    this.syncSearchSources();
  }

  async syncSearchSources() {
    const sources = window.NordlysSearchSources;
    if (!sources) return;
    for (const input of document.querySelectorAll("#search-from input[data-source]")) {
      const source = input.dataset.source;
      input.checked = (this.app.config.searchFrom || []).includes(source) && await sources.granted(source);
    }
  }

  /* General → Keywords: a word and the address it goes to, a row each. A row
     is kept once both make sense (an address without a scheme is taken as
     https); until then it is marked and waits, and the others keep working. */
  initGolinks() {
    const list = document.getElementById("golink-list");
    document.getElementById("golink-add")?.addEventListener("click", () => {
      list.append(this.golinkRow());
      list.lastElementChild.querySelector(".golink-key").focus();
    });
    list?.addEventListener("change", () => this.saveGolinks());
    list?.addEventListener("click", (event) => {
      const remove = event.target.closest(".golink-remove");
      if (!remove) return;
      remove.closest(".golink-row").remove();
      this.saveGolinks();
      document.getElementById("golink-add").focus();
    });
    this.syncGolinks();
  }

  golinkRow({ key = "", url = "" } = {}) {
    const row = document.createElement("li");
    row.className = "golink-row";
    row.innerHTML = `<input class="ipt golink-key" type="text" maxlength="24" spellcheck="false" autocomplete="off" placeholder="gh" aria-label="Keyword" data-i18n-aria="general.keywordWord">`
      + `<input class="ipt golink-url" type="text" inputmode="url" spellcheck="false" autocomplete="off" placeholder="https://github.com/search?q=%s" aria-label="Address" data-i18n-aria="general.keywordAddress">`
      + `<button type="button" class="golink-remove" aria-label="Remove this keyword" data-i18n-aria="general.keywordRemove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    row.querySelector(".golink-key").value = key;
    row.querySelector(".golink-url").value = url;
    window.I18N?.applyDOM(row);
    return row;
  }

  saveGolinks() {
    const KEYWORD = window.NordlysSearchSources.KEYWORD;
    const taken = new Set();
    const kept = [];
    for (const row of document.querySelectorAll("#golink-list .golink-row")) {
      const keyInput = row.querySelector(".golink-key"), urlInput = row.querySelector(".golink-url");
      const key = keyInput.value.trim();
      const typed = urlInput.value.trim();
      const url = !typed || /^[a-z][a-z\d+.-]*:/i.test(typed) ? typed : `https://${typed}`;
      const keyOk = KEYWORD.test(key) && !taken.has(key.toLowerCase());
      const urlOk = /^https?:\/\/\S+$/i.test(url) && url.length <= 2048;
      for (const [input, wrong] of [[keyInput, Boolean(key) && !keyOk], [urlInput, Boolean(typed) && !urlOk]]) {
        if (wrong) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      }
      if (!keyOk || !urlOk) continue;
      if (url !== typed) urlInput.value = url;
      taken.add(key.toLowerCase());
      kept.push({ key, url });
    }
    this.app.config.golinks = kept;
    this.app.saveConfig();
  }

  // Drawn again from the config, unless somebody is typing in it.
  syncGolinks() {
    const list = document.getElementById("golink-list");
    if (!list || list.contains(document.activeElement)) return;
    list.replaceChildren(...(this.app.config.golinks || []).map((link) => this.golinkRow(link)));
  }

  /* A group of radios: the arrow keys move along it, and moving chooses. */
  roveRadios(options, choose) {
    for (const option of options) {
      option.addEventListener("click", () => choose(option));
      option.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = options[(options.indexOf(option) + step + options.length) % options.length];
        next.focus();
        next.click();
      });
    }
  }

  /* Appearance → Page: what the page is (layouts.css). Today is the
     dashboard's own layout: it brings the dashboard and takes it away again. */
  setPageLayout(layout) {
    const config = this.app.config;
    if ((config.pageLayout || "board") === layout) return;
    config.pageLayout = layout;
    this.app.dashboard?.followPage(layout);
    this.app.saveConfig();
    this.app.applyPageLayout();
    this.app.pageFit?.request();
    this.syncPageLayout();
  }

  syncPageLayout() {
    const current = this.app.config.pageLayout || "board";
    for (const option of document.querySelectorAll(".page-layout-option")) {
      const on = option.dataset.pageLayout === current;
      option.setAttribute("aria-checked", String(on));
      option.tabIndex = on ? 0 : -1;
    }
  }

  syncBoardLayout() {
    const config = this.app.config;
    const current = config.boardLayout === "fitted" ? "fitted" : "natural";
    for (const option of document.querySelectorAll(".board-layout-option:not(.page-layout-option)")) {
      const on = option.dataset.layout === current;
      option.setAttribute("aria-checked", String(on));
      option.tabIndex = on ? 0 : -1;
    }
    const groups = config.groups || [];
    const yours = Boolean(window.NordlysBoardLayout?.hasRows(groups));
    const say = (key, fallback, params) => {
      const value = window.I18N?.t(key, params || {});
      return value && value !== key ? value : fallback;
    };
    const state = document.getElementById("board-rows-state");
    if (state) {
      const count = window.NordlysBoardLayout ? window.NordlysBoardLayout.rowsOf(groups).length : 0;
      state.textContent = yours
        ? say("bookmarks.rowsYours", `Rows: ${count}, arranged by you`, { count })
        : say("bookmarks.rowsAuto", "Rows: chosen by the board, as evenly as the window allows");
    }
    const auto = document.getElementById("board-rows-auto");
    if (auto) auto.hidden = !yours;
    this.syncPageFit();
  }

  initBookmarksManager() {
    this.initBoardLayout();
    this.initLinkCheck();
    const list = document.getElementById("follow-url");
    document.getElementById("follow-run")?.addEventListener("click", () => this.followList(list));
    list?.addEventListener("keydown", (event) => { if (event.key === "Enter") this.followList(list); });
    document.getElementById("cfg-add-group")?.addEventListener("click", () => {
      this.app.config.groups.push({
        id: `g_${Date.now()}`,
        label: window.I18N?.t("bookmarks.newFolder") || "New folder",
        cols: 4,
        links: []
      });
      this.app.saveConfig();
      this.app.grid?.render();
      this.renderBookmarksManager();
    });
  }

  /* ── Check the bookmarks (link-check.js, read in only here) ─────
     Leave to read the sites is asked from the click, only for the sites
     not given already, and handed back once the check is done. Which were
     given already is learnt when the panel opens; until then nothing is
     handed back, so no other part of Nordlys can lose a site it reads. */
  initLinkCheck() {
    const box = document.getElementById("link-check");
    const run = document.getElementById("check-run");
    if (!box || !run) return;
    const perms = () => (typeof chrome !== "undefined" ? chrome.permissions : null);
    const originOf = (url) => `${new URL(url).origin}/*`;
    const pages = () => [...new Set((this.app.config.groups || []).flatMap((group) => (group.links || []).map((link) => link.url)).filter((url) => /^https?:\/\//i.test(url || "")))];
    const secure = (urls) => [...new Set(urls.filter((url) => /^https:\/\//i.test(url)).map(originOf))];
    let held = null;
    box.addEventListener("toggle", async () => {
      if (!box.open || !perms()?.contains) return;
      const origins = secure(pages());
      const answers = await Promise.all(origins.map((origin) => new Promise((resolve) => perms().contains({ origins: [origin] }, (yes) => { void chrome.runtime?.lastError; resolve(yes ? origin : null); }))));
      held = new Set(answers.filter(Boolean));
    });
    run.addEventListener("click", () => {
      const urls = pages();
      const wanted = secure(urls).filter((origin) => !held?.has(origin));
      const go = (granted) => {
        const readable = (url) => /^https:\/\//i.test(url) && (granted || Boolean(held?.has(originOf(url))));
        this.runLinkCheck(urls, readable).then(() => {
          if (granted && held && wanted.length) perms()?.remove?.({ origins: wanted }, () => { void chrome.runtime?.lastError; });
        });
      };
      if (!perms()?.request || !wanted.length) { go(false); return; }
      perms().request({ origins: wanted }, (granted) => { void chrome.runtime?.lastError; go(Boolean(granted)); });
    });
  }

  // The check itself and what it found are drawn by link-check.js, read in only now.
  async runLinkCheck(urls, readable) {
    await loadScript("src/js/link-check.js");
    return window.NordlysLinkCheck.run(this, urls, readable);
  }

  renderBookmarksManager() {
    this.syncBoardLayout();
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
      const addBkmText = window.I18N ? window.I18N.t('bookmarks.addBookmark') : 'Add bookmark';
      gBox.innerHTML = `
        <div class="group-editor-head">
          <input type="text" class="group-label-input" value="${esc(group.label || '')}" placeholder="${esc(folderPlaceholder)}">
          <div style="display: flex; gap: 5px; align-items: center;">
            <select class="cols-select" title="Columns">
              ${[1,2,3,4,5,6,7,8].map(c => `<option value="${c}" ${Number(group.cols) === c ? 'selected' : ''}>${c} Cols</option>`).join('')}
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

  /* ── 8. The icon dialog (icon-picker.js) ─────────────────────── */
  openIconModal(gIdx, lIdx, opener = document.activeElement) {
    const link = this.app.config.groups[gIdx]?.links[lIdx];
    if (!link) return;
    this.activeIconTarget = { gIdx, lIdx };
    // The bookmark itself, so another tab's save can find where it went.
    this.activeIconLink = link;
    this.iconPicker.open(link, opener);
  }

  closeIconModal() {
    this.iconPicker.close();
  }

  /* However the dialog closed: the cross, Escape or a click outside. */
  iconModalClosed() {
    this.activeIconTarget = null;
    this.activeIconLink = null;

    if (this.app.grid?.quickEditReturnTarget) {
      const { gIdx, lIdx } = this.app.grid.quickEditReturnTarget;
      this.app.grid.quickEditReturnTarget = null;
      this.app.grid.openQuickEditModal(gIdx, lIdx);
    }
  }

  /* ── 9. Live Custom CSS Editor ───────────────────────────────── */
  initCustomCSSEditor() {
    const editor = document.getElementById("css-editor");
    const injectBtn = document.getElementById("cfg-inject-css");
    const clearBtn = document.getElementById("cfg-clear-css");

    /* CSS that came with an imported file waits here, shown and not used,
       until it is saved: a style sheet can load addresses, and pick them by
       the bookmarks it finds on the board. */
    let waiting = null;
    try { waiting = localStorage.getItem(CSS_WAITING_KEY); } catch (error) { /* nothing waits */ }
    const notice = document.getElementById("css-waiting");
    if (notice) notice.hidden = waiting === null;
    const settle = () => {
      try { localStorage.removeItem(CSS_WAITING_KEY); } catch (error) { /* it is shown once more */ }
      waiting = null;
      if (notice) notice.hidden = true;
    };
    if (editor) editor.value = waiting ?? (this.app.config.customCss || "");

    injectBtn?.addEventListener("click", () => {
      const css = editor?.value || "";
      settle();
      this.app.config.customCss = css;
      this.app.injectCustomCSS(css);
      this.app.saveConfig();
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.cssApplied") : "Custom CSS applied & saved", "success");
      }
    });

    clearBtn?.addEventListener("click", () => {
      if (editor) editor.value = "";
      settle();
      this.app.config.customCss = "";
      this.app.injectCustomCSS("");
      this.app.saveConfig();
      if (typeof toast === "function") {
        toast(window.I18N ? window.I18N.t("toast.cssCleared") : "Custom CSS cleared", "info");
      }
    });

    editor?.addEventListener("input", (e) => {
      if (waiting === null) this.app.injectCustomCSS(e.target.value);
    });

    // Preset Snippets
    const CSS_PRESETS = {
      "monochrome": `/* === Preset: Monochrome Minimalist Tiles === */\n.tile {\n  filter: grayscale(100%) brightness(0.9);\n  transition: filter 0.25s ease, transform 0.25s ease !important;\n}\n.tile:hover {\n  filter: grayscale(0%) brightness(1.1) !important;\n  transform: scale(1.06) !important;\n}`
    };

    document.querySelectorAll(".css-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        if (CSS_PRESETS[key] && editor) {
          editor.value = (editor.value.trim() ? editor.value + "\n\n" : "") + CSS_PRESETS[key];
          if (waiting !== null) return;
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
      const mdContent = `# Nordlys Custom CSS Guide\n\n## Core Selectors & Hierarchy\n- \`#hero\`, \`#clock\`, \`#date\`, \`#greet\` — Clock, date & greeting\n- \`#hh\`, \`#mm\`, \`#ss\` — Individual clock digits\n- \`#searchwrap\`, \`#search\`, \`#q\` — Search bar & input\n- \`#sugg\`, \`.sugg-item\` — Suggestions dropdown rows\n- \`#board\` — Bento board container\n- \`.card\` — Folder glass container\n- \`.cat\`, \`.cat b\` — Folder header & title text\n- \`.grid\` — Tile grid (\`[data-cols="1..8"]\`)\n- \`.tile\` — Bookmark tile (\`--c\` holds its accent color)\n- \`.box\` — Icon glass box, \`.lbl\` — bookmark label\n- \`#hiddenDock\`, \`.restoreFolder\` — Hidden folder dock & chips\n- \`#fit-toggle\` — One page fit switch above the clock (\`[aria-checked="true"]\` while on)\n- \`#gear\` — Settings gear button\n- \`#cfg\`, \`.ctab\`, \`.csec\` — Settings drawer components\n\n## CSS Variables & Theming Tokens (override on :root)\n- \`--void\` — page background color\n- \`--void-gradient\` — page background gradient\n- \`--card-tint\` / \`--card-tint-deep\` — folder card glass tints\n- \`--glass\` — search bar / gear glass fill\n- \`--glass-border\` — card border color\n- \`--accent\` / \`--accent-glow\`\n- \`--ink\` / \`--dim\` / \`--faint\` — text colors\n- \`--font-main\` / \`--font-display\`\n- \`--tw\` (tile size), \`--tile-radius\`, \`--card-radius\`\n- \`--glass-blur\`, \`--glass-saturate\`, \`--glass-opacity\` (0-1), \`--glass-border-sheen\` (0-1)\n- \`--bg-blur\`, \`--bg-dim\` — custom wallpaper effects\n\n## Recipes\n\n### Transparent Minimal Cards\n\`\`\`css\n.card { background: transparent !important; box-shadow: none !important; border: none !important; }\n\`\`\`\n\n### Cyberpunk Neon Borders\n\`\`\`css\n.card { border: 2px solid #ff007f !important; box-shadow: 0 0 10px #00f3ff, inset 0 0 10px #00f3ff !important; }\n\`\`\`\n\n### Compact Grid & Hover Zoom\n\`\`\`css\n.tile { transition: transform 0.2s !important; } .tile:hover { transform: scale(1.1) !important; z-index: 10; }\n\`\`\`\n\n### Square Sharp Modernist\n\`\`\`css\n:root { --card-radius: 0px !important; --tile-radius: 0px !important; }\n\`\`\`\n\n### Monochrome Matte Black\n\`\`\`css\n:root { --card-tint: #111 !important; --card-tint-deep: #0a0a0a !important; --glass-border: #333 !important; } .tile { filter: grayscale(100%); }\n\`\`\`\n\n### Floating Gradient Text Header\n\`\`\`css\n#clock { background: linear-gradient(90deg, #ff8a00, #e52e71); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n\`\`\`\n\n### Hide Clock & Center Bento\n\`\`\`css\n#hero { display: none !important; } #board { margin: auto; }\n\`\`\`\n`;
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
  Apply these styles in the Settings -> Appearance -> Custom CSS.
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
  /* Two rows, two questions, and each only visible when there is something
     behind it. A restore button with nothing behind it is worse than none: it
     promises a safety net.

       restore point — what was here before Nordlys changed it: a migration on
                       load, or an import.
       undo point    — one step back from the last thing you did that replaced
                       everything: a reset, or a restore. */
  initRestorePoint() {
    this.renderRecoveryRows();
    this.renderUpdateCopies();
    document.getElementById("cfg-restore-point")?.addEventListener("click", () => this.useRestorePointWithUndo());
    document.getElementById("cfg-undo-point")?.addEventListener("click", () => this.stepBack());
  }

  renderRecoveryRows() {
    const point = this.app.restorePoint();
    const row = document.getElementById("restore-point-row");
    if (row) row.hidden = !point;
    const when = document.getElementById("restore-point-when");
    if (when) when.textContent = point ? this.savedAtText(point) : "";

    const undo = this.app.undoPoint();
    const undoRow = document.getElementById("undo-point-row");
    if (undoRow) undoRow.hidden = !undo;
    const undoWhen = document.getElementById("undo-point-when");
    if (undoWhen) undoWhen.textContent = undo ? this.savedAtText(undo) : "";
    const what = document.getElementById("undo-point-what");
    if (what && undo) {
      what.textContent = undo.cause === "restore"
        ? this.text("backup.undoPointRestore", "Older settings were put back")
        : this.text("backup.undoPointReset", "Everything was reset");
    }
  }

  /* The copies made before updates, newest first: each can be put back in
     place of the whole setup, or saved as a backup file. */
  async renderUpdateCopies() {
    const box = document.getElementById("update-copies");
    const list = box?.querySelector(".update-copies-list");
    if (!box || !list) return;
    const copies = await this.app.updateCopies();
    box.hidden = !copies.length;
    list.replaceChildren(...copies.map((copy, index) => {
      const item = document.createElement("li");
      item.className = "update-copy";
      const what = document.createElement("span");
      what.textContent = `${this.text("backup.updateCopyFrom", "Before {version}", { version: copy.to || "" })} ${this.savedAtText(copy)}`;
      const put = document.createElement("button");
      put.type = "button";
      put.className = "glass-btn";
      put.dataset.copy = String(index);
      put.textContent = this.text("backup.updateCopyUse", "Put it back");
      put.addEventListener("click", () => this.useUpdateCopy(copy));
      const save = document.createElement("button");
      save.type = "button";
      save.className = "glass-btn";
      save.textContent = this.text("backup.updateCopySave", "Save as file");
      save.addEventListener("click", () => this.download(JSON.stringify(copy.file, null, 2), `nordlys-before-${copy.to || "update"}-${String(copy.savedAt || "").slice(0, 10)}.json`, "application/json"));
      const actions = document.createElement("span");
      actions.className = "update-copy-actions";
      actions.append(put, save);
      item.append(what, actions);
      return item;
    }));
  }

  async useUpdateCopy(copy) {
    const ok = await confirmDialog({
      title: this.text("confirm.restoreTitle", "Put the older settings back?"),
      message: this.text("backup.confirmRestore", "Your folders, bookmarks and appearance are replaced.", { when: this.savedAtText(copy) }),
      confirmText: this.text("backup.updateCopyUse", "Put it back"),
      cancelText: this.text("confirm.cancel", "Cancel")
    });
    if (ok) await this.applyBackupObject(copy.file, { own: true });
  }

  download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  savedAtText(point) {
    const saved = new Date(point?.savedAt || NaN);
    if (Number.isNaN(saved.getTime())) return "";
    return `(${saved.toLocaleDateString()} ${saved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }

  /* Restoring replaces the whole setup, so it is itself a destructive act and
     gets the same treatment as one: what it is about to discard is kept first,
     and if that cannot be written the restore does not happen. It applies in
     place rather than reloading — a reload would throw away the moment in which
     somebody can say "no, that was the wrong one". */
  async useRestorePointWithUndo() {
    const point = this.app.restorePoint();
    if (!point) return;
    const ok = await confirmDialog({
      title: this.text("confirm.restoreTitle", "Put the older settings back?"),
      message: this.text("backup.confirmRestore", "Your folders, bookmarks and appearance are replaced.", { when: this.savedAtText(point) }),
      confirmText: this.text("backup.restorePointBtn", "Put those back"),
      cancelText: this.text("confirm.cancel", "Cancel")
    });
    if (!ok) return;
    if (!this.keepAWayBack("restore")) return;
    if (!this.app.applyRecoveryBundle(point)) { this.sayNoRoom("toast.saveFailed"); return; }
    this.renderRecoveryRows();
    const done = this.text("toast.restorePointUsed", "Restored");
    if (typeof toast === "function") toast(done, "success");
    NordlysUI.announce(done);
    /* Focus lands on the way back rather than staying on a button whose row has
       just changed meaning under it. */
    document.getElementById("cfg-undo-point")?.focus({ preventScroll: true });
  }

  /* The one step back. It spends the slot rather than writing a new one, so
     there is no chain of snapshots behind somebody pressing undo twice. No
     confirm dialog: this is the direction that gives things back, and a
     question in front of it would be the nag this product refuses. */
  async stepBack() {
    const point = this.app.undoPoint();
    if (!point) return;
    if (!this.app.applyRecoveryBundle(point)) { this.sayNoRoom("toast.saveFailed"); return; }
    if (point.cause === "reset" && point.media) await this.restoreWallpaperAside();
    if (point.cause === "reset") await this.putBackBrowserStore(point);
    this.app.clearSnapshot(UNDO_POINT_KEY);
    this.renderRecoveryRows();
    const done = this.text(point.cause === "restore" ? "toast.restoreUndone" : "toast.resetUndone", "Put back");
    if (typeof toast === "function") toast(done, "success");
    NordlysUI.announce(done);
    // The row this button sat in has just gone, so focus moves to the other way
    // back if there is one, and to the tab heading if there is not.
    const other = document.getElementById("cfg-restore-point");
    (other?.offsetParent ? other : document.getElementById("settings-tab-backup"))?.focus({ preventScroll: true });
  }

  /* The half of a reset's way back that lives in browser storage: the other
     profiles, what the cards held, sync's own state. Not the keys to other
     services: a reset is also how those are taken off a device. Answers null
     when the browser will not say what it holds. */
  async keepBrowserStore(savedAt) {
    try {
      const skip = [STORAGE_KEY, SAVED_AT_KEY, UPDATE_COPIES_KEY, RESET_COPY_KEY, "nordlys_connections"];
      const items = Object.fromEntries(Object.entries(await this.localArea("get", null)).filter(([key]) => !skip.includes(key)));
      return { savedAt, items };
    } catch (error) { return null; }
  }

  async putBackBrowserStore(point) {
    for (const [field, key] of RESET_LISTS) {
      try { if (typeof point[field] === "string") localStorage.setItem(key, point[field]); } catch (error) { /* the next tab starts from one profile */ }
    }
    try {
      const copy = (await this.localArea("get", RESET_COPY_KEY))[RESET_COPY_KEY];
      if (copy?.savedAt !== point.savedAt) return;
      await this.localArea("set", copy.items);
      await this.localArea("remove", RESET_COPY_KEY);
    } catch (error) { /* the settings came back; the rest is best effort */ }
    this.app.sync?.profiles?.reload();
    this.app.sync?.emit();
  }

  /* Writes the way back before the thing that needs one, and answers whether it
     landed. An irreversible version of a reversible action is not a fallback. */
  keepAWayBack(cause, extra = {}) {
    const bundle = Object.assign(this.app.captureRecoveryBundle(cause), extra);
    if (this.app.writeSnapshot(UNDO_POINT_KEY, bundle)) return true;
    this.sayNoRoom("toast.recoveryFailed");
    return false;
  }

  sayNoRoom(key) {
    const message = this.text(key, "There is not enough room in storage, so nothing was changed.");
    if (typeof toast === "function") toast(message, "danger", 7000);
    NordlysUI.announce(message);
  }

  /* A wallpaper is tens of megabytes and cannot travel in a snapshot, so on a
     reset it is moved to one slot beside the live one rather than deleted. One
     slot, overwritten by each reset: no chain, and the undo can honestly say it
     brings back everything the reset took.

     Until the new snapshot is written, that slot still belongs to the undo
     point already sitting there. Spending it first — overwriting it, or, with
     no wallpaper to move, emptying it for nothing — and only then finding
     there is no room for the snapshot is how a reset that did not happen left
     the previous way back promising a file that was no longer on disk. So
     whatever is displaced is held here, and the caller puts it back if the
     snapshot does not land. */
  async setWallpaperAside() {
    const read = async (id) => { try { return await MediaVault.getMedia(id); } catch (error) { return null; } };
    const live = await read("custom_bg");
    const displaced = await read(UNDO_MEDIA_ID);
    const putBack = async () => {
      try {
        if (displaced) await MediaVault.saveMedia(UNDO_MEDIA_ID, displaced, displaced.type);
        else await MediaVault.deleteMedia(UNDO_MEDIA_ID);
      } catch (error) { /* the vault refused its own previous contents; nothing here can do better */ }
    };
    /* The vault commits a transaction at a time, so a write that throws leaves
       the slot as it was. A wallpaper that cannot be set aside is reported, not
       swallowed: the reset would delete the live copy next. */
    if (live) await MediaVault.saveMedia(UNDO_MEDIA_ID, live, live.type);
    else { try { await MediaVault.deleteMedia(UNDO_MEDIA_ID); } catch (error) { /* nothing aside */ } }
    return { media: Boolean(live), putBack };
  }

  async restoreWallpaperAside() {
    try {
      const kept = await MediaVault.getMedia(UNDO_MEDIA_ID);
      if (!kept) return;
      await MediaVault.saveMedia("custom_bg", kept, kept.type);
      await MediaVault.deleteMedia(UNDO_MEDIA_ID);
      await this.app.updateBackgroundMode();
    } catch (error) { /* the settings came back; the wallpaper is best effort */ }
  }

  /* Re-reads the stores that live beside the config after a bundle put them
     back, so the drawer shows what storage now holds rather than what it was
     showing a moment ago. */
  adoptRestoredStores() {
    this.customThemes = this.loadCustomThemes();
    this.renderThemeCards();
    try {
      const width = localStorage.getItem("nordlys_drawer_width");
      if (this.drawer) this.drawer.style.width = width || "";
    } catch (error) { /* the drawer keeps the width it has */ }
  }

  text(key, fallback, params) {
    return (window.I18N ? window.I18N.t(key, params || {}) : null) || fallback;
  }

  /* What the export button actually writes. The config sits at the top level,
     where every release since 2.0 put it; the themes someone authored and the
     width they dragged the drawer to travel beside it in one namespaced
     envelope, because a file called a backup that loses them is a backup in
     name only. What it cannot carry — wallpaper and video files, which run to
     tens of megabytes — is named in the panel rather than left to be discovered
     after a reset. */
  buildBackupPayload() {
    let drawerWidth = "";
    try { drawerWidth = localStorage.getItem("nordlys_drawer_width") || ""; } catch (error) { /* no width to carry */ }
    return window.NordlysConfigSchema.buildBackupFile(this.app.config, {
      customThemes: this.loadCustomThemes(),
      drawerWidth,
      dashboardData: this.app.dashboard?.backupData?.() || {}
    });
  }

  /* A backup file put in place of the whole setup: from an imported file,
     or from a copy kept before an update (own: made here, from this setup).
     Reloads once it has landed. */
  async applyBackupObject(parsed, { own = false } = {}) {
    const file = window.NordlysConfigSchema.readBackupFile(parsed);
    const imported = window.NordlysConfigSchema.normalizeImportConfig(file.config);
    window.NordlysConfigSchema.migrateRaw(imported);
    /* Checked in full before anything is written. The old test was "has a
       groups or a theme key", which let {"groups": {}} through — saved,
       and then a page that failed on every open. The reasons are shown,
       and the setup being replaced is kept in the restore point. */
    const verdict = window.NordlysConfigSchema.validateConfig(imported);
    if (!verdict.ok) {
      const label = window.I18N ? window.I18N.t("toast.importInvalid") : "Invalid JSON configuration structure";
      if (typeof toast === "function") toast(`${label}: ${verdict.errors.slice(0, 3).join("; ")}`, "danger", 7000);
      return false;
    }
    /* Brought up to the current shape here, before it is written. There
       is one restore-point slot. If the file still needed a migration on
       the next load, that load would take a second snapshot — of the
       imported file — over the one taken here of the setup being
       replaced, and the user's own setup would exist nowhere. Every
       export from 2.1.0 to 2.2.1 needs a migration. */
    const incoming = Object.assign({}, DEFAULT_CONFIG, imported);
    window.NordlysConfigSchema.repairConfig(incoming, this.app.defaultConfig);
    this.app.normalizeStoredConfig(incoming);
    /* One commit for the whole file. A file of embedded icons can be
       megabytes, and it is written to four keys: when the write failed,
       this reloaded anyway — and the page came back on the old config,
       which reads as "the import did nothing" with nothing said. Worse,
       the parts written before it stayed: the restore point spent on an
       import that never happened, or the imported themes left under the
       config they did not come with.

       The restore point and the extras go first because they are
       localStorage only and can be put back to the byte. The config
       goes last because it is the one write that also reaches the
       browser-storage mirror, and a mirror holding a refused import is
       a copy of a setup that never existed.

       What the cards held goes before all of it, to browser storage, which
       answers later and can refuse; the keys it replaces are kept to put back.
       CSS from a file waits in the editor to be read (initCustomCSSEditor). */
    const css = own ? "" : incoming.customCss || "";
    if (!own) incoming.customCss = "";
    const previous = this.app.config;
    const putBack = this.holdLocalKeys([RESTORE_POINT_KEY, STORAGE_KEY, "nordlys_custom_themes", "nordlys_drawer_width", CSS_WAITING_KEY]);
    const cardsBack = await this.adoptImportedCards(file.extras?.dashboardData);
    this.app.config = incoming;
    if (!cardsBack
      || !this.app.snapshotBeforeMigration(previous, "import")
      || !this.adoptImportedExtras(file.extras, css)
      || !this.app.saveConfig({ strict: true })) {
      this.app.config = previous;
      putBack();
      await cardsBack?.();
      this.sayNoRoom("toast.saveFailed");
      return false;
    }
    location.reload();
    return true;
  }

  // chrome.storage.local as a promise, which fails when the browser refuses.
  localArea(method, argument) {
    const area = typeof chrome !== "undefined" ? chrome.storage?.local : null;
    if (!area) return Promise.resolve({});
    return new Promise((resolve, reject) => {
      try {
        area[method](argument, (value) => {
          const error = chrome.runtime?.lastError;
          if (error) reject(new Error(error.message)); else resolve(value || {});
        });
      } catch (error) { reject(error); }
    });
  }

  /* What an imported file's cards held, written over this setup's. Answers the
     way back to what those keys held before, or null when the write was refused
     (and put back already). */
  async adoptImportedCards(data) {
    const items = Object.fromEntries(Object.entries(data && typeof data === "object" ? data : {}).map(([id, value]) => [`nordlys_dash.${id}`, value]));
    const keys = Object.keys(items);
    if (!keys.length) return () => Promise.resolve();
    let before;
    try { before = await this.localArea("get", keys); } catch (error) { return null; }
    const back = async () => {
      try {
        const kept = Object.fromEntries(Object.entries(before).filter(([, value]) => value !== undefined));
        await this.localArea("set", kept);
        const added = keys.filter((key) => kept[key] === undefined);
        if (added.length) await this.localArea("remove", added);
      } catch (error) { /* the cards keep what the file gave them */ }
    };
    try { await this.localArea("set", items); return back; }
    catch (error) { await back(); return null; }
  }

  /* Folders from another extension's backup, added after the ones here. The
     setup as it was is kept in the restore point first, as an import is. */
  addImportedFolders({ from, groups }) {
    if (!groups.length) {
      if (typeof toast === "function") toast(this.text("toast.importNothing", "No web bookmarks were found in that file."), "danger");
      return false;
    }
    const previous = JSON.parse(JSON.stringify(this.app.config));
    if (!this.app.snapshotBeforeMigration(previous, "import")) { this.sayNoRoom("toast.recoveryFailed"); return false; }
    const added = groups.map((group) => ({
      label: group.label,
      cols: Math.min(4, Math.max(2, Math.ceil(Math.sqrt(group.links.length)))),
      hidden: false,
      links: group.links.map((link) => ({ color: "#38bdf8", ...link })),
      ...(group.source ? { source: group.source } : {})
    }));
    this.app.config.groups = [...(this.app.config.groups || []), ...added];
    window.NordlysSyncModel?.normalize?.(this.app.config);
    if (!this.app.saveConfig()) { this.app.config = previous; this.sayNoRoom("toast.saveFailed"); return false; }
    this.app.grid?.render();
    this.renderBookmarksManager?.();
    this.renderRecoveryRows?.();
    const links = added.reduce((sum, group) => sum + group.links.length, 0);
    const done = this.text("toast.importedFrom", "{links} bookmarks in {folders} folders came over from {app}.", { links, folders: added.length, app: from });
    if (typeof toast === "function") toast(done, "success", 6000);
    NordlysUI.announce(done);
    return true;
  }

  /* Backup → Settings as text. Opened, it shows the settings as they are,
     unless what is in it came from elsewhere or was changed and not applied. */
  initBackupText() {
    const box = document.getElementById("backup-text");
    const text = document.getElementById("cfg-text");
    const address = document.getElementById("cfg-url");
    if (!box || !text || !address) return;
    box.addEventListener("toggle", () => {
      if (box.open && !text.dataset.held) text.value = JSON.stringify(this.app.config, null, 2);
    });
    text.addEventListener("input", () => { text.dataset.held = "1"; text.removeAttribute("aria-invalid"); });
    document.getElementById("cfg-text-apply")?.addEventListener("click", () => this.applyText(text));
    document.getElementById("cfg-url-load")?.addEventListener("click", () => this.readFromAddress(address, text));
    address.addEventListener("keydown", (event) => { if (event.key === "Enter") this.readFromAddress(address, text); });
  }

  // The text applied as a backup file is: another new tab's file adds its folders.
  async applyText(text) {
    let parsed;
    try { parsed = JSON.parse(text.value); }
    catch (error) {
      text.setAttribute("aria-invalid", "true");
      if (typeof toast === "function") toast(`${this.text("toast.importError", "Import failed")}: ${error.message}`, "danger", 5000);
      return false;
    }
    // Read in only when something is imported: every other tab is spared it.
    await loadScript("src/js/importers.js");
    const other = window.NordlysImporters?.read(parsed);
    if (other) return this.addImportedFolders(other);
    // CSS that is already this setup's is not new code to be read first.
    const own = (parsed?.customCss || "") === (this.app.config.customCss || "");
    return this.applyBackupObject(parsed, { own });
  }

  /* Leave to reach one site, asked while the click still counts as the
     person's: called before anything else is awaited. A page that cannot ask
     (the tests, the site's demo) has it. */
  leaveToReach(url) {
    const permissions = typeof chrome !== "undefined" ? chrome.permissions : null;
    if (!permissions?.request) return Promise.resolve(true);
    return new Promise((resolve) => {
      try { permissions.request({ origins: [`${url.origin}/*`] }, (granted) => resolve(Boolean(granted))); }
      catch (error) { resolve(false); }
    });
  }

  /* Bookmarks → Follow a list at an address: its folders come onto the board
     and follow it (lists.js), the way imported folders come: after the others,
     with a way back. The list is read once here, then again each hour. */
  async followList(address) {
    let url = null;
    try { url = new URL(address.value.trim()); } catch (error) { /* said below */ }
    const say = (message) => { if (typeof toast === "function") toast(message, "danger", 5000); };
    if (url?.protocol !== "https:") {
      address.setAttribute("aria-invalid", "true");
      say(this.text("backup.urlHttps", "Give an address that starts with https://"));
      return;
    }
    address.removeAttribute("aria-invalid");
    const granted = await this.leaveToReach(url);
    await loadScript("src/js/lists.js");
    let folders;
    try { folders = window.NordlysLists.parse(await window.NordlysLists.read(url.href), url.href); }
    catch (error) {
      say(granted ? `${this.text("backup.urlFailed", "That address could not be read")}: ${error.message}`
        : this.text("backup.urlRefused", "Without leave to reach that site, its file cannot be read."));
      return;
    }
    window.NordlysLists.markRead(url.href);
    const groups = folders.map((folder) => ({ ...folder, source: { type: "list", url: url.href, folder: folder.label } }));
    if (this.addImportedFolders({ from: url.hostname, groups })) address.value = "";
  }

  /* A settings file at a web address: leave to reach that one site is asked
     for there and then, while the click still counts as the person's; the file
     is read once, without cookies, and put in the text to be looked at first. */
  readFromAddress(address, text) {
    let url = null;
    try { url = new URL(address.value.trim()); } catch (error) { /* said below */ }
    const say = (message) => { if (typeof toast === "function") toast(message, "danger", 5000); };
    if (url?.protocol !== "https:") {
      address.setAttribute("aria-invalid", "true");
      say(this.text("backup.urlHttps", "Give an address that starts with https://"));
      return;
    }
    address.removeAttribute("aria-invalid");
    this.leaveToReach(url).then(async (granted) => {
      if (!granted) return say(this.text("backup.urlRefused", "Without leave to reach that site, its file cannot be read."));
      const response = await fetch(url.href, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout?.(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 8e6) throw new Error(this.text("backup.urlTooLarge", "the file is too large"));
      text.value = JSON.stringify(JSON.parse(body), null, 2);
      text.dataset.held = "1";
      text.removeAttribute("aria-invalid");
      text.focus();
      if (typeof toast === "function") toast(this.text("backup.urlRead", "Read. Look it over, then apply it."), "success", 4000);
    }).catch((error) => say(`${this.text("backup.urlFailed", "That address could not be read")}: ${error.message}`));
  }

  initBackupManager() {
    this.initBackupText();
    // Export JSON Backup
    document.getElementById("cfg-export")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(this.buildBackupPayload(), null, 2)], { type: "application/json" });
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

      reader.onload = async (evt) => {
        const text = evt.target.result;
        try {
          if (fileName.endsWith(".html") || fileName.endsWith(".htm") || text.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1") || text.includes("<DL>")) {
            // A bookmarks file a browser exported: read the way a followed list is (lists.js).
            await loadScript("src/js/lists.js");
            const groups = window.NordlysLists?.parse(text, "", file.name.replace(/[.][^.]+$/, "")) || [];
            // Added the way another new tab's folders are: a way back first, and only if the save landed.
            this.addImportedFolders({ from: file.name, groups });
          } else {
            /* JSON. The envelope beside the config is lifted out first, so it
               is never validated as a setting and never stored as one; a file
               without one — every backup written before this build, including
               the 2.0 exports people still have — reads as itself. */
            const parsed = JSON.parse(text);
            // Another new tab's backup adds its folders; a Nordlys one replaces the setup.
            await loadScript("src/js/importers.js");
            const other = window.NordlysImporters?.read(parsed);
            if (other) this.addImportedFolders(other);
            else await this.applyBackupObject(parsed);
          }
        } catch (err) {
          if (typeof toast === "function") {
            toast(`${window.I18N ? window.I18N.t("toast.importError") : "Import failed"}: ${err.message}`, "danger", 4000);
          }
        }
      };

      reader.readAsText(file);
    });

    /* Reset. The most destructive action in the product, and the one that used
       to delete its own safety net: nordlys_restore_point was in the key list
       it cleared, and it took no snapshot of its own, so "this cannot be undone"
       was simply accurate.

       Now the snapshot comes first and the removal only happens if it landed —
       everything the reset takes is inside it, including the wallpaper, which is
       moved aside rather than copied because of its size. The restore point is
       not in the key list any more: a reset may not spend the other way back. */
    document.getElementById("cfg-reset")?.addEventListener("click", () => {
      confirmDialog({
        title: this.text("confirm.resetTitle", "Reset everything?"),
        message: this.text("backup.confirmReset", "This clears your folders, bookmarks and appearance. A way back is saved first."),
        confirmText: this.text("confirm.reset", "Reset"),
        cancelText: this.text("confirm.cancel", "Cancel")
      }).then(async (ok) => {
        if (!ok) return;
        /* Both halves of the way back, or neither. The wallpaper moves first
           because the vault can be asked to put it back; the snapshot is the
           commit point, because localStorage cannot. */
        let aside;
        try { aside = await this.setWallpaperAside(); }
        catch (error) { this.sayNoRoom("toast.recoveryFailed"); return; }
        const lists = {};
        for (const [field, key] of RESET_LISTS) {
          try { const raw = localStorage.getItem(key); if (raw !== null) lists[field] = raw; } catch (error) { /* not kept */ }
        }
        if (!this.keepAWayBack("reset", { media: aside.media, ...lists })) { await aside.putBack(); return; }
        const kept = await this.keepBrowserStore(this.app.undoPoint()?.savedAt);
        for (const key of OWNED_LOCAL_KEYS) {
          try { localStorage.removeItem(key); } catch (error) { /* already gone */ }
        }
        try { await MediaVault.deleteMedia("custom_bg"); } catch (e) {}
        NordlysUI.announce(this.text("toast.resetDone", "Everything was reset"));
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          // The copies made before updates outlive a reset, as the restore point does.
          const copies = await this.app.updateCopies();
          const keep = { ...(copies.length ? { [UPDATE_COPIES_KEY]: copies } : {}), ...(kept ? { [RESET_COPY_KEY]: kept } : {}) };
          chrome.storage.local.clear(() => {
            if (Object.keys(keep).length) chrome.storage.local.set(keep, () => location.reload());
            else location.reload();
          });
          setTimeout(() => location.reload(), 400); // fallback if callback never fires
        } else {
          location.reload();
        }
      });
    });
  }

  /* localStorage has no transaction, so the nearest honest thing is to hold the
     exact bytes of every key an action writes and put them all back the moment
     one write fails. Returns the way back. */
  holdLocalKeys(keys) {
    const held = keys.map((key) => {
      try { return [key, localStorage.getItem(key)]; } catch (error) { return [key, null]; }
    });
    return () => {
      for (const [key, value] of held) {
        try {
          /* Written straight back rather than cleared first: the value going in
             is the one the store already had room for, so it cannot itself be
             the write that runs out of room — and the key whose write is what
             failed was never changed, so it is holding this already. */
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch (error) { /* the store refused its own previous contents; it still has them */ }
      }
    };
  }

  /* The stores an imported file carried beside its config. Answers whether they
     landed: a file whose themes will not fit is a file that has not been
     imported, not one that half has. */
  adoptImportedExtras(extras = {}, css = "") {
    try {
      if (Array.isArray(extras.customThemes)) localStorage.setItem("nordlys_custom_themes", JSON.stringify(extras.customThemes.filter(window.NordlysConfigSchema.isStudioTheme)));
      if (extras.drawerWidth) localStorage.setItem("nordlys_drawer_width", extras.drawerWidth);
      if (css.trim()) localStorage.setItem(CSS_WAITING_KEY, css);
      else localStorage.removeItem(CSS_WAITING_KEY);
      return true;
    } catch (error) { return false; }
  }
}
