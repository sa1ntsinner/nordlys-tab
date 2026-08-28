# Nordlys Refined UI/UX Design

## Status and baseline

Approved on 2026-08-28. Implementation starts from `origin/main` commit
`62c262073a63fb040e12998164891d4a4c91a1ad` on a feature branch. The dirty
`redesign` working tree is a negative reference only and must not be copied or
modified.

Nordlys remains a vanilla Manifest V3 Chrome new-tab extension. The current
centered composition — clock, search, then bookmark folders — is the product's
identity and must remain recognizable. This project improves the design system,
component quality, interaction behavior, accessibility, responsive behavior,
and maintainability without turning themes into different page layouts.

## Product principles

1. **Quiet canvas, clear content.** The aurora and glass establish atmosphere;
   bookmarks and controls remain crisp enough to use instantly.
2. **One component language.** A button, focus ring, dialog, menu, setting row,
   and tile behave the same everywhere and in every theme.
3. **Themes change mood, never structure.** Theme rules may provide semantic
   colors and background parameters. They may not alter component geometry,
   navigation structure, or page composition.
4. **Motion explains state.** Animation is brief, interruptible, and limited to
   transform and opacity where practical. Decorative blur choreography is not a
   substitute for hierarchy.
5. **Keyboard and pointer are peers.** Every pointer-only operation has a visible
   or discoverable keyboard alternative.
6. **No gallery-driven redesign.** External products are inspiration for
   hierarchy, restraint, and consistency; Nordlys does not copy their layouts.

## Invariants and non-goals

- Preserve the existing clock → search → bookmark-groups composition.
- Preserve storage compatibility, existing user configuration, theme IDs,
  import/export behavior, custom CSS, and all current bookmark operations.
- Preserve all 21 built-in themes and custom themes.
- Keep the desktop settings experience as a right-side drawer. Below 760 CSS
  pixels it becomes a full-width sheet.
- Do not add a runtime framework, animation library, remote font, remote UI
  asset, new extension permission, or new host permission.
- Do not turn individual themes into editorial scenes or alternate layouts.
- Do not replace the current background engine in this project.
- Do not remove advanced customization merely to simplify the interface;
  advanced controls may be progressively disclosed.
- Do not merge, push, publish, or change version/store metadata as part of this
  implementation.

## Visual foundations

Create semantic tokens for canvas, card/tile/elevated surfaces, overlays,
primary/secondary/tertiary text, borders, focus, accent states, status colors,
shadows, radii, spacing, typography, and motion. Use a 4-pixel spacing base and
a restrained radius set. Existing public CSS variables used by custom CSS must
remain available as compatibility aliases during the migration.

The semantic surface hierarchy has three visually distinct levels:

- canvas: background and aurora;
- card: bookmark folders and settings sections;
- elevated: menus, dialogs, popovers, and active controls.

Theme files assign semantic values. Component files consume semantic values and
must not contain theme-specific selector matrices. Use `color-mix(in oklch, …)`
as progressive enhancement only when an opaque fallback appears first.

Correct the luminance calculation in `relativeLuminance()` by linearizing sRGB
channels before applying WCAG coefficients. Custom-theme light/dark decisions
must use this corrected function.

## Bookmark canvas and icon presentation

The default visual tile remains 78 by 78 CSS pixels on ordinary desktop widths.
Responsive sizing may step down, but must not use `12vw` in a way that collapses
tiles below a usable 56-pixel visual size. At 320 pixels wide, bookmark groups
may reflow or scroll within the page rather than shrinking controls below the
minimum.

Icons are source-aware:

- built-in SVG glyphs occupy 62–66% of the tile;
- raster icons and favicons occupy 68–74%;
- monochrome marks can receive a light/dark foreground treatment;
- icon metadata may provide a bounded optical scale adjustment;
- transparent and unusually wide marks must look optically comparable to
  square marks.

The tile uses a stable neutral surface, a one-pixel border, and one restrained
shadow. Persistent colored washes and double icon drop-shadows are removed.
Color may appear as a subtle halo on hover or keyboard focus. Labels use 12–13
pixel text with sufficient contrast.

Hover lifts the tile by 2–3 pixels and scales it no further than 1.02. Pressed
state scales to approximately 0.97. Keyboard focus uses a two-layer ring that
remains visible on both dark and light backgrounds.

## Settings information architecture

On desktop, the settings drawer width is `clamp(600px, 46vw, 720px)`. Its header
and navigation remain visible while only the section content scrolls. A quiet
scrim preserves context without applying a heavy animated blur to the canvas.

