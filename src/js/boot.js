/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - FIRST FRAME
   ═══════════════════════════════════════════════════════════════════

   This runs before the body exists, and it exists for one reason: the first
   frame the user sees should already be their theme.

   Without it the markup carries a hardcoded data-theme, the page background is
   painted by <body> from a stylesheet, and nothing sets a colour on <html> at
   all — so a new tab opens on the browser's white default and then jumps to a
   dark theme, or worse, opens dark and jumps to light. On a page opened dozens
   of times a day that is not a polish issue, it is a small physical unpleasant-
   ness delivered dozens of times a day.

   It is a separate file rather than an inline script because the extension CSP
   is `script-src 'self'`, which forbids inline script. It must stay dependency-
   free and synchronous, in <head>, ahead of every stylesheet.

   The base colours below duplicate `--void` from the theme stylesheets on
   purpose: reading them would mean waiting for the stylesheet this file exists
   to get ahead of. A unit test asserts the two agree, so the copy cannot drift. */

(function () {
  "use strict";

  var BASE = {
    "aurora-void": "#060a14",
    "frosted-glass": "#0b1220",
    "cyberpunk-neon": "#08060e",
    "tokyo-night": "#13141f",
    "catppuccin-mocha": "#11111b",
    "oled-obsidian": "#000000",
    "nord-frost": "#242933",
    "gruvbox-dark": "#1d2021",
    "boreal-emerald": "#040f09",
    "sunset-amber": "#120704",
    "dracula-velvet": "#191724",
    "porcelain-light": "#f8fafc",
    "warm-ivory": "#faf7f2",
    "sage-light": "#f2f7f4",
    "sakura-daylight": "#fdf2f8",
    "solarized-light": "#fdf6e3",
    "nordic-snow": "#f0f4f8",
    "lavender-mist": "#f5f3ff",
    "gruvbox-light": "#fbf1c7",
    "peach-sunset": "#fff7ed",
    "mint-breeze": "#f0fdf4"
  };

  var LIGHT = [
    "porcelain-light", "warm-ivory", "sage-light", "sakura-daylight",
    "solarized-light", "nordic-snow", "lavender-mist", "gruvbox-light",
    "peach-sunset", "mint-breeze"
  ];

  /* Theme keys from earlier releases. A stored key we do not recognise would
     fall back to the default and produce the flash this file prevents. */
  var RENAMED = {
    "liquid-glass": "frosted-glass",
    "liquid-tahoe": "frosted-glass",
    "sakura-blossom": "sakura-daylight",
    "amethyst-twilight": "dracula-velvet",
    "sage-garden": "sage-light",
    "boreal": "boreal-emerald"
  };

  var root = document.documentElement;
  var theme = "aurora-void";
  var raw = null;
  var config = null;
  var background = null;

  try {
    // The move to the new key happens a moment later, in app.js; the first
    // frame just has to find the config wherever the previous build left it.
    raw = localStorage.getItem("nordlys_config") || localStorage.getItem("aether_tab_config") || localStorage.getItem("aurora_tab_config");
    if (raw) {
      config = JSON.parse(raw);
      var stored = config && config.theme;
      if (typeof stored === "string") {
        if (RENAMED[stored]) stored = RENAMED[stored];
        if (stored === "custom" && config.customTheme && typeof config.customTheme.bg === "string") {
          // A theme the user built: its background is stored with it.
          theme = "custom";
          background = config.customTheme.bg;
        } else if (BASE[stored]) {
          theme = stored;
        }
      }
    }
  } catch (error) {
    /* A corrupt or unreadable config is not worth a white flash; the default
       below is a perfectly good first frame. */
  }

  if (!background) background = BASE[theme] || BASE["aurora-void"];
  try {
    var mode = (config && config.bgMode) || "aurora";
    /* The scenes that were removed resolve to their survivor on first load, so
       the very first frame never carries a mode that no longer exists. The full
       migration in app.js runs a moment later and also restores the stillness
       the gradient modes had; this only needs the attribute to be honest. */
    if (mode === "cosmos" || mode === "particles" || mode === "mesh-gradient" || mode === "gradient") {
      mode = "aurora";
    }
    root.setAttribute("data-bg", mode);
  } catch (error) { /* no config: the defaults below are a fine first frame */ }

  root.setAttribute("data-theme", theme);
  if (LIGHT.indexOf(theme) !== -1) root.classList.add("light-ui");
  root.style.backgroundColor = background;
})();
