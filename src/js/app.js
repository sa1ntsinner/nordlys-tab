/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - MAIN ORCHESTRATOR & APPLICATION BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_CONFIG = {
  version: "2.2.2",
  theme: "aurora-void",
  colorMode: "dark",
  bgMode: "aurora",
  glassLevel: "full",
  headerStyle: "full",
  bgBlur: 0,
  bgDim: 0,
  timeFormat: "24h",
  showSeconds: false,
  userName: "",
  openNewTab: false,
  cardRadius: 24,
  tileSize: 78,
  cardGap: 12,
  cardGlow: 40,
  hoverEffect: "lift",
  iconShape: "squircle",
  customCss: "",
  groups: [
    {
      label: "DAILY",
      cols: 4,
      hidden: false,
      links: [
        { name: "YouTube", url: "https://www.youtube.com/", color: "#ff6b6b", icon: "youtube" },
        { name: "Notion", url: "https://www.notion.so/", color: "#f8f9fa", icon: "notion" },
        { name: "ChatGPT", url: "https://chatgpt.com/", color: "#10a37f", icon: "openai" },
        { name: "Reddit", url: "https://www.reddit.com/", color: "#ff8c42", icon: "reddit" },
        { name: "DeepL", url: "https://www.deepl.com/translator", color: "#4d96ff", icon: "deepl" },
        { name: "Spotify", url: "https://open.spotify.com/", color: "#1db954", icon: "spotify" },
        { name: "Telegram", url: "https://web.telegram.org/a/", color: "#29b6f6", icon: "telegram" },
        { name: "Netflix", url: "https://www.netflix.com/", color: "#e50914", icon: "netflix" }
      ]
    },
    {
      label: "DEV & TECH",
      cols: 3,
      hidden: false,
      links: [
        { name: "GitHub", url: "https://github.com/", color: "#9aa5b1", icon: "github" },
        { name: "LeetCode", url: "https://leetcode.com/", color: "#ffa116", icon: "leetcode" },
        { name: "Gemini", url: "https://gemini.google.com/app", color: "#8ab4f8", icon: "gemini" },
        { name: "Perplexity", url: "https://www.perplexity.ai/", color: "#22b8cd", icon: "perplexity" },
        { name: "Deep-ML", url: "https://www.deep-ml.com/", color: "#d946ef", icon: "brain" },
        { name: "VIA Keymap", url: "https://usevia.app/", color: "#06b6d4", icon: "keyboard" }
      ]
    },
    {
      label: "STUDIES",
      cols: 2,
      hidden: false,
      links: [
        { name: "Moodle", url: "https://moodle.tu-dortmund.de/my/", color: "#f97316", icon: "school" },
        { name: "BOSS TU", url: "https://www.boss.tu-dortmund.de/", color: "#84cc16", icon: "school" }
      ]
    },
    {
      label: "GAMING & SIM",
      cols: 2,
      hidden: false,
      links: [
        { name: "Steam", url: "https://store.steampowered.com/", color: "#66c0f4", icon: "steam" },
        { name: "GG.deals", url: "https://gg.deals/", color: "#a855f7", icon: "tag" },
        { name: "LFM Sim", url: "https://lowfuelmotorsport.com/", color: "#ef4444", icon: "flag" },
        { name: "RaceControl", url: "https://game.racecontrol.gg/", color: "#38bdf8", icon: "steering" }
      ]
    },
    {
      label: "SHOPPING",
      cols: 2,
      hidden: false,
      links: [
        { name: "AliExpress", url: "https://www.aliexpress.com/", color: "#ff4747", icon: "bag" },
        { name: "Kleinanzeigen", url: "https://www.kleinanzeigen.de/", color: "#86efac", icon: "bag" }
      ]
    }
  ]
};

/* Inline CSS custom properties a custom theme may set — cleared on preset switch */
const THEME_INLINE_TOKENS = [
  "--void", "--void-gradient", "--glass", "--glass-border", "--frost",
  "--card-tint", "--card-tint-deep",
  "--accent", "--accent-glow", "--nl-on-accent", "--ink", "--dim", "--faint",
  "--font-main", "--font-display",
  "--shader-1", "--shader-2", "--shader-3",
  // Legacy aliases kept for older user Custom CSS
  "--bg-void", "--card-bg", "--card-border", "--font-family"
];

