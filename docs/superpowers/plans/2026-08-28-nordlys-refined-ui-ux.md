# Nordlys Refined UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the existing Nordlys new-tab UI from an inconsistent glass prototype to a coherent, accessible, responsive, production-quality interface while preserving its current centered composition and feature set.

**Architecture:** Keep the dependency-free vanilla MV3 runtime and the public `AuroraApp`, `GridController`, `WidgetsController`, and `SettingsController` integration points. Introduce a semantic CSS foundation plus small global UI, icon-presentation, settings-shell, bookmark-editor, and icon-picker modules loaded before their consumers. Migrate components incrementally so storage schemas, theme IDs, and custom CSS aliases continue working throughout the branch.

**Tech Stack:** Manifest V3, HTML, CSS, vanilla JavaScript globals, Node.js 20+, Node test runner, Playwright 1.62.1, `@axe-core/playwright` 4.13.0.

**Spec:** `docs/superpowers/specs/2026-08-28-nordlys-refined-ui-ux-design.md`

## Global Constraints

- Baseline is `origin/main@62c262073a63fb040e12998164891d4a4c91a1ad`; do not import files or layout decisions from the dirty `redesign` working tree.
- Preserve the clock → search → bookmark-groups composition, storage schema, theme IDs, import/export, custom CSS, background engine, and current user features.
- Preserve all 21 built-in themes and custom themes; themes may change semantic colors and background parameters but never component geometry or layout.
- Desktop settings remain a right drawer with width `clamp(600px, 46vw, 720px)` and an approximately 168-pixel vertical rail; below 760 CSS pixels they become a full-width sheet.
- Built-in SVG icons occupy 62–66% of a default tile; favicon/raster icons occupy 68–74%; default desktop tile remains 78×78 pixels and never collapses below a 56-pixel visual tile at 320 pixels wide.
- Primary hit areas are 40–44 pixels. Normal text contrast is at least 4.5:1; focus/non-text indicators are at least 3:1.
- Motion tokens are 120ms fast, 160–180ms control, 240–280ms panel, and at most 320ms entrance. Do not animate blur, backdrop-filter, filter drop-shadow, or layout properties. Do not use `transition: all`.
- Add no runtime dependency, framework, remote font, remote UI asset, extension permission, host permission, or network-loaded design resource. Test dependencies are development-only.
- Use native elements before ARIA. Drawer/dialog focus is contained and restored; context menus, tabs, search suggestions, drag alternatives, and resize alternatives are keyboard operable.
- Production code follows strict RED → GREEN → REFACTOR. Record the failing command and expected failure before editing production code.
- Do not modify this plan or its spec during implementation. Record necessary rulings in the SDD ledger.
- Do not merge, push, publish, bump versions, or edit store metadata. Commit messages contain no AI/Codex/Anthropic attribution.

## Target file map and load order

Create these focused runtime files:

- `src/css/foundations.css`: semantic color, spacing, radius, typography, shadow, focus, and motion tokens plus legacy aliases.
- `src/js/ui-primitives.js`: `window.NordlysUI` focus, dialog, tabs, menu, live-region, and undo-toast primitives.
- `src/js/icon-presentation.js`: `window.NordlysIcons` source classification, optical scale, contrast tone, and shared icon rendering.
- `src/js/settings-shell.js`: `window.NordlysSettingsShell` drawer lifecycle, navigation, responsive mode, and focus containment.
- `src/js/settings-bookmarks.js`: `window.NordlysBookmarkSettings` folder accordions, focused bookmark editor, keyboard move actions, and undo deletion.
- `src/js/icon-picker.js`: `window.NordlysIconPicker` accessible icon-source tabs, filtering, selection, and live tile preview.

`newtab.html` must load styles in this order:

1. `main.css`
2. `foundations.css`
3. `liquid-glass.css`
4. `themes.css`
5. `components.css`
6. `settings.css`

It must load scripts in this order:

1. `ui-kit.js`
2. `ui-primitives.js`
3. `i18n.js`
4. `icons-db.js`
5. `icon-presentation.js`
6. `background.js`
7. `widgets.js`
8. `grid.js`
9. `settings-shell.js`
10. `settings-bookmarks.js`
11. `icon-picker.js`
12. `settings.js`
13. `app.js`

`SettingsController` remains the public orchestrator. New modules receive the
existing app/controller instance through constructors and must not introduce a
second storage owner.

---

### Task 1: Reproducible UI test harness and baseline contract

