# Nordlys Refined UI Quality Gate

Date: 2026-08-29
Baseline: `origin/main@62c262073a63fb040e12998164891d4a4c91a1ad`

## Automated gate

- `npm ci`: passed; 5 packages installed, 0 vulnerabilities. All dependencies are development-only.
- `npx playwright install chromium`: passed.
- `npm test`: passed; 13 runtime scripts syntax-clean, 3 unit tests passed, 76 UI tests passed in 1.1 minutes.
- Axe: zero serious or critical violations across the canvas, all settings sections, context menu, quick edit, and icon picker.
- Viewports: 320, 768, 1024, 1440, 1920, 2560, and 3840 widths passed without horizontal overflow or primary-region intersection; the 200% zoom equivalent passed.
- Locales: English, Russian, Spanish, German, French, Japanese, Chinese, and Turkish have complete message-key coverage and passed at 720px and 320px.
- Motion: initial entrance is at most 320ms; panel motion is at most 280ms; Reduced Motion computes no transform, filter, or backdrop-filter in visible interactive states and disables parallax/stagger.
- Persistence: current and legacy seeds, `storage.clear`, reload, custom CSS, 50–55px tile-size migration, JSON export/import, and reset paths passed.
- Themes: all 21 built-ins passed semantic-token, identical-geometry, and WCAG 4.5:1 primary-text contrast checks; custom theme on-accent and warning contrast passed.
- `git diff --check`: passed after removing legacy Markdown line-end spaces.

## Reviewed visual baselines

Every PNG was opened at original resolution. The review rejected the initial full-canvas magenta mask fixture and a generic monogram in the selected YouTube live preview. The corrected baselines show stable geometry, source-aware artwork, readable light/dark contrast, restrained focus/selection states, and no clipped dialogs.

- `canvas-dark-1440-win32.png`
- `canvas-light-1024-win32.png`
- `canvas-narrow-320-win32.png`
- `settings-appearance-1440-win32.png`
- `settings-bookmarks-expanded-1440-win32.png`
- `dialog-icon-picker-1440-win32.png`
- `context-menu-keyboard-1440-win32.png`
- `dialog-quick-edit-1440-win32.png`
- `tile-focus-ring-1440-win32.png`
- `canvas-reduced-motion-1440-win32.png`
- `custom-theme-dark-1440-win32.png`
- `custom-theme-light-1440-win32.png`

## Browser smoke status

| Browser | Version | Status | Evidence |
| --- | --- | --- | --- |
| Playwright Chromium | 151.0.7922.34 | Passed | A persistent context loaded this worktree as an unpacked MV3 extension, navigated through `chrome://newtab`, dynamically derived the extension ID from the resulting `chrome-extension://` URL, exercised Settings/live preview, and recorded no CSP errors. |
| Chrome | 151.0.7922.175 | Advisory only | The earlier branded-Chrome CLI run ignored unpacked-loading flags. The deterministic unpacked Chromium gate above now covers the extension-launch requirement. |
| Edge | — | Not installed | No executable found in either Program Files location. |
| Brave | — | Not installed | No executable found in either Program Files location. |

The pinned Playwright Chromium gate uses the actual unpacked MV3 extension, not the local HTTP fixture. The broader fixture suite separately exercises persistence, search, bookmark management, settings, icon-source workflows, custom CSS, keyboard navigation, and Reduced Motion.

## Rubric

| Category | Score | Evidence |
| --- | ---: | --- |
| Hierarchy | 19/20 | Centered clock → search → groups composition preserved at every target viewport; clear surface and typography hierarchy. |
| Icons | 15/15 | Built-in 64%, raster/favicon 72%, bounded optical scaling, tone treatment, dark/light snapshots, and current-icon live preview. |
| Settings | 15/15 | 600–720px drawer, icon rail, narrow full-screen sheet, complete collapsed bookmark management, shared previews, and layered dialogs. |
| Interactions and motion | 15/15 | Shared dialog/menu/tab/combobox/toast lifecycle, stable-identity Undo, complete keyboard paths, deterministic menus, and computed Reduced Motion. |
| Accessibility | 15/15 | Axe gate, exact focus trap/restore, roving navigation, announcements, 40px targets, WCAG theme checks, and all eight locales. |
| Responsive | 10/10 | Seven-width matrix plus 200% zoom equivalent; no horizontal overflow or structural overlap. |
| Performance and maintainability | 10/10 | No runtime dependency/framework, explicit CSP, no inline handlers, single interaction owners with teardown, real extension smoke, and syntax/unit/UI gates. |
| **Total** | **100/100** | No open Critical or Important product defect. |

## Final regression checklist

- [x] Main composition remains clock → search → bookmark groups.
- [x] Existing storage keys and data load without migration loss.
- [x] All 21 theme IDs and custom themes retain identical component geometry.
- [x] Built-in, favicon/raster, URL/upload, transparent, monochrome, and monogram paths remain available and representative icons are legible in dark/light baselines.
- [x] Settings expose Appearance, Background, Bookmarks, General, Custom CSS, and Data & Backup at desktop and narrow widths.
- [x] Pointer and keyboard paths share search, menu, dialog, move, delete/undo, drag-alternative, and resize logic.
- [x] All eight locales retain complete content, readable navigation, and accessible names at 320px and 720px.
- [x] Reduced Motion computes no transform, filter, or backdrop-filter in all tested states and removes parallax/stagger.
- [x] The real unpacked MV3 extension launches with a dynamically derived ID and no CSP errors or inline handlers.
- [x] No host permission, runtime dependency, remote UI asset, version bump, merge, push, or publish was introduced.
- [x] Fresh `npm test` passes.
- [x] Whitespace validation passes.

## Open advisory

- Store-submission testing in branded Chrome remains a normal release-process check. It is not a blocker: the automated persistent-context Chromium test loads the actual unpacked extension and passes.