/* Single source of truth for storage keys and theme classification */
/* The product is called Nordlys and so is everything it writes. It was not
   always: the first storage key was "aurora_tab_config", the second
   "aether_tab_config", and the class names, the global, the event names and
   the IndexedDB database all carried the earlier name too. Three names for one
   thing is the surest sign that three different hands built it. Every key an
   older build wrote is listed here and moved under the new name on first run,
   so nobody's setup is lost to a rename. */
const STORAGE_KEY = "nordlys_config";
const LEGACY_STORAGE_KEYS = ["aether_tab_config", "aurora_tab_config"];
const LEGACY_LOCAL_KEYS = {
  "aether_tab_config": STORAGE_KEY,
  "aurora_tab_config": STORAGE_KEY,
  "aurora_search_history": "nordlys_search_history",
  "aurora_language": "nordlys_language",
  "aurora_drawer_width": "nordlys_drawer_width",
  "aurora_custom_themes": "nordlys_custom_themes"
};

/* Runs before anything reads storage. A new key that already exists wins; an
   old key is copied only into an empty new one, then removed, so the move
   happens exactly once and a fresh install never sees it at all. */
function adoptLegacyLocalStorage() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_LOCAL_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch (error) { /* storage unavailable: nothing to move, nothing to lose */ }
}
/* The last state that existed before a migration rewrote it. */
const RESTORE_POINT_KEY = "nordlys_restore_point";
const LIGHT_THEMES = [
  "porcelain-light", "warm-ivory", "sage-light", "sakura-daylight",
  "solarized-light", "nordic-snow", "lavender-mist", "gruvbox-light",
  "peach-sunset", "mint-breeze"
];
/* Old saved theme keys from previous releases → current keys */
/* Backgrounds that no longer exist, and the closest thing that does. Cosmos was
   Aurora without its ribbons. Particles drew almost nothing — 0.08 of 255 away
   from a plain colour, measured. The four gradient compositions were a choice
   between arrangements that sat 4.5 to 8.7 of 255 apart and were never seen
   side by side, so the difference being chosen between could not be perceived
   by the person choosing.

   All four land on Aurora, and the ones that were still stay still: what people
   used a gradient FOR is a coloured field that does not move, which is now the
   aurora with its motion at zero. One scene and a slider, rather than a second
   scene carrying a catalogue. */
const BACKGROUND_MIGRATIONS = {
  "cosmos": "aurora",
  "particles": "aurora",
  "mesh-gradient": "aurora",
  "gradient": "aurora"
};
const STILL_MIGRATIONS = new Set(["particles", "mesh-gradient", "gradient"]);

const THEME_MIGRATIONS = {
  "liquid-glass": "frosted-glass",
  "liquid-tahoe": "frosted-glass",
  "sakura-blossom": "sakura-daylight",
  "amethyst-twilight": "dracula-velvet",
  "sage-garden": "sage-light",
  "boreal": "boreal-emerald"
};

class NordlysApp {
  constructor() {
    adoptLegacyLocalStorage();
    this.defaultConfig = DEFAULT_CONFIG;
    this.config = this.loadConfig();
    this.mediaObjectUrl = null;
    this.init();
  }

  /* The board is the point of the page; the header is how much context sits
     above it. Kept on <body> so Custom CSS can still see the choice. */
  /* One material at three levels. Someone arriving with the four old numbers
     keeps roughly what they had: whether they had turned the blur off is the
     only distinction the levels can honestly preserve. */
  /* Linked folders are refreshed on load and whenever the browser's bookmarks
     change. Nothing here runs, or asks for anything, until a folder is linked. */
  async followBrowserFolders() {
    const sync = window.NordlysBookmarks;
    if (!sync) return;
    const linked = (this.config.groups || []).some((group) => group.source?.folderId);
    if (!linked) return;

    const pull = async () => {
      if (await sync.refresh(this.config)) {
        this.saveConfig();
        this.grid?.render();
        this.settings?.renderBookmarksManager?.();
      }
    };
    await pull();
    // Debounced: a drag inside the browser's manager fires a burst of events.
    let pending = null;
    sync.watch(() => {
      clearTimeout(pending);
      pending = setTimeout(pull, 250);
    });
  }