**Files:**
- Create: `package.json`
- Create: `package-lock.json` through `npm install`
- Create: `playwright.config.cjs`
- Create: `tests/helpers/static-server.cjs`
- Create: `tests/helpers/nordlys-fixture.cjs`
- Create: `tests/helpers/check-js-syntax.cjs`
- Create: `tests/ui/baseline.spec.cjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `startStaticServer(rootDir): Promise<{ origin: string, close(): Promise<void> }>`.
- Produces: Playwright fixture `nordlysPage` that installs a complete in-memory `chrome.storage.local` stub before loading `/newtab.html`.
- Produces: npm scripts `test`, `test:unit`, `test:ui`, `test:ui:update`, and `test:syntax`.

- [ ] **Step 1: Define development dependencies and commands**

Create `package.json` with `private: true`, Node `>=20`, exact dev dependencies
`@playwright/test: 1.62.1` and `@axe-core/playwright: 4.13.0`, and these scripts:

```json
{
  "test": "npm run test:syntax && npm run test:unit && npm run test:ui",
  "test:syntax": "node tests/helpers/check-js-syntax.cjs",
  "test:unit": "node --test",
  "test:ui": "playwright test",
  "test:ui:update": "playwright test --update-snapshots"
}
```

Implement `check-js-syntax.cjs` with `readdirSync('src/js')`, select every `.js`
file, run `process.execPath --check <absolute-file>` with `spawnSync`, print the
filename, and exit non-zero on the first syntax failure.

- [ ] **Step 2: Build the real-page fixture**

`static-server.cjs` serves only files under the repository root, maps `/` to
`newtab.html`, rejects traversal with HTTP 403, assigns CSS/JS/SVG/image MIME
types, and binds to `127.0.0.1` on an ephemeral port. `nordlys-fixture.cjs`
installs this API before navigation:

```js
window.chrome = {
  storage: {
    local: {
      get(keys, callback) { callback(readRequestedKeys(keys)); },
      set(values, callback) { Object.assign(storageState, values); callback?.(); },
      remove(keys, callback) { removeRequestedKeys(keys); callback?.(); }
    }
  }
};
```

Also capture `pageerror` and console messages of type `error`; expose them as
`runtimeErrors` so every UI test can assert an empty array.

- [ ] **Step 3: Write baseline characterization tests**

Create tests that load the actual application and assert observable behavior:

```js
test('loads the default canvas without runtime errors', async ({ nordlysPage }) => {
  await expect(nordlysPage.page.locator('#page')).toBeVisible();
  await expect(nordlysPage.page.locator('.card')).toHaveCount(5);
  await expect(nordlysPage.page.locator('.tile')).toHaveCount(22);
  expect(nordlysPage.runtimeErrors).toEqual([]);
});

test('persists a changed setting through chrome.storage.local', async ({ nordlysPage }) => {
  await nordlysPage.page.locator('#gear').click();
  await nordlysPage.page.locator('[data-mode="light"]').click();
  await expect.poll(() => nordlysPage.storageState.aether_tab_config?.colorMode).toBe('light');
});
```

Use selectors present on `origin/main`; if a baseline selector differs, bind the
test to the existing accessible label or stable ID and record that exact selector
in the test.

- [ ] **Step 4: Run the baseline suite**

Run:

```powershell
npm install
npx playwright install chromium
npm run test:syntax
npm run test:ui -- tests/ui/baseline.spec.cjs
```

Expected: syntax checks all eight baseline JS files; both characterization tests
pass; there are zero page errors and zero console errors.

- [ ] **Step 5: Ignore generated artifacts and commit**

Add only `node_modules/`, `test-results/`, `playwright-report/`, and
`.playwright-artifacts/` to `.gitignore`.

```powershell
git add docs/superpowers package.json package-lock.json playwright.config.cjs tests .gitignore
git commit -m "test: add UI regression harness"
```

**Acceptance gate:** A clean checkout can install dependencies and exercise the
real page with deterministic storage. No product behavior or appearance changes
in this task.

---

### Task 2: Semantic foundations and accessible UI primitives

**Files:**
- Create: `src/css/foundations.css`
- Create: `src/js/ui-primitives.js`
- Create: `tests/unit/ui-kit.test.cjs`
- Create: `tests/ui/primitives.spec.cjs`
- Modify: `newtab.html`
- Modify: `src/js/ui-kit.js`
- Modify: `src/css/main.css`
- Modify: `src/css/components.css`
- Modify: `src/css/settings.css`

**Interfaces:**
- Produces: `window.NordlysUI.DialogController`, `FocusScope`, `RovingTabs`, `MenuController`, `announce(message)`, and `showUndoToast({ message, actionLabel, onAction, duration })`.
- Preserves: global `esc`, `hexToRgb`, `relativeLuminance`, `toast`, and `confirmDialog` names consumed by existing scripts.
- Produces: semantic `--nl-*` tokens and compatibility aliases for current public geometry/glass variables.

- [ ] **Step 1: Write failing luminance and primitive tests**

Use the Node VM to execute `ui-kit.js` and assert hand-derived WCAG values:

```js
assert.equal(relativeLuminance('#000000'), 0);
assert.equal(relativeLuminance('#ffffff'), 1);
assert.ok(Math.abs(relativeLuminance('#777777') - 0.1844749945) < 1e-6);
```

In Playwright, inject two buttons and a dialog fixture, open it through
`DialogController`, then assert Tab wraps inside it, Escape closes it, and focus
returns to the opener. Add a tabs fixture and assert ArrowDown/ArrowUp update
both focus and `aria-selected`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test:unit -- tests/unit/ui-kit.test.cjs
npm run test:ui -- tests/ui/primitives.spec.cjs
```

