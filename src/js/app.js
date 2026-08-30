/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - MAIN ORCHESTRATOR & APPLICATION BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_CONFIG = {
  version: "2.2.0",
  theme: "aurora-void",
  colorMode: "dark",
  bgMode: "aurora",
  headerStyle: "full",
  bgBlur: 0,
  bgDim: 0,
  timeFormat: "24h",
  showSeconds: false,
  userName: "",
  openNewTab: false,
  showSuggestions: true,
  defaultEngine: "google",
  glassBlur: 28,
  glassSaturate: 190,
  glassOpacity: 0.70,
  glassSheen: 0.45,
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
const STORAGE_KEY = "aether_tab_config";
const LEGACY_STORAGE_KEY = "aurora_tab_config";
const LIGHT_THEMES = [
  "porcelain-light", "warm-ivory", "sage-light", "sakura-daylight",
  "solarized-light", "nordic-snow", "lavender-mist", "gruvbox-light",
  "peach-sunset", "mint-breeze"
];
/* Old saved theme keys from previous releases → current keys */
const THEME_MIGRATIONS = {
  "liquid-glass": "frosted-glass",
  "liquid-tahoe": "frosted-glass",
  "sakura-blossom": "sakura-daylight",
  "amethyst-twilight": "dracula-velvet",
  "sage-garden": "sage-light",
  "boreal": "boreal-emerald"
};

class AuroraApp {
  constructor() {
    this.defaultConfig = DEFAULT_CONFIG;
    this.config = this.loadConfig();
    this.mediaObjectUrl = null;
    this.init();
  }

  /* The board is the point of the page; the header is how much context sits
     above it. Kept on <body> so Custom CSS can still see the choice. */
  applyHeaderStyle() {
    document.body.dataset.header = this.config.headerStyle || "full";
  }

  normalizeStoredConfig(config) {
    let changed = false;
    if (THEME_MIGRATIONS[config.theme]) { config.theme = THEME_MIGRATIONS[config.theme]; changed = true; }
    if (Number(config.tileSize) >= 50 && Number(config.tileSize) < 56) { config.tileSize = 56; changed = true; }
    return changed;
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const cfg = Object.assign({}, DEFAULT_CONFIG, parsed);
        if (this.normalizeStoredConfig(cfg)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
          if (typeof chrome !== "undefined") chrome.storage?.local?.set?.({ [STORAGE_KEY]: cfg });
        }
        return cfg;
      }
    } catch (e) {}
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

  /* If localStorage was wiped but chrome.storage still holds a config, restore it. */
  restoreFromChromeStorage() {
    if (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) return;
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY], (data) => {
        const saved = data && (data[STORAGE_KEY] || data[LEGACY_STORAGE_KEY]);
        if (saved && saved.groups && !localStorage.getItem(STORAGE_KEY)) {
          this.config = Object.assign({}, DEFAULT_CONFIG, saved);
          const migrated = this.normalizeStoredConfig(this.config);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
          if (migrated) chrome.storage.local.set({ [STORAGE_KEY]: this.config });
          this.applyThemeTokens();
          this.applyGeometryTokens();
          this.injectCustomCSS(this.config.customCss || "");
          this.updateBackgroundMode();
          this.grid?.render();
          this.widgets?.updateClock();
          const cssEditor = document.getElementById("css-editor");
          if (cssEditor) cssEditor.value = this.config.customCss || "";
          if (typeof toast === "function") {
            toast(window.I18N ? window.I18N.t("toast.restored") : "Settings restored from browser storage", "success");
          }
        }
      });
    } catch (e) {}
  }

  init() {
    // Initialize I18N (config -> saved pick -> browser language)
    const savedLang = localStorage.getItem("aurora_language");
    const supported = window.I18N ? Object.keys(window.I18N.translations) : ["en"];
    const navLang = (navigator.language || "en").slice(0, 2).toLowerCase();
    const lang = this.config.language || savedLang || (supported.includes(navLang) ? navLang : "en");
    this.config.language = lang;
    if (window.I18N) window.I18N.setLanguage(lang);

    window.addEventListener("aurora:languagechange", () => {
      this.widgets?.updateEngineIcon();
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
    if (this.config.customCss) {
      this.injectCustomCSS(this.config.customCss);
    }

    // 2. Initialize background engine
    this.bgEngine = new AuroraBackgroundEngine();
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

    if (cfg.glassBlur != null) root.setProperty("--glass-blur", `${cfg.glassBlur}px`);
    if (cfg.glassSaturate != null) root.setProperty("--glass-saturate", `${cfg.glassSaturate}%`);
    if (cfg.glassOpacity != null) root.setProperty("--glass-opacity", cfg.glassOpacity);
    if (cfg.glassSheen != null) root.setProperty("--glass-border-sheen", cfg.glassSheen);
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

    if (["aurora", "cosmos", "mesh-gradient", "particles"].includes(bgMode)) {
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
    window.Aurora = new AuroraApp();
  });
} else {
  window.Aurora = new AuroraApp();
}
