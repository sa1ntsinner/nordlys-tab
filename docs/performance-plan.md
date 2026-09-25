# New-tab performance plan (Windows, 2026-09-24)

## Reproduction

`node tools/perf/ab.cjs` compares a clean `git archive` export of `origin/main`
with this working tree in the same installed Chrome. Each run uses a disposable
profile, the same board, viewport, device scale, and sample duration, and the
runs are interleaved. The probe (`tools/perf/newtab.cjs`) records the animated
scene, a paused scene, a solid scene, and a solid scene without glass. It
captures GPU, renderer, and browser process CPU and memory separately, because
Chrome's Task Manager groups many processes under the browser name. It does not
exercise settings or search; cover those with the UI tests. Exact commands,
evidence, and limits are in `tools/perf/README.md`.

The current comparison uses `--cadence render`: the probe runs no
`requestAnimationFrame` loop of its own, so only the page's own frames are
measured. Every earlier session used the probe's own loop (`--cadence raf`),
which requested a display frame on every vsync in every scene. Figures from the
two cadences are not directly comparable.

## Current result: page frames only (`--cadence render`)

Installed Chrome 153.0.8010.53, headless, 2048 × 1152 at DPR 1.25, the dense
board (nine folders, 28 links), 2 s warmup, 8 s Aurora samples, seeded meteors
(`--seed 7`), ABBA-interleaved runs. Base is `origin/main` 1537da4. Current is
the working tree at fingerprint `adbcc450…`, unchanged during every run. One
page fit was off on both builds. Figures are medians recomputed from the
per-run arrays; a pair is run *i* of base against run *i* of current.

**Normal Aurora, five runs**
(`tools/perf/evidence/ab-chrome153-raf-render-5run.json`):
- GPU-process CPU: 507.30 → 407.83 ms/s (−19.6%), lower in all five pairs.
- Renderer CPU, all renderer processes: 98.49 → 87.63 ms/s (−11.0%), lower in
  all five pairs.
- Frame rate 29.93 → 29.69 fps and frame-interval p95 34.3 → 35.2 ms. Current
  was slightly slower on both in four of five pairs. Intervals over 50 ms were
  0% median on both builds.
- Total private memory of the disposable Chrome: 502.63 → 505.69 MiB, flat.
- Machine load before the runs was 2.5–14.5%, higher for current in four of
  five pairs, so load does not explain current's lower CPU.

**Idle budget, 15 fps, three runs**
(`tools/perf/evidence/ab-chrome153-idle-render-3run.json`, `--idle`):
- GPU-process CPU: 445.45 → 331.45 ms/s (−25.6%), lower in all three pairs.
- Renderer CPU: 126.77 → 82.44 ms/s (−35.0%), lower in all three pairs.
- About 14.8 fps on both builds (14.84 → 14.71).
- Machine load was low: 1.25–3% before every run.
- Total private memory 499.19 → 483.49 MiB, but current was higher in one of
  three pairs and the per-run values overlap. Treat it as variable, not lower.

**Forced quiet zones, alpha 0.45, three runs**
(`tools/perf/evidence/ab-chrome153-quiet-render-3run.json`, `--quiet-alpha 0.45`):
- GPU-process CPU: 668.08 → 549.46 ms/s median (−17.8%), but current was higher
  in one of three pairs (678.65 against 668.08).
- Renderer CPU: 120.11 → 109.90 ms/s median, but current was higher in two of
  three pairs. Renderer CPU under forced quiet zones is therefore not settled.
- Both builds solved the same way: alpha 0.45 in every zone, eight nonzero
  solves per sample, about 29.9 fps (29.91 → 29.82).

The four direct product changes between base and current are:
- the quiet-zone solve repaints a small CPU-backed scratch canvas instead of
  reading back the live canvas;
- the Aurora ribbon paths are clipped at their transparent gradient edge;
- the permanent layer-promotion hints are removed from the canvas and cards;
- between budgeted frames the engine sleeps on a timer and asks for a vsync
  only shortly before a paint is due.

These sessions measured all four together. They cannot attribute any share of
the difference to one change. Current also contains the One page fit code,
switched off.

The limits apply to every figure above:
- **Test setup.** The page ran headless over local HTTP, not as the installed
  unpacked extension.