Expected: luminance fails because baseline uses non-linear channel weights;
primitive tests fail because `window.NordlysUI` does not exist.

- [ ] **Step 3: Implement foundations and primitives**

Define semantic tokens with opaque fallbacks before any OKLCH mixing. Include
spacing 4/8/12/16/20/24/32/40/48, radii 10/14/18/24, the four approved motion
durations, emphasized easing, two-layer focus, three surface levels, and three
shadow levels. Component styles consume `--nl-*`; legacy variables continue as
aliases.

Linearize each sRGB channel in `relativeLuminance()`:

```js
const linear = value => {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
};
return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
```

Implement one top-layer stack inside `NordlysUI` so Escape closes only the
uppermost drawer/menu/dialog. `FocusScope` stores the opener, excludes hidden or
disabled nodes, wraps Tab/Shift+Tab, and restores focus only when the opener is
still connected. `announce()` reuses one polite live region. `showUndoToast()`
renders a real button and guarantees `onAction` runs at most once.

- [ ] **Step 4: Verify GREEN and refactor consumers**

Run the two focused commands from Step 2, then `npm test`. Expected: all tests
pass with no runtime errors. Replace only duplicated focus/Escape logic that is
covered by these tests; leave feature-specific behavior for later tasks.

- [ ] **Step 5: Commit**

```powershell
git add newtab.html src/css/foundations.css src/css/main.css src/css/components.css src/css/settings.css src/js/ui-kit.js src/js/ui-primitives.js tests
git commit -m "refactor: introduce UI foundations"
```

**Acceptance gate:** Correct WCAG luminance, one tested layer/focus model, semantic
tokens loaded in the documented order, and zero baseline regression.

---

### Task 3: Source-aware bookmark icons and responsive canvas polish

**Files:**
- Create: `src/js/icon-presentation.js`
- Create: `tests/unit/icon-presentation.test.cjs`
- Create: `tests/ui/bookmark-tiles.spec.cjs`
- Modify: `newtab.html`
- Modify: `src/js/icons-db.js`
- Modify: `src/js/grid.js`
- Modify: `src/js/app.js`
- Modify: `src/css/components.css`
- Modify: `src/css/main.css`
- Modify: `src/css/liquid-glass.css`

**Interfaces:**
- Produces: `window.NordlysIcons.classifyIcon(source): 'builtin'|'favicon'|'raster'|'monogram'`.
- Produces: `resolvePresentation({ source, key, isLight }): { kind, opticalScale, tone, accent }`.
- Produces: `renderIcon(presentation): HTMLElement` used by both live tiles and settings previews.
- Preserves: `resolveIcon(url, fallbackKey)` for callers outside the new renderer.

- [ ] **Step 1: Write failing classification, geometry, contrast, and narrow-layout tests**

Unit fixtures cover a built-in key, `_favicon` URL, uploaded data URL, ordinary
HTTPS raster URL, and missing icon. Assert optical scale is clamped to 0.88–1.12
and malformed values return 1.

UI tests assert:

```js
expect(svgBox.width / tileBox.width).toBeGreaterThanOrEqual(0.62);
expect(svgBox.width / tileBox.width).toBeLessThanOrEqual(0.66);
expect(faviconBox.width / tileBox.width).toBeGreaterThanOrEqual(0.68);
expect(faviconBox.width / tileBox.width).toBeLessThanOrEqual(0.74);
```

