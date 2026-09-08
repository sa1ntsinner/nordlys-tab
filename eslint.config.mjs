// ESLint, flat config. There is no build step in this project: the page loads
// plain scripts in order and they share a handful of globals. The lint has two
// jobs — catch what the browser would only tell us at runtime (a name that is
// not defined anywhere, a variable that is never read) and keep the code the
// same shape for everyone who forks it.
import js from "@eslint/js";
import globals from "globals";

/* Names that one page script defines at the top level and the others use. This
   list is the honest description of the coupling between the scripts; when it
   shrinks, the code got more modular. */
const pageGlobals = {
  // app.js
  Nordlys: "writable", NordlysApp: "readonly", DEFAULT_CONFIG: "readonly",
  STORAGE_KEY: "readonly", LEGACY_STORAGE_KEYS: "readonly", LEGACY_LOCAL_KEYS: "readonly",
  RESTORE_POINT_KEY: "readonly", LIGHT_THEMES: "readonly", THEME_MIGRATIONS: "readonly",
  BACKGROUND_MIGRATIONS: "readonly", STILL_MIGRATIONS: "readonly", THEME_INLINE_TOKENS: "readonly",
  adoptLegacyLocalStorage: "readonly",
  // ui-kit.js
  NordlysToast: "readonly", NordlysConfirm: "readonly", toast: "readonly", confirmDialog: "readonly",
  esc: "readonly", hexToRgb: "readonly", relativeLuminance: "readonly",
  // ui-primitives.js, typography.js, i18n.js
  NordlysUI: "readonly", NordlysType: "readonly", I18N: "readonly", translations: "readonly",
  // icons-db.js, icon-presentation.js, icon-picker.js
  ICONS_DB: "readonly", DOMAIN_MAP: "readonly", SECOND_LEVEL_SUFFIXES: "readonly",
  resolveIcon: "readonly", domainMatches: "readonly", getDeterministicHue: "readonly",
  NordlysIcons: "readonly", NordlysIconPicker: "readonly",
  // background.js, calc.js, config-schema.js, bookmark-sync.js
  NordlysBackgroundEngine: "readonly", MediaVault: "readonly",
  NordlysCalc: "readonly", NordlysConfigSchema: "readonly", NordlysBookmarks: "readonly",
  // widgets.js, grid.js, settings*.js
  ClockWidget: "readonly", SearchWidget: "readonly", WidgetsController: "readonly", LOCALE_MAP: "readonly",
  GridController: "readonly", MIN_COLUMNS: "readonly", MAX_COLUMNS: "readonly",
  SettingsController: "readonly", SCENE_NAMES: "readonly", SCENE_KEYS: "readonly",
  NordlysSettingsShell: "readonly", NordlysBookmarkSettings: "readonly"
};

export default [
  {
    ignores: [
      "node_modules/**", "playwright-report/**", "test-results/**", ".playwright-artifacts/**",
      ".references/**", ".superpowers/**", "docs/**", "tools/artwork/.scratch/**",
      "**/*.sweep.cjs", "sweeps.config.cjs", "scratch-*"
    ]
  },
  js.configs.recommended,
  {
    // The page: classic scripts, browser globals, the shared names above.
    files: ["src/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...globals.browser, chrome: "readonly", module: "readonly", ...pageGlobals }
    },
    rules: {
      // Classic scripts: a top-level name is this file's export to the others,
      // so it is declared here and consumed elsewhere. The redeclare check
      // must not treat the shared list above as competition for it, and the
      // unused check looks at local scope only.
      "no-redeclare": ["error", { builtinGlobals: false }],
      // A caught error that is not read is the normal shape here: the page
      // degrades on purpose rather than reporting. Arguments left in place to
      // document a callback's signature are fine too.
      "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "eqeqeq": ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }]
    }
  },
  {
    // Tests, helpers and tools run under Node with Playwright.
    files: ["tests/**/*.cjs", "tools/**/*.cjs", "*.cjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      // Names the tests reach inside page.evaluate(): the page's own globals.
      globals: { ...globals.node, ...globals.browser, chrome: "readonly", MediaVault: "readonly", Nordlys: "readonly", confirmDialog: "readonly", I18N: "readonly", NordlysUI: "readonly" }
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "eqeqeq": ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }]
    }
  },
  {
    files: ["eslint.config.mjs"],
    languageOptions: { sourceType: "module" }
  }
];
