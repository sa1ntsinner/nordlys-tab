# Competitor teardown — new-tab start pages and adjacent UI craft

Research date: 2026-08-30. Clones live under `.references/newtab/` (git-ignored). The
existing high-craft app corpus at `.references/ui/` was mined but not re-cloned.

| Project | Path | HEAD | Last commit | Status |
| --- | --- | --- | --- | --- |
| Bonjourr | `.references/newtab/bonjourr` | `c99ce56` | 2026-07-17 | active |
| Tabliss | `.references/newtab/tabliss` | `765a3f0` | 2024-01-16 | dormant |
| Mue | `.references/newtab/mue` | `678e1d7` | 2026-04-27 | active |
| nightTab | `.references/newtab/nighttab` | `4f66b87` | 2024-08-10 | dormant |
| Glance | `.references/newtab/glance` | `a8de7d8` | 2026-08-29 | active |
| Dashy | `.references/newtab/dashy` | `57ea05a` | 2026-08-30 | active |

Glance and Dashy were added beyond the brief. Glance is a self-hosted dashboard whose
CSS is hand-written custom properties with no build step — the closest technical match
to Nordlys in the whole survey, and the single best token system found. Dashy was added
because it solves exactly the problem Nordlys has: many user-selectable themes without
combinatorial CSS.

Nordlys reference points used throughout (read first, so comparisons are grounded):
`src/css/foundations.css`, `src/css/main.css`, `src/css/liquid-glass.css`,
`src/css/components.css` (46 KB), `src/css/themes.css` (53 KB), `src/css/settings.css`
(66 KB), `src/js/app.js`, `src/js/settings.js`, `src/js/typography.js`,
`src/js/icon-presentation.js`, `src/js/background.js`.

---

## 1. Bonjourr

`github.com/victrme/Bonjourr` — the closest peer. Deno + TypeScript, plain CSS, no
framework. 15 settings sections, ~30 features. Widely praised for looking like iOS.

### What it does well

**Everything is `em`, driven by two root numbers.** `src/styles/_global.css:1-40` defines
`--font-size: 1em` and `--clock-size: 6em`; the settings sliders write them:

```ts
// src/scripts/features/fonts.ts:259-261
function setFontSize(size: string): void {
    document.documentElement.style.setProperty('--font-size', `${Number.parseInt(size) / 16}em`)
}
// src/scripts/features/clock/index.ts:277-279
function clockSize(size = 5): void {
    document.documentElement.style.setProperty('--clock-size', `${size.toString()}em`)
}
```

The page-size slider is `min="5" max="26" step=".05"` (`src/settings.html:1852`); clock
size is `min="0.25" max="2.25" step=".125"` default `1` (`src/settings.html:896-909`).
Then every dimension of the clock is a multiple of that one unit
(`src/styles/features/time.css`):

```css
.digital        { font-size: calc(var(--clock-size) * 6); font-weight: var(--font-weight-clock); }
.analog         { width: calc(var(--clock-size) * 8); height: calc(var(--clock-size) * 8);
                  border: calc(var(--clock-size) * 0.2) solid; }
.analog-hours   { height: calc(var(--clock-size) * 2.4); }
.analog-minutes { height: calc(var(--clock-size) * 3.6); }
```

Two sliders scale the entire page proportionally with no media-query maintenance. This is
the single biggest structural difference from Nordlys, which hardcodes 13 distinct literal
`px` font sizes in `components.css` alone.

**Nested-radius formula for icon tiles.** `src/styles/features/links.css:585-600` derives
the inner image radius from the outer radius minus the padding, and derives every other
size band as a fixed ratio of the largest:

```css
#linkblocks.large { --icon-size: 4.8em; --block-size: 6.8em; --column-gap: 0.3em; --row-gap: 1.3em; }
.large .link .link-icon { padding: var(--link-padding); border-radius: var(--link-outer-radius); }
.large .link img        { border-radius: calc(var(--link-outer-radius) - var(--link-padding)); }

#linkblocks.medium { --icon-size: 3.5em; --block-size: 5.1em; }
/* .77 because they're about 77% the size of large links */
.medium .link .link-icon { padding: calc(var(--link-padding) * 0.77);
                           border-radius: calc(var(--link-outer-radius) * 0.77); }
.medium .link img        { border-radius: calc((var(--link-outer-radius) - var(--link-padding)) * 0.77); }
```

with `--link-padding: 0.3em; --link-outer-radius: 0.6em` in `_global.css`. The ratios are
`1.0 / 0.77 / 0.57 / 0.43` for large / medium / small / inline. Concentric radii stay
optically correct at every size for free.

**"Potato mode" — hardware detection that disables glass.** `src/scripts/startup/potato.ts`:

```ts
const canvas = document.createElement('canvas')
const gl = canvas?.getContext('webgl')
const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info')
if (BROWSER === 'chrome' && !gl) { document.body.classList.add('potato'); return }
const vendor = gl?.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? 0).toString()
const renderer = gl?.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? 0).toString()
const detectedPotato = vendor.includes('Google') && renderer.includes('SwiftShader')
```

Cached for four hours in `localStorage.lastPotatoCheck`. `body.potato` then strips
`backdrop-filter` and transitions from bookmarks, dialogs and the element mover, and
substitutes solid backgrounds (`src/styles/_global.css:180-215`). Software-rendered
Chrome (SwiftShader) is exactly the machine where a 28px backdrop blur on eight glass
cards drops to single-digit FPS.

**Adaptive fade-in — the fade lasts as long as the load took.** `src/scripts/shared/display.ts:44-54`:

```ts
loadtime = Math.min(performance.now() - loadtime, 333)
loadtime = loadtime > 33 ? loadtime : 0
document.documentElement.style.setProperty('--load-time-transition', `${loadtime}ms`)
document.body.classList.remove('loading')
```

Consumed by `_global.css:159-162` — `body.init #interface { transition: opacity var(--load-time-transition); }`.
Under one frame (33 ms) there is no fade at all; a slow load gets a fade proportional to
the stall, capped at 333 ms. It is also a **readiness barrier**: a `features` array is
seeded with every enabled widget and each one calls `displayInterface('clock')` etc. when
ready; the page only reveals when the array empties. That is how they get no layout shift
on a page whose contents come from async storage.

**`body.tabbing` focus rings.** `_global.css:104-124` — the dashed 2px accent outline is
applied only under `body.tabbing`, added on first Tab keypress. Slightly outdated now that
`:focus-visible` exists, but the intent (never show a ring to mouse users, always show one
to keyboard users) is right, and they add `outline-offset: 3px` plus `border-radius: 10px`
specifically for link tiles so the ring traces the tile shape.

**Alt-mode quick launch.** `src/styles/features/links.css:640-670` uses CSS counters to
number every tile, overlaid on `Alt`:

```css
#linkblocks { counter-reset: links 0; }
.link { counter-increment: links; }
.link:not(.no-alt) .link-icon::before {
    content: counter(links);
    position: absolute; inset: 0; z-index: 10;
    background-color: rgb(34 34 34 / 0.85);
    font-family: var(--monospace-font-family);
    opacity: 0; visibility: hidden; transition: opacity 0.075s;
}
[data-alt-mode='true'] .link:not(.no-alt) .link-icon::before { opacity: 1; visibility: visible; }
```

JS side, `src/scripts/features/links/index.ts:925-950`, maps `Alt+Digit N` to
`links[N-1].querySelector('a')?.click()`, guarded by `isTypingTarget(event.target)`.
Zero DOM for the numbers, and the overlay is instant.

**Animated tile removal that does not reflow the row.** `links.css:452-470`:

```css
.link.removed {
    margin: 0 calc(var(--column-gap) / 2 * -1); /* minus half of gap */
    width: 0 !important;
    opacity: 0;
    transition: width 0.3s 0.3s var(--out-cubic), margin 0.3s 0.3s var(--out-cubic), opacity 0.3s var(--out-cubic);
}
.link.removed .link-icon { transform: scale(0.6); }
```

The negative margin exactly cancels the flex gap of the collapsing element, so neighbours
slide smoothly instead of jumping by one gap width.

**Range input with a filled track, no JS per frame.** `src/styles/settings/inputs.css:181-192`:

```css
aside input[type='range'] {
    --range: calc(var(--max) - var(--min));
    --ratio: calc((var(--value) - var(--min)) / var(--range));
    --sx: calc(0.5 * 2em + var(--ratio) * (100% - 2em));
}
```

**Settings-row tooltips that expand inline.** `src/styles/settings/tooltips.css:14-90` —
a 20px round `?` button per row toggles `.tooltiptext.shown { max-height: 60px }` inside
the same `.param` card rather than opening a hover popup. `.settings-title` carries
`scroll-margin-top: 20px` "offset for when section is automatically getting scrolled to".

**Motion vocabulary**, small and named (`_global.css:39`, `links.css:2`):

```css
--out-cubic:     cubic-bezier(0.215, 0.61, 0.355, 1);
--in-out-bounce: cubic-bezier(0.68, -0.2, 0.265, 1.2);
```

Hover lift is gated behind a capability query so touch devices never get a stuck hover
state (`links.css:495-505`):