At 320×568 assert every `.tile .box` is at least 56×56, document scroll width
does not exceed client width, labels do not intersect the next tile, and a
monochrome light logo receives a dark tone in a light theme. Keyboard focus must
produce an outline/ring with at least 3:1 contrast against the adjacent tile.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test:unit -- tests/unit/icon-presentation.test.cjs
npm run test:ui -- tests/ui/bookmark-tiles.spec.cjs
```

Expected: missing module/classification failures; baseline icon ratio is about
0.45; the narrow tile is about 38 pixels.

- [ ] **Step 3: Implement the shared presentation model**

Add optional metadata to built-in icon records without changing their keys.
Render source kind and tone as data attributes and set bounded custom properties
`--icon-optical-scale` and `--icon-accent`. Keep text escaping and URL handling in
the existing trusted path. The renderer must not use `innerHTML` for user-provided
labels or URLs.

Replace `min(${tileSize}px, 12vw)` in `AuroraApp.applyGeometryTokens()` with a
clamped responsive variable that retains the configured desktop size and a
56-pixel floor. Reflow groups at the narrow breakpoint rather than shrinking
content below the floor.

- [ ] **Step 4: Refine tile visuals and states**

Use kind-specific icon ratios, a stable neutral surface, one border, and one
shadow. Remove persistent radial color wash, double icon drop-shadow, shine sweep,
and stacked hover scaling. Implement hover `translateY(-2px) scale(1.02)`, active
`scale(.97)`, the shared focus ring, and 12–13 pixel labels. Preserve drag/drop
state visibility.

- [ ] **Step 5: Verify and commit**

Run focused unit/UI tests at 320×568, 1024×768, and 1440×900, then `npm test`.
Expected: all icon ratios, contrast treatment, minimum size, and no-overflow
assertions pass with zero runtime errors.

```powershell
git add newtab.html src/js/icon-presentation.js src/js/icons-db.js src/js/grid.js src/js/app.js src/css tests
git commit -m "feat: clarify bookmark tiles"
```

**Acceptance gate:** Icons are visibly dominant and crisp in dark and light
themes, the original canvas composition remains recognizable, and 320-pixel
layout no longer solves density by producing unusable tiles.

---

### Task 4: Responsive settings shell and vertical navigation

**Files:**
- Create: `src/js/settings-shell.js`
- Create: `tests/ui/settings-shell.spec.cjs`
- Modify: `newtab.html`
- Modify: `src/js/settings.js`
- Modify: `src/js/i18n.js`
- Modify: `src/css/settings.css`
- Modify: `src/css/components.css`

**Interfaces:**
- Produces: `new NordlysSettingsShell({ root, opener, onSectionChange })` with `open(sectionId)`, `close()`, `select(sectionId)`, and `destroy()`.
- Consumes: `NordlysUI.FocusScope`, `RovingTabs`, and top-layer stack.
- Preserves: `SettingsController.open()`, `close()`, and existing section render methods as delegation points.

- [ ] **Step 1: Write failing shell tests**

Open settings from the gear and assert `role="dialog"`, `aria-modal="true"`, a
name tied to the visible heading, a vertical tablist with six tabs, one selected
tab, and one visible tabpanel. At 1440 pixels assert drawer width is 600–720
pixels and rail width is 156–180 pixels. Tab through more controls than the
drawer contains and assert focus never enters `#page`. Close with Escape and
assert focus returns to `#gear`.

At 720 pixels assert the sheet width equals the viewport, the nav is horizontal,
all six sections can be reached by scrolling, and no body horizontal overflow
appears. Verify ArrowDown/ArrowUp in the desktop rail and ArrowRight/ArrowLeft in
the mobile strip. Visit General, Background, Custom CSS, and Data & Backup and
assert every visible primary control has an associated label/name and a hit area
of at least 40 pixels.

- [ ] **Step 2: Verify RED**

Run `npm run test:ui -- tests/ui/settings-shell.spec.cjs`.

Expected: baseline drawer is about 520 pixels, tabs overflow without a clear
navigation model, required semantics are absent, and focus escapes.

- [ ] **Step 3: Implement the shell and DOM structure**

Replace the horizontal desktop tab row with grouped navigation for Customize,
App, and Advanced. Use native buttons inside a semantic tablist. Keep one panel
mounted and render the selected section through the existing controller method.
The drawer owns no config state. It emits the section ID to `SettingsController`.

Use `clamp(600px, 46vw, 720px)`, a 168-pixel rail, sticky shell header/rail, and
content-only scrolling. Below 760 pixels use an inset-free full-width sheet and
compact scrollable tabs with visible edge fade. Keep the canvas visible beneath
a low-opacity non-blurred scrim.

