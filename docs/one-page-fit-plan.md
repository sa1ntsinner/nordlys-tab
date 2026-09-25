# One page fit (2026-09-24)

An opt-in switch in **Settings → Bookmarks**. When it is on, ordinary new-tab
viewing puts the hero (clock, date, greeting), the search field, every
visible folder and tile, and the hidden-folder dock inside one visual
viewport. The document gets no vertical or horizontal scrollbar at any
window size, Windows display scale, browser zoom or board density. It is off
by default. When it is off, the page is laid out exactly as before.

It is a different feature from **Fitted**. Fitted is a board layout: it
decides how folders share a row, stretching each row edge to edge. One page
fit decides how much of the window the whole page may take up. The two can
be combined. The switch sits in the same block as Natural/Fitted, and its
note describes the difference. The same switch is also on the new tab
itself, at the top right (see *The switch on the page*), because nobody
looking for it found it three levels down in Settings.

## Files

| File | Role |
| --- | --- |
| `src/js/page-fit.js` | `window.NordlysPageFit`: pure helpers (`measuresAt`, `solveFit`, `zoomModel`, `boardHeight`, `largestZoom`, `fingerprint`, `validHint`) and the `PageFit` controller |
| `src/css/page-fit.css` | Every rule waits for `html[data-page-fit="on"]`. Loaded last |
| `newtab.html` | `#fit-surface` wraps `#hero`, `#searchwrap`, `#arrange-bar`, `#board`, `#hiddenDock` inside `#page`. It also holds the switch, its note and a state line that is part of the switch's description, plus a CSS-guide entry |
| `src/js/boot.js` | First frame: sets `data-page-fit="on"` only when the stored config has `onePageFit === true` |
| `src/js/app.js` | `DEFAULT_CONFIG.onePageFit = false`. It creates `PageFit` before the first render and asks for a fit after geometry tokens, header style and Custom CSS change. `nordlys_fit_hint` is in `OWNED_LOCAL_KEYS`, so Reset clears it |
| `src/js/config-schema.js` | `onePageFit: "boolean"` for import validation and repair (a wrong type goes back to `false`) |
| `src/js/grid.js` | `render()` lets a new tab wear its remembered answer before building the board (`prepare()`) and fits synchronously, `relayout()` asks for a fit, `flowRows()` measures in unzoomed lengths, `flyHome()` handles a zoomed lift |
| `src/js/board-arrange.js` | Arrange suspends the fit. Drag lift, ghosts, FLIP offsets and reserved heights are converted by `currentCSSZoom`. The end of a drag re-requests a fit |
| `src/js/settings.js`, `src/css/settings.css` | `setPageFit()`, which both switches call (it saves, fits now and announces the state line once when the fit is turned on), `syncPageFit()` (both switches and the state line) and styles |
| `src/css/components.css`, `src/css/polish.css`, `src/css/themes.css` | The switch on the page (`.fit-toggle`), where it sits at each width, the room above the clock for it below 760 px, and its light-theme colours |
| `src/js/widgets.js` | Under the fit, keyboard selection scrolls within the capped suggestion list |
| `src/js/i18n.js` | Seven keys (`bookmarks.onePageFit*`) in all eight locales; `bookmarks.onePageFitHint` describes the switch on the page while the fit is off |
| `PRIVACY.md` | Lists the fit hint among what is stored locally |
| `tests/unit/page-fit.test.cjs`, `tests/ui/one-page-fit.spec.cjs`, `tests/ui/one-page-fit-scrollbars.spec.cjs`, `tests/ui/fit-toggle.spec.cjs` | Tests |

## Config, persistence, first frame

- `onePageFit` is a boolean with a default of `false`. It is saved with the
  config in localStorage and the chrome.storage mirror, and it travels in
  backups. Backup import validates the type, and a stored wrong type is
  repaired to `false`. It is not part of a shared *look*: whether a board
  fits depends on the viewer's own window.
- The switch is the only thing saved in the config. Values the fit works
  out, such as the tile size, gaps and zoom, are written as inline custom
  properties on `#page` and never go into the config. `tileSize`, `cardGap`
  and `boardGap` keep the values the user chose (the spec asserts this).
- **Fit hint.** So that a new tab does not search again, the answer a
  search settles on is kept in `localStorage["nordlys_fit_hint"]`, outside
  the config: at most four entries, newest first, each holding only the
  custom properties the page wore, the wide flag, the stage, `t`, zoom and
  the height it measured (about 0.5 KB each). An entry is keyed by an
  FNV-1a fingerprint of the window (`clientWidth`, `clientHeight`),
  `devicePixelRatio`, page language, extension version, whether each
  bundled face has loaded, and the config (long strings such as icons or
  Custom CSS enter by length and ends). Lookup tries the exact key, then
  the same key with every face loaded. A new tab's hint is written at once;
  any other search's is written 600 ms after the window stops changing, so
  a dragged window does not fill the four slots with sizes it only passed
  through. Entries are validated before use (only `--*` properties with
  short string values), a Reset clears the key (`OWNED_LOCAL_KEYS`), and it
  is never in a backup or recovery point. PRIVACY.md lists it.
