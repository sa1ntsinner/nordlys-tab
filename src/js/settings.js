/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SETTINGS CONTROLLER & CUSTOMIZATION
   ═══════════════════════════════════════════════════════════════════ */

/* Fallback names, and the keys that translate them. Marking the card with
   data-i18n lets a language switch retranslate it without a listener here. */
/* The fallbacks used to read Aurora / Drift / Horizon while the dictionary that
   actually paints the cards said Nordlys / Contour / Fjord, so a missing key or
   a late I18N renamed three scenes on the spot. Same words in both places now. */
const SCENE_NAMES = {
  "aurora": "Nordlys",
  "halo": "Halo",
  "silk": "Silk",
  "frost": "Frost",
  "drift": "Contour",
  "horizon": "Fjord",
  "custom-image": "Wallpaper",
  "custom-video": "Video",
  "solid": "Solid"
};
const SCENE_KEYS = {
  "aurora": "scene.aurora",
  "halo": "scene.halo",
  "silk": "scene.silk",
  "frost": "scene.frost",
  "drift": "scene.drift",
  "horizon": "scene.horizon",
  "custom-image": "scene.wallpaper",
  "custom-video": "scene.video",
  "solid": "scene.solid"
};

/* The settings a shared look may change (look-share.js). */
const LOOK_SETTINGS = ["bgMode", "bgMotion", "bgIntensity", "bgSeed", "bgRealSky", "bgDaylight", "boardLayout", "glassLevel", "cardRadius", "tileSize", "cardGap", "boardGap", "boardWidth", "tileLabels", "cardGlow", "iconShape", "hoverEffect"];

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
      onSelect: (tab) => { if (tab === "favicon") this.refreshFaviconPreview?.(); }
    });
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
    this.initRestorePoint();
    this.initScenePicker();
    this.initTypography();
    this.initLookShare();
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
    const personalGrid = document.getElementById("bg-personal-grid");
    if (!select || !grid || !personalGrid) return;

    /* The generative previews are stills of the real scenes (paintStill), so
       they are drawn once the grid has a size to draw into, and again whenever
       the palette moves: a new mood, a new theme, a mood still being mixed. */
    let stillsQueued = false;
    const paintStills = () => {
      stillsQueued = false;
      const engine = this.app.bgEngine;
      if (!engine || !grid.offsetParent) return;
      for (const still of grid.querySelectorAll("canvas.scene-still")) {
        if (engine.paintStill(still, still.dataset.scene)) still.parentElement.classList.add("is-live");
      }
    };
    const queueStills = () => {
      if (stillsQueued) return;
      stillsQueued = true;
      requestAnimationFrame(paintStills);
    };
    if (typeof ResizeObserver === "function") new ResizeObserver(queueStills).observe(grid);
    window.addEventListener("nordlys:palette", queueStills);

    const paint = () => {
      grid.replaceChildren();
      personalGrid.replaceChildren();
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
        if (NORDLYS_GENERATIVE_SCENES.has(option.value)) {
          const still = document.createElement("canvas");
          still.className = "scene-still";
          still.dataset.scene = option.value;
          preview.append(still);
        }
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
        const personal = ["custom-image", "custom-video", "solid"].includes(option.value);
        (personal ? personalGrid : grid).append(card);
      }
      queueStills();
    };

    select.addEventListener("change", () => {
      document.querySelectorAll("#bg-scene-picker .scene-card").forEach((card) => {
        card.setAttribute("aria-checked", String(card.dataset.scene === select.value));
      });
      showRelevant();
    });

    /* Offering an Upload Wallpaper button while Aurora is running, or a blur
       slider with nothing to blur, is noise the user has to read and dismiss.
       Each control declares the scenes it belongs to and the rest step aside. */
    const SCENE_GROUPS = {
      media: ["custom-image", "custom-video"],
      image: ["custom-image"],
      halo: ["halo"]
    };
    const showRelevant = () => {
      const scene = select.value;
      for (const node of document.querySelectorAll("#sec-background [data-scene-only]")) {
        // "procedural" is every scene the canvas draws itself, which background.js
        // already names; listing them again here is how a new atmosphere ships
        // without the controls that belong to it.
        const belongs = node.dataset.sceneOnly === "procedural"
          ? NORDLYS_GENERATIVE_SCENES.has(scene)
          : (SCENE_GROUPS[node.dataset.sceneOnly] || []).includes(scene);
        node.hidden = !belongs;
      }
    };

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
       Five that ship and as many as somebody cares to mix. A mood is three
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
      ["mono", "Mono", "background.paletteMono"]
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
      // The five that ship carry their swatch in CSS; a mixed one carries its
      // own, because its colours are not known until somebody picks them.
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
      for (const [id, label, key] of BUILT_IN_MOODS) paletteGrid.append(moodChip(id, label, key));
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

    /* Tonight's moon, said in words beside the switch that follows it. */
    const realSky = document.getElementById("cfg-bg-real-sky");
    const tonight = document.getElementById("bg-moon-tonight");
    // Spelled out so every phase's message key can be found by searching for it.
    const MOON_WORDS = {
      new: ["moon.new", "new moon"], waxingCrescent: ["moon.waxingCrescent", "waxing crescent"],
      firstQuarter: ["moon.firstQuarter", "first quarter"], waxingGibbous: ["moon.waxingGibbous", "waxing gibbous"],
      full: ["moon.full", "full moon"], waningGibbous: ["moon.waningGibbous", "waning gibbous"],
      lastQuarter: ["moon.lastQuarter", "last quarter"], waningCrescent: ["moon.waningCrescent", "waning crescent"]
    };
    const sayTonight = () => {
      if (!tonight || !window.NordlysSky) return;
      const moon = window.NordlysSky.moonPhase(new Date());
      const [key, english] = MOON_WORDS[window.NordlysSky.phaseName(moon.phase)];
      const percent = Math.round(moon.illumination * 100);
      tonight.textContent = say("background.moonTonight", `Tonight: ${english}, ${percent}% lit`, { phase: say(key, english), percent });
      tonight.hidden = this.app.config.bgRealSky === false;
    };
    if (realSky) realSky.checked = this.app.config.bgRealSky !== false;
    sayTonight();
    realSky?.addEventListener("change", () => {
      this.app.config.bgRealSky = realSky.checked;
      this.app.saveConfig();
      this.app.updateBackgroundMode();
      sayTonight();
    });
    window.addEventListener("nordlys:languagechange", sayTonight);

    /* The time of day, as light on the chosen mood: the switch, what the sun
       is doing now in words beside it, and a day played through in a few
       seconds so the switch shows what it does instead of promising it. */
    const daylight = document.getElementById("cfg-bg-daylight");
    const daylightNow = document.getElementById("bg-daylight-now");
    const daylightPlay = document.getElementById("bg-daylight-play");
    // Spelled out so every phase's message key can be found by searching for it.
    const DAYLIGHT_WORDS = {
      night: ["daylight.night", "night"], dawn: ["daylight.dawn", "dawn"], sunrise: ["daylight.sunrise", "sunrise"],
      morning: ["daylight.morning", "morning"], afternoon: ["daylight.afternoon", "afternoon"],
      sunset: ["daylight.sunset", "sunset"], dusk: ["daylight.dusk", "dusk"]
    };
    const sayDaylight = (sky = this.app.bgEngine?.sky, clock = null) => {
      if (!daylightNow) return;
      const on = this.app.config.bgDaylight === true;
      daylightNow.hidden = !on || !sky;
      if (daylightPlay) daylightPlay.hidden = !on;
      if (!on || !sky) return;
      const [key, english] = DAYLIGHT_WORDS[sky.phase] || DAYLIGHT_WORDS.night;
      const phase = say(key, english);
      daylightNow.textContent = clock
        ? say("background.daylightAt", `${clock}: ${phase}`, { time: clock, phase })
        : say("background.daylightNow", `Now: ${phase}`, { phase });
    };
    if (daylight) daylight.checked = this.app.config.bgDaylight === true;
    daylight?.addEventListener("change", () => {
      this.app.config.bgDaylight = daylight.checked;
      this.app.saveConfig();
      this.app.bgEngine?.setDaylight(daylight.checked);
      sayDaylight();
    });
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

    /* A new scatter of the same scene — other stars, other frost, another
       weave — kept until shuffled again, and one undo away from the last. */
    document.getElementById("bg-shuffle")?.addEventListener("click", () => {
      const previous = this.app.config.bgSeed ?? 0;
      const next = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      const sow = (seed) => {
        this.app.config.bgSeed = seed;
        this.app.bgEngine?.setSeed(seed);
        this.app.saveConfig();
      };
      sow(next);
      window.NordlysUI?.showUndoToast?.({
        message: say("background.shuffled", "A new sky"),
        onAction: () => {
          sow(previous);
          window.NordlysUI?.announce?.(say("background.unshuffled", "The previous sky is back"));
        }
      });
    });
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
    this.syncScenePicker = () => { paint(); showRelevant(); paintPalette(); };

    /* The still field has its own small picker, built the same way, because a
       composition is a picture too and a list of four words would say less. */
    applyAtmosphere();
    paintPalette();
    showRelevant();
    paint();
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
    } else if (["theme", "polar", "violet", "ember", "mono"].includes(look.bgPalette)) {
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
    const switcher = document.getElementById("color-mode-switcher");
    window.NordlysUI?.trackThumb(switcher, switcher?.querySelector(".mode-btn.active"));
  }

  syncFormValues() {
    const cfg = this.app.config;
    const daylightSwitch = document.getElementById("cfg-bg-daylight");
    if (daylightSwitch) daylightSwitch.checked = cfg.bgDaylight === true;
    this.syncBoardLayout();
    
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

    // Aesthetics Sliders & Selects
    const glassLevel = document.getElementById("cfg-glass-level");
    const cardRadius = document.getElementById("cfg-card-radius");
    const tileSize = document.getElementById("cfg-tile-size");
    const cardGap = document.getElementById("cfg-card-gap");
    const cardGlow = document.getElementById("cfg-card-glow");
    const hoverEffect = document.getElementById("cfg-hover-effect");
    const iconShape = document.getElementById("cfg-icon-shape");

    if (glassLevel) glassLevel.value = cfg.glassLevel || "full";
    const highLegibility = document.getElementById("cfg-high-legibility");
    if (highLegibility) highLegibility.checked = Boolean(cfg.highLegibility);
    if (cardRadius) cardRadius.value = cfg.cardRadius != null ? cfg.cardRadius : 18;
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
    const lblGlow = document.getElementById("lbl-glow");
    const lblBgBlur = document.getElementById("lbl-bgblur");
    const lblBgDim = document.getElementById("lbl-bgdim");

    if (lblRadius) lblRadius.textContent = `${cfg.cardRadius != null ? cfg.cardRadius : 18}px`;
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
    const radiusVal = `${cfg.cardRadius != null ? cfg.cardRadius : 18}px`;

    /* The preview reads the same tokens the real surface does, so it cannot
       drift from it and cannot invent a fifth filter function of its own. */
    previewCard.style.removeProperty("backdrop-filter");
    previewCard.style.removeProperty("-webkit-backdrop-filter");
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
      this.updateMiniPreview();
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
      this.updateMiniPreview();
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
    });
    cardGlow?.addEventListener("change", () => this.app.saveConfig());

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
      const raw = localStorage.getItem("nordlys_custom_themes");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveCustomThemes() {
    localStorage.setItem("nordlys_custom_themes", JSON.stringify(this.customThemes));
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
    const languageSelect = document.getElementById("cfg-language-select");
    const userName = document.getElementById("cfg-user-name");
    const timeFormat = document.getElementById("cfg-time-format");
    const showSeconds = document.getElementById("cfg-show-seconds");
    const openNewTab = document.getElementById("cfg-open-newtab");
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
  /* The board's layout and rows, mirrored here from the arrangement that owns
     them, and the door into it. */
  initBoardLayout() {
    const options = [...document.querySelectorAll(".board-layout-option")];
    for (const option of options) {
      option.addEventListener("click", () => {
        this.app.grid?.arrange?.setLayout(option.dataset.layout);
        this.syncBoardLayout();
      });
      option.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = options[(options.indexOf(option) + step + options.length) % options.length];
        next.focus();
        next.click();
      });
    }
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
    window.addEventListener("nordlys:languagechange", () => this.syncBoardLayout());
    this.syncBoardLayout();
  }

  syncBoardLayout() {
    const config = this.app.config;
    const current = config.boardLayout === "fitted" ? "fitted" : "natural";
    for (const option of document.querySelectorAll(".board-layout-option")) {
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
  }

  initBookmarksManager() {
    this.initBoardLayout();
    document.getElementById("cfg-add-group")?.addEventListener("click", () => {
      this.app.config.groups.push({
        id: `g_${Date.now()}`,
        label: window.I18N?.t("bookmarks.newFolder") || "New Folder",
        cols: 4,
        links: []
      });
      this.app.saveConfig();
      this.app.grid?.render();
      this.renderBookmarksManager();
    });
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
      const addBkmText = window.I18N ? window.I18N.t('bookmarks.addBookmark') : '+ Add Bookmark';
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

  /* ── 8. Universal 5-Source Icon Picker Modal ─────────────────── */
  initIconPickerModal() {
    const modalX = document.getElementById("modal-x");

    modalX?.addEventListener("click", () => this.closeIconModal());

    // Tab 1: explicit online discovery. Search terms leave the device only
    // after the person presses Search, and the chosen SVG is embedded locally.
    const iconSearch = document.getElementById("icon-search");
    const iconSearchBtn = document.getElementById("icon-search-btn");
    const iconSearchStatus = document.getElementById("icon-search-status");
    const iconSearchGrid = document.getElementById("modal-icon-grid");
    let searchSequence = 0;
    let searchController = null;

    const say = (key, fallback) => {
      const value = window.I18N?.t(key);
      return value && value !== key ? value : fallback;
    };
    const renderSearchResults = (results) => {
      iconSearchGrid?.replaceChildren();
      for (const result of results) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-item discovered-icon";
        button.setAttribute("aria-label", result.name);
        const image = document.createElement("img");
        image.src = result.dataUrl;
        image.alt = "";
        const name = document.createElement("span");
        name.textContent = result.name;
        // The source is named once, under the results, not on every tile.
        button.append(image, name);
        button.addEventListener("click", () => {
          if (!this.activeIconTarget) return;
          const { gIdx, lIdx } = this.activeIconTarget;
          const link = this.app.config.groups[gIdx]?.links[lIdx];
          if (!link) return;
          link.customImg = result.dataUrl;
          link.iconSource = result.id;
          delete link.icon;
          delete link.monogram;
          window.NordlysIconHistory?.leave(link);
          this.app.saveConfig();
          this.app.grid?.updateTileDOM(gIdx, lIdx);
          this.renderBookmarksManager();
          this.closeIconModal();
        });
        iconSearchGrid?.append(button);
      }
    };
    const searchOnline = async () => {
      const query = iconSearch?.value.trim();
      if (!query) {
        if (iconSearchStatus) iconSearchStatus.textContent = say("picker.searchNeedsQuery", "Enter a brand or product name.");
        iconSearch?.focus();
        return;
      }
      const sequence = ++searchSequence;
      searchController?.abort();
      const controller = new AbortController();
      searchController = controller;
      iconSearchBtn?.setAttribute("aria-busy", "true");
      if (iconSearchStatus) iconSearchStatus.textContent = say("picker.searching", "Searching official vector collections…");
      try {
        const target = this.activeIconTarget;
        const link = target ? this.app.config.groups[target.gIdx]?.links[target.lIdx] : null;
        const results = await window.NordlysIconDiscovery.search(query, { colour: link?.color, signal: controller.signal });
        if (sequence !== searchSequence) return;
        renderSearchResults(results);
        if (iconSearchStatus) iconSearchStatus.textContent = results.length
          ? say("picker.searchFound", "Choose a vector to save it locally.")
          : say("picker.searchEmpty", "No brand mark found. Try the website icon or paste an image URL.");
      } catch {
        if (sequence !== searchSequence) return;
        iconSearchGrid?.replaceChildren();
        if (iconSearchStatus) iconSearchStatus.textContent = say("picker.searchFailed", "Search unavailable. Try again or use the website icon.");
      } finally {
        if (sequence === searchSequence) {
          searchController = null;
          iconSearchBtn?.removeAttribute("aria-busy");
        }
      }
    };
    iconSearchBtn?.addEventListener("click", searchOnline);
    iconSearch?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      searchOnline();
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
    /* The browser's own favicon cache is the default source. It is local, it
       already holds every site the person has visited — which is every site
       they would bookmark — and asking it sends nothing anywhere. A remote
       provider is contacted only when its chip is pressed. */
    this.currentFaviconSource = "chrome";
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
          case "direct":
            return `${parsed.origin}/apple-touch-icon.png`;
          case "chrome":
          default:
            /* Root-relative on purpose. The page is served from the extension's
               own origin, so this resolves there without chrome.runtime.getURL,
               and — unlike the absolute chrome-extension://<id>/ form — it
               still resolves after a reinstall or on another profile, where
               the id differs. */
            return `/_favicon/?pageUrl=${encodeURIComponent(parsed.origin)}&size=64`;
        }
      } catch (e) {
        return null;
      }
    };

    const fetchAndDisplayFavicon = async (customProvider = null) => {
      const provider = customProvider || this.currentFaviconSource || "chrome";
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

      const say = (key, fallback) => (window.I18N ? window.I18N.t(key) : fallback);
      if (favStatus) favStatus.textContent = provider === "chrome" ? say("picker.faviconLocal", "From your browser's own cache") : say("picker.faviconFetching", "Fetching…");
      const resolvedFavUrl = buildFaviconUrl(rawUrl, provider);
      const badge = document.getElementById("favicon-res-badge");
      if (badge) badge.hidden = true;
      if (!resolvedFavUrl) {
        if (favStatus) favStatus.textContent = say("picker.faviconInvalid", "That isn't a site address or a domain.");
        return;
      }

      this.currentFetchedFaviconUrl = resolvedFavUrl;
      if (favImgBox) {
        favImgBox.replaceChildren();
        const img = document.createElement("img");
        img.alt = "";
        img.style.cssText = "width: 100%; height: 100%; object-fit: contain; cursor: pointer;";
        /* A miss stays a miss. This used to fall back to DuckDuckGo on its
           own, which meant a failed local lookup became a network request the
           person never asked for. Now it says so, and the chips are right
           there. */
        img.addEventListener("error", () => {
          if (favStatus) favStatus.textContent = say("picker.faviconMissing", "No icon found here. Try another source.");
          this.currentFetchedFaviconUrl = null;
        }, { once: true });
        img.addEventListener("load", () => {
          if (favStatus && provider !== "chrome") favStatus.textContent = say("picker.faviconReady", "Icon ready");
          // The size that actually arrived, not the size asked for.
          if (badge) { badge.textContent = `${img.naturalWidth}×${img.naturalHeight}`; badge.hidden = false; }
        }, { once: true });
        img.src = resolvedFavUrl;
        favImgBox.appendChild(img);
        favImgBox.onclick = () => this.currentFetchedFaviconUrl && this.openCropper(this.currentFetchedFaviconUrl, "favicon");
      }
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
        this.currentFaviconSource = chip.dataset.favSource || "chrome";
        fetchAndDisplayFavicon(this.currentFaviconSource);
      });
    });
    /* Loaded when the website-icon tab is opened, not when the picker is. */
    this.refreshFaviconPreview = () => fetchAndDisplayFavicon();
    this.resetFaviconSource = () => {
      this.currentFaviconSource = "chrome";
      this.currentFetchedFaviconUrl = null;
      favSourceChips.forEach((c) => c.classList.toggle("active", c.dataset.favSource === "chrome"));
    };

    favApplyBtn?.addEventListener("click", () => {
      const url = this.currentFetchedFaviconUrl || buildFaviconUrl(favUrlInput?.value.trim(), this.currentFaviconSource);
      if (url && this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          link.customImg = url;
          delete link.icon;
          delete link.monogram;
          delete link.iconSource;
          window.NordlysIconHistory?.leave(link);
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
    const urlEditing = document.getElementById("icon-url-editing");
    const urlHistory = document.getElementById("icon-url-history");
    const urlStrip = urlHistory?.querySelector(".icon-url-strip");
    const addresses = window.NordlysIconHistory;
    this.currentLoadedUrl = null;
    /* The address the preview came from, and the remembered one being
       changed, if any. The picture alone is what used to be kept. */
    this.urlSource = null;
    this.urlEditingFrom = null;

    const word = (key, fallback, params) => {
      const value = window.I18N?.t(key, params);
      return value && value !== key ? value : fallback;
    };
    const targetLink = () => {
      const target = this.activeIconTarget;
      return target ? this.app.config.groups[target.gIdx]?.links[target.lIdx] : null;
    };
    const showActions = (shown) => { if (urlActions) urlActions.style.display = shown ? "flex" : "none"; };
    /* Success is said only once the image has actually decoded. The loader
       hands the address back unchanged when every way of fetching it failed,
       and this used to announce that as "loaded successfully" regardless. */
    const handleUrlLoaded = async (url) => {
      const decodes = await new Promise((done) => {
        const probe = new Image();
        probe.onload = () => done(probe.naturalWidth > 0);
        probe.onerror = () => done(false);
        probe.src = url;
      });
      if (!decodes) {
        this.currentLoadedUrl = null;
        this.urlSource = null;
        if (urlStatus) urlStatus.textContent = word("modal.imageFailed", "No image came back from that address");
        showActions(false);
        return;
      }
      this.currentLoadedUrl = url;
      if (urlImgBox) {
        this.setPreviewImage(urlImgBox, url, () => this.openCropper(url, "url"));
      }
      if (urlStatus) urlStatus.textContent = word("modal.imageLoaded", "Image ready");
      showActions(true);
    };
    let previewSequence = 0;
    const previewAddress = async (address) => {
      if (!address) return;
      const sequence = ++previewSequence;
      // Until it arrives there is nothing to use: the buttons would have
      // applied the picture that was there before.
      this.currentLoadedUrl = null;
      this.urlSource = null;
      showActions(false);
      urlImgBox?.classList.add("is-loading");
      if (urlStatus) urlStatus.textContent = word("modal.imageLoading", "Loading the image…");
      const cleanDataUrl = await this.loadImageAsCleanBase64(address);
      // A newer address was asked for while this one was on its way.
      if (sequence !== previewSequence) return;
      urlImgBox?.classList.remove("is-loading");
      this.urlSource = addresses?.isAddress(address) ? address.trim() : null;
      await handleUrlLoaded(cleanDataUrl);
    };

    /* Changing a remembered address: the field is where it is changed, and
       what is used next takes the old one's place instead of joining it. */
    const setEditing = (address) => {
      this.urlEditingFrom = address || null;
      if (urlEditing) urlEditing.hidden = !address;
      urlStrip?.querySelectorAll(".icon-url-version").forEach((item) => item.classList.toggle("is-editing", item.dataset.url === address));
    };
    document.getElementById("icon-url-editing-cancel")?.addEventListener("click", () => {
      const link = targetLink();
      setEditing(null);
      showCurrent(link);
      urlInput?.focus();
    });

    /* What the pane shows for the icon the bookmark has now. */
    const showCurrent = (link) => {
      this.currentLoadedUrl = null;
      this.urlSource = null;
      previewSequence++;
      urlImgBox?.classList.remove("is-loading");
      const image = link?.customImg;
      const address = link?.iconUrl || (/^https?:\/\//i.test(image || "") ? image : "");
      if (urlInput) urlInput.value = address;
      if (image && /^(https?:|data:)/i.test(image)) {
        if (urlImgBox) this.setPreviewImage(urlImgBox, image, () => this.openCropper(image, "url"));
        if (urlStatus) urlStatus.textContent = address
          ? word("picker.urlCurrent", "In use, from this address")
          : word("picker.urlCurrentImage", "The picture in use now");
        showActions(true);
        this.currentLoadedUrl = image;
        this.urlSource = addresses?.isAddress(address) ? address : null;
      } else {
        if (urlImgBox) {
          const empty = document.createElement("span");
          empty.className = "icon-url-empty";
          empty.textContent = word("modal.noImage", "No image");
          urlImgBox.replaceChildren(empty);
          urlImgBox.onclick = null;
        }
        if (urlStatus) urlStatus.textContent = word("modal.urlHint", "Enter an image address above to try it");
        showActions(false);
      }
    };

    const thumbOf = (entry, current) => {
      const box = document.createElement("span");
      box.className = "icon-url-thumb";
      const picture = entry.thumb || (current ? targetLink()?.customImg : "");
      if (picture) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = picture;
        image.draggable = false;
        box.append(image);
      } else {
        const letter = document.createElement("span");
        letter.className = "icon-url-letter";
        letter.textContent = (addresses.hostOf(entry.url).charAt(0) || "?").toUpperCase();
        box.append(letter);
      }
      return box;
    };
    const toolButton = (tool, label, title, path) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-url-tool";
      button.dataset.tool = tool;
      button.tabIndex = -1;
      button.setAttribute("aria-label", label);
      button.title = title;
      button.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
      return button;
    };
    const versionItem = (entry, link) => {
      const current = link?.iconUrl === entry.url;
      const host = addresses.hostOf(entry.url);
      const item = document.createElement("li");
      item.className = "icon-url-version";
      item.classList.toggle("is-current", current);
      item.classList.toggle("is-editing", this.urlEditingFrom === entry.url);
      item.dataset.url = entry.url;
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "icon-url-pick";
      pick.tabIndex = -1;
      pick.title = current ? `${word("picker.urlInUse", "In use")} · ${entry.url}` : entry.url;
      pick.setAttribute("aria-label", current ? word("picker.urlVersionInUse", `${host}, in use`, { host }) : host);
      pick.setAttribute("aria-keyshortcuts", "Delete");
      if (current) pick.setAttribute("aria-current", "true");
      const name = document.createElement("span");
      name.className = "icon-url-host";
      name.textContent = host;
      pick.append(thumbOf(entry, current), name);
      const tools = document.createElement("span");
      tools.className = "icon-url-tools";
      tools.append(
        toolButton("edit", word("picker.urlEditOf", `Change the address from ${host}`, { host }), word("picker.urlEdit", "Change the address"), '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
        toolButton("remove", word("picker.urlRemoveOf", `Remove ${host} from this list`, { host }), word("picker.urlRemove", "Remove from this list"), '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
      );
      item.append(pick, tools);
      return item;
    };
    /* One stop in the tab order for the whole strip; the arrows walk it, and
       the chosen version's own tools follow it. */
    const rove = (item, focus = false) => {
      urlStrip?.querySelectorAll(".icon-url-version").forEach((other) => {
        const on = other === item;
        other.querySelectorAll("button").forEach((button) => { button.tabIndex = on ? 0 : -1; });
      });
      if (focus) item?.querySelector(".icon-url-pick")?.focus();
    };
    const renderHistory = (link, { arriving = null, focusUrl = null } = {}) => {
      if (!urlStrip || !urlHistory || !addresses) return;
      const entries = addresses.list(link);
      urlHistory.hidden = entries.length === 0;
      urlStrip.replaceChildren(...entries.map((entry) => versionItem(entry, link)));
      const items = [...urlStrip.children];
      const focused = items.find((item) => item.dataset.url === focusUrl);
      if (arriving) items.find((item) => item.dataset.url === arriving)?.classList.add("is-arriving");
      rove(focused || items.find((item) => item.classList.contains("is-current")) || items[0], Boolean(focused));
    };
    this.renderIconUrlHistory = (link) => {
      setEditing(null);
      showCurrent(link);
      renderHistory(link);
    };

    /* A version taken off the list folds away where it stood; the icon on the
       tile is untouched, and the one Undo puts it back. */
    const removeVersion = (item) => {
      const link = targetLink();
      const url = item?.dataset.url;
      if (!link || !url || !addresses) return;
      const removed = addresses.forget(link, url);
      if (!removed) return;
      this.app.saveConfig();
      if (this.urlEditingFrom === url) setEditing(null);
      // The address the icon claimed is gone, so the pane stops saying so.
      if (removed.wasCurrent && urlInput?.value.trim() === url) showCurrent(link);
      const neighbour = item.nextElementSibling || item.previousElementSibling;
      const hadFocus = item.contains(document.activeElement);
      if (neighbour) rove(neighbour, hadFocus);
      else if (hadFocus) urlInput?.focus();
      const gone = () => {
        item.remove();
        if (urlHistory) urlHistory.hidden = !urlStrip?.children.length;
      };
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !item.animate) gone();
      else {
        /* Compositor-only, like everything else that moves here: the version
           fades and shrinks where it stood, then leaves, and the ones after it
           glide into the gap (FLIP) instead of the strip's width animating. */
        item.style.pointerEvents = "none";
        item.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.8)" }], NordlysUI.motion("fast"))
          .finished.then(() => NordlysUI.animateReflow(urlStrip, gone), gone);
      }
      NordlysUI.showUndoToast({
        message: word("picker.urlRemoved", "Address removed; the icon stays as it is"),
        onAction: () => {
          const back = targetLink() === link ? link : null;
          addresses.restore(link, removed);
          this.app.saveConfig();
          if (back && removed.wasCurrent && !urlInput?.value.trim()) showCurrent(link);
          if (back) renderHistory(link, { arriving: url, focusUrl: urlStrip?.contains(document.activeElement) ? url : null });
        }
      });
    };

    urlStrip?.addEventListener("click", (event) => {
      const item = event.target.closest(".icon-url-version");
      if (!item) return;
      const link = targetLink();
      const url = item.dataset.url;
      const tool = event.target.closest(".icon-url-tool")?.dataset.tool;
      rove(item);
      if (tool === "remove") { removeVersion(item); return; }
      if (tool === "edit") {
        setEditing(url);
        if (urlInput) { urlInput.value = url; urlInput.focus(); urlInput.select(); }
        previewAddress(url);
        return;
      }
      setEditing(null);
      if (link?.iconUrl === url) { showCurrent(link); return; }
      if (urlInput) urlInput.value = url;
      previewAddress(url);
    });
    urlStrip?.addEventListener("keydown", (event) => {
      const item = event.target.closest(".icon-url-version");
      if (!item) return;
      const items = [...urlStrip.children];
      const at = items.indexOf(item);
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key] * (getComputedStyle(urlStrip).direction === "rtl" ? -1 : 1);
      let next = null;
      if (Number.isFinite(step)) next = items[Math.max(0, Math.min(items.length - 1, at + step))];
      else if (event.key === "Home") next = items[0];
      else if (event.key === "End") next = items[items.length - 1];
      else if ((event.key === "Delete" || event.key === "Backspace") && event.target.classList.contains("icon-url-pick")) {
        event.preventDefault();
        removeVersion(item);
        return;
      }
      if (!next) return;
      event.preventDefault();
      rove(next, true);
    });

    urlCheckBtn?.addEventListener("click", () => previewAddress(urlInput?.value.trim()));
    urlInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      previewAddress(urlInput.value.trim());
    });
    // What the buttons would use is what the preview shows, never a field that
    // has since been changed under it.
    urlInput?.addEventListener("input", () => {
      if (urlInput.value.trim() === (this.urlSource || "")) return;
      if (!this.currentLoadedUrl) return;
      this.currentLoadedUrl = null;
      this.urlSource = null;
      showActions(false);
      if (urlStatus) urlStatus.textContent = word("picker.urlChanged", "Press Preview to see this address");
    });

    urlCropBtn?.addEventListener("click", () => {
      if (this.currentLoadedUrl) {
        this.openCropper(this.currentLoadedUrl, "url");
      }
    });

    urlApplyBtn?.addEventListener("click", async () => {
      const url = this.currentLoadedUrl;
      const link = targetLink();
      if (!url || !link || urlApplyBtn.disabled) return;
      const { gIdx, lIdx } = this.activeIconTarget;
      urlApplyBtn.disabled = true;
      try {
        // The same size budget a file gets: a picture fetched from an address
        // was stored whole, however large.
        const image = await this.iconSizedDataUrl(url);
        link.customImg = image;
        delete link.icon;
        delete link.monogram;
        delete link.iconSource;
        await this.noteIconAddress(link, this.urlSource, image);
        this.app.saveConfig();
        this.app.grid?.updateTileDOM(gIdx, lIdx);
        this.renderBookmarksManager();
        this.closeIconModal();
      } finally {
        urlApplyBtn.disabled = false;
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

    /* The hint under the drop zone said "Max 5MB" and nothing held anyone to
       it; an oversized or non-image file was taken, or silently ignored. Now
       the hint line says why a file was refused, and says it out loud too. */
    const fileHint = document.getElementById("icon-file-hint");
    const refuseFile = (key, fallback) => {
      const message = word(key, fallback);
      if (fileHint) {
        fileHint.textContent = message;
        fileHint.classList.add("refused");
      }
      window.NordlysUI?.announce?.(message);
    };
    const processUploadedFile = (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) { refuseFile("modal.fileNotImage", "That file is not an image"); return; }
      if (file.size > 5 * 1024 * 1024) { refuseFile("modal.fileTooLarge", "That file is over 5 MB"); return; }
      if (fileHint) {
        fileHint.textContent = word("modal.fileHint", "PNG, SVG, JPG, WebP or GIF, up to 5 MB");
        fileHint.classList.remove("refused");
      }
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

    fileApplyBtn?.addEventListener("click", async () => {
      if (this.uploadedDataUrl && this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          link.customImg = await this.iconSizedDataUrl(this.uploadedDataUrl);
          delete link.icon;
          delete link.monogram;
          delete link.iconSource;
          window.NordlysIconHistory?.leave(link);
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

    /* The letters are shown the way the tile will draw them — on its plate,
       in its tone — here and in the tile preview above, instead of white on
       a gradient no tile ever wears. */
    this.paintMonogram = (link, letters) => {
      const source = { ...link, monogram: letters || (link?.name || "A").trim().charAt(0).toUpperCase() || "A" };
      delete source.customImg;
      delete source.icon;
      for (const box of [monogramBox, document.querySelector("#icon-live-preview .box")]) {
        if (!box || !window.NordlysIcons) continue;
        const presentation = NordlysIcons.resolvePresentation({ source, metadata: {}, isLight: document.documentElement.classList.contains("light-ui") });
        box.replaceChildren(NordlysIcons.renderIcon(presentation));
        box.style.setProperty("--c", link?.color || "var(--nl-accent)");
        NordlysIcons.applyIconContrast(box);
      }
    };
    monogramInput?.addEventListener("input", (e) => {
      const target = this.activeIconTarget;
      const link = target ? this.app.config.groups[target.gIdx]?.links[target.lIdx] : null;
      this.paintMonogram(link, e.target.value.trim().toUpperCase());
    });

    monogramApplyBtn?.addEventListener("click", () => {
      if (this.activeIconTarget) {
        const { gIdx, lIdx } = this.activeIconTarget;
        const link = this.app.config.groups[gIdx]?.links[lIdx];
        if (link) {
          delete link.customImg;
          delete link.icon;
          delete link.iconSource;
          window.NordlysIconHistory?.leave(link);
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
    this.cropperPrevSourceTab = "custom";
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
    applyBtn?.addEventListener("click", async () => {
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
        delete link.iconSource;
        await this.noteIconAddress(link, this.cropperAddress, exportCanvas);
        this.app.saveConfig();
        this.app.grid?.updateTileDOM(gIdx, lIdx);
        this.renderBookmarksManager();
      }
      this.closeIconModal();
    });

    // Use Original Image (Bypass crop)
    useOrigBtn?.addEventListener("click", async () => {
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
            link.customImg = await this.iconSizedDataUrl(this.cropperOriginalSource);
            delete link.icon;
            delete link.monogram;
            delete link.iconSource;
            await this.noteIconAddress(link, this.cropperAddress, link.customImg);
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
  /* An icon is drawn at a few dozen pixels, and it is stored inside the config,
     which lives in a store of a few megabytes shared with everything else. The
     full file went in as it came — up to 5 MB for one tile — so a single photo
     could leave no room to save anything. A raster is kept at 256 pixels on its
     longer side, as WebP; a vector is already small and stays a vector. */
  async iconSizedDataUrl(dataUrl, longest = 256) {
    // A vector stays a vector unless it is heavy: an SVG fetched from an
    // address can carry megabytes of embedded images or path data.
    if (!dataUrl || (/^data:image\/svg\+xml/i.test(dataUrl) && dataUrl.length <= 150000)) return dataUrl;
    try {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const svg = /^data:image\/svg\+xml/i.test(dataUrl);
      const width = image.naturalWidth || longest, height = image.naturalHeight || longest;
      // A vector is drawn at the full icon size, whatever size it declares.
      const scale = svg ? longest / Math.max(width, height) : Math.min(1, longest / Math.max(width, height));
      if (!svg && scale === 1 && dataUrl.length < 200000) return dataUrl;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.9);
    } catch {
      return dataUrl;
    }
  }

  /* The small picture a remembered address is shown by: drawn once, from the
     icon that was saved, so the list never asks the network for anything. */
  async iconThumb(source, size = 64) {
    if (!source) return "";
    try {
      let image = source;
      if (typeof source === "string") {
        image = new Image();
        image.src = source;
        await image.decode();
      }
      const width = image.naturalWidth || image.width || size;
      const height = image.naturalHeight || image.height || size;
      const scale = Math.min(size / width, size / height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale);
      const webp = canvas.toDataURL("image/webp", 0.82);
      return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
    } catch {
      // A picture from another site that would not let itself be read.
      return "";
    }
  }

  /* After an icon is applied: the address it came from goes to the front of
     the bookmark's list, or takes the place of the one being changed; any
     other kind of icon means the tile no longer claims an address. */
  async noteIconAddress(link, address, picture) {
    const addresses = window.NordlysIconHistory;
    if (!addresses) return;
    if (!addresses.isAddress(address)) { addresses.leave(link); return; }
    const thumb = await this.iconThumb(picture);
    if (this.urlEditingFrom) addresses.replace(link, this.urlEditingFrom, address, thumb);
    else addresses.remember(link, address, thumb);
    this.urlEditingFrom = null;
  }

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
    /* The cropper returns to the pane it was opened from. Its callers still
       name the source they came from, which is no longer a tab of its own. */
    const MERGED = ["url", "upload", "monogram"];
    this.cropperPrevSourceTab = MERGED.includes(sourceTab) ? "custom" : (sourceTab || "custom");
    this.cropperOriginalSource = imageSource;
    // Only a picture that came from an address the person gave has one to keep.
    this.cropperAddress = sourceTab === "url" ? this.urlSource : null;

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
    // The bookmark itself, so another tab's save can find where it went.
    this.activeIconLink = link;

    // 1. Update Modal Title with Bookmark Name
    const titleEl = document.querySelector("#icon-modal .modal-head b");
    if (titleEl) {
      const name = link.name || "Bookmark";
      const title = window.I18N?.t("picker.titleFor", { name });
      titleEl.textContent = title && title !== "picker.titleFor" ? title : `Icon for “${name}”`;
    }

    /* 2. The website-icon pane is prepared, not loaded. Opening the picker used
       to build a Google favicon URL and fetch it at once, before the person had
       chosen anything — they might have wanted the built-in icon and never
       looked at this tab. The image is requested when the tab is opened, from
       the browser's own cache unless another source is chosen. */
    const favUrlInput = document.getElementById("favicon-url-input");
    const favDomainName = document.getElementById("favicon-domain-name");
    const favImgBox = document.getElementById("favicon-preview-img-box");
    const favStatus = document.getElementById("favicon-status");
    this.resetFaviconSource?.();
    if (favUrlInput) {
      favUrlInput.value = link.url || "";
      let host = "";
      try { if (link.url && /^https?:\/\//i.test(link.url)) host = new URL(link.url).hostname; } catch (e) {}
      if (favDomainName) favDomainName.textContent = host || (link.url || "");
      if (favImgBox) favImgBox.replaceChildren();
      if (favStatus) favStatus.textContent = host
        ? (window.I18N ? window.I18N.t("picker.faviconLocal") : "From your browser's own cache")
        : (window.I18N ? window.I18N.t("picker.faviconNeedsUrl") : "Enter the site address above");
    }

    // 3. The address the icon came from, and the ones it came from before.
    this.renderIconUrlHistory?.(link);

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
      const livePreview = document.querySelector("#icon-live-preview .box")?.cloneNode(true);
      this.paintMonogram?.(link, initialChar);
      // Only the square shows the letters on opening; the tile above keeps the
      // icon the bookmark has now until the letters are being typed.
      if (livePreview) document.querySelector("#icon-live-preview .box")?.replaceWith(livePreview);
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

    // 7. Which tab opens first
    // A pasted URL, an uploaded file and a monogram share one pane now, so
    // whichever of them the bookmark is already using lands in the same place.
    const kind = window.NordlysIcons.classifyIcon(link);
    const defaultTab = kind === "favicon" ? "favicon" : (link.customImg && !link.iconSource) || link.monogram ? "custom" : "search";

    this.iconPicker.select(defaultTab);
    this.activeModalTab = defaultTab;

    // 8. Prepare discovery without contacting its provider.
    const searchIpt = document.getElementById("icon-search");
    if (searchIpt) searchIpt.value = link.name || "";
    document.getElementById("modal-icon-grid")?.replaceChildren();
    const searchStatus = document.getElementById("icon-search-status");
    if (searchStatus) searchStatus.textContent = window.I18N?.t("picker.searchIdle") || "Search happens only when you ask.";

    this.iconPicker.open(link, opener);
    if (defaultTab === "search") queueMicrotask(() => searchIpt?.focus());
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
  /* Two rows, two questions, and each only visible when there is something
     behind it. A restore button with nothing behind it is worse than none: it
     promises a safety net.

       restore point — what was here before Nordlys changed it: a migration on
                       load, or an import.
       undo point    — one step back from the last thing you did that replaced
                       everything: a reset, or a restore. */
  initRestorePoint() {
    this.renderRecoveryRows();
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
      drawerWidth
    });
  }

  initBackupManager() {
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
                const next = h3.parentElement?.querySelector("dl, DL") || h3.nextElementSibling;
                if (next && next.tagName.toLowerCase() === "dl") {
                  next.querySelectorAll("a, A").forEach((a) => {
                    const url = a.getAttribute("href") || a.href;
                    if (url && !window.NordlysConfigSchema.isForbiddenUrl(url)) {
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
                if (url && !window.NordlysConfigSchema.isForbiddenUrl(url)) {
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
            /* JSON. The envelope beside the config is lifted out first, so it
               is never validated as a setting and never stored as one; a file
               without one — every backup written before this build, including
               the 2.0 exports people still have — reads as itself. */
            const file = window.NordlysConfigSchema.readBackupFile(JSON.parse(text));
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
              return;
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
               a copy of a setup that never existed. */
            const previous = this.app.config;
            const putBack = this.holdLocalKeys([RESTORE_POINT_KEY, STORAGE_KEY, "nordlys_custom_themes", "nordlys_drawer_width"]);
            this.app.config = incoming;
            if (!this.app.snapshotBeforeMigration(previous, "import")
              || !this.adoptImportedExtras(file.extras)
              || !this.app.saveConfig()) {
              this.app.config = previous;
              putBack();
              this.sayNoRoom("toast.saveFailed");
              return;
            }
            location.reload();
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
        if (!this.keepAWayBack("reset", { media: aside.media })) { await aside.putBack(); return; }
        for (const key of OWNED_LOCAL_KEYS) {
          try { localStorage.removeItem(key); } catch (error) { /* already gone */ }
        }
        try { await MediaVault.deleteMedia("custom_bg"); } catch (e) {}
        NordlysUI.announce(this.text("toast.resetDone", "Everything was reset"));
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.clear(() => location.reload());
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
  adoptImportedExtras(extras = {}) {
    try {
      if (Array.isArray(extras.customThemes)) localStorage.setItem("nordlys_custom_themes", JSON.stringify(extras.customThemes));
      if (extras.drawerWidth) localStorage.setItem("nordlys_drawer_width", extras.drawerWidth);
      return true;
    } catch (error) { return false; }
  }
}