```css
@media only screen and (hover: hover) {
    .link:not(.selected) a:hover .link-icon { transform: translateY(-2px) scale(1.05); }
}
```

**Layout as a serialized grid string.** `src/styles/interface/global.css:1-20` —
`#interface { display: grid; grid-template-areas: var(--grid); }` and every widget gets
`grid-area: time | main | searchbar | quicklinks | notes | quotes | pomodoro`
(`src/styles/features/grid.css:6-40`). The layout is stored as a 2-D array of widget
names and stringified (`src/scripts/features/move/helpers.ts:88-99`):

```ts
export function gridStringify(grid: Grid): string {
    const itemListToString = (row: string[]) => row.reduce((a, b) => `${a} ${b}`)
    return grid.map((row) => `'${itemListToString(row)}'`).join(' ').trimEnd()
}
```

Defaults are `single` / `double` / `triple` column presets; `'.'` is an empty cell. The
entire drag-to-move feature is ~200 lines because CSS does the layout.

### What it does badly

**~60 hand-measured `max-height` values in CSS.** `src/styles/settings/dropdowns.css` is
nothing but numbers like `#local_options.shown { max-height: 585px; }`,
`.all .as_css { max-height: 3100px; }`, `.all .as_weather { max-height: 405px; }`. Every
one has to be re-measured whenever the content inside changes, in any of 17 languages.
This is the collapse-animation problem solved the worst possible way.

**No automatic contrast anywhere.** Readability over an arbitrary Unsplash photo is a
manual slider — `--text-shadow-alpha` (default `0.2`, `src/scripts/features/others.ts:125`)
feeding `--text-shadow-interface: 1px 2px 6px rgb(0 0 0 / var(--text-shadow-alpha))`. The
only automatic decision in the whole codebase is one string heuristic
(`src/scripts/features/searchbar.ts:52-57`):

```ts
?.classList.toggle('opaque', value.includes('#fff') && opacityFromHex(value) > 7)
```

A user who picks `#eeeeee` for the search-bar background gets white-on-white text, because
the check is literally `value.includes('#fff')`. `getAverageColor()`
(`src/scripts/features/backgrounds/index.ts:1029-1060`) does sample the wallpaper down to
100px and average it, but the result is only used for `--average-color` (the page
background behind a loading image) and the `theme-color` meta tag — never for text.

**No `prefers-reduced-motion`, at all.** Zero occurrences in `src/`.

**Interface colours have no primitive layer.** `[data-theme='light']` and
`[data-theme='dark']` each hardcode 15 unrelated hexes: `--color-input: #39383d`,
`--color-focused: #323135`, `--color-dialog-input-text: #a4a7a8`. No ramp, no relationship,
no way to add a third theme without inventing 15 more.

**Touch targets below the bar.** `aside input, aside select { height: 31px }`
(`inputs.css:112-119`); `.wrapper { min-height: 31px }`. The mobile media query lifts it
only to `36px` (`_responsive.css:230`). 44px is the accepted minimum.

**Analog clock is 450 lines of hand-tuned magic multipliers** — `calc(var(--clock-size) * 3.69)`,
`* 2.58`, `* 0.65`, `* 1.2` — one block per hand style per face style. Beautiful output,
unmaintainable source.

**`user-select: none` on `body`** (`_global.css:139`) kills text selection page-wide.