  applyGlassLevel() {
    document.documentElement.dataset.glass = this.config.glassLevel || "full";
  }

  applyHeaderStyle() {
    document.body.dataset.header = this.config.headerStyle || "full";
  }

  normalizeStoredConfig(config) {
    let changed = false;
    if (THEME_MIGRATIONS[config.theme]) { config.theme = THEME_MIGRATIONS[config.theme]; changed = true; }
    /* Keyed on the presence of an old value, not the absence of the new one.
       The defaults are merged before this runs, so "glassLevel is missing" can
       never be true — it is in DEFAULT_CONFIG. glassBlur no longer is, so its
       presence means it came from something the user actually saved. */
    if (config.glassBlur !== undefined) {
      const blur = config.glassBlur;
      config.glassLevel = blur === 0 ? "off" : (blur != null && blur <= 14 ? "subtle" : "full");
      for (const dead of ["glassBlur", "glassSaturate", "glassOpacity", "glassSheen"]) delete config[dead];
      changed = true;
    }
    if (BACKGROUND_MIGRATIONS[config.bgMode]) {
      // Whatever held still keeps holding still.
      if (STILL_MIGRATIONS.has(config.bgMode)) config.bgMotion = 0;
      config.bgMode = BACKGROUND_MIGRATIONS[config.bgMode];
      changed = true;
    }
    if (config.gradient !== undefined) { delete config.gradient; changed = true; }
    /* Search goes through Chrome's own default engine now, so a stored engine
       choice has nothing to drive. Dropped rather than kept as dead weight. */
    for (const dead of ["defaultEngine", "customEngineUrl", "showSuggestions"]) {
      if (config[dead] !== undefined) { delete config[dead]; changed = true; }
    }
    if (Number(config.tileSize) >= 50 && Number(config.tileSize) < 56) { config.tileSize = 56; changed = true; }
    return changed;
  }

  /* Across every product in this category, the complaint that turns a five-star
     user into an uninstall in one event is losing their setup — and the most
     common cause is not a crash but an upgrade that migrated something wrongly.
     Nothing here can promise a migration is correct. It can promise the
     previous state still exists afterwards. */
  snapshotBeforeMigration(previous) {
    try {
      const snapshot = {
        savedAt: new Date().toISOString(),
        version: previous.version || "unknown",
        config: previous
      };
      localStorage.setItem(RESTORE_POINT_KEY, JSON.stringify(snapshot));
    } catch (error) {
      /* A snapshot that cannot be written must never stop the app loading. */
    }
  }

