# New-tab performance probe

Two scripts, run from the repository root with the dev dependencies installed.

- `newtab.cjs` loads one build of `newtab.html` in a fresh headless browser profile.
  It records canvas and display frame rate, frame-interval p95, the JS time
  spent in `render()`, per-process CPU (GPU, renderer, browser), and Windows
  private memory for four scenes: `aurora`, `paused`, `solid`, and
  `solid-no-glass`. Since report version 2 it also times the engine's own frames
  and records every quiet-zone solve. `--cadence render` drops the probe's own
  frame loop, `--quiet-alpha` forces the quiet zones on, and `--seed` seeds the
  meteors (see [Report version 2](#report-version-2)). `--scene` picks the
  atmosphere, and `--silk-skip` takes Silk apart (see [Scenes](#scenes---scene)).
- `ab.cjs` runs that probe against a clean `git archive` export of a ref
  (`origin/main` by default) and against this working tree, uncommitted
  changes included. The runs are interleaved ABBA, and it prints medians.

```sh
# A/B, all four scenes (about 5 minutes)
node tools/perf/ab.cjs --runs 3 --seconds 8 --out tools/perf/evidence/ab-chrome153-dense.json

# A/B of the idle budget (15 fps after a minute without input)
node tools/perf/ab.cjs --runs 3 --seconds 8 --only aurora --out tools/perf/evidence/ab-chrome153-dense-idle.json -- --idle

# One build only
node tools/perf/newtab.cjs --channel chrome --board dense --width 2048 --height 1152 --dpr 1.25 --seconds 8 --warmup 2

# One build with One page fit switched on, and its fit reported
node tools/perf/newtab.cjs --channel chrome --board dense --width 1280 --height 720 --seconds 8 --warmup 2 --one-page-fit on

# One build with no probe frame loop, quiet zones forced on, and meteors seeded
node tools/perf/newtab.cjs --channel chrome --board dense --width 2048 --height 1152 --dpr 1.25 --seconds 8 --warmup 2 --cadence render --quiet-alpha 0.45 --seed 7

# The same as an A/B (both builds get the same flags)
node tools/perf/ab.cjs --runs 3 --seconds 8 --out tools/perf/evidence/ab-render-cadence.json -- --cadence render --seed 7

# One build, Silk instead of Aurora, the moving scene only
node tools/perf/newtab.cjs --channel chrome --board dense --width 2048 --height 1152 --dpr 1.25 --seconds 8 --warmup 2 --cadence render --seed 7 --scene silk --only scene

# Silk as an A/B (the scene's sample is labelled `silk`, so use --only scene, not --only aurora)
node tools/perf/ab.cjs --runs 3 --seconds 8 --only scene --out tools/perf/evidence/ab-silk.json -- --cadence render --seed 7 --scene silk
```

The `ab.cjs` defaults are the installed Chrome (`--channel chrome`) and the
`dense` board: the demo board plus four folders, making 9 folders and 28 links.
The viewport is 2048 × 1152 at DPR 1.25, with a 2 s warmup and 8 s per scene.
Everything after `--` is passed to `newtab.cjs`.

The runner also guards the comparison:
- A run fails on any page error, or if the browser version differs between runs.
- It fingerprints `src/`, `newtab.html`, and `manifest.json` before and after
  all runs. If the working tree changed in between, it prints
  `CHANGED DURING RUNS` and exits 2.
- It logs whole-machine CPU load before each run.

## One page fit (`--one-page-fit on|off`)

Without the flag, which is the default for both scripts, the probe seeds the
board as saved. It adds no init script and reads nothing about the fit, so
default runs, and every A/B in this folder, measure the page exactly as before.
The boards carry no `onePageFit` key, so the app's default (off) applies.

With `on` or `off`, the probe:
- seeds `onePageFit: true` or `false` into the saved board;
- wraps `PageFit.prototype.fit` from an init script as `page-fit.js`
  publishes it, so it catches the first fit. That fit runs inside the app's
  constructor, before `window.Nordlys` exists;
- waits after load until no fit pass has run for 500 ms (at most 5 s), then
  adds a `pageFit` block to the report. This happens before the scenes, so it
  costs no sample time. The block holds:
  - `stage` (`off`, `natural`, `compact`, `scaled`), `t` and `zoom`, as the fit
    settled on them;
  - `surfaceCssZoom` / `boardCssZoom`: what Chrome applies (`currentCSSZoom`);
  - `scrollHeight` / `clientHeight` and the widths of `document.scrollingElement`,
    plus `fitsVertically` / `fitsHorizontally`;
  - `coldFit`: the first pass that actually fitted, with its start time from
    navigation (`atMs`), its main-thread duration (`durationMs`) and its trial
    layouts. It is `null` when the switch is off;
  - `passes`, `activePasses`, `activeFitMsTotal` and `trials` for all passes up
    to that point, since fonts and the surface's resize observer ask again;
  - `settled`: false if passes were still running at 5 s.

A build without `page-fit.js`, such as `origin/main` 1537da4, reports
`supported: false` and no stage. In `ab.cjs`, `-- --one-page-fit on` therefore
compares current with the fit on against a base that cannot fit. Each run's
entry in `runs` then carries a short `pageFit` summary. `coldFit.durationMs` is
one pass, timed with `performance.now()`. The page's own `PageFit.cost` measures
the same thing. It excludes the style and layout work the browser does
afterwards, and it varies by viewport: sampled once each, not a benchmark.

## Scenes (`--scene`)

The atmosphere is `bgMode` in the saved config (`DEFAULT_CONFIG.bgMode` is
`aurora`, in `src/js/app.js`). The canvas draws nine of them, the names in
`NORDLYS_GENERATIVE_SCENES` (`src/js/background.js`): `aurora`, `polaris`,
`halo`, `pillars`, `nacre`, `silk`, `baikal`, `drift` and `horizon`. The settings
panel shows `aurora` as Nordlys and the last two as Contour and Fjord.
`--scene` takes the internal names. `frost` was retired on 2026-09-25 (a stored
Frost becomes Baikal), so older evidence that names it cannot be re-run on this
build.

### The GPU layer (`--gl on|off`)

Silk, Polaris and Contour draw their long lines on a WebGL2 layer
(`src/js/sky-gl.js`) wherever the browser has one. `--gl off` holds them on the
2D canvas instead, the way a browser without WebGL2 paints them — the before
of that change, on one build. The default is `on`, the product as it ships.
`probe.gl` records the flag, and each sample's `renderCadence.engine.layer`
says which way the lines were drawn: `gpu`, `2d` (held off), `lost` (the
context was lost) or `none` (the scene never asked for the layer).

Without the flag, which is the default for both scripts, no `bgMode` is seeded.
The app's default applies, so every earlier run and evidence file measured
Aurora. With `--scene <name>`, the probe:
- seeds `bgMode: <name>` into the saved board before the page loads, the same
  way the board itself is seeded;
- fails the run unless the stored config and the engine are both in that scene
  after load, and the engine is still in it at the end of the scene's sample.
  An unknown `bgMode` does not throw in the page: `updateBackgroundMode()`
  quietly draws `solid` (`app.js`), so without this check a scene that does not
  exist in one build would be measured as a solid colour;
- labels the first sample with the scene's name.

### Sample labels and `--only`

The first sample is the scene as it moves. It has always been labelled
`aurora`, and without `--scene` it still is, so old reports, `ab.cjs`
summaries and `--only aurora` keep their meaning. With `--scene silk` it is
labelled `silk`. The other three samples (`paused`, `solid`,
`solid-no-glass`) keep their names: `paused` is the chosen scene held still.

`--only` takes:
- `all` (the default): all four samples;
- `scene`: the first sample only, whatever the scene;
- the first sample's label: `aurora` without `--scene`, or the scene's name.

`--only aurora` with another scene fails with a message pointing to
`--only scene`, rather than keeping a `silk` sample under a flag that says
Aurora. An `--only` value that names no sample now fails too. It used to
produce a report with no samples.

### What else shapes a scene

`--scene` seeds `bgMode` and nothing else. Every other key falls back to
`DEFAULT_CONFIG`, as it did before, and the report's `startup.scene` records the
values the engine ended up with:
- `motion` 1, `intensity` 1 (the settings sliders), `palette` `theme` (the
  colours come from the `aurora-void` theme's `--shader-1..3`), `seed` 0 (the
  scatter of Silk's threads, the stars, the trails, the pillars, the clouds and
  the ice), dark UI, and daylight off.
  High legibility is off; it would cap the intensity at 0.6.
- `realSky`: Halo draws tonight's moon from the date and the machine's time
  zone (`bgRealSky`, on by default). Two Halo runs on different days draw a
  different moon. `--real-sky off` seeds `bgRealSky: false`, which holds the moon
  full, and `--real-sky on` seeds `true`. Without the flag nothing is seeded.
  `startup.scene.moon` shows the phase that was drawn, and `timeZone` the
  zone.
- `silk`: the thread count and total walk steps (66 threads and 2971 steps at
  2048 × 1152), since both scale with the viewport.
- Each scene starts at its own rest phase (`NORDLYS_REST_PHASE`: Aurora 12,
  Polaris 20, Pillars 9, Nacre 14, Silk 31.7, Baikal 6, the others 7.4). `--fixed-phase` still sets `t = 12` for every
  scene, so a fixed-phase Silk is not the frame the settings thumbnail shows.
- The frame budget (30 fps, 15 after a minute idle) is the same for every
  scene. A scene that renders more slowly than that reports it in
  `renderCadence` (see the smoke below): check `renderCadence.fps` before
  setting two scenes' CPU per second side by side.

### Taking Silk apart

`--skip-method` replaces engine methods with no-ops after load, before the first
sample. It now takes a comma list, and a name the engine does not have fails the
run. Before, a misspelt name was ignored and the run measured everything.
`--skip-method renderSilk` leaves the canvas empty but keeps the loop, the
budget and the quiet-zone pass running. `silkAngle` is refused: stubbing it
returns `undefined`, every thread point becomes NaN, and the gradient throws.

`--silk-skip` (with `--scene silk --gl off` only: it splits the 2D strokes, which
the GPU layer replaces) drops parts of `renderSilk` without
touching the product. It wraps `renderSilk` and `silkAngle` on the engine, and
while `renderSilk` runs, it wraps `stroke` and `fillRect` on whichever context
is `this.ctx` at that moment: the live canvas, or the quiet-zone sample that
`solveQuiet()` paints. Parts, as a comma list:

| Part | What is dropped | Identified by |
|---|---|---|
| `strokes` | Every thread stroke; the walk and the gradients still run | `stroke()` inside `renderSilk` |
| `bloom` | Each thread's wide, faint passes; the thin core is kept | every stroke but the last of each `NORDLYS_SILK_PASSES` group |
| `sheen` | The band of light swept over the threads | `fillRect()` under `source-atop` |
| `depth` | The backdrop field behind the threads | `fillRect()` under `destination-over` |
| `field` | Nothing drawn. The vector-field walk is frozen at the first frame after the split: `silkAngle` returns the recorded angles, so the threads keep one shape and every stroke and fill is still drawn | `silkAngle()` calls, in walk order |

Each sample then carries `silkSplit`: `renders` (`renderSilk` calls, quiet-zone
sample renders included), `strokesDrawn`, and `skipped` per part. The run fails
if Silk did not render during the scene's sample (a held still, or
`--fixed-phase`), or if a requested part dropped nothing. The second failure
means `renderSilk` no longer draws the way the split assumes.
`tests/unit/perf-probe.test.cjs` runs the real `renderSilk` from
`background.js` against a recording context and checks those assumptions: one
stroke per pass, core last, one fill per part, the field walked through
`silkAngle`. The split cannot be combined with `--skip-method renderSilk`. It is
applied after load, so `startup` and the one-page-fit block still see the whole
scene.

### One build, several scenes

`ab.cjs` compares builds, not scenes. To compare scenes in one build, run the
probe once per scene in one sitting, and rotate the order each round so drift
hits every scene (PowerShell, from the repository root):

```powershell
$scenes = 'aurora', 'silk', 'halo'
foreach ($round in 1..3) {
  $order = 0..($scenes.Count - 1) | ForEach-Object { $scenes[($_ + $round - 1) % $scenes.Count] }
  foreach ($scene in $order) {
    node tools/perf/newtab.cjs --channel chrome --board dense --width 2048 --height 1152 --dpr 1.25 --seconds 8 --warmup 2 `
      --cadence render --seed 7 --real-sky off --scene $scene --only scene --out "tools/perf/evidence/scenes-$scene-$round.json"
  }
}
```

Every report records `browser`. Keep only rounds with the same version and no
page `errors`, and compare `renderCadence.fps` first.

### Report version 3

`newtab.cjs` reports now carry `"reportVersion": 3`. Run without the new flags,
a version 3 report keeps every version 2 field with its old meaning, and the
first sample is still `aurora`. It adds:
- `probe.scene`, `probe.realSky` (`null` when not given), `probe.skippedMethods`
  (the parsed `--skip-method` list; `probe.skipMethod` keeps the raw string), and
  `probe.silkSkip`;
- `startup.scene`: `requested`, `config` (the stored `bgMode`), `engine` (the
  engine's mode), `attribute` (`data-bg`), `running`, `motion`, `intensity`,
  `palette`, `seed`, `realSky` and `timeZone`, plus `silk` or `moon` in those
  scenes;
- `silkSplit` on each sample, with `--silk-skip` only.

`ab.cjs` is unchanged. Its summary stays at version 2. Scene flags go after
`--` and are recorded in `probeArgs`, and the scene labels come from the
reports.

### Smoke on 2026-09-25

This smoke predates the GPU layer: it measured the 2D strokes that `--gl off`
now keeps, and the Silk rows are the lag the layer was built to remove. To
repeat a `--silk-skip` row today, add `--gl off`.

The smoke used installed Chrome 153.0.8010.53, headless, the dense board,
2048 × 1152 @1.25, `--cadence render --seed 7`, 2 s samples after a 0.5 s
warmup, and one run each on the working tree. Machine load was about 36% before
the runs, with other browser tests on the machine. Every run reported
`errors: []`, the stored config and the engine in the requested scene, and the
same mode at the end of the sample. These are single runs under load. They show
that the flags work, and the figures are **not** a benchmark.

| Run | Label | Loop fps (p50 / p95 ms) | `render()` ms/frame | GPU CPU ms/s | `silkSplit.skipped` |
|---|---|---:|---:|---:|---|
| no `--scene`, `--only aurora` | aurora | 29.92 (33.4 / 34.7) | 0.63 | 456 | |
| `--scene aurora` | aurora | 29.65 (33.4 / 34.5) | 0.65 | 492 | |
| `--scene halo --real-sky off` | halo | 30.35 (33.3 / 33.6) | 0.45 | 268 | moon phase 0.5, held full |
| `--scene silk` | silk | 15.40 (65.8 / 69.4) | 1.48 | 1103 | |
| `--scene silk`, all four samples | silk | 7.91 (111 / 198) | 3.13 | 1110 | |
| `--skip-method renderSilk` | silk | 29.80 (33.4 / 34.0) | 0.08 | 298 | |
| `--silk-skip strokes` | silk | 29.81 (33.3 / 33.8) | 1.86 | 318 | strokes 12276 |
| `--silk-skip bloom,sheen,depth,field` | silk | 21.77 (47.4 / 55.2) | 1.72 | 1125 | bloom 6072, sheen 46, depth 46, field 136666 |
| `--skip-method renderSilky` | | exit 1: `the engine has no such method` | | | |

At this size, Silk did not hold the 30 fps budget in either run, and the GPU
process used more than one core. Without its strokes, or without `renderSilk`,
it drew at 30 fps with GPU-process CPU near Aurora's. The strokes looked like
the cost, and not the JS walk: `render()` time stayed under 2 ms per frame.
Keeping only the core strokes (bloom, sheen and depth dropped, field frozen)
did not bring Silk back to 30 fps. Each of these is one run under load. A
controlled run is still needed before any conclusion
(see [One build, several scenes](#one-build-several-scenes)).

Smoke results on 2026-09-24, with the dense board, 2 s Aurora-only samples
against the main checkout, and no page errors in any run:

| Browser | Viewport | Flag | Stage | Zoom | scrollHeight / clientHeight | Cold fit |
|---|---|---|---|---:|---:|---:|
| Chromium 151 | 1920 × 1080 | none | (no `pageFit` block) | | | |
| Chromium 151 | 1920 × 1080 | off | off | 1 | 1080 / 1080 | none |
| Chromium 151 | 1920 × 1080 | on | natural | 1 | 1080 / 1080 | 6.9 ms, 0 trials |
| Chromium 151 | 1280 × 720 | on | compact | 1 | 720 / 720 | 37.2 ms, 3 trials |
| Chrome 153 | 2048 × 1152 @1.25 | none | (no `pageFit` block) | | | |
| Chrome 153 | 2048 × 1152 @1.25 | off | off | 1 | 1152 / 1152 | none |
| Chrome 153 | 2048 × 1152 @1.25 | on | natural | 1 | 1152 / 1152 | 8.3 ms, 0 trials |
| Chrome 153 | 1280 × 720 | on | compact | 1 | 720 / 720 | 41.3 ms, 3 trials |
| Chrome 153 | 960 × 540 | on | scaled | 0.8843 (CSS 0.8843) | 540 / 540 | 61.9 ms, 2 trials |
| Chrome 153, `origin/main` | 1280 × 720 | on | unsupported | | 791 / 720 | none |

### Chrome 153 at 960 × 540, saved evidence

`evidence/fit-off-chrome153-960x540.json` and `evidence/fit-on-chrome153-960x540.json`
hold one run each: Chrome 153.0.8010.53, the dense board, 960 × 540 at DPR 1,
`--cadence render`, 2 s Aurora after a 0.5 s warmup, no seed, and no page
errors. They were written at 19:58 UTC, between the idle and quiet-zone A/B
sessions below. Neither file records a tree fingerprint.

| Flag | Stage | Zoom | scrollHeight / clientHeight | Cold fit |
|---|---|---:|---:|---:|
| off | off | 1 | 1096 / 540 (scrolls) | none |
| on | scaled | 0.8261 (CSS 0.8261) | 540 / 540 | 96.4 ms, 3 trials |

With the switch on, two fit passes took 110.9 ms in total. The smoke row above
for the same viewport (0.8843, 61.9 ms) came from an earlier tree. These are
single runs, so they are not a benchmark of fit cost. The two files' startup
timings also differ, and one run each cannot separate the fit from run-to-run
noise, so no startup cost is claimed.

## Report version 2

Reports now carry `"reportVersion": 2`. A report without that field is
version 1. Every evidence file in this folder up to and including
`evidence/ab-chrome153-final-5run.json` is version 1, measured with the probe's
own frame loop (see below). The `*-render-*run.json` and `fit-*` files are
version 2, run with `--cadence render`.

Run with the defaults, a version 2 report keeps every version 1 field with its
old meaning. It adds these fields and nothing else:
- `probe.cadence`, `probe.quietAlpha`, `probe.forcedQuietZones`, `probe.seed`;
- `renderCadence`, `quiet` and `meteorsSpawned` on each sample.

The probe now also wraps `solveQuiet()` and `engine.meteors.push` in every mode,
and it takes one `performance.now()` per render. That adds microseconds per
frame, well below the run-to-run noise in the tables below.

`ab.cjs` writes `reportVersion: 2` and a `probe` block to its summary. It adds
`renderFps`, `renderP50Ms`, `renderP95Ms`, `renderOver50MsPct`,
`quietAlphaMax`, `quietNonzeroSolves` and `meteorsSpawned` to each scene. The
table prints `-` for a missing value. Its header line names the cadence, and the
forced quiet alpha and seed when they are set.

### Frame clock (`--cadence raf|render`)

- **`raf`**, the default, is the version 1 behaviour. For the whole sample the
  probe runs its own `requestAnimationFrame` loop and reports `rafFps`,
  `rafP95Ms` and `rafOver25MsPct` from it. That loop asks for a display frame on
  every vsync, about 120 a second on Chrome 153's virtual display and about 60
  on Chromium 151's, **in every scene**. Paused, solid and solid-no-glass
  therefore never go idle. The compositor, GPU and renderer work of those
  callbacks lands in their CPU figures. The "display callbacks stay at about
  120/s" in the earlier results is this loop, not the page.
- **`render`** schedules no frame of its own. The probe waits in Node for the
  sample, so only the page's own work runs. `rafFps`, `rafP95Ms` and
  `rafOver25MsPct` are `null`, meaning not measured, not zero.

In both modes `renderCadence` times the engine's own frames from the wrapped
`render()`. It has these fields:

| Field | Meaning |
|---|---|
| `loopFrames` | Renders from the engine's loop, which always passes `dt > 0` |
| `repaints` | `render(0)` calls: `repaint()` and held stills, counted apart and not timed |
| `intervals` | Number of gaps between consecutive loop frames in the sample |
| `fps` | `loopFrames` over the sample's elapsed time |
| `p50Ms`, `p95Ms`, `maxMs` | Loop-frame intervals. At the 30 fps budget, about 33 ms; at the idle budget (`--idle`), about 67 ms |
| `over50MsPct` | Share of intervals over 50 ms: at 30 fps, at least one budgeted frame missed. Meaningless with `--idle` |
| `absent`, `reason` | `true` when there was no interval to measure, with the cause |
| `engine` | `mode`, `running` and `parked` (no frame pending) at the end of the sample |

A scene without frames is reported as absent, not as fast. Paused, solid and
solid-no-glass report `loopFrames: 0`, `p95Ms: null` and `absent: true`, with
the reason `engine stopped (paused, solid or hidden)`. A parked engine (a held
still) reports `engine parked: a held still frame`. The version 1 fields keep
their old values there: `canvasFps: 0` and `canvasRenderMsPerFrame: 0`.

**Do not compare across cadences.** A `render` run's CPU, GPU and task figures,
above all in the paused and solid scenes, omit work that every version 1 file
includes. Set them only beside other `render` runs from the same session. In an
A/B both builds get the same flags, so each comparison is like for like.
`renderCadence.p95Ms` measures the engine's roughly 33 ms frames. `rafP95Ms`
measured the probe's 8 ms callbacks. The two are different quantities.

The `--one-page-fit` settling wait still uses `requestAnimationFrame`. It runs
once, before the first scene, so it never overlaps a sample.

### Quiet zones (`--quiet-alpha <0.01–1>`)

In every version 1 file, `quietAlphas` is `[0, 0, 0, 0]`. Under the default dark
Aurora, the quiet zones never take any sky back, so `quieten()` draws nothing
and its cost goes unmeasured. On 2026-09-24 a sweep looked for a real setting
that changes that. It used Chromium 151 at 2048 × 1152 @1.25 with the demo
board, and solved every zone at 120 or 240 phases (t = 0 to 60) per
configuration.
- **Aurora:** nonzero at none of the phases. That held on `aurora-void` and
  `porcelain-light` with the `theme`, `mono`, `ember` and `polar` palettes and
  custom all-white and all-black moods. On `aurora-void` it also held with a
  pastel mood and with high legibility.
- **Halo, frost, drift, horizon:** zero at every phase, with the `theme` and
  `mono` palettes on both themes.
- **Silk on `aurora-void`:** nonzero at 3/120 phases with the theme palette,
  12/120 with `mono`, and 30–36/120 with a white or pastel mood (alpha up to
  0.45, on the date and greeting zones only). On `porcelain-light`, silk stayed
  zero with every palette tried. One of those runs, `theme`, crashed the
  headless renderer partway through its 120 back-to-back solves; that was not
  investigated.

A real sky therefore gives nonzero alphas only now and then. A moving sample
would drift in and out of them.

`--quiet-alpha a` forces it instead. After load, every zone, including any the
app sends later, asks for a contrast no colour pair reaches (22:1; the maximum
is 21:1), with its ceiling `most` set to `a`. On every solve, each zone then takes
back exactly `a`, in any scene and at any phase. In the smoke run,
`--quiet-alpha 0.45` gave `quietAlphas` and `quiet.alphaMax` of
`[0.45, 0.45, 0.45, 0.45]` in Aurora, with 2 of 2 solves nonzero. The `raf`
smoke run, without the flag, gave `[0, 0, 0, 0]`. `probe.forcedQuietZones` counts the zones it applied
to.

The flag has limits:
- The solver still paints and reads its 96-pixel sample, so
  `scratchRenderMsPerFrame` stays realistic. It skips the nine-step bisection a
  real partial cut runs, which makes the solve itself slightly cheaper than a
  natural nonzero one.
- `quietAlphas`, the version 1 field, is the last solve's result, even from
  before the scene. In the paused and solid scenes it still shows the Aurora
  values. `quiet.solves` (0 there) tells you whether the scene solved at all.
- `quiet` covers the solves inside one sample only. It holds `solves`,
  `nonzeroSolves` (any zone at 0.01 or more), and `alphaMax` per zone.

### Seeded meteors (`--seed <0–4294967295>`)

The meteors are the only per-frame `Math.random` draws in `src/js` (stars,
nebulae and the other fields already come from the engine's own seeded
stream). Before any page script runs, `--seed` replaces `Math.random` with a
mulberry32 stream. `meteorsSpawned` counts spawns in each sample in every mode.

The seed fixes the order of the draws from page load. It does not fix the
frame each spawn lands on: a spawn's chance scales with the frame's `dt`, and
the number of frames before a sample varies with startup. In the smoke run, two
seeded 5 s Aurora runs (`--seed 11`) spawned 2 and 2 meteors, and an unseeded
run spawned 0. Treat that as equal exposure, not identical frames.

### Smoke on 2026-09-24

The smoke used Chromium 151 (bundled), headless, 1920 × 1080 @1, the dense
board and the main checkout's working tree. It ran 2 s scenes after a 0.4 s
warmup (5 s for the seed check), one run each, with no page errors. Each figure
comes from a single run, so none of this is a benchmark. It only shows that the
flags do what they say.

| Scene | Cadence | rafFps | Loop fps (p50 / p95 ms) | Absent | Renderer tasks, ms/s |
|---|---|---:|---:|---|---:|
| aurora | raf | 27.69 | 27.2 (36.4 / 42) | no | 31.1 |
| paused | raf | 59.62 | 0 (null) | yes, engine stopped | 19.0 |
| solid | raf | 59.74 | 0 (null) | yes, engine stopped | 18.6 |
| aurora | render, `--quiet-alpha 0.45 --seed 7` | null | 26.27 (35 / 58) | no | 24.9 |
| paused | render | null | 0 (null) | yes, engine stopped | 2.6 |
| solid | render | null | 0 (null) | yes, engine stopped | 2.2 |

The drop in paused and solid renderer tasks, from about 19 ms/s to about
2.5 ms/s, is the probe's own frame loop leaving the measurement. It is one run
per mode and has not been repeated in Chrome 153.

## Results: render cadence, Chrome 153.0.8010.53 (current)

Three A/B sessions written on 2026-09-24 between 19:54 and 20:00 UTC, with
`--cadence render --seed 7 --only aurora`. They ran in installed Chrome 153
(headless) with the dense board at 2048 × 1152 and DPR 1.25, a 2 s warmup and
8 s samples, interleaved ABBA. Base is `origin/main` 1537da4 (fingerprint
`dc426a8b…`). Current is the working tree at fingerprint `adbcc450…`, unchanged
during all three sessions. One page fit was off on both builds. Despite its
name, `ab-chrome153-raf-render-5run.json` is a `render`-cadence run: every file
here has `probe.cadence: "render"`, so `rafFps` and `rafP95Ms` are `null`.

To repeat them, with new output names so the evidence stays as it is:

```sh
node tools/perf/ab.cjs --runs 5 --seconds 8 --only aurora --out rerun-render.json -- --cadence render --seed 7
node tools/perf/ab.cjs --runs 3 --seconds 8 --only aurora --out rerun-idle.json -- --cadence render --seed 7 --idle
node tools/perf/ab.cjs --runs 3 --seconds 8 --only aurora --out rerun-quiet.json -- --cadence render --seed 7 --quiet-alpha 0.45
```

Medians below are recomputed from the per-run arrays, and they match the
file's own. A pair is run *i* of base against run *i* of current. Brackets show
the per-run range.

### Normal Aurora, five runs (`evidence/ab-chrome153-raf-render-5run.json`)

| Aurora, dense board | base | current | pairs where current was lower |
|---|---:|---:|---:|
| GPU process CPU, ms/s | 507.30 [493–540] | 407.83 [398–454] | 5 of 5 |
| Renderer process CPU, ms/s (all renderers) | 98.49 [93.0–108.3] | 87.63 [82.8–94.8] | 5 of 5 |
| Renderer main-thread tasks, ms/s | 65.91 | 41.95 | 5 of 5 |
| JS time in `render()`, ms/frame | 0.99 | 0.52 | 5 of 5 |
| Quiet-zone sample paint, ms/frame (`scratchRenderMsPerFrame`) | 0 | 0.28 | (current only) |
| Browser process CPU, ms/s (noisy, see Limits) | 96.57 | 89.52 | 3 of 5 |
| Engine frame rate, fps | 29.93 | 29.69 | 4 of 5 (slower) |
| Engine frame-interval p50 / p95, ms | 33.3 / 34.3 | 33.3 / 35.2 | p95 higher in 4 of 5 |
| Intervals over 50 ms, % (median) | 0 | 0 | one run each above 0 |
| GPU process private memory, MiB | 306.11 | 306.46 | 3 of 5 |
| Page renderer private memory, MiB | 73.15 | 72.12 | 2 of 5 |
| All processes of the fresh browser, private MiB | 502.63 [495–515] | 505.69 [494–521] | 3 of 5 |
| JS heap, MiB | 4.35 | 5.38 | 0 of 5 |
| Meteors spawned (median) | 3 | 3 | current spawned 2 in two runs |

- **GPU-process and renderer CPU were lower in every pair.** GPU-process CPU
  fell by 19.6% and renderer CPU by 11.0%. The highest current GPU run (454.29)
  sits below the lowest base run (493.47). The renderer ranges overlap.
- **Machine load did not favour current.** Before each run it was
  9 / 2.5 / 3.5 / 8 / 10.75% for base and 14.5 / 13.75 / 9.5 / 12.5 / 7.25% for
  current. Current started under more load in four of five pairs.
- **Frame pacing cost a little.** Current drew 0.24 fps fewer and its p95 was
  0.9 ms higher, in four of five pairs each. The median p50 is 33.3 ms on both
  builds. One run of each build had intervals over 50 ms (base 0.85%, current
  0.42%).
- **Memory is flat.** Total private memory rose 0.6%, which is within the
  per-run spread. The JS heap was larger on current in every pair of this
  session, by 0.03–1.07 MiB, but not in the quiet-zone session below (5.57 → 4.90 MiB,
  lower in all three pairs). No RAM reduction is claimed.

### Idle budget, 15 fps, three runs (`evidence/ab-chrome153-idle-render-3run.json`, `-- --idle`)

| Aurora, dense board | base | current | pairs where current was lower |
|---|---:|---:|---:|
| GPU process CPU, ms/s | 445.45 [390–452] | 331.45 [306–356] | 3 of 3 |
| Renderer process CPU, ms/s (all renderers) | 126.77 [107.5–129.4] | 82.44 [76.7–86.5] | 3 of 3 |
| JS time in `render()`, ms/frame | 2.09 | 0.83 | 3 of 3 |
| Engine frame rate, fps | 14.84 | 14.71 | 3 of 3 (slower) |
| Engine frame-interval p95, ms | 75.1 | 75.2 | 1 of 3 |
| GPU process private memory, MiB | 304.14 | 288.11 | 2 of 3 |
| All processes of the fresh browser, private MiB | 499.19 [495–513] | 483.49 [475–506] | 2 of 3 |

Machine load was 1.25–3% before every run. GPU-process CPU fell by 25.6% and
renderer CPU by 35.0%, in every pair. Both builds drew about 14.8 fps. The
memory medians are lower, but one pair went the other way and the per-run
values overlap. Treat memory here as variable.

### Forced quiet zones, three runs (`evidence/ab-chrome153-quiet-render-3run.json`, `-- --quiet-alpha 0.45`)

| Aurora, dense board | base | current | pairs where current was lower |
|---|---:|---:|---:|
| GPU process CPU, ms/s | 668.08 [565–742] | 549.46 [548–679] | 2 of 3 |
| Renderer process CPU, ms/s (all renderers) | 120.11 [103.4–132.2] | 109.90 [109.3–139.0] | 1 of 3 |
| JS time in `render()`, ms/frame | 1.16 | 0.67 | 3 of 3 |
| Quiet-zone sample paint, ms/frame | 0 | 0.44 | (current only) |
| Engine frame rate, fps | 29.91 | 29.82 | 2 of 3 |
| Quiet alpha max / nonzero solves per sample | 0.45 / 8 | 0.45 / 8 | identical |
| All processes of the fresh browser, private MiB | 508.45 | 503.90 | 3 of 3 |

Machine load was 1.25–3.25% before every run. Both builds took back the same
0.45 in every zone on every solve. The GPU-process median fell by 17.8%, but in
the first pair current was higher (678.65 against 668.08). Renderer CPU was
higher on current in two of three pairs (138.97 against 120.11, and 109.31
against 103.35), so the lower median is not a result. The memory difference is
under 1%.

### What differs between the builds

The direct product changes between base and current are:
- `quieten()` repaints a small CPU-backed scratch canvas to solve the quiet
  zones, instead of reading back the live canvas;
- the Aurora ribbon paths are clipped at their transparent gradient edge;
- the permanent layer-promotion hints on the canvas (`will-change`) and cards
  (`translate3d`) are removed;
- between budgeted frames the engine sleeps on a timer and asks for a vsync
  only shortly before a paint is due (`scheduleFrame()` in `background.js`).
  It no longer takes a callback on every vsync.

Current also contains the One page fit code with the switch off. These
sessions measured the changes together, so no share of the difference can be
attributed to any one of them.

## Results: final five-run session, Chrome 153.0.8010.53 (historical, probe frame loop)

This session used the default `--cadence raf`, so every figure includes the
probe's own vsync loop. It measured an older tree. Do not set its absolute
values beside the render-cadence sessions above.

Evidence: `evidence/ab-chrome153-final-5run.json` (written 2026-09-24 18:27 UTC). The Aurora
scene only (`--only aurora`), with five ABBA-interleaved runs per build, and the
same browser, board, viewport (2048 × 1152 at DPR 1.25), 2 s warmup and 8 s
samples as above. Base is `origin/main` 1537da4 (fingerprint `dc426a8b…`).
Current is the working tree at fingerprint `e5db7f7e…`, unchanged during the
runs. That tree differs from the earlier sessions' `101c58c3…`: besides the
performance changes, it includes the One page fit work (`page-fit.js`,
`page-fit.css`, and edits to `app.js`, `grid.js`, `boot.js` and others). The run
did not pass `--one-page-fit`, so One page fit was off on both builds.

Medians of five runs, recomputed from the per-run arrays in the file. Brackets
show the per-run range.

| Aurora, dense board | base | current | pairs where current was lower |
|---|---:|---:|---:|
| GPU process CPU, ms/s | 515.72 [408–523] | 453.37 [380–535] | 2 of 5 |
| JS time in `render()`, ms/frame | 0.94 [0.85–1.01] | 0.50 [0.48–0.62] | 5 of 5 |
| Renderer main-thread tasks, ms/s | 64.10 | 54.47 | 4 of 5 |
| Renderer process CPU, ms/s (all renderers) | 97.90 [92.5–103.3] | 104.98 [100.0–124.5] | 1 of 5 |
| Browser process CPU, ms/s (noisy, see Limits) | 79.78 | 90.08 | 0 of 5 |
| GPU process private memory, MiB | 304.95 | 297.32 | 2 of 5 |
| Page renderer private memory, MiB | 75.42 | 73.46 | 2 of 5 |
| All processes of the fresh browser, private MiB | 502.84 | 496.75 | 4 of 5 |
| Canvas frame rate, fps | 29.91 | 29.91 | flat |
| Frame-interval p95, ms | 8.6 | 8.5 | flat |

- **GPU CPU is directional only.** The median fell 12.1%, but that figure is
  not a measured effect. In three of the five interleaved pairs, current was
  higher: 534.66 against 515.72, 479.69 against 468.81, and 453.37 against
  408.11. The two pairs where current was lower differ by more (379.81 against
  523.16, and 401.84 against 521.69), and they carry the median. Machine load
  before each run was 5 / 0.75 / 14.25 / 5 / 1.75% for base and
  1 / 3.75 / 16.25 / 11.75 / 13.25% for current. Current started under more
  load in four of the five pairs. Two of those four pairs went each way, so load
  neither explains the spread nor cancels it.
- **JS render time is the one consistent win:** 0.94 → 0.50 ms/frame, lower in
  every pair. It is main-thread JS only. Current also spends 0.33 ms per
  quiet-zone sample frame (`scratchRenderMsPerFrame`), which base does not
  report separately, because base solves quiet zones inside `render()`.
- **Renderer CPU rose** from 97.90 to 104.98 ms/s, higher on current in four of
  five pairs. It sums every renderer process of the disposable browser. Spare
  renderers normally sit idle, but this file keeps no per-process split. The
  rise may come from the One page fit code being present with the switch off,
  or from the load difference. This session cannot tell them apart. The earlier
  three-run sessions were flat (88.6 → 88.5). The later render-cadence session
  above has renderer CPU lower in all five pairs. It differs in both cadence and
  tree, so it replaces this comparison but does not explain this rise.
- **Memory is flat within noise.** "Page renderer" is the single busiest
  renderer process, which is the new tab's (75.42 → 73.46 MiB). "All
  processes" sums every process of the fresh, disposable Chrome instance the
  probe launched, not the user's browser: the browser, GPU, renderer, utility and
  other processes (502.84 → 496.75 MiB). All four memory rows overlap across
  runs.

## Results: earlier three-run sessions, Chrome 153.0.8010.53, Windows 11, AMD Radeon 890M, on AC power (historical, probe frame loop)

Base is `origin/main` 1537da4. Current is the working tree of
`perf/windows-newtab` at the time (fingerprint `101c58c3…`, before the One page
fit work): the canvas sample repaint, the ribbon paint-area cut, and the removed
layer hints. Values are medians of three runs, and brackets show the per-run
range. Do not compare these absolute values with the five-run session above:
different tree, different session.

| Aurora, dense board | base | current | direction |
|---|---:|---:|---:|
| GPU process CPU, ms/s (quiet session) | 298 [295–339] | 240 [236–251] | lower; tree edited mid-session |
| GPU process CPU, ms/s (guarded session) | 431 [303–615] | 245 [237–315] | lower; base disturbed |
| GPU process CPU, ms/s (idle, 15 fps) | 225 [225–256] | 174 [161–177] | lower; 8–30% load on 4 of 6 runs |
| JS time in `render()`, ms/frame (quiet session) | 0.64 | 0.40 | lower |
| Canvas frame rate, fps | 30.0 | 30.0 | none |
| Renderer CPU, ms/s (quiet session) | 88.6 | 88.5 | flat |
| GPU / page renderer private memory, MiB | 299–315 / 73–75 | 290–324 / 72–78 | flat |

Paused and solid scenes with glass on: GPU private memory is about 15–20 MiB lower on every
run, from 206–216 down to 188–197 MiB, probably because the permanent layer
hints were removed. GPU and renderer CPU on those scenes shows no consistent
change: single runs jump by 20–30 ms/s in either direction, and the same scene
does not repeat between sessions. Display callbacks stay at about 120/s on both builds, with a median
frame-interval p95 of 8.5–9.2 ms in every scene. One disturbed current run
reached 12–12.5 ms on the solid scenes; the same scenes stayed at 9.0–9.2 ms in
the quiet session.

The quiet session is the cleanest data: machine load was 1.5–5.3% before every
run. During it, other work added one field initializer and some comments to
`background.js`, so its current fingerprint changed. Both sides of that edit
behave the same, but the session is kept under its own name. The guarded
session is the formally valid rerun on the settled tree (fingerprint
`101c58c3…`), but one base run started at 42.5% load and another, at 3%,
was disturbed partway through (615 ms/s). In the idle session, four of six
runs started at 8–30% load. All three sessions overlapped other benchmarks,
builds, or edits on the machine, so the per-session deltas are not a clean
measurement and no percentage is claimed from them. Current's median was lower
in each of these three sessions. In the raf-cadence five-run session above,
the pairs were split. The render-cadence sessions further up supersede both as
the current comparison.

## Limits

- **One browser only.** Compare only builds measured in the same browser
  version. Bundled Chromium 151 and installed Chrome 153 differ a great deal:
  151 drew Aurora at about 13 fps at 1920 × 1080.
- **Absolute numbers drift between sessions.** Base Aurora GPU CPU ran from
  298 to 431 ms/s across sessions on the same machine, and a single run reached
  615. Background load, thermals, and other browsers move it. Only interleaved
  pairs from one session are comparable. The earlier draft's 479 → 378 ms/s used
  3 s samples and a 0.4 s warmup, so do not set it beside these figures. Its
  direction agrees with them.
- **Headless.** The page is served over local HTTP as `newtab.html`, not
  `chrome-extension://`, with the board seeded in `localStorage`. The GPU is
  real (`gpu_compositing: enabled`), but the display is virtual: about 120
  callbacks/s, no occlusion. With the default `--cadence raf` those callbacks
  come from the probe's own loop, in every scene.
- **The extension path in Chrome 153 was not measured.** A real unpacked
  extension (`--extension`) passed a smoke run in Chromium 151: Aurora at
  30.7 fps, no page errors (`evidence/chromium151-extension-smoke.json`). The
  same run in installed Chrome 153 stalled. The likely cause is that branded
  Chrome no longer honours `--load-extension`; that was not verified here.
- **Background tabs are not a RAM proxy.** Headless reports every tab as
  visible, so three extension tabs all animate: 553 → 878 MiB total private.
  `--simulate-hidden` only overrides `document.hidden`. The engine stops, but
  Chrome keeps each canvas and its compositing (544 → 854 MiB), unlike a real
  background tab. See `evidence/chromium151-extension-3tabs*.json`.
- **What the counters mean.** Process CPU comes from CDP
  `SystemInfo.getProcessInfo`. Memory is Windows private bytes and working set,
  taken at the end of each scene. `render()` time is main-thread JS only; GPU
  work is asynchronous. Browser-process CPU is noisy and is not a basis for
  decisions. Settings and search are not exercised here; the UI tests cover them.
- **GPU-process CPU is not GPU utilization.** It is the CPU time of Chrome's
  GPU process, which issues the GPU work. The probe does not read GPU engine
  utilization, so no figure here states how busy the GPU itself was.
- **Private bytes are not GPU memory.** `gpuPrivateMiB` is the GPU process's
  Windows private bytes, and `totalPrivateMiB` sums private bytes over every
  process of the disposable browser. Neither is VRAM or shared GPU memory. No
  session here shows a robust RAM reduction.
- In the three-run evidence files, `current.path` is `..\..\..` because the
  runs were started from an isolated worktree against the main checkout. The
  five-run file was started from the main checkout, so it reads `.`.

## Evidence

| File | What |
|---|---|
| `evidence/ab-chrome153-raf-render-5run.json` | Current 5-run A/B, Aurora, `--cadence render --seed 7` (the name notwithstanding, not `raf`) |
| `evidence/ab-chrome153-idle-render-3run.json` | Current 3-run A/B, Aurora at the idle budget, `--cadence render --seed 7 --idle` |
| `evidence/ab-chrome153-quiet-render-3run.json` | Current 3-run A/B, Aurora, `--cadence render --seed 7 --quiet-alpha 0.45` |
| `evidence/fit-off-chrome153-960x540.json`, `evidence/fit-on-chrome153-960x540.json` | One page fit off / on, one run each at 960 × 540 |
| `evidence/ab-chrome153-final-5run.json` | Historical 5-run A/B (`raf` cadence), Aurora only, tree with One page fit code (switch off) |
| `evidence/ab-chrome153-dense.json` | Historical guarded 3-run A/B (`raf`), four scenes, settled tree |
| `evidence/ab-chrome153-dense-quiet-tree-touched.json` | Historical quiet 3-run A/B (`raf`), four scenes; comment-only edit mid-run |
| `evidence/ab-chrome153-dense-idle.json` | Historical guarded 3-run A/B (`raf`), Aurora at the idle budget |
| `evidence/chromium151-extension-*.json` | Real unpacked extension in Chromium 151: smoke, three tabs, simulated hidden |