**Documented design bugs from their own CHANGELOG:** "Fixed digital clock jittering when
seconds are enabled (#815)" (22.2.0), "Fixed digital world clocks overlapping when large
font size + am/pm (#869)" (22.3.0), "No more layout shift when toggling widgets (on slow
computers)", "Slightly blurry settings panel on Chrome", "Fixed greetings flickering at 3am".
The jitter fix is what produced `font-variant-numeric: tabular-nums` on `.digital-ss` — but
note it is applied **only to the seconds span**, not to hours and minutes.

---

## 2. Tabliss

`github.com/joelshepherd/tabliss` — React 18, `node-sass` (indented `.sass`), dormant since
January 2024. Included because it is the most-recommended "minimal" new tab, and because
its failure mode is instructive.

### What it does well

**One slider is both the dimmer and the theme switch.** `src/views/dashboard/Dashboard.tsx:11`:

```tsx
const theme = (background.display.luminosity ?? 0) > 0 ? "light" : "dark";
```

and `src/views/shared/Backdrop.tsx:28-34`:

```tsx
if (blur && !focus) { style["filter"] = `blur(${blur}px)`; style["transform"] = `scale(${blur / 500 + 1})`; }
if (luminosity && !focus) { style["opacity"] = 1 - Math.abs(luminosity); }
```

The `luminosity` range is `min="-1" max="1" step="0.1"` (`src/views/settings/Background.tsx:77-97`).
Rather than painting a scrim div, they lower the **image's own opacity** and let the
Dashboard's `background-color: white | black` show through — the same number that darkens
the photo also flips the text colour. One control, no extra DOM, no scrim/text
disagreement possible.

Note `transform: scale(${blur / 500 + 1})` — the same overscale-to-hide-blurred-edges trick
Nordlys uses in `main.css` (`transform: scale(calc(1 + var(--bg-blur-px) / 500))`). Identical
constant; likely convergent.

**FOUC killed with a two-line pre-React script.** `target/shared/theme.js`:

```js
const theme = localStorage.getItem("theme");
if (theme) document.documentElement.classList.add(`theme-${theme}`);
```

loaded synchronously in `target/chromium/index.html:12`, kept fresh by an effect in
`Dashboard.tsx:13-16`. Settings live in IndexedDB and cannot be read before paint, so the
last-known theme is mirrored to `localStorage` purely as a paint-time cache. `CHANGELOG.md:21`
records the bug this fixed: "Initial flash of black before settings load if using a light theme."

**Deliberate one-frame delay so the fade actually runs.** `src/views/shared/Backdrop.tsx:15-19`:

```tsx
const [show, setShow] = React.useState(false);
React.useEffect(() => { setShow(ready); }, [ready]);
```

State starts `false` and only flips in an effect (after first paint), guaranteeing the
`opacity 150ms ease-in-out` transition has a from-state.

**Custom CSS injected with `useLayoutEffect`, not `useEffect`** (`src/plugins/widgets/css/Css.tsx:6-18`)
so it lands before paint. `CHANGELOG.md:45`: "Custom CSS now loads before the first render,
savings eyes everywhere."

**Batched writes flushed on `beforeunload`.** `src/lib/db/storage.ts:142-167` coalesces
rapid setting changes into one write and force-flushes if the tab closes mid-timer.

**Next-image prefetch.** `src/plugins/backgrounds/unsplash/Unsplash.tsx:44-53` warms the
next rotation photo into the HTTP cache with a detached `new Image()`.

**Icons legible over anything without a chip.** `src/views/dashboard/Dashboard.sass:5` —
`svg { filter: drop-shadow(0 0 0.5rem rgba(0, 0, 0, 0.25)) }` globally; the hover pill then
sets `filter: none` (`Overlay.sass:24`) because the pill background now provides contrast.

**Click-through widget layer.** `src/views/dashboard/Widgets.sass:4,13` — the fullscreen
widget layer is `pointer-events: none` and only the widget content opts back in with
`pointer-events: all`.

### What it does badly

**There is no token system.** No CSS custom properties (the only `--var` in `src/` is inside
a vendored GitHub-calendar stylesheet), no SCSS variables file, no theme object. `#3498db`
is copy-pasted literally across six files: `src/styles.sass:24`,
`src/views/dashboard/Overlay.sass:23`, `src/views/settings/Settings.sass:6,88`,
`src/views/shared/Logo.css:7`, `src/plugins/backgrounds/colour/types.ts:10`,
`src/plugins/backgrounds/gradient/types.ts:14-15`. Hover states are inline `darken(#3498db, 10%)`.

**No z-index scale — and no z-index at all.** `grep -rn "z-index" src` returns nothing.
Stacking is DOM order plus conditional mounting.

**No `prefers-reduced-motion`.** Including the clock hands, which animate with an overshoot
bezier (`src/plugins/widgets/time/Analogue.sass:18`,
`cubic-bezier(0.175, 0.885, 0.32, 1.275)`) every single second.

**Dead CSS implying an animation that does not exist.** `Settings.sass:25` declares
`transition: transform 0.15s ease-out` on the settings `.plane`, but `src/views/App.tsx:99`
mounts and unmounts Settings outright — so the panel pops in with no animation, forever.

**Two stacking font-size systems on the clock.** Global `h1 { font-size: 4em }`
(`src/styles.sass:32`) plus a per-widget inline `fontSize: '${fontSize}px'`
(`src/views/dashboard/Widget.tsx:16`, slider `min="2" max="100" step="2"`, default 24).
Rendered size is the slider value × 4, which is obvious from neither file.

**No responsive design.** One `@media` in the whole of `src/`, and it is the
`prefers-color-scheme` FOUC fallback. Settings panel is a fixed `width: 330px`.

**Slot positions are hand-tuned asymmetries.** `src/views/dashboard/Slot.sass` — `topLeft`
uses `top: 2rem`, `topCentre` uses `top: 0`, all three bottom slots use `bottom: 3rem`.
No token, no comment explaining why.

**The clock context re-renders every consumer every second unconditionally**
(`src/contexts/time.tsx:27`), even for a widget configured to display neither minutes nor
seconds.

**`float: right` for settings-row buttons** (`src/views/settings/Widget.sass:12-14`), two
lines away from files that use CSS grid.

**Zero readability guarantee.** Per-widget text colour is a raw `<input type="color">`
defaulting to `#ffffff` (`src/views/settings/Widget.tsx:108-117`), with no text-shadow, no
scrim, no contrast check, and no warning. `text-shadow` appears once in the codebase and is
inert (`Search.sass:13`, `text-shadow: inherit` inheriting from nothing).

---

## 3. Mue

`github.com/mue/mue` — React + Vite + SCSS, active. Marketplace, 17 settings sections,
i18n into many languages.

### What it does well

**Fluid root type with `vmin`.** `src/scss/index.scss:19-27` — `#center { font-size: calc(10px + 2vmin); display: grid; place-items: center; }` and every widget is an `em`
multiple: clock `4em`, greeting `1.6em`, quote `0.8em`, AM/PM `0.5em`. Same idea as
Bonjourr, achieved with `vmin` instead of a slider.

**Clock zoom as a multiplier on the em base.** `src/features/time/Clock.jsx:126,131`:

```js
setFontSize(`${4 * Number((localStorage.getItem('zoomClock') || 100) / 100)}em`)
```

**Locale-aware numerals.** `src/utils/formatNumber.js:9-27` runs clock digits through
`Intl.NumberFormat` with a numbering-system extension per language (`ar-u-nu-arab`,
`fa-u-nu-arabext`, Devanagari, Bengali, Tamil), so those users see native digit glyphs
rather than merely translated labels. No other project in this survey does this.

**Font subsetting done properly.** `src/scss/index.scss:89-161` — six `@font-face` blocks
with hand-written `unicode-range` per script (Latin, Latin-ext, Greek, Vietnamese,
Cyrillic), self-hosted from `@fontsource`, `font-display: swap`. Browsers fetch only the
chunk they need.

**BlurHash placeholder + blob caching + double-buffered crossfade.**
`src/features/background/hooks/useBackgroundRenderer.js` — fetches the image as a blob with
`credentials: 'omit'`, decodes a `fast-blurhash` canvas data-URL to show instantly, then
crossfades via a dynamically created `#backgroundOverlay` with `TRANSITION_DURATION = 1200`,
forcing reflow (`void overlay.offsetHeight`) so the opacity transition restarts. Revokes
the object URL and aborts in-flight fetches on unmount.

**Offline fallback shipped in the bundle.** `src/features/background/api/offlineImage.js`
picks at random from `offline_images.json` when `navigator.onLine === false`.

**Lazy request for the expensive thing.** `src/features/background/components/PhotoInformation.jsx:255-268`
only requests the Mapbox location tile once the user hovers the panel — with the comment
"this is to reduce requests to the api".

**Deep-linkable settings.** `src/components/Elements/MainModal/Main.jsx:68-91` handles
`popstate` and hash routing, so a card or notification can link straight to
`#settings/background/source`.

**One-level undo for preset installs.** `src/utils/marketplace/install.js:14-21` snapshots
the entire prior `localStorage` into `backup_settings` before applying a preset;
`uninstall.js:14-21` restores it exactly.

**Hover-revealed toolbar with a generous hit zone.** `src/features/navbar/scss/index.scss:52-73`
— a 500×50px invisible region top-right holds buttons at `opacity: 0; visibility: hidden`
until hovered, `transition: visibility 0.2s linear, opacity 0.2s linear`.

### What it does badly

**Theming is compile-time SCSS maps keyed by a runtime class.** `src/scss/_variables.scss:55-113`
defines `$themes: (light: (...), dark: (...))` accessed through a `t($key)` function inside a
`@mixin themed()` that emits `.light &` / `.dark &` selectors. Adding a third theme means
recompiling SCSS. Nordlys's plain custom properties are strictly better here.

**Exactly one real CSS custom property in the whole app** — `--shadow-shift`.

**No accent colour, no contrast checking.** The only colour pickers are the background
colour/gradient and the three vertical-clock digit colours. `grep -rin "contrast" src` finds
only an image CSS filter. Readability is an opt-in `textBorder` checkbox producing
`filter: drop-shadow(var(--shadow-shift) var(--shadow-shift) 0 #111c)`.

**No tabular numerals.** `grep -rn "tabular\|font-variant" src` — no matches. Lexend Deca is
proportional, so the clock jitters every second by design.

**`$boxShadow` never holds a shadow.** `_variables.scss:7` — every value is
`0 0 0 1px <colour>`. A border named as a shadow.

**252 `!important` declarations** across `src/**/*.scss`, concentrated in
`_toast.scss` (36), `_colourpicker.scss` (32), `_buttons.scss` (25), `_material-ui.scss` (23).
The last of those overrides `.MuiSwitch-switchBase` — and Material-UI is not in
`package.json`. It is dead CSS fighting a library that was removed.

**`* { font-family: ... !important; }`** on line 12 of `index.scss`.

**z-index sprawl:** `-2, -1, 0, 1, 2, 10, 11, 12, 89, 90, 99, 100, 999, 9999`, one with
`!important` (`quicklinks.scss:565`).

**Custom CSS and font are string-interpolated into the DOM unsanitised.**
`src/utils/settings/load.js:78-98` — `document.head.insertAdjacentHTML('beforeend', '<style id="customcss">' + css + '</style>')`,
and marketplace "settings" items bulk-write arbitrary keys to `localStorage` with no schema
validation (`src/utils/marketplace/install.js:16-24`). Anything that can reach
`localStorage.customcss` controls CSS in the extension's own page.

**`prefers-reduced-motion` honoured in exactly one place** (the background crossfade). The
manual escape hatch, `.no-animations`, targets a hardcoded selector list that includes the
dead MUI class.

**Latent first-run crash.** `src/utils/settings/move.js:8-12` — a bare exported function
that calls `return this.setDefaultSettings()`; invoked as `moveSettings()` from
`App.jsx:17` on the empty-localStorage path.

---

## 4. nightTab

`github.com/zombieFox/nightTab` — vanilla JS, one CSS file per component, dormant since
August 2024. The most *systematised* of the four, and the only one with a real generative
theme engine.

### What it does well

**A whole palette from four numbers.** State stores hue and saturation only — lightness is
derived (`src/component/state/index.js:83-112`):

```js
color: { range: { primary: { h: 222, s: 14 } }, contrast: { start: 17, end: 83 }, shades: 14 }
```

and `src/component/theme/index.js:113-146` walks a linear lightness ramp:

```js
let shades = (contrast.end - contrast.start) / (shades - 1);
for (i = 0; i < shades; i++) {
  let hsl = {...color.range[type]};                    // same H and S every shade
  hsl.l = Math.round((shades * i) + contrast.start);   // only L moves
  // pushes --theme-primary-{i+1}-h / -s / -l and -r / -g / -b onto :root
}
```

**The light/dark switch walks the same ramp backwards.** `src/component/theme/index.css:41-73`
— `.is-theme-style-dark` maps `--theme-primary-010…140` to shades `1…14`;
`.is-theme-style-light` maps `010→14, 020→13, …`. One ramp, two readings, zero duplicated
colour definitions. **43 named theme presets** each supply nothing but `{h, s, contrast:{start, end}}`
— `nord` is `h:220, s:16, contrast:{15,50}` (`src/component/themePreset/nord/index.js:3`),
`snow` is `h:217, s:46, contrast:{75,95}`. That is a whole theme in four numbers versus
Nordlys's ~15 hand-picked hexes per theme.

**84 accent presets from a formula.** `src/component/accentPreset/index.js` — 12 hues at 30°
steps × 7 shades on one S/L curve where saturation peaks at the midtone:

```
l:90 s:40 → l:77 s:60 → l:63 s:80 → l:50 s:100 → l:37 s:80 → l:23 s:60 → l:10 s:40
```

**A pure-CSS black-or-white text flip with no JS.** `src/component/theme/index.css:1-11`:

```css
:root {
  /* calculates perceived lightness using the sRGB Luma method */
  --theme-t: 0.55;
  --theme-t-r: 0.2721;
  --theme-t-g: 0.7152;
  --theme-t-b: 0.1255;
}
:root {
  --theme-accent-text: 0, 0%, calc(((((var(--theme-accent-rgb-r) * var(--theme-t-r))
    + (var(--theme-accent-rgb-g) * var(--theme-t-g))
    + (var(--theme-accent-rgb-b) * var(--theme-t-b))) / 255) - var(--theme-t)) * -10000000%);
}
```

The `* -10000000%` is a step function: any luma below `0.55` overflows to a huge positive
percentage the browser clamps to `100%` (white); above it, to `0%` (black). It recomputes
live as a slider moves, with no JS and no re-render. Applied identically to
`--theme-background-color-text` and to all 14 `--theme-primary-text-0N0`.

**Named z-index scale, 1000-increment.** `src/style/zindex/index.css` (full file):

```css
--z-index-background: 1000; --z-index-layout: 2000; --z-index-showcase: 2000;
--z-index-toolbar: 3000;    --z-index-edge: 4000;   --z-index-dropdown: 5000;
--z-index-shade: 6000;      --z-index-menu: 7000;   --z-index-modal: 8000;
--z-index-suggest: 9000;
```

**Motion tokens: a raw scale plus semantic aliases.** `src/component/layout/index.css:14-31`:

```css
--layout-duration-01: 0.1s; /* … through … */ --layout-duration-10: 1s;
--layout-timing-ease: ease-in-out;
--layout-timing-bounce: cubic-bezier(0.8, 0.8, 0.4, 1.4);
--layout-transition-extra-fast: var(--layout-duration-02) var(--layout-timing-ease);
--layout-transition-fast:       var(--layout-duration-04) var(--layout-timing-ease);
--layout-transition-medium:     var(--layout-duration-06) var(--layout-timing-ease);
--layout-transition-slow:       var(--layout-duration-08) var(--layout-timing-ease);
--layout-transition-extra-slow: var(--layout-duration-10) var(--layout-timing-ease);
```

The two-layer structure (raw steps, then role names composed from them) is exactly the
`--nl-motion-*` idea, but they also bake easing into the alias so a call site writes
`transition: opacity var(--layout-transition-fast)` and cannot forget the curve.

**Parametric shadows.** `src/component/theme/index.css:181-222` — one user slider
`--theme-shadow` (default 75, range 0-300) scales a family of four-layer Material-style
elevation shadows built from `--theme-shadow-offset-base: 20`, `--theme-shadow-blur-base: 30`,
`--theme-shadow-opacity-base: 20`.

**Container breakpoints before container queries existed.** `src/component/layout/index.js:30-51`
puts a `ResizeObserver` on the layout element and stamps `is-layout-breakpoint-xs…xxl` on
`<html>` from `{ sm: 550, md: 700, lg: 900, xl: 1100, xxl: 1600 }`. The bookmark grid then
allows 2-column "wide" tiles only once the *container* passes 900px.

**Bookmark grid with dense packing.** `src/component/group/index.css:1-100`:

```css
.is-bookmark-style-block { --group-cell-width: 11em; --group-cell-height: 10em; }
.is-bookmark-style-list  { --group-cell-width: 20em; --group-cell-height:  4em; }
.group-body {
  font-size: calc(calc(var(--bookmark-size) / 10) * 0.1em);
  display: grid;
  grid-auto-rows: var(--group-cell-height);
  gap: calc(var(--layout-space) * var(--layout-gutter));
  grid-template-columns: repeat(auto-fill, minmax(var(--group-cell-width), 1fr));
  grid-auto-flow: dense;
}
```

**Versioned settings migration, done seriously.** `src/component/updateLegacy/index.js`
(1381 lines) holds 79 version-keyed migration functions from `1.0.0` to `6.5.0`;
`src/component/update/index.js` adds `7.0.0`–`7.5.0`. The runner walks every intermediate
version:

```js
update.run = (data) => {
  for (var key in update.mod) {
    if (version.compare(data.version, key) == -1) { data = update.mod[key](data); data.version = key; }
  }
  ...
};
```

and `src/component/data/index.js:243-249` auto-backs-up the pre-migration blob to
`localStorage['nightTabBackup']` first.

**Per-control reset button.** `src/component/control/slider/index.js:119-141` — every slider
renders its own inline "reset" button wired to the default from state. No hunting for a
global reset.

**Import via drag-drop, file picker, *and* clipboard paste**
(`src/component/data/index.js:122-155`, `navigator.clipboard.readText()`), validated by
checking for an app-identifying key, with a `shake` keyframe on invalid JSON and a `pop`
keyframe on success.

**Zero permissions in the manifest.** Bookmarks are a plain array in the same
`localStorage` blob as settings — no `bookmarks` permission requested.

### What it does badly

**The contrast story is a threshold, not a guarantee.** The `contrast` slider only sets the
lightness *range* of the ramp; the luma flip uses non-gamma-corrected coefficients that
match neither Rec.601 nor Rec.709 exactly, on raw 0-255 channels, against an arbitrary
`0.55` cutoff. Two colours straddling that cutoff can still land at a poor real ratio.
There is no WCAG or APCA function in the codebase.

**No `prefers-reduced-motion`** — zero occurrences repo-wide, including the accent-cycle
animation that changes hue every 300 ms by `setInterval`.

**No tabular numerals on the clock.** `src/component/clock/index.css` is 60 lines that set
`font-family: var(--theme-font-display-name)`, `font-size: 1.5em` per digit group, and the
accent colour on `.clock-separator` — and nothing else. Repo-wide grep for
`font-variant-numeric` / `tabular-nums`: zero hits. Fjalla One is proportional, so
`11:11 → 12:22` visibly shifts.

**Option overload with no way to search.** 11 top-level tabs; the `theme` tab alone has 14
sub-sections (`preset, saved, style, color, accent, font, radius, shadow, shade, opacity,
background, layout, header, bookmark`); 692 distinct i18n strings in
`src/locale/en_GB/messages.json`. No search-within-settings anywhere.

**Combinatorial selector explosion.** `src/component/bookmark/index.css` is 1129 lines and
hardcodes ~30 near-identical `is-bookmark-direction-*.is-bookmark-order-*.is-bookmark-alignment-*`
combinations for what is `justify-content` / `align-items` — while the *same file* already
expresses the same idea as custom properties (`--bookmark-display-justify`,
`--bookmark-display-align`) 60 lines earlier.

**Polling instead of observing.** `src/component/edge/index.js:24-33` re-measures the focus
highlight's target with `getBoundingClientRect()` on a perpetual 100 ms `setTimeout` loop.

**Bundle bloat.** The entire Font Awesome set is bundled (7188 JS lines / 252 KB plus 6097
CSS lines) regardless of use; `moment` is a dependency for formatting a clock. Custom Google
Fonts are requested as `':100,100i,200,200i,…,900,900i'` — 18 faces — regardless of the one
weight actually selected.

**Bootstrap 4 normalize verbatim** as the reset (`src/style/reset/index.css`), including its
`#007bff` link colour.

**No changelog, no in-repo docs, no custom-CSS escape hatch.**

---

## 5. Glance (added)

`github.com/glanceapp/glance` — self-hosted dashboard. Go templates, hand-written CSS with
no build step, no framework. Technically the closest thing to Nordlys in this survey, and it
has the best token system found anywhere.

### What it does well

**The entire palette derives from three numbers plus two multipliers.**
`internal/glance/static/css/main.css:9-56`:

```css
:root {
    font-size: 10px;
    --scheme: ;
    --bgh: 240;  --bgs: 8%;  --bgl: 9%;
    --bghs: var(--bgh), var(--bgs);
    --cm: 1;    /* contrast multiplier */
    --tsm: 1;   /* text saturation multiplier */

    --color-background: hsl(var(--bghs), var(--bgl));
    --color-widget-background: hsl(var(--bghs), calc(var(--bgl) + 1%));
    --color-separator:  hsl(var(--bghs), calc(var(--scheme) ((var(--scheme) var(--bgl)) + 4% * var(--cm))));
    --color-popover-background: hsl(var(--bgh), calc(var(--bgs) + 3%), calc(var(--bgl) + 3%));

    --ths: var(--bgh), calc(var(--bgs) * var(--tsm));
    --color-text-highlight:  hsl(var(--ths), calc(var(--scheme) var(--cm) * 85%));
    --color-text-paragraph:  hsl(var(--ths), calc(var(--scheme) var(--cm) * 73%));
    --color-text-base:       hsl(var(--ths), calc(var(--scheme) var(--cm) * 58%));
    --color-text-base-muted: hsl(var(--ths), calc(var(--scheme) var(--cm) * 52%));
    --color-text-subdue:     hsl(var(--ths), calc(var(--scheme) var(--cm) * 35%));
}
```

**`--scheme` is the cleverest single line in this whole survey.** It is an *empty* custom
property in dark mode, and `internal/glance/static/css/site.css:1-3` redefines it for light:

```css
:root[data-scheme=light] { --scheme: 100% -; }
```

Substitute it into `calc(var(--scheme) (var(--scheme) var(--bgl) + 4%))`:

- dark: `calc( ( 9% + 4%) )` → `13%` — 4% *lighter* than the background
- light: `calc(100% - (100% - 9% + 4%))` → `5%` — 4% *darker* than the background

So `+4%` always means "4% further from the background, toward contrast", and **one
expression is correct in both schemes**. There is no `.dark {}` block anywhere. A light
theme is one attribute plus a lightness value.

Users configure it in YAML (`docs/configuration.md:416-470`) as
`background-color: 100 20 10`, `primary-color: 40 90 40`, `contrast-multiplier: 1.1`,
`text-saturation-multiplier: 1`, `light: true` — piped through
`internal/glance/templates/theme-style.gotmpl` (12 lines total) into `:root`.
`contrast-multiplier: 1.3` means "all text 30% lighter/darker depending on scheme" — the
whole accessibility control surface is one number.

**Anti-jitter clock, one line.** `internal/glance/static/css/widget-clock.css`:

```css
.clock-time { min-width: 8ch; }
```

No `tabular-nums` needed — reserving the width in `ch` units stops the reflow at source and
also protects against locale digit-width differences.

**Container queries per widget, not viewport media queries.**
`internal/glance/static/css/widgets.css:52-55`:

```css
.widget-content { container-type: inline-size; container-name: widget; }
```

then `utils.css:206-217` steps a `--cards-per-row` variable down through
`@container widget (max-width: 1300px)` … `(max-width: 450px)`. A widget in a 300px sidebar
column and the same widget full-width behave correctly with no page-level knowledge.

**Decorative generated content hidden from assistive tech.** `utils.css:33-38`:

```css
.list-horizontal-text > *:not(:last-child)::after {
    content: '•' / "";
    color: var(--color-text-subdue);
    margin: 0 0.4rem;
}
```

The `/ ""` is the CSS alt-text syntax — the bullet renders but is announced as nothing.
Same technique on the disclosure chevron (`content: "◀" / ""`, `utils.css:79`) and the
bookmark external-link arrow (`content: '↗' / ""`, `widget-bookmarks.css:9`).

**Popover geometry from four local variables.** `popover.css:5-56`:

```css
.popover-container {
    --triangle-size: 10px;
    --triangle-offset: 50%;
    --triangle-margin: calc(var(--triangle-size) + 3px);
    --entrance-y-offset: 8px;
    --entrance-direction: calc(var(--entrance-y-offset) * -1);
}
.popover-container.position-above { --entrance-direction: var(--entrance-y-offset); padding-top: 0; padding-bottom: var(--triangle-margin); }
.popover-frame { animation: popoverFrameEntrance 0.3s backwards cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes popoverFrameEntrance { from { opacity: 0; transform: translateY(var(--entrance-direction)); } }
```

Flipping above/below re-aims the arrow, the padding, the shadow and the *entrance direction*
by redefining variables — one keyframe serves both directions.

**A measured browser workaround, documented honestly.** `site.css:167-173`:

```css
@keyframes loadingContainerEntrance {
    from {
        /* Using 0.001 instead of 0 fixes a random 1s freeze on Chrome on page load when all */
        /* elements have opacity 0 and are animated in. I don't want to be a web dev anymore. */
        opacity: 0.001;
    }
}
```

**Cached-image transition suppression.** `site.css:88-99`:

```css
img[loading=lazy].loaded:not(.finished-transition) { transition: opacity .4s; }
img[loading=lazy].cached:not(.finished-transition) { transition: none; }
img[loading=lazy]:not(.loaded, .cached)            { opacity: 0; }
```

An image already in cache appears instantly; a freshly fetched one fades. Nothing fades on
a warm reload.

**iOS zoom prevention, deliberate.** `mobile.css:156-159`:

```css
.ios .search-input { /* so that iOS Safari does not zoom the page when the input is focused */ font-size: 16px; }
```

**Layout tokens, small and honest.** `--widget-gap: 23px`, `--widget-content-vertical-padding: 15px`,
`--widget-content-horizontal-padding: 17px`, `--content-bounds-padding: 15px`,
`--border-radius: 5px`, `--mobile-navigation-height: 50px`, plus a six-step type scale
`--font-size-h1: 1.7rem` … `--font-size-h6: 1.1rem` on a `10px` root so `rem` reads as
tenths. `.page-column-small { width: 300px }`.

### What it does badly

**No `prefers-reduced-motion`** — zero occurrences, and the page-content entrance,
popover entrance and mobile column entrance all animate unconditionally.

**The `--scheme` trick is genuinely unreadable.** `calc(var(--scheme) ((var(--scheme) var(--bgl)) + 6% * var(--cm)))`
appears verbatim in six files. It works, and nobody who has not read the light override can
guess what it does. There is no comment anywhere explaining it.

**Self-admitted unmaintainable section.** `utils.css:88`:
`/* TODO: refactor, otherwise I hope I never have to change dynamic columns again */`.

**Monospace body font by default** (`'JetBrains Mono'`, `site.css:120-126`) — a strong
aesthetic commitment that reads as "terminal", not "start page".

**`--cm` is a lightness multiplier, not a contrast ratio.** `contrast-multiplier: 1.3` gives
no guarantee about the resulting ratio; a saturated background hue can still produce a
failing pair.

---

## 6. Dashy (added)

`github.com/Lissy93/dashy` — Vue dashboard, 38 built-in themes. Included specifically for
how it makes many themes cheap.

### What it does well

**Component-scoped semantic tokens that all default back to a four-value base.**
`src/styles/color-palette.scss:1-100`:

```scss
:root {
  --primary: #5cabca;
  --background: #0b1021;
  --background-darker: #05070e;
  --foreground: var(--primary);
  --primary-transparent-60: color-mix(in srgb, var(--primary), transparent 60%);

  /* Color variables for specific components
   * all variables are optional, since they inherit initial values from above
   * Using specific variables makes overriding for custom themes really easy */
  --item-text-color: var(--foreground);
  --nav-link-background-color-hover: #607d8b33;
  --search-container-background: var(--background-darker);
  --widget-background-color: var(--background-darker);
  --context-menu-background: var(--background);
  --footer-text-color: var(--medium-grey);
  /* … ~60 more … */
}
```

A minimal theme overrides four variables; an elaborate one drills into any component
without touching component CSS. `src/styles/themes/_catppuccin.scss` is 40 lines and does
exactly that under `html[data-theme='catppuccin']`.

**A separate dimensions file, kept apart from colour.** `src/styles/dimensions.scss`:

```scss
--curve-factor: 5px;        --curve-factor-navbar: 16px;   --curve-factor-small: 2px;
--dimming-factor: 0.7;      --scroll-bar-width: 8px;       --header-height: 6.3rem;
--item-group-padding: 5px;  --item-shadow: 1px 1px 2px #130f23;
--item-icon-transform: drop-shadow(2px 4px 6px var(--transparent-50)) saturate(0.95);
--item-icon-transform-hover: drop-shadow(4px 8px 3px var(--transparent-50)) saturate(2);
--tooltip-arrow-size: 6px;  --tooltip-width: 250px;
```

Note that `--item-icon-transform` bundles an entire filter chain as a token, so a theme can
restyle icon treatment without editing the icon component.

**Pre-baked alpha ramps** so nothing has to recompute translucency:
`--transparent-70/50/30` and `--transparent-white-70/50/30/10`.

**Reduced motion in five places**, including the settings-panel transition
(`src/components/Settings/SettingsContainer.vue:158-161`) and the tooltip directive
(`src/directives/Tooltip.js:87-89`), plus a JS-side check in `Item.vue:244`.

### What it does badly

Themes are still 38 hand-authored files of hardcoded hexes — the alias layer makes them
*cheap to write* but they are not *derived*, so nothing guarantees any of them is
contrast-safe, and Catppuccin's 40 lines are 40 opportunities to typo a value. Compared
with nightTab's four numbers or Glance's three, this is the middle of the road: better
authoring ergonomics, no correctness guarantee.

---

## 7. What the `.references/ui` corpus adds

Mined for token and component craft that transfers to hand-written CSS.

**Radius as one number times a multiplier — `shadcn-ui`.**
`shadcn-ui/apps/v4/app/globals.css:49-55`:

```css
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
```

from a single `--radius: 0.625rem`. Changing one number reshapes every corner proportionally.

**State colours derived, not stored — `shadcn-ui`.**
`shadcn-ui/apps/v4/registry/styles/style-vega.css:158` computes hover as
`color-mix(in oklch, var(--secondary), var(--foreground) 5%)`, and
`globals.css:336` uses `color-mix(in oklab, var(--border) 30%, transparent)` for chrome. A
hover state expressed relative to the current theme's own tokens is automatically correct
under every theme, including user-authored ones.

**WCAG contrast helpers you can lift wholesale — `formbricks`.**
`formbricks/packages/types/colors.ts` (verified present, 6 KB):

```ts
export const AA_CONTRAST_RATIO = 4.5;                                    // line 105
export const getReadableTextColor = (surface, darkText = "#0f172a",      // line 111
  lightText = "#ffffff", minRatio = AA_CONTRAST_RATIO) => { … }
export const ensureReadable = (preferred, surface,                       // line 127
  minRatio = AA_CONTRAST_RATIO) => {
  for (let weight = 0.1; weight < 1; weight += 0.1) {
    const candidate = mixColor(preferred, pole, weight);
    if (getContrastRatio(candidate, surface) >= minRatio) return candidate;
  }
  return pole;
};
```

`ensureReadable` is the piece Nordlys does not have: nudge a *user's chosen* colour toward
the nearest pole only as far as needed, preserving as much of their hue as possible, instead
of replacing it.

**Reduced motion that collapses rather than removes — `formbricks`.**
`formbricks/apps/web/modules/ui/globals.css:362-374`:

```css
/* Respect prefers-reduced-motion for all CSS animations and transitions … Durations are
   collapsed to a near-zero value instead of `animation: none` so animationend/transitionend
   still fire; Radix primitives rely on them to unmount `animate-out` content. */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after, ::backdrop {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This matters to Nordlys directly: `src/js/ui-kit.js:80` does
`el.addEventListener("transitionend", () => el.remove(), { once: true })` — and
`src/css/main.css`'s reduced-motion block sets `animation: none !important` and
`transform: none !important`. Toasts still get `transition-duration: 80ms` there, so they
do currently clear, but the pattern is one edit away from leaking elements.

**Named, gapped z-index scales — `excalidraw` and `outline`.**
`excalidraw/packages/excalidraw/css/styles.scss:4-27`:
`--zIndex-canvas: 1 … --zIndex-layerUI: 4 … --zIndex-ui-context-menu: 90 … --zIndex-modal: 1000; --zIndex-popup: 1001; --zIndex-toast: 999999;`
`outline/shared/styles/depths.ts:1-19`:
`{ toc: 100, header: 800, sidebar: 900, hoverPreview: 950, overlay: 2000, modal: 3000, menu: 4000, toasts: 5000, popover: 9000, tooltip: 50000 }`
with the honest inline comment `// Note: editor lightbox is z-index 999`.

**Multi-layer penumbra shadows — `excalidraw`.**
`excalidraw/packages/excalidraw/css/theme.scss:60-66`:

```scss
--modal-shadow: 0px 100px 80px rgba(0,0,0,0.07), 0px 41.78px 33.42px rgba(0,0,0,0.0503),
  0px 22.34px 17.87px rgba(0,0,0,0.0417), 0px 12.52px 10.02px rgba(0,0,0,0.035),
  0px 6.65px 5.32px rgba(0,0,0,0.0283), 0px 2.77px 2.21px rgba(0,0,0,0.0197);
```

Six layers with decreasing blur/opacity pairs approximating a soft area light. Also
`--shadow-island` (3 layers) at `theme.scss:33-35`.

**Dark mode by filter, for user-drawn content — `excalidraw`.**
`theme.scss:190` — `--theme-filter: invert(93%) hue-rotate(180deg);`. Not directly
applicable to Nordlys's UI, but worth knowing for an arbitrary-content surface.

**Double focus ring — `penpot`.**
`penpot/frontend/src/app/main/ui/ds/buttons/_buttons.scss:45-52`:

```scss
&:focus-visible {
  outline: var(--button-focus-inner-ring-color) solid 2px;
  outline-offset: -3px;
  --button-border-color: var(--button-focus-outer-ring-color);
}
```

Two concentric rings — an *inset* outline plus a border-colour swap. Far more visible on a
translucent glass tile than a single outside ring.

**Penpot's three-tier architecture** is the cleanest full system in the corpus:
`color-defs.scss` (raw, alpha-baked via Sass `color.change`) → `colors.scss` (semantic,
scoped to `:global(.light)` / `:global(.default)`) → `design-tokens.scss` (component-role
tokens, one per interactive state: `--button-primary-background-color-rest`, `-hover`,
`-active`, `-disabled`). Dependencies flow one way only. It compiles to plain custom
properties, so the *pattern* transfers to Nordlys with no Sass.

**Attribute-substring theming — `plane`.**
`plane/packages/editor/src/styles/variables.css:21,31` uses `[data-theme*="light"]` /
`[data-theme*="dark"]`, so a compound name like `data-theme="dark-high-contrast"` matches
the shared block *and* its own overrides. Directly relevant to Nordlys's 20 named themes,
which currently share nothing.

**Progressive-enhancement glass — `shadcn-ui`.**
`style-luma.css:485` ships a solid `bg-black/30` and only upgrades to blur under
`@supports (backdrop-filter: blur(0))`.

---

## 8. Token systems compared

| | Colour | Space | Radius | Shadow | Motion | z-index | User theme cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Glance** | 3 numbers (`--bgh/--bgs/--bgl`) + `--cm`/`--tsm`; every colour an `hsl()` offset; `--scheme` sign-flip makes one expression work light **and** dark | `--widget-gap: 23px`, two content-padding tokens, `--content-bounds-padding: 15px` | one `--border-radius: 5px`, scaled inline (`calc(var(--border-radius) * 2)`) | one 3px flat offset for widgets; popover uses local `--shadow-properties` + `--shadow-color` | ad hoc `.2s`/`.3s`; one recurring `cubic-bezier(0.25, 1, 0.5, 1)`. No tokens | `z-index: 20` on popover, nothing else notable | **3 numbers** |
| **nightTab** | `{h, s}` + `{contrast.start, end}` → 14-shade ramp; light mode reverses the ramp | none discrete; one `--layout-space: 0.05em` × user gutter/padding numbers | one `--theme-radius`, `calc(… * 0.01em)`, quarter-scaled for inner corners | parametric 4-layer family scaled by one `--theme-shadow` slider | 10-step raw scale + 5 semantic aliases **with easing baked in** | full 1000-increment named scale (10 slots) | **4 numbers** |
| **Bonjourr** | 15 hardcoded hexes per `[data-theme]`, no ramp; accent as `41 144 255` triples consumed via `rgb(var(--accent-color) / 0.15)` | `--page-gap: 1em`; everything else `em` off `--font-size` | one `--border-radius: 25px` + `--link-outer-radius: 0.6em` with ratio multipliers | ad hoc per component | 2 named curves (`--out-cubic`, `--in-out-bounce`), durations inline | 1–4 by hand | ~15 hexes |
| **Dashy** | 4 base vars + ~60 component-role aliases that default back to them | `dimensions.scss` with `--curve-factor*`, `--header-height`, `--tooltip-*` | 3 named curve factors (5/16/2 px) | `--item-shadow`, `--item-hover-shadow` as tokens; also icon filter chains | none | none | **4 vars minimum**, 38 themes ship |
| **Mue** | SCSS `$themes` map, compile-time; 1 real custom property total | none | one `12px`, used consistently | `0 0 0 1px` (a border) | inline per component, ~6 distinct curves | 14 raw literals, one `!important` | recompile required |
| **Tabliss** | none — `#3498db` copy-pasted in 6 files | none | none | 3 declarations total | 150 ms / 250 ms, one bezier | none at all | n/a |
| **Nordlys (today)** | `--nl-*` semantic layer aliasing raw `--void/--ink/--dim/--accent`; 20 themes × ~15 hand-picked hexes in `themes.css`, several with bespoke `.card` shadow overrides | `--nl-space-1…12` defined — **used 0 times** | `--nl-radius-sm…xl` defined, **15 uses across 112 KB**; real radii are literals (`--card-radius: 24px`, `--tile-radius: 20px`, plus `18/14/10/8px`) | `--nl-shadow-1…3` defined, **4 uses**; real shadows are inline multi-layer literals | `--nl-motion-fast/control/panel/enter` + `--nl-ease-emphasized/pop` — **232 + 47 uses**. Genuinely adopted | 20 distinct literals from 0 to 500, unnamed | ~15 hexes, hand-tuned |

### Which approach to adopt

**Glance's, with nightTab's naming and Nordlys's contrast solver bolted on.**

Glance wins on power-to-weight: a theme is `background-color: 220 23 95`,
`primary-color: 220 91 54`, `contrast-multiplier: 1.1`, `light: true`, and *nothing else can
be inconsistent* because nothing else is authored. The `--scheme` sign-flip is what makes it
work — without it you need a light block and a dark block and they drift.

But Glance's expression is illegible and its "contrast multiplier" guarantees nothing.
nightTab shows the fix for readability (raw step scale + semantic aliases that compose the
raw ones, so call sites read as intent). Nordlys already has the fix for correctness — the
33-step ramp search in `settings.js` — which is stronger than anything either project ships.

Concretely for Nordlys: keep `--nl-*` as the only namespace, express each theme as
`{h, s, l, accent-h, accent-s, accent-l, cm}` plus an optional handful of overrides, derive
surfaces with the `--scheme` technique, and keep the WCAG ramp solver as the authority for
text and border colours. That collapses `themes.css` from 53 KB to a table, and it makes
every user-authored theme as safe as the built-ins.

---

## 9. Start-page layout patterns

### Measurements

| | Container | Vertical rhythm | Clock | Search | Tile / grid | Settings entry |
| --- | --- | --- | --- | --- | --- | --- |
| **Bonjourr** | `#interface`: `display: grid`, `max-width: 1600px`, `padding: 4em 1em 6em 1em`, `gap: var(--page-gap) = 1em`, `min-height: 100dvh`; every widget `place-self: center` | grid rows from `grid-template-areas: var(--grid)` | `calc(--clock-size × 6)`, weight 200, `line-height: 1em`, `margin-bottom: 0.1em`; `#time-container { gap: 4em }`; analog `8 × --clock-size` square | `max-width: var(--searchbar-width, 30em)`, `min-width: 15em`, `height: 2.5em`, `radius 10px`, `blur(2em)`; suggestions at `top: 2.5em`, `radius 1em`, `padding 0.6em` | 5 modes. `large`: icon `4.8em`, block `6.8em`, col-gap `0.3em`, row-gap `1.3em`, folder pad `2em`. `medium`: `3.5 / 5.1 / 0.2 / 1`. `small`: block `2.5em`, gaps `1.5em`. `inline`: `2em / 1em`. `text`: col-gap `1.8em` | fixed bottom-right, `padding-right: 20px; padding-bottom: 20px`, button `4em × 4em`, `radius 13px`; icon rotates 20° on hover, 60° when open |
| **Tabliss** | `.fullscreen` absolute inset:0, no max-width, no breakpoints | none — 9 absolute slots | `<h1>` at `4em` × per-widget `Npx` (compounding) | plugin, no fixed geometry | none — widgets stack with `margin: 1rem` | always-visible gear in the Overlay; `S` opens, `Esc` closes |
| **Mue** | `#center` absolute inset:0, `display: grid; place-items: center`, `font-size: calc(10px + 2vmin)` | `#widgets` flex column, `gap: 20px`, `animation: fadeIn 1s` | `4em × zoom%`, inline style | first widget, pinned | quicklinks flex-wrap, `gap: 12px`, `padding: 0 25px` | hover zone `500 × 50px` top-right |
| **nightTab** | `.layout` flex; direction + order both user settings (4 arrangements); header/bookmark widths independent % sliders | `gap: calc(--layout-space × --layout-gutter)` = `0.05em × 20` = `1em` default | `1em` container, `1.5em` per digit group, × `calc(--header-clock-size × 0.01em)` | in header, alignment-driven | `repeat(auto-fill, minmax(11em, 1fr))`, rows `10em`, `grid-auto-flow: dense`; list mode `20em × 4em` | full-panel overlay; `Ctrl+Alt+M` |
| **Glance** | `.page-columns` flex, `gap: var(--widget-gap) = 23px`; `.page-column-small { width: 300px }` | `.widget + .widget { margin-top: 23px }`, content padding `15px 17px` | `min-width: 8ch` | `height: 6rem` input, border-colour transitions on hover then focus-within | bookmark icon `20px`, container `padding: 0.5rem`, `opacity: 0.7` | n/a (config file) |
| **Nordlys** | `#page` flex column centred, `gap: 28px`, `padding: 36px 20px 48px`, `min-height: 100vh`; `#board` flex-wrap, `gap: 16px`, `width: min(96vw, 1480px)` | `#hero { gap: 6px }`; `#searchwrap { margin-top: 18px }` | `clamp(62px, 12vh, 120px)`, weight 200, `line-height: 0.95`, `tabular-nums`, gradient-clipped text, `drop-shadow(0 10px 30px var(--accent-glow))` | `width: min(88vw, 640px)`, `height: 54px`, `radius 18px`, `blur(var(--glass-blur))` | `--tw: 78px` (70 at `max-height: 940px`, 62 at `820px`), `--grid-gap: 12px 10px`, `--tile-radius: 20px`, cards `radius 24px`, `padding: 16px 20px 18px`; `.grid[data-cols="N"] { repeat(N, var(--tw)) }` for N=2…8, `data-cols="1"` becomes a `minmax(180px, 1fr)` list | fixed `right: 18px; bottom: 16px`, `44 × 44`, `radius 14px`, `opacity: 0.55` → 1 on hover |

### Structural comparison

Four distinct answers to "where does stuff go":

1. **Named CSS grid areas, serialized (Bonjourr).** Layout is a string of grid-area names.
   Three presets (1/2/3 columns), `'.'` for empty. Drag-to-move edits the array and
   re-stringifies. Cheapest possible implementation of a genuinely flexible layout.
2. **Nine absolute slots (Tabliss).** `topLeft` … `bottomRight`, each a fixed
   `top/left/transform` triple; multiple widgets in a slot stack with `margin: 1rem`.
   Simple, but the slot offsets are undocumented magic and there is no way to express
   "half-width" or "spanning".
3. **A single reorderable flex column (Mue, Nordlys).** Order is an array in storage; render
   is `order.map(...)`. Easy to build, easy to reason about, no 2-D expression at all.
4. **Two areas with independent widths and a swappable order (nightTab).** Header and
   bookmark regions, `flex-direction` and `order` both user-set — four arrangements from two
   booleans, plus a percentage width slider each with a mutual-compensation formula.

### Hidden until hover

- **Bonjourr:** group "add" button (`visibility: hidden` until `#link-mini:hover`); tile
  titles in `small` mode (`opacity: 0; visibility: hidden` → visible on `:hover`, positioned
  `top: 3em` with its own blurred chip); the settings gear itself when "hide settings icon"
  is on (`opacity: 0` → `0.5` when settings open → `1` on hover).
- **Mue:** the whole navbar, behind a 500×50 invisible hit zone; quicklink drag handles.
- **nightTab:** bookmark edit tray and URL strip, both parked off-canvas at
  `top: calc(-1 * var(--bookmark-edit-height))` and slid in with a bounce curve and a 0.1 s
  delay.
- **Tabliss:** only the two least-used overlay icons.
- **Nordlys:** the gear sits at `opacity: 0.55` permanently rather than hiding.

### Settings presentation

| | Form | Sections | Disclosure |
| --- | --- | --- | --- |
| Bonjourr | right drawer, `width: 450px`, `min-width: 333px`, `translateX(-100%)` over `0.33s`; mobile becomes a bottom sheet at `translateY(-75dvh)` | **15**, one long scroll | one global "show all settings" toggle reveals 22 `.as` blocks; per-dropdown `max-height`; inline `?` tooltips expanding to `max-height: 60px` |
| nightTab | full-panel overlay; 3-column grid `4fr 10fr auto` above 700px, `max-width: 60em` | **11** tabs, `theme` alone has 14 sub-sections | reusable `Collapse` (radio/checkbox/toggle modes) using a `margin-bottom: -200vh` trick; per-slider reset button |
| Mue | modal, `height: 80vh`, `width: clamp(60vw, 1400px, 90vw)`, sidebar `min-width: 250px`, `backdrop-filter: blur(16px) saturate(180%)` | **3** tabs → **17** sidebar groups | drill-down sub-sections; a separate "Experimental" tab with a warning subtitle; hash deep links |
| Tabliss | left panel, fixed `330px`, mounted/unmounted | **7** blocks, one scroll | one `ToggleSection` component whose label reads "Open X" / "Close X" |
| Nordlys | right drawer, `width: min(94vw, 520px)`, `min-width: 380px`, **user-resizable** via a drag handle with width presets | **6** tabs (`appearance, general, background, bookmarks, custom-css, backup`) | 4 `<details>` elements; 29 `.row`s; 13 ranges, 13 selects, 8 colour wells, 3 checkboxes |

Nordlys has by far the most restrained settings surface — 6 tabs against Bonjourr's 15
sections and nightTab's 692 i18n strings — and it is the only one with a resizable panel.

---

## 10. Ten things Nordlys should steal

**1. Glance's `--scheme` sign-flip, so one expression serves light and dark.**
Source: `glance/internal/glance/static/css/main.css:12` + `site.css:1-3`.
Why: `themes.css` is 53 KB because 10 light themes and 10 dark themes each restate every
surface. With `--scheme: ;` on dark and `--scheme: 100% -;` on `[data-theme-mode="light"]`,
a single `--nl-surface-elevated: hsl(var(--nl-hs), calc(var(--scheme) (var(--scheme) var(--nl-l) + 4%)))`
is correct in both directions, and the 10 light themes stop existing as separate code. Add
the comment Glance forgot.

**2. Bonjourr's `body.potato` GPU check, gating `backdrop-filter`.**
Source: `bonjourr/src/scripts/startup/potato.ts` + `_global.css:180-215`.
Why: Nordlys has **38 `backdrop-filter` declarations** across `components.css` and
`settings.css` and exactly one `@supports` block in the whole codebase (and that one is for
`color-mix`). On software-rendered Chrome — which is what SwiftShader detection finds — a
28px blur on eight glass cards plus a running canvas is the difference between a start page
and a stutter. Cache the verdict for four hours as Bonjourr does. Pair it with shadcn's
`@supports (backdrop-filter: blur(0))` guard so the solid fallback is the default, not the
exception.

**3. Bonjourr's adaptive fade-in with a readiness barrier.**
Source: `bonjourr/src/scripts/shared/display.ts:44-54`.
Why: `#hero`, `#searchwrap` and `.card` each animate in on a fixed
`var(--nl-motion-enter) = 320ms`, regardless of whether the page was ready in 8 ms or 300 ms.
The rule `loadtime > 33 ? loadtime : 0` means a fast load gets *no* animation at all, which
is the correct behaviour and one nobody notices until they see it. The barrier half — reveal
only when every enabled widget reports ready — is what removes layout shift.

**4. Glance's `min-width: 8ch` on the clock.**
Source: `glance/internal/glance/static/css/widget-clock.css`.
Why: `#clock` has `font-variant-numeric: tabular-nums`, which fixes digit *width* — but
`body.seconds .sc, body.seconds #ss { display: inline }` and the `.ampm` chip
(`margin-left: 10px`, `padding: 3px 9px`) still change the clock's total width when toggled,
and Outfit's tabular figures do not help with that. Reserving the width in `ch` fixes the
*container*, which is the thing that actually reflows the hero. Bonjourr shipped a bug for
this (#815); nightTab and Mue still have it.

**5. Bonjourr's nested-radius formula and ratio-derived size bands.**
Source: `bonjourr/src/styles/features/links.css:585-660`.
Why: Nordlys sets `--tile-radius: 20px` and `--card-radius: 24px` as unrelated literals, and
`.grid[data-cols="1"] .tile` reaches for `calc(var(--tile-radius) * 0.75)` by hand.
`inner = outer − padding` keeps concentric corners optically correct, and a single ratio per
size band (`1.0 / 0.77 / 0.57 / 0.43`) means adding a "small tiles" mode is three lines, not
a new block. Combine with shadcn's `--radius × N` so one number drives the whole set.

**6. `formbricks`'s `ensureReadable()` — nudge the user's colour, do not replace it.**
Source: `formbricks/packages/types/colors.ts:127-140`.
Why: Nordlys's `pickInk()` in `settings.js:759-777` searches a 33-step *greyscale* ramp, so
a user who wants warm off-white text gets neutral grey. `ensureReadable` walks the preferred
colour toward the nearest pole in 10% steps and stops at the first candidate that clears the
ratio, keeping as much hue as the maths allows. Nordlys's guarantee is stronger; formbricks's
behaviour is kinder. Use `ensureReadable` for accent-derived colours and keep the ramp search
as the fallback when nothing qualifies.

**7. nightTab's motion aliases with easing baked in.**
Source: `nighttab/src/component/layout/index.css:14-31`.
Why: Nordlys already has `--nl-motion-*` and `--nl-ease-*` and uses them 279 times — the
adoption is genuinely good. But the two are separate, so 119 call sites in `components.css`
each re-pair a duration with a curve by hand, and several pair a duration with bare `ease`
(`transition: background-color var(--nl-motion-panel) ease` in `main.css`). Composing
`--nl-transition-control: var(--nl-motion-control) var(--nl-ease-emphasized)` removes the
opportunity to forget.

**8. Glance's per-widget container queries.**
Source: `glance/internal/glance/static/css/widgets.css:52-55` and `utils.css:120-217`.
Why: `.grid[data-cols="N"]` hardcodes columns 2 through 8 as explicit rules, and the only
adaptation is `@media (max-width: 860px)` flipping everything to `auto-fill`. A card that is
narrow because the user dragged it narrow behaves identically to one that is narrow because
the window is. `container-type: inline-size` on `.card` lets the tile grid respond to its own
card, which is what Nordlys's resizable cards actually need. nightTab reached the same
conclusion in 2021 and had to build it with a `ResizeObserver`; the CSS feature now exists.

**9. Glance's CSS alt-text on decorative generated content, and `penpot`'s double focus ring.**
Sources: `glance/.../utils.css:33-38` (`content: '•' / "";`),
`penpot/frontend/src/app/main/ui/ds/buttons/_buttons.scss:45-52`.
Why: Nordlys generates decorative marks — `.cat s` is a 4px accent dot, `.box::after` is a
sheen sweep — that screen readers may announce. The `/ ""` syntax is free. And the current
focus treatment (`outline: 2px solid var(--nl-focus); outline-offset: 2px; box-shadow: 0 0 0 4px var(--nl-focus-outer)`
in `foundations.css:37-41`) puts both rings *outside* the element; on a translucent tile
against a bright wallpaper, an inset ring plus an outer one reads far better, and Penpot's
`outline-offset: -3px` is the technique.

**10. nightTab's versioned migration chain and per-control reset.**
Sources: `nighttab/src/component/update/index.js:630-649`,
`nighttab/src/component/control/slider/index.js:119-141`.
Why: Nordlys already migrates one thing well — `NordlysType.migrate()` in `typography.js`
moves a legacy font off `customTheme` and deletes the key. That is the right instinct with no
framework around it. nightTab's runner walks *every* intermediate version in order and
auto-backs-up before doing so, which is what lets them ship 79 migrations without fear. And
with 13 sliders and 8 colour wells in the drawer, a per-control reset button is worth more
than a global one.

---

## 11. Five things Nordlys already does better

**1. Real WCAG enforcement, not a threshold hack — and it solves a harder problem than
anyone else attempts.** `src/js/settings.js:743-790` builds a 33-step greyscale ramp,
computes the *worst* contrast against **both** the page background and the card surface, and
picks the qualifying end that matches the theme's polarity, with subdued text taking the
qualifying colour closest to the bar:

```js
const RAMP = Array.from({ length: 33 }, (unused, step) => { … });
const worstAgainst = (colour, surfaces) => Math.min(...surfaces.map((s) => ratio(colour, s)));
```

The comment explains why walking toward white or black cannot work — "when the two surfaces
straddle the middle … the best answer is neither extreme but a mid tone, and against pure
black and pure white even the optimum only reaches 4.58:1". A live warning
(`custom-theme-contrast-warning`) fires when nothing clears 4.5:1, rather than shipping a
quiet failure. Borders are held to 3:1 because a border is not text.

Against this: Bonjourr has a `value.includes('#fff')` string check. Tabliss and Mue have
nothing at all. nightTab has a luma step function on non-linearised channels with an
arbitrary 0.55 cutoff. Glance has a lightness multiplier that guarantees nothing. **Nordlys
is the only project in this survey that can promise a ratio.**

**2. Reduced motion is honoured, and it is the only one that is.** `src/css/main.css`
carries a global block killing animation, transform, filter and both backdrop-filter prefixes,
and `foundations.css:76-78` additionally shortens the motion *tokens*
(`--nl-motion-control: 80ms`, `--nl-motion-panel: 100ms`, `--nl-motion-enter: 100ms`) so the
reduced state is still coherent rather than dead. `background.js:205` refuses to start the
canvas loop at all when `motionQuery.matches`.

Measured across the six clones: **Bonjourr 0 files, Tabliss 0, nightTab 0, Glance 0**, Mue 1
(background crossfade only), Dashy 5. Nordlys is alone here, and it is not close.

**3. Icon contrast that measures rendered pixels and moves the plate, not the icon.**
`src/js/icon-presentation.js` samples the actual favicon through a
`willReadFrequently` canvas, weights luminance by alpha, and compares it against the plate's
measured luminance. When they fail to separate it re-tones the *plate* to the opposite end
of the theme palette — never absolute white or black — and it declines to act on a colourful
logo because "re-toning a coloured logo would destroy it". The threshold is argued rather
than assumed:

```js
/* Deliberately below the 3:1 WCAG asks of a lone graphical control. A tile is
   never the only carrier of its meaning … (Spotify green reads 2.6:1 on white,
   Steam blue 1.9:1) … This threshold catches the failure that actually hurts:
   an icon that vanishes into its plate. */
const MIN_ICON_CONTRAST = 1.8;
```

and `refreshIconContrast()` re-decides every tile on theme change, with an explicit
`requestAnimationFrame` wait because a theme swap runs through a view transition. Bonjourr's
answer to the same problem is `.backgrounds .link .link-icon { background-color: white }` —
paint every icon onto a white chip. Tabliss's is a global drop-shadow.

**4. Canvas discipline.** `src/js/background.js` clamps `devicePixelRatio` to 1.5 (line 129),
pauses on `visibilitychange` (108-110), refuses to run when hidden or when reduced motion is
set (205), and normalises `dt` to 60fps units "so speed is identical on 60/120/144Hz panels"
(210). Mue's background renderer forces three reflows and runs a 1200 ms crossfade with no
DPR ceiling. nightTab polls `getBoundingClientRect()` on a 100 ms `setTimeout` forever.

**5. A stated hit-target contract, enforced in CSS.** `--nl-target-min: 40px` is used at 10
call sites in `components.css` — the engine selector, tray buttons, the card resize handle,
context-menu items, themed selects — under a comment describing it as "the 40px contract,
applied where an audit of every state found it broken. Visuals are unchanged; only the
reachable area grows." Bonjourr's settings controls are `height: 31px`, lifted only to 36px
on touch. Nobody else names the number at all.

### Where Nordlys is honestly behind

Stated plainly, because the list above is not the whole picture:

- **`--nl-space-1` … `--nl-space-12` are defined and used exactly zero times.** Every gap and
  padding in `components.css` and `settings.css` is a literal. `--nl-radius-*` fares little
  better at 15 uses across 112 KB; `--nl-shadow-*` has 4. Only the motion tokens are real.
- **13 distinct literal font sizes** in `components.css` on half-pixel steps (9.5, 10, 10.5,
  11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16) with no scale and no root multiplier.
  Bonjourr and Mue both scale their entire page from one number; Nordlys cannot.
- **Two token namespaces coexist**: `--nl-*` semantic and raw `--void/--ink/--dim/--accent/--glass`.
  `foundations.css` aliases one to the other, `themes.css` writes only the raw set, and
  `app.js` writes both plus four "legacy aliases so older user Custom CSS keeps working". The
  migration is half done and the seam is load-bearing.
- **20 z-index literals from 0 to 500**, unnamed, spread across three files.
- **`themes.css` at 53 KB** is ~300 hand-picked hex values plus per-theme `.card` shadow
  overrides — the exact thing Glance and nightTab prove is unnecessary.
- **No `@layer` anywhere**, and `components.css` + `settings.css` together are 112 KB of flat
  cascade.

None of that is visible to a user today. All of it is what makes the twenty-first theme
expensive.