  restorePoint() {
    try {
      const raw = localStorage.getItem(RESTORE_POINT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  useRestorePoint() {
    const point = this.restorePoint();
    if (!point || !point.config) return false;
    this.config = Object.assign({}, DEFAULT_CONFIG, point.config);
    this.loadedFromStore = true;
    this.saveConfig();
    return true;
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const cfg = Object.assign({}, DEFAULT_CONFIG, parsed);
        /* Remembered for the mirror: only a config this instance loaded or
           adopted from a store may ever be written there. The defaults it
           starts on when nothing is stored must not be. */
        this.loadedFromStore = true;
        if (this.normalizeStoredConfig(cfg)) {
          // Keep what the user had, exactly as it was, before writing over it.
          this.snapshotBeforeMigration(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
          if (typeof chrome !== "undefined") chrome.storage?.local?.set?.({ [STORAGE_KEY]: cfg });
        }
        return cfg;
      }
    } catch (e) {}
    this.loadedFromStore = false;
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: this.config });
      }
    } catch (e) {}
  }

  /* chrome.storage is the page's backup copy, and the only copy left when Chrome
     clears site data. This is the one place that reads it.

     The rule is about this instance, not about the stores. If this page started
     on defaults because nothing was stored, then anything real that exists by
     the time the answer arrives is adopted — from localStorage first, since a
     second tab may have restored and written it while this request was in
     flight, and from the mirror otherwise. And the mirror is only ever written
     with a config that was loaded or adopted from a store. Two earlier versions
     of this method broke that rule in two ways. One tidied the mirror from a
     separate call while the live config was still defaults, and wrote defaults
     over the only copy. The next keyed the adopt decision on whether
     localStorage was empty at callback time: with two tabs opening at once — an
     extension update reloads every open new-tab page together — the second
     tab's callback found localStorage already filled by the first, skipped the
     adopt, and published its own defaults to the mirror. Both were reproduced
     in a real Chromium before they shipped. */
  restoreFromChromeStorage() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get([STORAGE_KEY, ...LEGACY_STORAGE_KEYS], (data) => {
        if (!data) return;
        const legacyPresent = LEGACY_STORAGE_KEYS.some((key) => data[key] !== undefined);
        let migrated = false;

        if (!this.loadedFromStore) {
          let source = null;
          let fromMirror = false;
          try {
            const written = localStorage.getItem(STORAGE_KEY);
            if (written) source = JSON.parse(written);
          } catch (e) {}
          if (!source) {
            source = data[STORAGE_KEY] || LEGACY_STORAGE_KEYS.map((key) => data[key]).find(Boolean);
            fromMirror = Boolean(source);
          }
          if (source && source.groups) {
            this.config = Object.assign({}, DEFAULT_CONFIG, source);
            migrated = this.normalizeStoredConfig(this.config);
            if (migrated) this.snapshotBeforeMigration(source);
            this.loadedFromStore = true;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            this.applyThemeTokens();
            this.applyGeometryTokens();
            this.applyHeaderStyle();
            this.applyGlassLevel();
            this.injectCustomCSS(this.config.customCss || "");
            this.updateBackgroundMode();
            this.grid?.render();
            this.widgets?.updateClock();
            const cssEditor = document.getElementById("css-editor");
            if (cssEditor) cssEditor.value = this.config.customCss || "";
            if (fromMirror && typeof toast === "function") {
              toast(window.I18N ? window.I18N.t("toast.restored") : "Settings restored from browser storage", "success");
            }
          }
        }

        /* Never with defaults. Rewritten when the mirror carried an old key, and
           when what came in needed a migration — otherwise the backup keeps a
           shape the code no longer reads and restores it un-migrated next time. */
        if (!this.loadedFromStore) return;
        if (legacyPresent || migrated) chrome.storage.local.set({ [STORAGE_KEY]: this.config });
        if (legacyPresent) chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
      });
    } catch (e) {}
  }

  init() {
    // Initialize I18N (config -> saved pick -> browser language)
    const savedLang = localStorage.getItem("nordlys_language");
    const supported = window.I18N ? Object.keys(window.I18N.translations) : ["en"];
    const navLang = (navigator.language || "en").slice(0, 2).toLowerCase();
    const lang = this.config.language || savedLang || (supported.includes(navLang) ? navLang : "en");
    this.config.language = lang;
    if (window.I18N) window.I18N.setLanguage(lang);

    window.addEventListener("nordlys:languagechange", () => {
      this.widgets?.refreshLabels();
      this.widgets?.updateClock();
      this.grid?.render();
      this.settings?.renderBookmarksManager();
      this.settings?.renderThemeCards();
    });

    // Typography left the theme; carry any font a custom theme still stores.
    if (window.NordlysType?.migrate(this.config)) this.saveConfig();

    // 1. Apply Active Theme, Geometry & Custom CSS
    this.applyThemeTokens();
    this.applyGeometryTokens();
    this.applyHeaderStyle();
    this.applyGlassLevel();
    this.followBrowserFolders();
    if (this.config.customCss) {
      this.injectCustomCSS(this.config.customCss);
    }

    // 2. Initialize background engine
    this.bgEngine = new NordlysBackgroundEngine();
    this.updateBackgroundMode();

    // 3. Initialize widgets
    this.widgets = new WidgetsController(this);
    this.grid = new GridController(this);
    this.settings = new SettingsController(this);

    // 4. Render Grid
    this.grid.render();

    // 5. Global Keyboard Shortcuts & Lifecycle
    this.initGlobalShortcuts();
    this.initVisibilityListener();
    this.initColorModeListener();
    this.restoreFromChromeStorage();
  }

  /* ── Theme Token Engine ─────────────────────────────────────────── */

  /* Is a given (or the active) theme intrinsically light? The UI chrome
     (.light-ui) always follows the THEME — never a mismatched overlay. */
  isLightTheme(themeKey = this.config.theme) {
    if (themeKey === "custom" && this.config.customTheme) {
      return relativeLuminance(this.config.customTheme.bg) > 0.6;
    }
    return LIGHT_THEMES.includes(themeKey);
  }

  /* Switch theme with a soft cross-fade (View Transitions API when available). */
  setTheme(themeKey, customTheme = null) {
    if (customTheme) {
      this.config.theme = "custom";
      this.config.customTheme = customTheme;
    } else {
      this.config.theme = themeKey;
      delete this.config.customTheme;
      // Remember the last explicit pick per family so Dark/Light/Auto can flip back
      if (LIGHT_THEMES.includes(themeKey)) {
        this.config.lastLightTheme = themeKey;
      } else {
        this.config.lastDarkTheme = themeKey;
      }
    }
    // Keep the segmented switcher truthful (Auto stays Auto)
    if (this.config.colorMode !== "auto") {
      this.config.colorMode = this.isLightTheme() ? "light" : "dark";
    }
    this.saveConfig();

    const apply = () => {
      this.applyThemeTokens();
      this.settings?.renderThemeCards();
      this.settings?.syncColorModeSwitcher?.();
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) {
      const transition = document.startViewTransition(apply);
      /* Choosing another theme before the first transition settles aborts it,
         and the rejected promise surfaces as an uncaught error in the console.
         The abort is the correct outcome here, not a failure. */
      transition.ready?.catch(() => {});
      transition.finished?.catch(() => {});
    } else {
      apply();
    }
  }

  /* Dark / Light / Auto segmented control. Dark and Light swap to the last
     theme of that family; Auto follows the OS and keeps following it live. */
  setColorMode(mode) {
    this.config.colorMode = mode;
    let targetTheme = this.config.theme;

    if (mode === "dark" && this.isLightTheme()) {
      targetTheme = this.config.lastDarkTheme || "aurora-void";
    } else if (mode === "light" && !this.isLightTheme()) {
      targetTheme = this.config.lastLightTheme || "porcelain-light";
    } else if (mode === "auto") {
      targetTheme = this.resolveAutoTheme();
    }

    if (targetTheme !== this.config.theme) {
      this.setTheme(targetTheme);
    } else {
      this.saveConfig();
      this.applyThemeTokens();
      this.settings?.renderThemeCards();
      this.settings?.syncColorModeSwitcher?.();
    }
  }

  resolveAutoTheme() {
    const osIsLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (osIsLight) {
      return this.isLightTheme() ? this.config.theme : (this.config.lastLightTheme || "porcelain-light");
    }
    return this.isLightTheme() ? (this.config.lastDarkTheme || "aurora-void") : this.config.theme;
  }

  applyThemeTokens() {
    const root = document.documentElement;
    const isLight = this.isLightTheme();

    if (this.config.theme === "custom" && this.config.customTheme) {
      root.dataset.theme = "custom";
      this.applyCustomTokens(this.config.customTheme, isLight);
    } else {
      THEME_INLINE_TOKENS.forEach((token) => root.style.removeProperty(token));
      let theme = this.config.theme || "aurora-void";
      if (THEME_MIGRATIONS[theme]) theme = THEME_MIGRATIONS[theme];
      root.dataset.theme = theme;
      root.classList.toggle("light-ui", isLight);
    }
    root.dataset.colorMode = this.config.colorMode || "dark";

    // The canvas engine repaints its aurora / orbs / dust in theme colors
    this.bgEngine?.refreshPalette();

    // Fonts ride the same path as the palette so one call settles the whole look.
    window.NordlysType?.apply(this.config, root);

    // Icon plates are chosen against the theme they were measured on, so a new
    // palette invalidates every one of them.
    window.NordlysIcons?.refreshIconContrast();
  }

  initColorModeListener() {
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      mq.addEventListener("change", () => {
        if (this.config.colorMode === "auto") {
          const target = this.resolveAutoTheme();
          if (target !== this.config.theme) {
            this.setTheme(target);
            this.config.colorMode = "auto"; // setTheme keeps auto, but be explicit
            this.saveConfig();
            this.settings?.syncColorModeSwitcher?.();
          }
        }
      });
    }
  }

  /* Derive & apply the full token set from a custom theme's 7 colors + font.
     Also used by the Theme Studio for its live preview (no save involved). */
  applyCustomTokens(ct, isLightOverride = false) {
    const root = document.documentElement;
    THEME_INLINE_TOKENS.forEach((token) => root.style.removeProperty(token));

    const set = (token, value) => value && root.style.setProperty(token, value);
    const rgba = (hex, a) => {
      const c = hexToRgb(hex);
      return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${a})` : null;
    };
    const shade = (hex, factor) => {
      const c = hexToRgb(hex);
      if (!c) return null;
      const f = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
      return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
    };

    set("--void", ct.bg);
    set("--void-gradient", `radial-gradient(130% 100% at 50% -10%, ${shade(ct.bg, 1.45) || ct.bg} 0%, ${ct.bg} 55%, ${shade(ct.bg, 0.6) || ct.bg} 100%)`);
    set("--glass", rgba(ct.card, 0.5));
    set("--glass-border", rgba(ct.border, 0.55));
    set("--frost", rgba(ct.accent, 0.18));
    set("--card-tint", ct.card);
    set("--card-tint-deep", shade(ct.card, 0.55));
    set("--accent", ct.accent);
    set("--accent-glow", rgba(ct.glow || ct.accent, 0.4));
    const accentLuminance = relativeLuminance(ct.accent);
    const blackContrast = (accentLuminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (accentLuminance + 0.05);
    set("--nl-on-accent", blackContrast >= whiteContrast ? "#000000" : "#ffffff");
    set("--ink", ct.text);
    set("--dim", ct.dim);
    set("--faint", ct.dim);
    set("--font-main", ct.font);
    set("--font-display", ct.font);

    // Canvas shader palette derived from the custom accent pair
    set("--shader-1", ct.accent);
    set("--shader-2", ct.glow || ct.accent);
    set("--shader-3", ct.dim);

    // Legacy aliases so older user Custom CSS keeps working
    set("--bg-void", ct.bg);
    set("--card-bg", ct.card);
    set("--card-border", ct.border);
    set("--font-family", ct.font);

    root.classList.toggle("light-ui", isLightOverride || relativeLuminance(ct.bg) > 0.6);
    this.bgEngine?.refreshPalette();
  }

  applyGeometryTokens() {
    const root = document.documentElement.style;
    const cfg = this.config;

    /* The glass level owns these now. Writing them inline here put them beyond
       the reach of every selector, which is why a control that looked wired up
       changed nothing at all. */
    if (cfg.cardRadius != null) root.setProperty("--card-radius", `${cfg.cardRadius}px`);
    // Preserve a usable 56px floor; narrow layouts reflow instead of collapsing controls.
    if (cfg.tileSize != null) root.setProperty("--tw", `clamp(56px, 12vw, ${Math.max(56, cfg.tileSize)}px)`);
    if (cfg.cardGap != null) root.setProperty("--grid-gap", `${cfg.cardGap}px`);
    if (cfg.cardGlow != null) root.setProperty("--card-glow-intensity", `${cfg.cardGlow / 100}`);

    // Icon Shape
    if (cfg.iconShape === "circle") {
      root.setProperty("--tile-radius", "50%");
    } else if (cfg.iconShape === "rounded") {
      root.setProperty("--tile-radius", "8px");
    } else {
      root.setProperty("--tile-radius", "calc(var(--tw) * 0.25)");
    }

    // Dynamic Hover Class on document.body
    const body = document.body;
    body.classList.remove("hover-lift", "hover-glow", "hover-scale", "hover-none");
    body.classList.add(`hover-${cfg.hoverEffect || "lift"}`);

    document.body.classList.toggle("seconds", !!cfg.showSeconds);
    this.applyWallpaperEffects();
  }

  applyWallpaperEffects() {
    const root = document.documentElement.style;
    const blur = Math.max(0, this.config.bgBlur || 0);
    const dim = Math.max(0, Math.min(0.8, (this.config.bgDim || 0) / 100));
    root.setProperty("--bg-blur", `${blur}px`);
    root.setProperty("--bg-blur-px", blur);
    root.setProperty("--bg-dim", dim);
  }

  initGlobalShortcuts() {
    window.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const isCmd = isMac ? e.metaKey : e.ctrlKey;
      const activeTag = document.activeElement ? document.activeElement.tagName : "";
      const isInput = activeTag === "INPUT" || activeTag === "TEXTAREA";

      // 1. Cmd+K / Ctrl+K -> Focus Search
      if (isCmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("q");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 2. Cmd+, / Ctrl+, -> Toggle Settings Drawer
      if (isCmd && e.key === ",") {
        e.preventDefault();
        if (this.settings?.drawer?.classList.contains("open")) {
          this.settings.close();
        } else {
          this.settings?.open();
        }
        return;
      }

      // 3. Alt+1 .. Alt+9 -> Launch bookmarks from first visible folder
      if (e.altKey && !e.ctrlKey && !e.metaKey && !isInput && e.code.startsWith("Digit")) {
        const digit = parseInt(e.code.replace("Digit", ""), 10);
        if (digit >= 1 && digit <= 9) {
          const visibleGroup = (this.config.groups || []).find(g => !g.hidden && g.links && g.links.length > 0);
          if (visibleGroup && visibleGroup.links[digit - 1]) {
            e.preventDefault();
            const link = visibleGroup.links[digit - 1];
            if (this.config.openNewTab) {
              window.open(link.url, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = link.url;
            }
          }
        }
      }
    });
  }

  initVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      const video = document.getElementById("bg-video");
      if (document.hidden) {
        this.bgEngine?.pause();
        if (video && !video.paused) video.pause();
      } else {
        this.bgEngine?.resume();
        if (video && video.classList.contains("active")) {
          video.play().catch(() => {});
        }
      }
    });
  }

  injectCustomCSS(css) {
    let styleEl = document.getElementById("user-custom-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "user-custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  async updateBackgroundMode() {
    const bgMode = this.config.bgMode || "aurora";
    const canvas = document.getElementById("bg-canvas");
    const media = document.getElementById("bg-media");
    const video = document.getElementById("bg-video");

    const clearMedia = () => {
      if (media) {
        media.classList.remove("active");
        media.removeAttribute("src");
      }
      if (video) {
        video.classList.remove("active");
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (this.mediaObjectUrl) {
        URL.revokeObjectURL(this.mediaObjectUrl);
        this.mediaObjectUrl = null;
      }
    };

    this.applyWallpaperEffects();

    // The chosen background, for the rules that need to know which one it is.
    document.documentElement.dataset.bg = bgMode;

    if (bgMode === "aurora") {
      if (canvas) canvas.style.display = "block";
      clearMedia();
      this.bgEngine.setMode(bgMode);
    } else if (bgMode === "custom-image" || bgMode === "custom-video") {
      this.bgEngine.setMode(bgMode);
      clearMedia();

      try {
        const blob = await MediaVault.getMedia("custom_bg");
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        this.mediaObjectUrl = url;

        const isVideo = bgMode === "custom-video" || (blob.type || "").startsWith("video/");
        if (isVideo && video) {
          video.src = url;
          video.classList.add("active");
          video.play().catch(() => {});
        } else if (media) {
          media.src = url;
          media.classList.add("active");
        }
      } catch (e) {
        console.warn("Could not load custom wallpaper:", e);
      }
    } else {
      clearMedia();
      this.bgEngine.setMode("solid");
    }
  }
}

// Bootstrap immediately with zero event-loop delay
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.Nordlys = new NordlysApp();
  });
} else {
  window.Nordlys = new NordlysApp();
}