The drawer contains an approximately 168-pixel vertical navigation rail:

- Customize: Appearance, Background, Bookmarks;
- App: General;
- Advanced: Custom CSS, Data & Backup.

Navigation rows are 40–44 pixels high, use 16–18 pixel icons, and show a subtle
tint plus a narrow active marker. They implement tablist/tabpanel semantics and
arrow-key navigation. At narrow widths the navigation becomes a compact,
horizontally scrollable tab strip with an obvious scroll affordance; the drawer
itself becomes a full-width sheet.

Settings content uses a shared setting-row pattern: title and concise supporting
text on the left, control on the right, with a 52–64 pixel default row height.
Advanced glass tuning is collapsed by default. Appearance includes a sticky
preview rendered from the same tile/card components as the live canvas. Theme
cards form a two-column grid and show a real preview plus an unambiguous selected
state.

## Bookmark management and icon selection

The bookmark manager shows folder accordions. A collapsed folder row exposes
name, bookmark count, visibility, reorder handle, and overflow actions. An
expanded folder shows compact bookmark summary rows containing icon, name, and
host. Editing uses a focused editor rather than exposing every input in every
row simultaneously.

Drag remains available, but folders and bookmarks also provide explicit Move up
and Move down actions. Removal is immediately reflected and paired with an Undo
toast that restores the exact previous location during its timeout.

The icon picker is a 640–680 pixel accessible dialog on desktop and fits within
the narrow viewport. It provides accessible source tabs, search, category
filters, 72-pixel cells with 32–36 pixel artwork, and a live preview using the
actual bookmark tile renderer. Quick edit and confirmation dialogs share the
same dialog/focus primitive.

## Interaction and accessibility

Use native elements first. Shared primitives provide any behavior native HTML
does not provide consistently:

- focus containment and focus restoration for drawer/dialog;
- roving focus for tabs and menus;
- Escape dismissal respecting the topmost layer;
- live-region announcements;
- menu positioning and active-item management;
- non-destructive toast actions.

The bookmark context menu opens with pointer context-menu, the Menu key, or
Shift+F10. Arrow keys, Home, End, Enter, Space, and Escape work as expected.
Search exposes the combobox/listbox pattern and keeps DOM focus in the input
while `aria-activedescendant` identifies the active suggestion. Pointer drag and
resize operations have explicit button/stepper alternatives and announce the
result.

All meaningful controls have accessible names. Drawer and dialog focus cannot
escape while open. Closing restores focus to the opener. Text contrast targets
WCAG AA (4.5:1 for normal text); non-text indicators and focus indicators target
3:1. Primary hit areas are 40–44 pixels; compact visuals may be smaller only
when their clickable area remains at least 40 pixels.

## Motion and performance

Motion tokens:

- fast feedback: 120ms;
- controls and dropdowns: 160–180ms;
- drawer and dialog: 240–280ms;
- first-load entrance: at most 320ms with a capped stagger.

Use a shared emphasized easing close to `cubic-bezier(.2, .8, .2, 1)`. Do not
use `transition: all`. Do not animate blur, backdrop-filter, filter drop-shadow,
or layout properties. Reduced Motion removes scale, blur, long travel, parallax,
and stagger; state changes become immediate or a short opacity fade.

Retain the background engine's visibility/pause behavior and current DPR cap.
The final page must produce no console errors, horizontal overflow, or long
main-thread work attributable to the redesign.

## Responsive contract

Verify 320×568, 768×720, 1024×768, 1440×900, 1920×1080, 2560×1440, and 4K.
Also verify 200% browser zoom. The canvas may become vertically scrollable, but
controls do not overlap, labels do not collide, and no interactive target is
shrunk to preserve a desktop row.

Long translations must be checked in English, Russian, German, Japanese, and
Chinese. The complete theme contract runs over all built-in theme IDs, while
visual snapshots cover representative dark, light, colorful, and custom themes.

## Quality gate

No Critical or Important review finding may remain open. The acceptance score is
at least 90/100:

- visual hierarchy and consistency: 20;
- bookmark/icon clarity: 15;
- settings usability: 15;
- interaction and motion: 15;
- accessibility: 15;
- responsive behavior: 10;
- performance and maintainability: 10.

Automated verification uses dev-only tests. Playwright covers DOM behavior,
geometry, keyboard operation, responsive layout, and visual snapshots. Axe is a
supporting signal, not a substitute for manual keyboard and contrast review.
The production extension remains dependency-free at runtime.