- `boot.js` runs before any stylesheet and sets `html[data-page-fit="on"]`.
  From the first frame, `#fit-surface` is therefore already the flex column
  the fit measures. The first fit runs synchronously inside the first
  `grid.render()`, during `DOMContentLoaded` and before first paint, so the
  first painted frame is already fitted. If a hint matches,
  `PageFit.prepare()` writes it at the start of that render, before the
  board is built, so the board's very first layout is the fitted one and the
  pass after the render only measures it (one trial). A hint that no longer
  fits is dropped in the same synchronous pass, which then searches as
  before. Either way the first painted frame is fitted (the spec records
  the first frames of each reopened tab).
- When a config is adopted from another tab or from chrome.storage,
  `applyLoadedConfig → grid.render()` refits. `render()` reads `onePageFit`
  on every pass, so a switch changed in another tab is followed immediately
  (covered by the spec).

## Surface

With the switch off, `#fit-surface` is `display: contents`, which generates
no box. `#page`'s flex layout, gaps and alignment reach the same children
exactly as before. The spec compares boxes and screenshots with the wrapper
present and with it removed from the DOM, and requires them to be identical.

With the switch on, the surface becomes a flex column that inherits
`#page`'s direction, `align-items`, `justify-content` and `gap`, so it
places the content exactly where `#page` did. It is the only element that
is zoomed. Everything that is fixed or portalled is a sibling outside
`#page` and is never scaled: `#gear`, `#cfg` (the settings drawer), dialogs,
context menus, the toast dock, the select popovers, the drag lift and the
drop marker. The spec checks each one's `currentCSSZoom` value. The arrange
bar is the one fixed element inside the surface, and the fit stands down
while arranging. The switch on the page (`#fit-toggle`) is outside `#page`
too, and is never scaled.

## The switch on the page

`#fit-toggle` is a `<button role="switch">` named by its visible text,
`bookmarks.onePageFit` (the drawer switch's own name, so the two read the
same in every language), with a small switch drawn beside the name:
hollow with the knob left when off, filled with the accent and the knob
right when on. Its description (`#fit-toggle-state`, also its tooltip) is
the drawer's state line while the fit is on ("Shown at 72% to fit this
window.") and `bookmarks.onePageFitHint` while it is off. Both switches
call `SettingsController.setPageFit()` and are drawn by `syncPageFit()`,
which runs after either is pressed, after every pass (`nordlys:pagefit`),
after a config is adopted from another tab or chrome.storage
(`applyLoadedConfig → syncFormValues`) and after a language change. There
is one saved value, `onePageFit`, and nothing else is saved.

**A star until it is wanted (2026-09-25).** Most people turn the fit on once
and never touch it again, so on the page the switch rests as a star: the
Nordlys mark (`.fit-toggle-star`), at 55 % in the secondary text colour, lit
in the accent at 90 % while the fit is on. A pointer on it, or Tab, unfolds
the glass leftward out of the star (`clip-path`, from the star's 40 px
corner to the whole switch) while the star turns and shrinks into the knob;
it folds again a moment after it is left. Until then the rest of the switch
is clipped away, so only the star's corner answers the pointer, and a star
at rest has no glass and blurs nothing. It glints once, 1.2 s after the page
opens (`.glint`, a single animation, skipped for reduced motion): a
permanent twinkle would keep the page painting at the display's rate. The
glint is only for a star nobody has found yet (`glintStar()`): with a
pointer or Tab already on it there is none, and one arriving mid-glint puts
it out, since a glint over the open switch drew the star on top of its knob
(on a busy machine the spec's pointer landed in the glint, which is how it
was found). On a
touch screen the first tap only opens it (`.is-open`, for five seconds or
until a tap elsewhere) and the second works it. With forced colours the
switch is always unfolded. Its box never changes, so everything below about
where it sits and how the fit keeps clear of it holds either way.