Convert General, Background, Custom CSS, and Data & Backup markup to the shared
SettingRow structure while preserving every existing element ID used by
`SettingsController`. Associate each range/select/input with a native `label`.
Group export/import actions separately from the destructive reset action, and
give the destructive group a visible explanatory heading.

- [ ] **Step 4: Refactor lifecycle through the shared focus model**

Remove duplicate global Escape and focus-return listeners from `settings.js`.
Ensure repeated open/close cycles register no duplicate listeners. Opening a
specific section from a context-menu command selects that tab after the drawer
is visible.

- [ ] **Step 5: Verify and commit**

Run the focused shell suite, `npm test`, and a loop of ten open/close cycles that
asserts one close action per Escape. Expected: all pass with empty runtime error
capture.

```powershell
git add newtab.html src/js/settings-shell.js src/js/settings.js src/js/i18n.js src/css tests
git commit -m "feat: redesign settings navigation"
```

**Acceptance gate:** Settings preserve live canvas context, expose every section
without clipping, contain and restore focus, and remain usable at 720 and 320
pixels.

---

### Task 5: Appearance controls, theme contract, and shared live preview

**Files:**
- Create: `tests/unit/theme-contract.test.cjs`
- Create: `tests/ui/appearance.spec.cjs`
- Modify: `src/js/app.js`
- Modify: `src/js/settings.js`
- Modify: `src/js/i18n.js`
- Modify: `src/css/themes.css`
- Modify: `src/css/settings.css`
- Modify: `src/css/components.css`

**Interfaces:**
- Produces: a theme contract in which every built-in theme supplies semantic
  canvas, surface, text, border, accent, and focus tokens.
- Consumes: `NordlysIcons.renderIcon()` for the appearance preview.
- Preserves: all existing theme IDs, mode behavior, custom theme values, and
  storage keys.

- [ ] **Step 1: Write failing theme and appearance tests**

Load the built-in theme ID list from the real application. For each ID, apply the
theme and assert all required semantic tokens resolve to non-empty colors, the
primary text/card contrast is at least 4.5:1, focus/card contrast is at least
3:1, and the geometry of `.card`, `.tile`, and settings controls does not
change between theme IDs.