- **CPU, not GPU.** "GPU-process CPU" is CPU time of Chrome's GPU process, from
  CDP. It is not GPU engine utilization.
- **Memory.** Memory figures are Windows private bytes per process, summed
  across the disposable browser for the total. They are not GPU memory (VRAM).
- **No robust RAM reduction** is shown in any session.

## Earlier results: probe frame loop (`--cadence raf`), historical

These sessions are kept for the record. The probe's own frame loop added
compositor, GPU and renderer work to every scene. They measured older trees,
so they are not directly comparable with the result above.

The first 1920 × 1080 Windows probe in bundled Chromium 151 measured about
13 canvas frames/s in Aurora and about 59 display callbacks/s when the canvas
was paused. Pausing reduced renderer script time from about 97 to 3 ms/s. The
bundled browser and installed Chrome 153 differ substantially, so these figures
are diagnostic only.

Three interleaved 8-second sessions in installed Chrome 153 (tree `101c58c3…`,
before the timer wake and One page fit): median Aurora GPU-process CPU was lower
on current in each session, for example 298 → 240 ms/s in the quietest session
and 225 → 174 ms/s at the idle budget. The sessions overlapped other work on
the machine, and absolute values drifted by up to about 45% between sessions,
so no percentage was claimed.

A five-run session (`tools/perf/evidence/ab-chrome153-final-5run.json`, tree
`e5db7f7e…`) had split pairs:
- GPU-process CPU: 515.72 → 453.37 ms/s median, but current was higher in three
  of five pairs.
- Renderer CPU rose from 97.90 to 104.98 ms/s, higher in four of five pairs.

The render-cadence session above, on a later tree, has renderer CPU lower in
all five pairs. The two sessions differ in both cadence and tree, so it does
not explain the earlier rise. It does replace that session as the current
comparison.

`newtab.cjs --one-page-fit on|off` seeds that setting and reports the fit
(stage, zoom, scroll and client height, first-fit duration). It is off by
default, so it does not change any A/B above. At 960 × 540 in Chrome 153 the
dense board scrolled 1096 / 540 px with the switch off. With it on, the board
fitted at 540 / 540, at stage `scaled` and zoom 0.8261. The cold fit took
96.4 ms, from one run each (`tools/perf/evidence/fit-*-chrome153-960x540.json`).

## Findings and actions

1. **Canvas readback:** `solveQuiet()` read the live full-size canvas once a
   second to calculate text contrast. Chrome profiling attributed hundreds of
   milliseconds of startup time to this operation. *Done:* the same scene is
   drawn into a small CPU-backed sampling canvas, the live canvas is unchanged,
   and `tests/unit/quiet-zone.test.cjs` rejects live-canvas readback.
2. **Canvas paint area:** The Aurora ribbon paths covered pixels below their
   transparent gradient edge. *Done:* each path ends at that edge. It was not
   measured in isolation in Chrome 153, so its share of the A/B is unknown.
3. **Layer allocation:** *Done:* the permanent layer-promotion hints are removed
   from the canvas and cards. The glass blur is retained.
4. **Frame pacing and resolution:** *Done:* between budgeted frames the engine
   sleeps on a timer instead of taking vsync callbacks that paint nothing. The
   five-run session shows a small cost: 29.93 → 29.69 fps and a p95 of
   34.3 → 35.2 ms. No new device-scale cap was added.
5. **Startup:** Reprofile after the canvas fix. Optimize remaining work only
   where profiling shows a material cost; avoid large changes to the settings
   lifecycle for a small or unmeasured gain. No startup percentage is claimed:
   single-run startup timings vary.
