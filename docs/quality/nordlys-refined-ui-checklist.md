# Nordlys Refined UI Quality Gate

Date: 2026-08-28  
Baseline: `origin/main@62c262073a63fb040e12998164891d4a4c91a1ad`

## Automated gate

- `npm ci`: passed; 5 packages installed, 0 vulnerabilities. All dependencies are development-only.
- `npx playwright install chromium`: passed.
- `npm test`: passed; 13 runtime scripts syntax-clean, 3 unit tests passed, 47 UI tests passed in 54.2s.
- Axe: zero serious or critical violations across the canvas, all settings sections, context menu, quick edit, and icon picker.
- Viewports: 320, 768, 1024, 1440, 1920, 2560, and 3840 widths passed without horizontal overflow or primary-region intersection; the 200% zoom equivalent passed.
- Locales: English, Russian, German, Japanese, and Chinese passed at 720px and 320px.
- Motion: initial entrance is at most 320ms; panel motion is at most 280ms; Reduced Motion disables scale, blur, parallax, and stagger and caps remaining transitions at 80ms.
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
| Chrome | 151.0.7922.175 | Not completed | Installed branded Chrome ignored `--load-extension`/`--disable-extensions-except` in both headed and headless isolated-profile launches; `chrome://newtab` remained `chrome://new-tab-page`. This run is not counted as a pass. |
| Edge | — | Not installed | No executable found in either Program Files location. |
| Brave | — | Not installed | No executable found in either Program Files location. |

The pinned Chromium Playwright gate exercises storage persistence, search, bookmark editing/opening semantics, settings, icon-source workflows, custom CSS surfaces, keyboard navigation, and Reduced Motion against the unpacked source through the local extension-compatible fixture. A manual unpacked-extension smoke in branded Chrome remains a release-environment advisory, not a product defect.

## Rubric

| Category | Score | Evidence |
| --- | ---: | --- |
| Hierarchy | 19/20 | Centered clock → search → groups composition preserved at every target viewport; clear surface and typography hierarchy. |
| Icons | 15/15 | Built-in 64%, raster/favicon 72%, bounded optical scaling, tone treatment, dark/light snapshots, and current-icon live preview. |
| Settings | 14/15 | 600–720px drawer, 168px grouped rail, narrow full-screen sheet, SettingRows, shared previews, bookmark accordions, and icon picker. |
| Interactions and motion | 14/15 | Shared dialog/menu/tab/combobox/toast lifecycle, complete keyboard paths, bounded transform/opacity motion, Reduced Motion. |
| Accessibility | 15/15 | Axe gate, focus visibility, focus trap/restore, roving navigation, combobox/listbox semantics, announcements, target sizing, five locales. |
| Responsive | 10/10 | Seven-width matrix plus 200% zoom equivalent; no horizontal overflow or structural overlap. |
| Performance and maintainability | 9/10 | No runtime dependency/framework, explicit transitions, static-only backdrop blur, paused reduced-motion canvas, syntax/unit/UI gates. |
| **Total** | **96/100** | Gate is above 90 with no open Critical or Important product defects. |

## Final regression checklist

- [x] Main composition remains clock → search → bookmark groups.
- [x] Existing storage keys and data load without migration loss.
- [x] All 21 theme IDs and custom themes retain identical component geometry.
- [x] Built-in, favicon/raster, URL/upload, transparent, monochrome, and monogram paths remain available and representative icons are legible in dark/light baselines.
- [x] Settings expose Appearance, Background, Bookmarks, General, Custom CSS, and Data & Backup at desktop and narrow widths.
- [x] Pointer and keyboard paths share search, menu, dialog, move, delete/undo, drag-alternative, and resize logic.
- [x] English, Russian, German, Japanese, and Chinese retain readable navigation and accessible names.
- [x] Reduced Motion removes scale, blur, parallax, and stagger.
- [x] No manifest/host permission, runtime dependency, remote UI asset, version bump, merge, push, or publish was introduced.
- [x] Fresh `npm test` passes.
- [x] Whitespace validation passes.

## Open advisory

- Manual unpacked-extension smoke in installed branded Chrome was not completed because command-line unpacked loading was ignored. Before store submission, load this worktree through `chrome://extensions` in Developer Mode and run the listed feature smoke once. No automated or visual product defect remains open.
