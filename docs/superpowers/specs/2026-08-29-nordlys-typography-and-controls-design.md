# Nordlys Typography and Controls — Design

Date: 2026-08-29
Branch: `feat/nordlys-refined-ui`
Predecessor: icon legibility (`fdf0902`)

## Goal

Give the settings panel a typographic identity of its own, let the user assign
fonts per area including the ones installed on their machine, and remove the last
places where Nordlys falls back to operating-system chrome — the nine native
`<select>` dropdowns that render as a white sliding rectangle regardless of theme.

## Constraints

- **No remote resources.** MV3 extension pages may not pull fonts from a CDN, and
  a Web Store review treats remote assets as a defect. Every bundled face ships
  inside the package and loads from the extension origin.
- **Redistribution licence required for anything bundled.** The user's font
  collection (`github.com/sa1ntsinner/fonts`) is marked "DON'T USE FOR COMMERCIAL
  USE" by its own README: Dank Mono, MonoLisa, Operator Mono and Gintronic are
  commercial, SF Mono is Apple's. Satoshi, installed locally, is Fontshare's and
  permits use but not redistribution. None of them may be bundled. They remain
  fully usable through local font selection, which redistributes nothing.
- **`queryLocalFonts` is available but gated.** Verified in the real unpacked
  extension: the API exists, the context is secure, permission state is `prompt`,
  and a denied or ungranted call returns an **empty array rather than throwing**.
  Absence of fonts must therefore be treated as "not granted", never as an error.
- Existing storage keys, theme IDs and section IDs keep working; no migration loss.
- The work must not regress the icon-plate guarantee shipped in `fdf0902`.

## Bundled faces

| Face | Role | Licence | Approx. woff2 |
| --- | --- | --- | --- |
| Outfit (variable) | Display — clock, folder headers, panel title | OFL 1.1 | ~60 KB |
| Instrument Sans (variable) | Interface — panel, labels, tiles, controls | OFL 1.1 | ~70 KB |

No monospace face is bundled. `--font-mono` is used in two places (the search
`kbd` hint and calculator results); the system stack is sufficient there and a
third file is not worth the weight.

Files live in `src/fonts/`, are declared with `@font-face` and `font-display: swap`,
and are added to the store zip allowlist in `RELEASE_GUIDE.md` and
`docs/CHROME_STORE_GUIDE.md`. Each face ships with its `OFL.txt` alongside.

## Font subsystem

### Slots

Three assignable slots map onto the CSS custom properties that already exist, so
no consumer changes:

| Slot | Token | Applies to |
| --- | --- | --- |
| Display | `--font-display` | clock, folder headers, panel title |
| Interface | `--font-main` | everything else |
| Monospace | `--font-mono` | search hint, calculator output |

### Sources offered in each slot

1. **Bundled** — Outfit, Instrument Sans. Always present, no permission.
2. **Common system faces** — a fixed list of family names that ship with Windows,
   macOS and most Linux desktops, filtered by slot so a monospace face is never
   offered for Display and a proportional one is never offered for Monospace:
   - Display and Interface: Segoe UI, SF Pro Text, Inter, Roboto, Helvetica Neue,
     Arial, Georgia.
   - Monospace: Cascadia Code, Consolas, SF Mono, Menlo, IBM Plex Mono.

   Offered by name only; an absent family simply falls through the stack. No
   permission. The device list from source 3 is not filtered this way — it is the
   user's own inventory, and second-guessing what they meant to pick there would
   hide exactly the fonts they installed on purpose.
3. **Everything installed** — a list item labelled "All fonts on this device"
   that, **on click**, calls `queryLocalFonts()`. This is the only path that
   requires a user gesture and shows Chrome's permission prompt. On success the
   picker gains every installed family (Satoshi, MonoLisa, Gintronic and the rest).

### Permission behaviour

- The call happens only from a real click, never on load or on panel open.
- An empty array is indistinguishable from denial, so both take the same path:
  the picker keeps sources 1 and 2, and the list item changes to explain that the
  device list is unavailable and can be retried.
- A granted list is cached in memory for the session only. Font inventories change
  when the user installs fonts, and a stale cache in storage would be wrong more
  often than it would be useful.