Open Appearance and assert theme cards are two columns at desktop width, one card
has `aria-pressed="true"`, selecting a card updates the live canvas and the
shared preview, and advanced glass controls are inside a collapsed native
`details` element by default. The preview must contain the same `.card`,
`.tile`, `.box`, and `.lbl` classes as the canvas.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test:unit -- tests/unit/theme-contract.test.cjs
npm run test:ui -- tests/ui/appearance.spec.cjs
```

Expected: semantic contract and shared preview assertions fail; duplicated light
theme overrides permit component values outside the contract.

- [ ] **Step 3: Migrate themes to semantic assignments**

Keep theme selectors responsible for token values only. Consolidate repeated
`.light-ui`, porcelain, sage, and warm component overrides into semantic token
assignments. Component selectors remain in component files. Preserve opaque
fallbacks before OKLCH `color-mix()` values. Use corrected luminance for custom
theme mode selection.

- [ ] **Step 4: Rebuild Appearance content**

Create a shared SettingRow structure with title, concise description, and a
40-pixel minimum control target. Render theme cards from existing theme metadata
with real mini previews and a visible check mark. Add a sticky preview using the
production component classes. Keep custom theme creation and every advanced
glass parameter, but collapse the advanced controls initially.

- [ ] **Step 5: Verify all themes and commit**

Run the theme unit test, appearance UI test, then `npm test`. Also iterate every
theme at 1024×768 and assert no console error or horizontal overflow. Expected:
all 21 themes satisfy the same geometry and semantic contract.

```powershell
git add src/js/app.js src/js/settings.js src/js/i18n.js src/css/themes.css src/css/settings.css src/css/components.css tests
git commit -m "feat: unify themes and appearance controls"
```

**Acceptance gate:** Theme changes alter mood without changing layout, Appearance
is scannable, advanced controls remain available, and the real preview matches
the canvas components.

---

### Task 6: Bookmark settings editor, icon picker, and undo deletion

**Files:**
- Create: `src/js/settings-bookmarks.js`
- Create: `src/js/icon-picker.js`
- Create: `tests/ui/bookmark-settings.spec.cjs`
- Create: `tests/ui/icon-picker.spec.cjs`
- Modify: `newtab.html`
- Modify: `src/js/settings.js`
- Modify: `src/js/i18n.js`
- Modify: `src/css/settings.css`

**Interfaces:**
- Produces: `NordlysBookmarkSettings({ app, root, openIconPicker })` with `render()`, `moveFolder(id, delta)`, `moveBookmark(folderId, bookmarkId, delta)`, and `removeWithUndo(location)`.
- Produces: `NordlysIconPicker({ dialogRoot, onSelect })` with `open(currentIcon)`, `close()`, and `select(source)`.
- Consumes: `NordlysUI.DialogController`, `showUndoToast()`, and `NordlysIcons.renderIcon()`.
- Preserves: existing bookmark/folder IDs, config shape, import/export, URL validation, upload, cropper, built-in icon source, favicon source, and custom URL source.

- [ ] **Step 1: Write failing bookmark-manager tests**

Assert folders render as accordions with name, count, visibility toggle, move
buttons, and overflow action. Expanding one folder reveals summary rows containing
icon, name, and host but not all editable inputs. Activating Edit opens a focused
editor. Move down changes both DOM order and stored config. Delete removes the
item, exposes an Undo button, and Undo restores the exact folder/index and stored
data. Assert live-region text describes move, deletion, and restoration.

- [ ] **Step 2: Write failing icon-picker tests**

Assert opening the picker creates a named modal dialog 640–680 pixels wide on a
1440-pixel viewport, traps focus, and returns focus to the icon trigger. Its source
tabs expose tab semantics, search filters real built-in results, cells are at
least 72×72 with artwork 32–36 pixels, and selecting a result updates a live
production `.tile` preview and then the bookmark editor. At 320 pixels assert the
dialog fits without horizontal overflow or clipped actions.

- [ ] **Step 3: Verify RED**

Run both new UI suites. Expected: baseline exposes all inputs in dense rows,
provides no undo or explicit move alternative, and the icon modal lacks complete
dialog/tab/focus semantics.

- [ ] **Step 4: Extract and implement bookmark settings behavior**

Move bookmark-section behavior out of `SettingsController` without changing who
saves config. Use stable IDs and immutable snapshots for undo. A second mutation
after deletion cancels only an incompatible pending undo; a successful undo runs
once. Pointer drag calls the same move methods used by buttons.

- [ ] **Step 5: Extract and implement the icon picker**

Move picker lifecycle, source tabs, search, categories, selection, and preview
into `IconPickerController`. Use textContent/DOM APIs for user data. Reuse the
dialog primitive and shared tile renderer. Keep crop/upload processing owned by
the existing settings orchestration until selection returns a final source.

- [ ] **Step 6: Verify and commit**

Run both focused suites, then `npm test`. Expected: keyboard and pointer flows
produce identical stored order; undo restores exact data; picker has no focus
escape, clipping, or runtime errors.

```powershell
git add newtab.html src/js/settings-bookmarks.js src/js/icon-picker.js src/js/settings.js src/js/i18n.js src/css/settings.css tests
git commit -m "feat: improve bookmark management"
```

**Acceptance gate:** Bookmark management is compact and understandable, every
reorder has a keyboard path, deletion is reversible, and icon selection previews
the real result.

---

### Task 7: Search, context menu, quick edit, and resize keyboard parity

**Files:**
- Create: `tests/ui/search-combobox.spec.cjs`
- Create: `tests/ui/context-menu.spec.cjs`
- Create: `tests/ui/keyboard-actions.spec.cjs`
- Modify: `newtab.html`
- Modify: `src/js/widgets.js`
- Modify: `src/js/grid.js`
- Modify: `src/js/settings.js`
- Modify: `src/js/ui-primitives.js`
- Modify: `src/js/i18n.js`
- Modify: `src/css/components.css`

**Interfaces:**
- Consumes: `NordlysUI.MenuController`, `DialogController`, and `announce()`.
- Preserves: existing search engines, URL detection, search history, quick edit
  fields, pointer context menu, drag/drop, and pointer resize.

- [ ] **Step 1: Write failing search combobox tests**

Assert the input has `role="combobox"`, `aria-autocomplete="list"`,
`aria-expanded`, `aria-controls`, and `aria-activedescendant`. Suggestions are
options in a listbox. Arrow keys update the active descendant without moving DOM
focus out of the input; Enter activates it; Escape closes the list while retaining
the typed value. Removing a history suggestion has an accessible name and does
not submit the search.

- [ ] **Step 2: Write failing context-menu and dialog tests**

Focus a tile and open its menu with Shift+F10 and the Menu key. Assert menu/menuitem
roles, first-item focus, ArrowUp/Down, Home/End, Enter/Space, Escape, viewport
collision handling, and focus restoration. Open Quick Edit and assert it uses the
same modal dialog/focus behavior as the icon picker and confirmation dialog.

- [ ] **Step 3: Write failing drag/resize alternative tests**

Use visible or overflow actions to move a folder and bookmark without drag.
Expose resize decrement/increment controls that change columns by one valid step,
save the same config as pointer resize, clamp to the same bounds, and announce the
new column count.

- [ ] **Step 4: Verify RED**

Run the three focused files. Expected: baseline suggestions and context items are
generic divs, quick edit lacks complete dialog semantics, and resize is pointer-only.

- [ ] **Step 5: Implement shared accessible behavior**

Refactor search to the active-descendant combobox pattern. Drive context-menu
opening, movement, activation, closing, and focus restoration through
`MenuController`; retain pointer coordinates as an input to the same controller.
Drive Quick Edit through `DialogController`. Route move and resize buttons to the
same model mutations used by pointer operations and announce results.

- [ ] **Step 6: Verify and commit**

Run the three focused suites and `npm test`. Repeat primary flows using only the
keyboard. Expected: identical state changes for keyboard and pointer paths, no
focus loss, and no duplicate action from Enter/Space.

```powershell
git add newtab.html src/js/widgets.js src/js/grid.js src/js/settings.js src/js/ui-primitives.js src/js/i18n.js src/css/components.css tests
git commit -m "feat: add keyboard-complete interactions"
```

**Acceptance gate:** Search, menus, dialogs, reorder, and resize are fully usable
without a pointer and preserve all existing actions.

---

### Task 8: Motion, responsive behavior, target sizing, and visual refinement

**Files:**
- Create: `tests/ui/responsive.spec.cjs`
- Create: `tests/ui/motion.spec.cjs`
- Create: `tests/ui/accessibility.spec.cjs`
- Modify: `src/css/main.css`
- Modify: `src/css/liquid-glass.css`
- Modify: `src/css/components.css`
- Modify: `src/css/settings.css`
- Modify: `src/css/themes.css`
- Modify: `src/js/background.js`

**Interfaces:**
- Consumes: semantic motion/focus/size tokens from `foundations.css`.
- Preserves: background visibility pause and device-pixel-ratio cap.

- [ ] **Step 1: Write failing responsive and target-size tests**

Parameterize 320×568, 768×720, 1024×768, 1440×900, 1920×1080,
2560×1440, and 3840×2160. Assert no body horizontal overflow, no intersection
between clock/search/groups, visible labels stay inside their tile columns, and
every primary visible control has a hit box at least 40 pixels in each dimension.
Repeat the 1024 layout with device scale/viewport equivalent to 200% zoom.

- [ ] **Step 2: Write failing motion tests**

Record animations returned by `document.getAnimations({ subtree: true })` during
initial load, tile hover, drawer open, menu open, and dialog open. Assert animated
keyframes contain only `transform` and/or `opacity`, entrance finishes within
320ms, and panels finish within 280ms. Emulate Reduced Motion and assert there is
no scale, blur, parallax, or stagger and every remaining animation is at most
120ms.

- [ ] **Step 3: Write failing accessibility tests**

Run Axe against the canvas, every settings section, context menu, quick edit, and
icon picker. Treat serious/critical violations as failures. Add explicit tests for
focus indicator presence and contrast because Axe does not validate every focus
state. Verify long Russian and German labels plus Japanese and Chinese navigation
at 720 and 320 pixels.

- [ ] **Step 4: Verify RED**

Run the three new suites. Expected: baseline motion includes filter/blur and
multiple durations, compact controls miss target size, and current ARIA/focus
defects are reported.

- [ ] **Step 5: Complete the visual and motion pass**

Replace remaining `transition: all` declarations with explicit properties.
Remove animated blur/backdrop/filter/shadow and clock blur pulses. Normalize
durations to foundation tokens. Preserve static backdrop blur only where it
materially separates a surface. Make long translations wrap or truncate with an
accessible full name. Keep visual radii and shadows within the foundation scales.
Honor Reduced Motion in CSS and suspend decorative background pointer/parallax
responses when it is active.

- [ ] **Step 6: Verify and commit**

Run the focused suites, then `npm test`. Expected: zero serious/critical Axe
violations, no overflow in the viewport matrix, target-size assertions pass,
and motion timing/property assertions pass.

```powershell
git add src/css src/js/background.js tests
git commit -m "feat: polish responsive motion and accessibility"
```

**Acceptance gate:** The product remains calm and readable at every target size,
Reduced Motion is genuinely reduced, and decorative work does not obscure or
delay interaction.

---

### Task 9: Visual regression suite and final quality gate

**Files:**
- Create: `tests/ui/visual-regression.spec.cjs`
- Create: `tests/ui/visual-regression.spec.cjs-snapshots/` through reviewed Playwright snapshots
- Create: `docs/quality/nordlys-refined-ui-checklist.md`
- Modify when a failing regression requires it: `src/css/main.css`, `src/css/liquid-glass.css`, `src/css/themes.css`, `src/css/components.css`, `src/css/settings.css`, `src/js/ui-primitives.js`, `src/js/icon-presentation.js`, `src/js/widgets.js`, `src/js/grid.js`, `src/js/settings-shell.js`, `src/js/settings-bookmarks.js`, `src/js/icon-picker.js`, `src/js/settings.js`, `src/js/app.js`

**Interfaces:**
- Consumes: every completed runtime component and test fixture.
- Produces: stable reviewed snapshots and a recorded 100-point quality score.

- [ ] **Step 1: Add representative visual snapshots**

Capture deterministic screenshots with animation disabled for:

- 1440×900 default dark canvas;
- 1024×768 representative light canvas containing monochrome light logos;
- 320×568 narrow canvas;
- 1440×900 Appearance drawer;
- 1440×900 Bookmarks drawer with one expanded folder;
- 1440×900 icon picker;
- context menu, quick edit, keyboard focus, and Reduced Motion states;
- custom theme with both light and dark luminance inputs.

Mask only genuinely nondeterministic clock text and canvas animation. Do not mask
bookmark tiles, settings content, focus indicators, menus, or dialogs.

- [ ] **Step 2: Generate snapshots and review every image**

Run `npm run test:ui:update -- tests/ui/visual-regression.spec.cjs`. Open every
generated PNG at original resolution. Reject washed-out icons, misaligned optical
centers, accidental clipping, excessive glow, inconsistent radii, weak active
states, dense controls, or changed main composition. Apply fixes through a new
failing behavioral or visual test before production edits.

- [ ] **Step 3: Run the complete automated gate fresh**

Run:

```powershell
npm ci
npx playwright install chromium
npm test
git diff --check origin/main...HEAD
```

Expected: exit code 0 for all commands; zero failed tests; zero page/console
errors; no whitespace errors.

- [ ] **Step 4: Run actual-browser smoke checks**

Load the unpacked worktree in installed Chrome, Edge, and Brave when present.
For each available browser verify new-tab override, storage persistence, search,
bookmark opening, settings, icon upload/crop, custom CSS, import/export, keyboard
navigation, and Reduced Motion. Record browser version and result in the quality
checklist. Absence of a browser is recorded explicitly and does not get reported
as a passing run.

- [ ] **Step 5: Score the approved rubric**

Record evidence and score: hierarchy 20, icons 15, settings 15,
interaction/motion 15, accessibility 15, responsive 10, performance/
maintainability 10. A category cannot receive full credit when its associated
test or manual check has an open defect. Continue fixing with RED/GREEN cycles
until the total is at least 90 and there are no Critical or Important findings.

- [ ] **Step 6: Commit verification artifacts**

```powershell
git add tests docs/quality package.json package-lock.json
git add -u
git commit -m "test: verify Nordlys UI quality gates"
```

**Acceptance gate:** Fresh full verification passes, every snapshot has been
visually inspected, the score is at least 90/100, and no Critical or Important
review issue remains.

## Final regression checklist

- [ ] Main composition remains clock → search → bookmark groups.
- [ ] Existing storage data loads without migration loss.
- [ ] All 21 theme IDs and custom themes work with identical component geometry.
- [ ] Built-in, favicon, URL, upload, transparent, monochrome, and monogram icons
  remain legible in representative dark and light themes.
- [ ] Settings expose Appearance, Background, Bookmarks, General, Custom CSS, and
  Data & Backup at desktop and narrow widths.
- [ ] Pointer and keyboard paths both work for search, menus, dialogs, move,
  delete/undo, drag, and resize.
- [ ] English, Russian, German, Japanese, and Chinese do not create clipped
  navigation or inaccessible names.
- [ ] Reduced Motion removes scale/blur/parallax/stagger.
- [ ] No new manifest permission, host permission, runtime dependency, remote UI
  asset, version bump, merge, push, or publish occurred.
- [ ] `npm test` and `git diff --check origin/main...HEAD` pass in a fresh run.