**Where it sits.** At the top right, in the band above the clock
(`top: 16px; right: 20px`). Beside the gear at the bottom right was the
first idea, and it does not survive a real board: at 1440 × 900 the nine
folders run under that corner, and a 150–200 px switch there lies over the
last row of bookmarks on the ordinary page at every width tested (the spec
fails that way if the switch is moved there). The band above the clock is
empty at every width. The switch is `position: absolute`, not `fixed`, so
on the ordinary page it scrolls away with that band instead of floating
over the bookmarks; a fitted page does not scroll, so there it is always in
view. Below 481 px the gear moves to the top right (`top: 12px; right:
12px`, 14 px below 421 px) and the switch sits beside it, centred on it.
Below 760 px the clock is wide enough to reach under the switch, so
`#page` has 64 px above the clock there instead of 48 (off, that is the
only change to the ordinary page's layout). While the board is being
arranged the switch is hidden: the fit is paused and the arrange bar has
the bottom of the window. It is under the drawer, dialogs, menus and toasts
(`--nl-z-chrome`), and toasts, at the bottom, never meet it.

**How the fit keeps clear of it.** `PageFit.chrome()` lists the gear and
the switch. `gearRoom()` returns, over both, the room a board passing under
one needs below it (`bottom`) or above it (`top`), and `head`: the room
above the clock when a piece of chrome at the top is across from the clock,
date or greeting. The first search holds the top padding at
`min(padding-top, head)` at every step, as it holds the bottom at
`min(padding-bottom, bottom)`; `compactAt()` applies both. After a search,
`underChrome()` says whether a folder, the dock or the clock lies within
8 px of chrome at the top and at the bottom; each side found is taken up
once (at most two more searches, each handed the last one's floor). A
handed-on floor is corrected for the extra top padding as well as the
bottom, so the zoom's prediction counts it exactly (the old `lift` is gone:
the floor's own pads already include it). On a desktop the clock is never
across from the switch, so `head` is 0 and a board that stays below it pays
nothing; on a phone the clock stays under the switch and the gear.

## Algorithm

Each pass is `PageFit.fit()` followed by `solve()` (and `search()` for the
compaction and zoom stages). Every trial layout is synchronous and is
wrapped in `#page.fit-measuring`, which sets `transition: none` so
measurements never read a value partway through a transition. The class is
removed before the frame paints, so nothing animates into its fitted size.

A pass that is about to measure trial layouts also sets
`html[data-fit-measuring]`, which gives `body` `overflow-y: hidden` (body's
overflow is what reaches the viewport, main.css). Chrome on Windows draws
classic scrollbars that take about 15 px, so without it the natural page and
the floor trial would be measured in a window narrowed by a scrollbar, and
each scrollbar coming or going would cost a layout of its own. The
attribute is removed in `fit()`'s `finally`, before paint, so a page that
ends up taller than the window (past the 1 % floor) still scrolls. Warm
exits never set it.

`need()` is `#page` padding-top plus padding-bottom plus the surface's
drawn height (`getBoundingClientRect`, which includes zoom). The room is
`documentElement.clientHeight`, minus 1 px of slack for sub-pixel rounding.

0. **Warm exit.** The page is still wearing the last answer. The pass stops
   with no trial layout when the window is the same size and either the
   height is exactly the height the last pass settled on, or it still fits
   within the tolerance (the larger of 8 px and 2 % of the height). Most
   passes (after a render, a font load or a no-op resize) end here.
   **Hint.** A pass that would otherwise search first tries the remembered
   answer for its key (a new tab does this before its board is built, see
   above). It is kept when it fits and either measures within half the
   tolerance of the height it was remembered with, or fits within the
   tolerance. One trial either way.
1. **Natural.** Everything borrowed is cleared (a no-op on first load). If
   the page fits and no folder lies under the gear, the pass stops.
2. **Compact.** `readBase()` reads this window's own computed values: page
   padding and gap, clock size, date and search margins, folder padding and
   gap, tile gap, board gap, plus `tileSize` and `cardGap` from the config.
   One number `t` walks every measure from its own value (0) to its floor
   (1). Spacing closes over the first half and tiles shrink over the second.
   Floors: page padding 12, page gap 10, clock 48, date margin 2, search
   margin 0, folder padding 8/10, folder gap 6, tile gap 4, grid gap 6,
   board gap 8, tile 56 px. The tile floor is the grid's own minimum. The
   pass lays out `t = 1`. If that fits, false position between `t = 0` and
   `t = 1` finds the smallest `t` that fits within the tolerance, using at
   most 4 more layouts.
3. **Scale.** If even the floors do not fit, the surface is zoomed with CSS
   `zoom`. The board keeps its on-screen width (`--fit-board-w =
   width / z`), so a zoomed-out board has more room across and gains
   columns instead of only shrinking. With `data-fit-wide` the board flows
   as a desktop board: folders at their own width and columns as chosen.
   The rule is scoped with `:where()` so the Fitted layout keeps precedence.
   The zoom is predicted, not searched:
   `boardPlan()` reads every folder's width and height with nothing
   stretched, grouped the way `flowRows()` groups them. `boardHeight()`
   breaks lines with the same `NordlysBoardLayout.balance()` the grid uses,
   and each line is as tall as its tallest folder. `largestZoom()` walks the
   pure prediction down in 2 % steps and then bisects, with no layout. One
   trial confirms the result. The plan must reproduce the unzoomed page to
   within 2 px, or it is not trusted: Custom CSS or an unknown layout causes
   a fallback to a measured search (a linear correction down, then false
   position). Zoomed far out, Chrome keeps a hairline border at least one
   device pixel wide, so each folder grows by 1–3 of its own pixels. A
   prediction that turns out too large is therefore re-planned at the zoom
   it was tried at, which captures that growth, and predicted again at most
   0.5 % below the miss, so a guess on the very edge of a line break does
   not miss again by a hair (at most 3 rounds).
4. **A stacking window (≤ 860 px).** The stylesheet stacks folders one per
   line. Zoomed, a stack is wider in its own lengths, so its folders take
   more bookmarks to a line and it is shorter than it measured at 1. The
   old model assumed its unzoomed height, and a stack was only used above
   `boardWidth / 860`, while desktop flow was only allowed below it. Both
   pinned narrow windows. Nine folders at 640 × 800 and the demo board at
   640 × 630 both stopped at exactly 0.7116 = 612 / 860 whatever the
   height, and the demo board at 480 × 700 took a stack at 0.608 when one
   fitted at 0.66. Now the flow is predicted at any zoom (step 3). A stack
   is then tried at the larger of 92 % of that zoom and the zoom its
   unzoomed height guarantees. If it fits, it is kept (it is the page's own
   look for a narrow window, and a few percent is not worth a different
   page) and walked up by false position (at most 3 layouts) to the largest
   zoom that fits. The shortest stack the folders could ever make (each one
   line of bookmarks) rules the stack out without a layout on most boards.
5. **The gear (and the switch).** The gear is fixed over the bottom right
   corner (the top right at ≤ 480 px); the One page fit switch is above the
   clock (see *The switch on the page* for how both are kept clear). The page is fitted as the stylesheet spaces it, with
   the old bottom floor of `min(padding-bottom, reserve)`. If a folder or the
   dock then lies within 8 px of the gear (`underGear()`), it is fitted again
   keeping the whole corner clear: bottom padding of at least `reserve =
   innerHeight - gear.top + 8` at every step, or, for a top gear, top
   padding of `gear.bottom + 8` while zoomed. A zoomed first attempt hands
   its floor measurements to the second (padding changes none of them), so
   the second skips compaction. Most boards end in a centred line that stops
   short of the gear and never pay for the second attempt. The old code
   capped the reserve at the page's own bottom padding (32 px in windows
   under 940 px tall, against the 68 px the gear needs), so a Fitted board
   ran its last line under the gear, and a heavily zoomed dense board on a
   phone rose under the top gear.

Zoom is floored at 1 %. A board that would need less (well over ten
thousand tiles) stays at 1 % and scrolls. That is the only case in which
anything scrolls, and nothing is ever hidden. In practice a board is
unreadable long before that point, and the state line in Settings shows the
percentage beside the switch that turns the fit off.

## Triggers and coalescing

| Trigger | Path |
| --- | --- |
| Board render (load, edit, drop, undo, language, adoption) | `grid.render()` calls `request({ now: true })`. The board is fitted before it is painted. The first render of a tab calls `prepare()` first, which wears a matching hint before the board is built |
| `grid.relayout()` (fonts, tile size, theme widths) | `request()` |
| `resize`, `visualViewport` `resize` (browser zoom, display scale, DPR, window) | `request()` |
| `document.fonts` `loadingdone` / `ready` | `request()` |
| Size, spacing, header style and Custom CSS settings | `applyGeometryTokens` / `applyHeaderStyle` / `injectCustomCSS` call `request()` |
| Anything else that changes the surface's height | `ResizeObserver` on `#fit-surface` calls `request()` |
| The switch | `request({ now: true })` |
| Arrange enter / exit | `suspend('arrange', on)`, which fits now |
| End of a drag | `request()` (a pass asked for mid-drag is deferred, not lost) |

`request()` runs at most one pass per animation frame. After a pass that
cost more than 24 ms, the next one waits until 160 ms after it finished, so
dragging a window edge over a dense board produces a few fits instead of
one per frame. The final size is always fitted. The `ResizeObserver` cannot
loop. Every pass records the surface's unzoomed size in the observer's own
units (`offsetWidth`/`offsetHeight`, the same as `borderBoxSize`), so the
notification for a size the fit caused compares equal and is ignored. No
pass runs on an idle frame: the spec counts trial layouts across 1.2 s of
idle and finds zero, and 20 `resize` events plus a `visualViewport`
`resize` in one frame produce one pass.

## Interactions

- **Keyboard focus** is untouched. The fit changes only styles, and
  `flowRows()` already restores focus when it rebuilds lines. The spec keeps
  one tile focused across four window sizes.
- **Drag.** The browser reports pointer coordinates in viewport pixels, and
  `getBoundingClientRect` includes zoom, so hit-testing needed no changes.
  Wherever a measured box is written back as a CSS length, the code divides
  by `currentCSSZoom`: `flowRows()` widths and capacity, the lift's
  position and follow translation, `flyHome()`, FLIP offsets for folders and
  tiles, ghost tiles, and the height a folder reserves during a tile drag.
  The lift is dressed with the same custom properties and zoom as the board
  (`PageFit.dress`), so it is the same size in the hand as on the board. The
  spec drags a tile and a folder on a zoomed board, checks the lift's size
  and position against the tile, and checks where the item lands in the
  config. `dress` also copies `data-fit-wide` onto the lift, and the wide
  column rules include `.drag-lift[data-fit-wide]` (not a Fitted lift,
  which keeps its own tracks). Without it, a folder lifted off a zoomed
  board laid out wide on a phone took the phone's `auto-fit` columns in
  hand: a two-column folder with a long name became four columns and a
  different height. The spec lifts one in a 390 px window and compares grid
  tracks and grid height; with the old stylesheet it gets 4 tracks for 2.
  At 640 px the bug did not show, because `components.css` loads after
  `main.css` and its `data-cols` rules already beat the 860 px stacking
  columns.
- **Settings state line.** `#page-fit-state` ("Shown at 62% to fit this
  window.") is part of the switch's description
  (`aria-describedby="page-fit-state page-fit-note"`), so it is read
  whenever the switch is focused. It is spoken once, through the shared
  polite live region, when somebody turns the fit on. It is never spoken
  as the window is resized and the percentage follows, because the line is
  not itself a live region.
- **Arrange** suspends the fit, restoring the ordinary scrolling page with
  zoom 1, because it edits the very sizes compaction borrows. The state line
  reads "Paused while you arrange the board." *Done* refits.
- **Search.** The suggestions list sits below the field. Under the fit it is
  capped at the room below the field (`--fit-sugg-max`, set on `#sugg`
  itself so it does not restyle the board), gets `overflow-y: auto` and
  `overscroll-behavior: contain`, and the arrow keys scroll the selected row
  into view. Dialogs are portals outside the surface and keep their own
  internal scrolling.
- **Reduced motion.** Nothing is animated to reach a fitted size, and zoom
  is not a transform, so the reduced-motion rules (`transform: none`) leave
  it alone.
- **Compositor.** No `will-change`, no transforms and no filters are added.
  Zoom is a layout property and creates no layer.
- **Quiet zones.** Zooming moves the clock and the search without resizing
  them, and the hero observer only sees size changes, so every pass calls
  `queueQuietZones()` itself.

## Measurements

Command: `scratch-fit-measure.cjs` (removed before commit; the same numbers
are asserted by the spec). Every cell is `scrollHeight/clientHeight`. "Cold
fit" is one pass forced from the unfitted page. Display scale and browser
zoom are reproduced as Chrome delivers them to the page: a smaller CSS
viewport at a higher device pixel ratio.

Final build, installed Chrome 153.0.8010.53, Windows 11. The same matrix
in bundled Chromium 151.0.7922.34 (Playwright) gives the same stages and
zooms, and every cell fits:

| Board | Window | Off | On | Stage | Zoom | Tile px on screen | Cold fit ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| demo (5 folders) | 1920×1080 at 100% | 1080/1080 | 1080/1080 | natural | 1 | 78 | 3 |
| demo | 1920×1080 at 125% display | 864/864 | 864/864 | natural | 1 | 78 | 3 |
| demo | 1920×1080 at 150% display | 904/720 | 720/720 | compact | 1 | 56 | 25 |
| demo | 1920×1080 at 200% browser zoom | 891/540 | 540/540 | scaled | 0.79 | 44 | 22 |
| demo | 1440×900 at 200% browser zoom | 1696/450 | 450/450 | scaled | 0.61 | 34 | 22 |
| demo | phone 390×844 at DPR 3 | 1431/844 | 844/844 | scaled | 0.70 | 39 | 9 |
| nine folders | 1920×1080 at 100% | 1080/1080 | 1080/1080 | natural | 1 | 78 | 4 |
| nine folders | 1920×1080 at 125% display | 1026/864 | 864/864 | compact | 1 | 78 | 42 |
| nine folders | 1920×1080 at 150% display | 904/720 | 720/720 | compact | 1 | 64 | 29 |
| nine folders | 1920×1080 at 200% browser zoom | 1209/540 | 540/540 | scaled | 0.78 | 44 | 31 |
| nine folders | 1440×900 at 200% browser zoom | 2742/450 | 450/450 | scaled | 0.58 | 32 | 38 |
| nine folders | phone 390×844 at DPR 3 | 2163/844 | 844/844 | scaled | 0.45 | 25 | 13 |
| 30 folders × 14 | 1920×1080 at 100% | 7566/1080 | 1080/1080 | scaled | 0.49 | 27 | 303 |
| 30 × 14 | 1920×1080 at 125% display | 7546/864 | 864/864 | scaled | 0.39 | 22 | 352 |
| 30 × 14 | 1920×1080 at 150% display | 9184/720 | 720/720 | scaled | 0.34 | 19 | 457 |
| 30 × 14 | 1920×1080 at 200% browser zoom | 9171/540 | 540/540 | scaled | 0.24 | 13 | 644 |
| 30 × 14 | 1440×900 at 200% browser zoom | 21260/450 | 450/450 | scaled | 0.19 | 11 | 715 |
| 30 × 14 | phone 390×844 at DPR 3 | 11372/844 | 844/844 | scaled | 0.21 | 12 | 216 |

Before the zoom stage predicted instead of searching, a cold fit of the
420-tile board took 0.5–2.7 s. After the change it takes 0.2–0.7 s. A warm
exit, which is most passes, costs no trial layouts.

Every trial restyles the whole board, because an inherited custom property
or a zoom reaches every tile: roughly 45 ms restyle plus 40 ms relayout per
trial for 420 tiles on this machine. That is why the zoom stage predicts
instead of searching. These sessions ran alongside other benchmarks on the
same machine, so timings drift between runs. The no-scroll results do not
drift.

### Review fixes (2026-09-24)

Measured in bundled Chromium (Playwright 1.62.1, headless) on Windows 11,
with throwaway probes in the job's scratch directory, not in `tools/perf`.
"Before" is the tree before these fixes, "after" is this one. Other
benchmarks shared the machine, so milliseconds vary 2× between runs; trial
counts and zooms do not. A trial is one full restyle and relayout of the
board.

**Narrow windows, the largest zoom that fits.** Cold pass, fonts loaded,
DPR 1 unless noted. "px" is the page's height against the window's. A
brute-force check that steps the zoom down from 1 in 0.25 % steps, in both
flows, was run on the narrow cells and a few neighbours (700×700, 800×600,
640×500, 720×450). The most it found above the chosen zoom was 1.4 %
(demo at 800×600: 0.814 chosen, 0.825 fits), which is inside the search's
tolerance.

| Board | Window | Before | After |
| --- | --- | --- | --- |
| nine folders | 640×630 | 0.643, 485/630 | 0.644, 485/630. Line-break cliff: at 0.645 five folders no longer share a line and 3 + 3 + 3 needs 643 px, so nothing 3 % larger fits (spec) |
| nine folders | 640×800 | 0.712, 692/800 | 0.831, 795/800 |
| demo | 640×630 | 0.712, 527/630 | 0.870, 628/630 (spec: 3 % larger does not fit either way) |
| demo | 640×800 | 0.712, 527/800 | 0.968, 686/800 |
| demo | 700×700 | 0.781, 572/700 | 0.969, 687/700 |
| nine folders | 480×700 | 0.526, 543/700 | 0.685, 612/700 |
| demo | 480×700 | 0.608 stacked, 652/700 | 0.784 flowing, 695/700 |
| nine folders | phone 390×844 at DPR 3 | 0.45 | 0.678 |
| demo | phone 390×844 at DPR 3 | 0.70 | 0.85 |
| nine folders | 960×540 at DPR 2 | 0.777 | 0.777 |
| nine folders | 720×450 at DPR 2 | 0.579 | 0.579 |
| 30 × 14 | 960×540 at DPR 2 | 0.240 | 0.249 |
| 30 × 14 | 720×450 at DPR 2 | 0.188 | 0.193 |
| 30 × 14 | 1536×864 at DPR 1.25 | 0.3925 | 0.391 |

**Cold pass** (forced from the unfitted page, nothing remembered, five
repeats):

| Board | Window | Before: trials, ms | After: trials, ms |
| --- | --- | --- | --- |
| nine folders | 1536×864 at 1.25 | 5, 32–64 | 5, 36–70 |
| nine folders | 960×540 at 2 | 2, 26–46 | 2, 29–67 |
| nine folders | 640×630 | 4, 41–121 | 3, 38–60 |
| 30 × 14 | 1536×864 at 1.25 | 4, 634–1424 | 4, 858–1319 |
| 30 × 14 | 960×540 at 2 | 6, 1149–1840 | 4, 811–1273 |
| 30 × 14 | 640×630 | 4, 522–1236 | 4, 575–1132 |
| 30 × 14 | 480×700 | — | 7, 1207–1793 (top gear: a second, compaction-free search) |
| 30 × 14 | phone 390×844 at 3 | — | 8, 1181–1989 (the same) |

**Opening a new tab again** (a real reload; the page's first pass as
`PageFit.opened` records it, which excludes the render's own first layout
that every open pays). Before the hint, every open paid the first-open cost.

| Board | Window | First open | Each of the next five |
| --- | --- | --- | --- |
| nine folders | 1536×864 at 1.25 | 4 trials, 78 ms | 1 trial, 6–12 ms (one of five searched again, 5 trials, 60 ms) |
| nine folders | 960×540 at 2 | 3, 63 ms | 1, 7–11 ms |
| nine folders | 640×630 | 3, 71 ms | 1, 6–14 ms |
| nine folders | 390×844 at 3 | 3, 67 ms | 1, 8–11 ms |
| 30 × 14 | 1536×864 at 1.25 | 4, 608 ms | 1, 114–155 ms |
| 30 × 14 | 960×540 at 2 | 4, 576 ms | 1, 85–165 ms |
| 30 × 14 | 640×630 | 3, 448 ms | 1, 59–99 ms |
| 30 × 14 | 390×844 at 3 | 8, 1091 ms | 1, 100–172 ms |

The remembered answer is on the page before the board is first laid out, so
there is no frame of the unfitted board and no second layout to fit it. The
spec records the first frames of every reopened tab and requires the first
one with folders to be fitted, at the zoom the pass settled on. Once the
bundled faces load, the next pass is usually a warm exit or a one-trial
hint for the loaded-fonts key.

**Classic scrollbars.** With Playwright's `--hide-scrollbars` removed, the
Windows scrollbar takes 15 px. Before, the trials of a cold pass for nine
folders were measured at `clientWidth` 1521 of 1536 (and 945 of 960 at
960×540). After, every trial is measured at 1536 (960). The page still
scrolls once the pass is over when it has to.

**Chrome's minimum font size.** Tried through a profile preference
(`webkit.webprefs.minimum_font_size`, which new-headless Chromium honours)
at 12, 16 and 20 px, with nine folders and the 420-tile board, at
1536×864, 960×540 and 640×630: all 18 fit with nothing to scroll. Chrome
applies the minimum before zoom, so zoomed text is not enlarged, and
compaction and zoom are measured on the real layout. Not reproduced, so no
fallback was changed and no regression test was added.

## Edge cases

- **Empty board.** There are no folders, so the empty state is the board.
  Compaction reads no folder or tile measures and changes only the chrome.
- **Header hidden or compact.** `readBase()` skips missing nodes, and the
  change of header style requests a fit.
- **Custom CSS** can change anything. `injectCustomCSS` requests a fit, the
  observer catches the rest, and the zoom plan's self-check falls back to
  the measured search when the prediction does not reproduce the page.
- **Rows the user arranged** are predicted per row, the same way
  `flowRows()` breaks them.
- **Fitted layout.** The wide-flow rules sit under Fitted's own selectors
  (`:where()`). Fitted's stretched widths do not change line breaks or
  heights, which is the property `flowRows()` already relies on.
- **Gear.** No folder or dock is left within 8 px of the fixed gear, at the
  bottom or, on a phone, at the top (algorithm step 5). The spec checks
  every window for it.
- **Fonts.** A new tab's first pass often runs before the bundled faces
  have loaded; the hint key says which faces had, and the loaded-fonts key
  is tried next. Nothing is waited for: the page is fitted with the faces it
  has, and refitted (usually a warm exit) when they arrive.
- **Chrome's minimum font size** does not break the fit (see
  Measurements).
- **A config from another tab** is adopted and refitted. A switch changed
  there is followed here.
- **Drag in progress.** A pass is deferred and replayed at cleanup, so the
  rects a drag session holds never go stale mid-drag.
- **Pinch zoom** (visual viewport scale above 1) is not a reason to shrink
  the page. The room is the layout viewport's `clientHeight`, and a
  `visualViewport` resize only asks for a pass, which the warm exit ends.

## Remaining limitations

- Arrange shows the ordinary, unfitted page and may scroll while it is open.
  This suspension was explicitly allowed.
- Past roughly 10,000 tiles the zoom floor of 1 % is reached and the page
  scrolls rather than hiding anything.
- A search on a very dense board is still a noticeable cost: 0.6–1.3 s for
  420 tiles on this loaded machine (four trials), paid before first paint.
  A new tab pays it only when nothing is remembered for its window, board
  and settings: the first open after a change, a window size not among the
  last four, or a font state not seen before (about one open in five for
  nine folders at 1536×864 in the measurements above). Otherwise it pays
  one trial (60–170 ms for 420 tiles, 6–14 ms for nine folders).
- On a phone, or anywhere the board runs under the gear and the first fit
  leaves a folder under it, the fit runs a second, compaction-free search:
  7–8 trials for 420 tiles instead of 4.
- A narrow window keeps its stacked folders if a stack fits at 92 % of the
  zoom the desktop flow reaches, or more, so a stack may be shown up to 8 %
  smaller than a flow would be.
- The search stops within its tolerance (the larger of 8 px and 2 % of the
  height). Where a line break makes the height jump, the chosen zoom can
  leave more room than that, because a zoom a step larger does not fit.
- At strong zoom-out, text is small by design. The state line in Settings
  reports the percentage, and the switch turns the fit off.
- Browser zoom and display scale were reproduced as viewport and DPR
  equivalents. Headless Chrome cannot drive the zoom menu itself.

## Tests

- `tests/unit/page-fit.test.cjs` (23 tests): measures at 0, 1 and between,
  monotonicity and floors; the solver on smooth and stepped heights and its
  layout budget; the zoom model; `boardHeight` for automatic rows and rows
  the user made; `largestZoom` with jumps and bounds; the default, schema
  and repair; the `boot.js` first-frame attribute; script and sheet order;
  what the surface contains; every rule gated on the switch (commas inside
  nested `:where(:not())` are now split correctly); the hint fingerprint
  and what a hint may contain; Reset clears the hint and no backup or
  recovery store carries it.
- `tests/ui/one-page-fit.spec.cjs` (34 tests):
  - Off-state parity, with boxes and a screenshot identical when the wrapper
    is removed, and nothing left behind after turning the fit on and off.
  - Six windows (100 %, 125 % and 150 % display scale, 200 % browser zoom on
    two screen sizes, and a DPR-3 phone) × two boards (nine folders, and a
    dense 420-tile board with a hidden folder). Each checks for no scroll,
    no hidden tiles, every part inside the window, and no folder or dock
    under the gear.
  - Compaction first, with settings left unchanged. The drawer, gear, toast
    dock and dialogs stay unscaled, and a dialog does not scroll the page.
  - Live resize with focus kept. A burst of resizes produces one pass, and
    an idle page runs zero trials. A new folder, a bigger tile size, and a
    switch changed from another tab are each refitted.
  - The Settings switch: its accessible name and description (the state
    line first), the keyboard, persistence to both stores, one announcement
    when it is turned on and none when a resize changes the percentage, the
    first-frame attribute after a reload, and the zoom percentage in English
    and German.
  - Search suggestions stay inside the window and scroll internally.
  - Tile and folder drags on a zoomed board. Arrange suspends the fit and
    resumes it.
  - Reduced motion.
  - 640×630 with the demo board and with nine folders: no scroll, and a zoom
    3 % larger fits in neither flow. 480×800: the stack is kept, and a stack
    3 % larger does not fit.
  - A new tab: the answer is stored as custom properties only; a reopened
    tab wears it for one trial, and every reopened tab's first frame with
    folders is fitted at the zoom it settled on. A stale answer is dropped
    and the search reaches the same zoom as a cold one; another board's
    answer is never used.
  - A Fitted board under the gear, compact (1440×800) and zoomed
    (1440×560): its last line reaches under the gear and stays clear of it.
  - A long-named two-column folder lifted on a zoomed phone board keeps two
    grid tracks and its grid height in hand, with nothing spilling out.
- `tests/ui/fit-toggle.spec.cjs` (27 tests): the switch on the page.
  - Six windows (1440×900, 1366×768, 1024×700, 768×1024, 390×844,
    320×568), off: found by role and name without opening Settings, off,
    its name in full, outside `#page` and unzoomed, a 40 px target, clear of
    the gear, the clock, the search and every folder, bookmark and label;
    the page still scrolls and the switch scrolls away with it. On, pressed:
    no scroll either way, everything inside the window, nothing under the
    switch or the gear.
  - A dense 288-tile board zoomed to fit at 1440×900, a DPR-3 phone and
    200 % browser zoom (720×450 at DPR 2), with the zoom percentage as the
    switch's description.
  - Saved to both stores, on after a reload from the first frame, off again
    after a reload, and no size saved. The drawer's switch and state line
    follow the page's switch and the page's switch follows the drawer's,
    and both follow a config adopted from another tab.
  - Keyboard: Tab reaches it just before the gear, Space and Enter work it,
    focus stays on it, a focus ring is drawn, and turning it on announces
    what the fit did, once. Axe finds nothing on or off, in a dark and a
    light theme.
  - All eight languages at 1440×900, 760×700 and 360×740, off and on: its name in
    full and clear of everything, and the hint as its description.
  - Toasts at three widths never meet it; arranging hides it and Done brings
    it back.
- `tests/ui/one-page-fit-scrollbars.spec.cjs` (1 test, its own file because
  it launches Chromium without `--hide-scrollbars`): every trial of a cold
  pass is measured at the full window width, and afterwards nothing holds
  the page from scrolling.

Of the new checks, these fail on the tree before the fixes: the scrollbar
test, the demo board at 640×630, the stack at 480×800, both new-tab tests,
both Fitted-gear windows, the dense board on a phone (a folder under the
top gear), the Settings announcement and description, and the lifted folder
(with the old stylesheet: 4 tracks in hand for 2). Nine folders at 640×630
passes before and after, because its answer was already the largest.