- The chosen value is stored as a **family name string**, not a handle, so a
  choice survives reload without needing the permission again. If the family later
  disappears, CSS falls through to the slot's default stack on its own.

### Storage and application

- `config.fonts = { display, interface, mono }`, each a family name or the
  sentinel `"default"`.
- Applied in `applyThemeTokens()` by setting the three tokens on `:root`,
  alongside the existing theme tokens, so a theme change and a font change go
  through one path.
- **Typography leaves the theme.** The custom-theme editor's `thm-font` control is
  removed: a theme is a colour palette, and font choice is global. On first load
  after the update, a custom theme carrying a `font` value moves that value into
  `config.fonts.interface` once, then the key is dropped. Nothing is lost and the
  migration cannot run twice.

## Themed listbox

One component replaces all nine native `<select>` elements.

### The nine call sites

| Element | Options | Notes |
| --- | --- | --- |
| `cfg-language-select` | 8 | |
| `cfg-time-format` | 2 | |
| `cfg-default-engine` | 10 | |
| `cfg-bg-mode` | 7 | rewritten in part C; the control is replaced now |
| `cfg-icon-shape` | 3 | |
| `cfg-hover-effect` | 4 | |
| `quick-folder-select` | dynamic | folder list, rebuilt per open |
| `quick-folder-cols-select` | 8 | |
| `thm-font` | 6 | **removed**, superseded by the font slots |

Eight are replaced; the ninth is deleted. Three new font slots are added, so the
panel ends with eleven instances of the component.

### Shape and behaviour

- A trigger button showing the current value, and a popover list painted in theme
  tokens — never system chrome.
- Registered on the existing layer stack, so Escape, focus restore and background
  `inert` behave exactly as the drawer, dialogs and menus already do.
- `role="combobox"` on the trigger with `aria-expanded` and `aria-controls`;
  `role="listbox"` on the popover with `role="option"` and `aria-selected`.
- Keyboard: Enter/Space/Down opens, Up/Down moves, Home/End jump, typing letters
  jumps to a match, Enter commits, Escape closes without committing and returns
  focus to the trigger.
- The popover flips above the trigger when it would overflow the viewport, and its
  height is capped so a ten-item list scrolls rather than escaping the panel.
- In the font slots each option renders in its own family, so the list previews
  itself. Families are applied to options lazily as they scroll into view.

## Panel visual language

- **Type scale** built on the two bundled faces: rail group labels 10px/700 with
  wide tracking, navigation items 13.5px/600, row labels 12.5px/450, row values
  12.5px/600 with tabular figures, section titles 15px/650 in Outfit.
- **Row rhythm**: a single row height with the label left and the control right on
  a shared baseline, dividers only between rows inside a group — not around it.
- **Grouping** follows the SyncSpend reference: quiet uppercase labels introduce a
  block, the block itself is one rounded surface, and controls sit flush inside it.
- The existing 40px minimum target size and focus-visible treatment are unchanged.

Motion stays as it is in this part. The animation pass is part C, and doing it
here would make both harder to review.

## Testing

- **Component behaviour**: opening, committing, Escape-without-commit, focus
  restore to the trigger, type-ahead, and that the background is `inert` while
  open — the same guarantees the other layers already prove.
- **No native dropdown survives**: assert `document.querySelectorAll('select')` is
  empty across every settings section, so a regression cannot quietly reintroduce
  one.
- **Font application**: choosing a family sets the matching token, is visible on
  the canvas, and survives a reload.
- **Permission degradation**: with `queryLocalFonts` stubbed to return `[]`, the
  device-list item reports unavailability and the picker still works from the
  bundled and common sources.
- **Migration**: a saved custom theme carrying `font` lands in
  `config.fonts.interface` exactly once and the theme key is dropped.
- **Bundled faces actually load**: assert the two families report as loaded via
  `document.fonts.check`, so a missing or misnamed file fails the suite rather
  than silently falling back to a system stack.
- Visual baselines for the panel are regenerated and reviewed at full resolution.

## Out of scope

- Icon legibility — shipped in `fdf0902`.
- Background engines, the animation pass, and the folder `+`/`−` controls — part C.