6. **Silk, and every long stroked line (2026-09-25):** Silk lagged while the
   other scenes held 30 fps. On this machine it ran at 10–18 fps at
   1600 × 900, DPR 2 (canvas 2400 × 1350), with Chrome's GPU-process main thread
   saturated at about 1,100 ms/s. A per-variant bench, swapping `renderSilk`
   for copies that change one thing, put the cost on the size of each stroke's
   bounding box, not on the ink:
   - no strokes: 30 fps, 166–270 ms/s;
   - thin core only, or wide bloom only: about 44 ms of GPU-process time a
     frame each, the same, so stroke width is not the cost;
   - mitred or bevelled joins, flat colour instead of the gradient, no sheen,
     no depth fill: no change;
   - half the threads: half the cost; canvas at DPR 1 (0.44 × the pixels):
     0.46 × the cost;
   - each thread in sub-paths of 16, 8 or 4 segments: 57, 41 and 24 ms a frame;
   - hairlines (0.9 device px): 14 ms a frame, all scenery included.

   That is the signature of Ganesh (Skia Graphite is off here) falling back to
   its software path renderer for antialiased strokes too big for its GPU
   paths: a coverage mask for the whole bounding box, rasterised on the CPU and
   uploaded, for each of 180 strokes a frame. Contour was the same problem at a
   smaller scale: 15 full-window level paths stroked at 1–1.6 px held it at
   26.8 fps and about 990 ms/s. *Done:* both scenes draw their lines on a small
   WebGL2 layer (`src/js/sky-gl.js`): triangle strips, the passes as bands
   across one strip combined per pixel as the canvas blends them, laid onto
   the 2D canvas in one `drawImage`. Contour's marching-squares pieces are
   merged with `MAX` blending so they do not bead where they meet. A still, the
   quiet-zone sample and a browser without WebGL2 paint in 2D as before.
   Parity, as the eye gets it (canvas over the page colour): Silk mean |Δ| 0.14
   of 255, and fewer than 0.5 % of 2 × 2 patches differ by more than 4, in dark
   and light themes; Contour the same, with the same total light to within 3 %
   (`tests/ui/sky-gl.spec.cjs`, which fails when the bloom's alpha or the
   thread's fade is changed).

   **Silk, 3 ABBA runs, `origin/main` against this tree** (installed Chrome
   153, 1600 × 900, DPR 2, `--scene silk --only scene --cadence render --seed 7`,
   `tools/perf/evidence/ab-chrome153-silk-gl-3run.json`):

   | | base | current |
   |---|---:|---:|
   | frames a second | 25.4 | 29.9 |
   | render p95 | 45.1 ms | 34.3 ms |
   | GPU-process CPU | 1,126 ms/s | 171 ms/s (−85 %) |
   | renderer CPU | 60 ms/s | 93 ms/s (it draws 30 frames now, not 25) |
   | GPU-process private memory | 768 MiB | 219 MiB |

   **Every scene of this tree, 2 rounds of 5 s**, same settings and board:

   | scene | fps | GPU-process CPU | renderer CPU |
   |---|---:|---:|---:|
   | Nordlys (aurora) | 30.1 | 323 ms/s | 84 ms/s |
   | Polaris | 30.1 | 218 ms/s | 105 ms/s |
   | Halo | 30.1 | 227 ms/s | 80 ms/s |
   | Pillars | 29.9 | 252 ms/s | 108 ms/s |
   | Nacre | 30.1 | 243 ms/s | 116 ms/s |
   | Silk | 30.0 | 255 ms/s | 110 ms/s |
   | Baikal | 30.0 | 215 ms/s | 84 ms/s |
   | Contour | 29.9 | 219 ms/s | 149 ms/s |
   | Fjord | 29.9 | 212 ms/s | 73 ms/s |

   The four new scenes were built to that rule from the start (see
   `docs/design-system.md`, "A scene paints with what the GPU draws as it
   is"), and `tests/unit/scene-cost.test.cjs` holds every scene to it. Frost,
   which stroked its fronds in 16 full-window batches and held about 26 fps at
   1,000 ms/s, was retired; a stored Frost becomes Baikal.

## Acceptance checks

- Same-browser, same-board Windows A/B measurements show lower GPU CPU during
  motion, no material renderer CPU or memory regression, and no idle regression.
  *Status:* met for normal and idle Aurora in the headless render-cadence
  sessions, within the limits above. Under forced quiet zones the medians are
  lower but the pairs are split.
- Aurora and other scenes retain their palette, motion, and text contrast in
  dark and light themes, at normal and high device scale.
- Search, theme switching, settings, bookmark editing, reduced motion, and
  actual unpacked-extension behavior pass the relevant UI and unit tests.
- Screenshots at the same scene phase and viewport show no material loss of
  detail. Document any browser-dependent or test-fixture limitations.
