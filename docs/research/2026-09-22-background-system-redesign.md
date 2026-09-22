# Nordlys background system redesign

**Date:** 2026-09-22  
**Scope:** product and interaction direction for the app itself, not store artwork  
**Decision:** replace the top-level renderer picker with a curated, local-first
scene system. Keep user photos, videos and flat colour as a separate Personal
collection.

## Executive conclusion

The current choice — `Aurora / image / video / solid` — exposes implementation
types. It asks the user to know *how* a background is rendered before they can
choose *how they want the tab to feel*.

The stronger product model is:

> A **Scene** is a complete visual environment: artwork, palette, foreground
> treatment, material recipe, motion profile and a static accessibility state.

Nordlys should ship four unmistakably different scene families first, not a
large gallery of nearly identical gradients:

1. **Nordlys** — the existing aurora, rebuilt as the signature living-light
   family.
2. **Fjord** — a quiet horizon with a daylight cycle; broad planes, no stars or
   ribbons.
3. **Contour** — seeded topographic linework; graphic rather than atmospheric.
4. **Grain** — a still tonal field with tactile noise; the cheapest and calmest
   authored option.

Each family has 3–5 art-directed presets and remembers its own settings. The
normal interface exposes at most three controls: **Colour**, **Motion** and
**Atmosphere**. An Advanced disclosure can expose renderer-specific details.
Photos, video and a plain colour remain fully supported under **Personal**.

This respects the project's existing rule that a scene must be a genuinely
different kind of thing. The old gradients failed because they were minute
arrangements of the same pixels. The proposed families differ in visual
grammar, renderer, motion and emotional character; presets are deliberately
kept one level below them.

## What the market actually offers

| Product | Background model | Context / rotation | Foreground adaptation | Product lesson |
| --- | --- | --- | --- | --- |
| **Tabliss** | Unsplash, GIPHY, colour, gradients and uploads; search makes it an asset catalogue | Timed rotation and pause/resume on the dashboard | One luminosity control both reveals a light/dark page base and changes the foreground polarity | Breadth is discoverable, and pause belongs close to the result; the catalogue itself has little authored identity. [Official site](https://tabliss.io/), [2.6 release](https://tabliss.io/posts/tabliss-version-2-6.html), [privacy](https://tabliss.io/privacy.html) |
| **Bonjourr** | Curated photo/video collections, files, URLs and colour; blur, brightness and grain texture | Photos change by tab, hour, daylight period, day or pause | Text shadow and dark mode are separate controls | Time-of-day curation creates mood more effectively than an enormous static picker. Texture is a useful finishing layer, but the settings surface exposes many raw controls. [Official site](https://bonjourr.fr/), [settings reference](https://bonjourr.fr/docs/reference/settings-reference/), [live settings](https://online.bonjourr.fr/) |
| **nightTab** | Colour, gradient, remote image or video URL; very deep theme controls | Multiple URLs select a random image on load | Theme and background are powerful but largely user-coordinated | Playlists are valuable; asking people to host files and tune raw image parameters is power-user UX, not a polished default. [Official repository](https://github.com/zombieFox/nightTab), [background guide](https://github.com/zombieFox/nightTab/wiki/Setting-a-background-video-or-image) |
| **Momentum** | Curated daily photo, favourites and custom photos depending on plan | Daily editorial rotation | Photo Match chooses a complementary theme colour; custom hue, saturation, brightness and transparency preview immediately | The background should drive the interface palette automatically, while keeping overrides nondestructive. [Official product](https://momentumdash.com/), [theme and font help](https://get.momentumdash.help/hc/en-us/articles/360012372373-Theme-and-Font) |
| **macOS wallpaper** | Authored dynamic wallpapers, aerial categories, still pictures, colours and personal photos | Time-of-day light changes; shuffle intervals; light/dark still variants | The OS chooses the appropriate appearance | Categories and context are more legible than renderer names. Dynamic, light-still and dark-still variants are states of one work, not separate unrelated choices. [Apple wallpaper guide](https://support.apple.com/en-qa/guide/mac-help/mchlp3013/mac) |
| **Nordlys today** | One procedural Aurora plus local image, video and theme colour | Fixed | Theme supplies shader colours; glass is mostly one recipe | Strong signature and privacy, but the picker confuses one authored artwork with three media formats and offers no contextual behaviour. |

The opportunity is not to beat Tabliss at quantity. It is to become the first
new-tab product where generated backgrounds behave like an authored design
system rather than a folder of assets.

## Signals from designers and users

The most useful community feedback is consistent with the product evidence:

- In r/startpages, a minimal start page received immediate feedback that slow
  background changes and an initial white background made controls difficult to
  find. Background readiness and first-paint contrast are part of usability,
  not polish. [Discussion](https://www.reddit.com/r/startpages/comments/117kbdw)
- Another start-page critique specifically calls out white text becoming
  unreadable over bright images. Automatic foreground treatment is a baseline,
  not an advanced preference. [Discussion](https://www.reddit.com/r/startpages/comments/11owptb)
- A popular minimal page's solid-colour variants were explicitly liked even
  after image backgrounds were added. A quiet authored still option is not a
  fallback for weak hardware; it is a real aesthetic preference.
  [Discussion](https://www.reddit.com/r/startpages/comments/iwzqeb)
- A startpage with a 19 MB animated GIF was advised to crop, compress or use
  video. Users notice payload and delay long before they admire the animation.
  [Discussion](https://www.reddit.com/r/startpages/comments/n2tkx0)

These are qualitative signals, not representative research. They align with
the stronger primary-source pattern: reliable first paint, controlled motion,
legibility and good defaults matter more than the number of knobs.

## Visual references worth borrowing from — not copying

### Apple: contextual artwork and semantic material

Apple presents dynamic, still, aerial, colour and personal wallpapers as
recognisable categories. Dynamic artwork can follow time of day, while still
light and dark states remain available. That is a useful information
architecture for Nordlys.

Apple's materials guidance says material thickness should be chosen by semantic
role, not by whatever colour it happens to produce. Thicker material gives text
and fine details more contrast; thinner material preserves more background
context. Nordlys therefore should not apply one glass formula to search, cards,
menus and settings. The scene should provide a *material recipe*, and each
surface role should select an appropriate level from it.
[Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials)

### Material 3: source colour becomes semantic roles

Material's Dynamic Color derives a light and dark scheme from a wallpaper or
source colour, then assigns colours to semantic roles rather than scattering
sampled pixels directly through the interface. Its documentation stresses that
tokens give the system flexibility and consistency, and retain accessible
foreground/container pairings.
[Android Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3),
[Dynamic Color tokens](https://developer.android.com/develop/ui/views/theming/dynamic-colors)

Nordlys already has a stronger contrast solver than the surveyed competitors.
The missing piece is to make scene-derived colours inputs to that solver:

```text
scene palette -> tonal candidates -> semantic roles -> contrast solver -> UI
```

The artwork influences the interface, but never gets authority to make text
unreadable.

### Stripe and Vercel: one memorable visual, bounded by a fallback

Stripe describes choosing among CSS, SVG, Canvas, WebGL and images per effect,
with performance, accessibility and fallback options as part of the design
decision. Its later interactive globe project set a 60 fps target and was ready
to fall back to a static image; disabling antialiasing ultimately solved a
high-resolution performance problem.
[Stripe Connect](https://stripe.com/blog/connect-front-end-experience),
[Stripe globe](https://stripe.com/blog/globe)

Vercel's WebGL conference experience began with a specific visual metaphor — a
prism revealing light — before choosing effects. The lesson is that technology
should serve a recognisable concept, not become the concept.
[Vercel WebGL experience](https://vercel.com/blog/building-an-interactive-webgl-experience-in-next-js)

For Nordlys: spend the visual boldness on one full-screen scene. Keep clock,
search and bookmarks disciplined. Every animated family must ship with a
designed static frame rather than a generic solid fallback.

## Three product directions

### Direction A — Curated scene gallery (recommended)

```text
Background
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Nordlys  │ │ Fjord    │ │ Contour  │ │ Grain    │
│  live    │ │  calm    │ │  graphic │ │  still   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

Preset       Colour       Motion       Atmosphere
[ Boreal ▾ ] [ Auto  ◉ ]  [ Calm  ─● ] [ Quiet ─● ]

Personal:  Add photo   Add video   Plain colour
```

**Strengths:** clearest mental model, strongest identity, easy live preview,
bounded complexity, local/offline by default. It can grow one authored family
at a time without turning settings into a renderer control panel.

**Risk:** every new scene needs real art direction, performance work and a
static variant. That is healthy product pressure, not a defect.

### Direction B — One adaptive Nordic world

One continuous landscape changes with local time, light/dark mode and season.
The user chooses only `Natural / Cool / Warm`, motion and whether to follow
time.

**Strengths:** exceptionally coherent brand; almost no setup; each tab feels
connected to the day. It follows the best part of Bonjourr and macOS dynamic
wallpapers.

**Risk:** users who dislike the core aesthetic have nowhere to go. Seasonal and
geographic logic also increases test surface and can feel gimmicky when a user
wants a stable workspace.

### Direction C — Layer studio

Users compose a base, light field, texture and motion layer, then save/share a
recipe.

```text
Base        Light         Texture      Motion
Midnight  + Aurora veil + Fine grain + Drift
```

**Strengths:** genuinely powerful; recipes remain small and local; can build a
community ecosystem without hosting media.

**Risk:** recreates nightTab's configuration burden and pushes aesthetic
decisions back onto the user. A large combinatorial state space makes contrast,
performance and support much harder.

### Recommendation

Build **Direction A**, borrow the time-of-day option from **B**, and keep the
layer model of **C** internal. A scene author can compose layers in code, but a
normal user chooses an authored result. If later demand justifies a studio,
expose it under Advanced without changing the stored scene format.

## The authored families

| Family | Visual grammar | Renderer | User-facing controls | Static/reduced-motion state |
| --- | --- | --- | --- | --- |
| **Nordlys** | Soft light ribbons, sparse depth particles, broad off-centre composition | Existing 2D canvas, simplified into separable layers | Preset, colour mood, motion, atmosphere | Deterministic painted frame with no RAF loop |
| **Fjord** | Large horizon, reflected tonal band, restrained haze; no literal landscape illustration required | CSS gradients plus one small generated noise/SVG layer | Time (`Auto / Dawn / Day / Dusk / Night`), warmth, atmosphere | Exact time-state held; no parallax or animated blur |
| **Contour** | Seeded topographic isolines that create negative space around the hero | Generated SVG or Path2D cached once | Seed/preset, line weight, drift | Same generated map, fully still |
| **Grain** | Monochrome or duotone field with paper/film texture and a controlled vignette | Static CSS + small repeating noise asset or cached generated bitmap | Tone, texture, vignette | Identical; it is still by design |

Possible later family: **Current**, a restrained fluid field. Do not ship it in
the first pass. Fluid simulation is visually impressive but close enough to
Aurora in silhouette, and expensive enough, that it must prove distinctiveness
and battery cost in a prototype first.

## Interaction design

### Information architecture

Rename the section from a renderer-centric picker to:

```text
Background
  Scenes
  Personal
  Behaviour
  Advanced
```

- **Scenes** is the default view: large live-preview cards for the four
  families, then smaller preset chips for the selected family.
- **Personal** contains local photos, local video and plain colour. Upload is an
  action, not a permanent empty card.
- **Behaviour** contains `Fixed / New tab / Daily / Time of day`; only options
  supported by the selected scene are enabled.
- **Advanced** contains scene-specific controls, performance quality and manual
  interface-accent override.

### Live preview and commit

Hover/focus may preview a thumbnail, but clicking a scene applies it to the full
page immediately. Changes are optimistic and reversible:

- keep `Previous` available until settings closes;
- do not discard per-scene settings when switching;
- show `Reset this scene`, not one destructive global reset;
- keyboard focus and selection state must remain visible on every thumbnail;
- do not run four live canvases in the picker — thumbnails are static snapshots
  and only the selected scene runs.

### Friendly controls, not engine vocabulary

| Product label | Internal meaning |
| --- | --- |
| **Colour** | authored palette/preset or Auto |
| **Motion** | 0–1 family-specific speed/amplitude envelope |
| **Atmosphere** | family-specific visual density/contrast; never exposes raw particle counts |

Raw blur, particle count, noise scale and layer opacity are implementation
details. If an advanced control does not produce a clearly visible, safe
decision across its range, do not expose it.

### Automatic foreground treatment

Every scene publishes:

- `polarityHint` (`dark`, `light`, `auto`);
- 1–3 palette seeds;
- a `busyMap` or at minimum a preferred quiet region;
- semantic material levels for hero, search, cards, popovers and settings;
- foreground/accent candidates.

Nordlys then measures the rendered or representative frame and resolves final
tokens through the existing contrast solver. `Auto` is the default. A manual
accent is an override that persists independently of the scene and always goes
through the same safety check.

Photos need the strongest adaptation: sample a downscaled frame, estimate
luminance and local variance behind major UI regions, then choose light/dark
foreground and an appropriate scrim. Blur is optional aesthetics; a scrim is
the readability mechanism.

## Product architecture

### Stable data model

```js
scene: {
  id: "fjord",
  preset: "blue-hour",
  version: 1,
  params: {
    colour: "auto",
    motion: 0.25,
    atmosphere: 0.4,
    time: "auto"
  }
},
backgroundRotation: {
  mode: "fixed",       // fixed | new-tab | daily | time-of-day
  sceneIds: ["fjord"]
},
foreground: {
  accent: "auto",
  material: "auto"
}
```

Renderer-specific parameters belong in versioned scene definitions, not in the
top-level configuration. Unknown scene IDs must fall back to a deterministic
built-in scene without deleting the stored value, so restoring a removed or
temporarily unavailable scene remains possible.

### Scene contract

Each scene module should provide the same lifecycle:

```js
mount(surface)
apply({ preset, params, palette, reducedMotion, quality })
renderStatic()
start()
stop()
resize(viewport)
snapshot(size)
destroy()
```

`stop()` is mandatory on `document.hidden`. `renderStatic()` is mandatory for
reduced motion, picker thumbnails, tests and low-power fallback. This contract
lets CSS, SVG and Canvas scenes coexist without making `app.js` know their
implementation.

### Separate static and dynamic layers

MDN recommends pre-rendering repeated primitives, separating static from
frequently changing canvas layers, avoiding per-frame image scaling and
`shadowBlur`, and using `requestAnimationFrame`.
[Canvas optimisation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

For Nordlys:

- static texture, vignette and horizon layers should be CSS/SVG or cached
  bitmaps;
- only the smallest genuinely dynamic layer should redraw;
- animation must use the RAF timestamp so high-refresh screens do not increase
  speed;
- keep the existing DPR ceiling and visibility pause;
- measure scene cost on integrated and dedicated GPUs;
- a quality downgrade changes density/resolution, never the overall art
  direction.

An `OffscreenCanvas` worker is a later optimisation, not a prerequisite. Use it
only if profiling shows main-thread contention; the web platform supports
moving canvas work into a worker, but added architecture is not free.
[OffscreenCanvas guidance](https://web.dev/articles/offscreen-canvas)

### Accessibility and motion

Apple advises that motion be purposeful, optional and brief, and specifically
calls out parallax, animated blur, depth simulation and ongoing motion for
reduction or replacement. MDN describes `prefers-reduced-motion` as a request to
remove, reduce or replace nonessential motion; large panning and scaling are
common triggers.
[Apple Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion),
[Apple reduced-motion criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria),
[MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

Requirements:

- system reduced motion wins by default; an app control may reduce further but
  never silently force full motion;
- every family has a designed static composition, not a blank canvas;
- no full-field pointer parallax in the default profile;
- avoid continuous oscillation of high-contrast large forms;
- transition between scenes with a short opacity dissolve; no zoom or pan;
- motion never carries meaning unavailable in the still state;
- support reduced transparency with more opaque material roles where the media
  query is available, and keep a manual high-legibility option.

### Privacy

The differentiator should remain verifiable:

- built-in scenes and thumbnails ship with the extension;
- scene generation makes zero network requests;
- personal media remains in IndexedDB and object URLs are revoked;
- no cloud gallery in the first version;
- if a remote provider is added later, it is an explicit source with clear
  disclosure, not a background default. Tabliss's own privacy policy confirms
  that a search term must be sent to Unsplash when that external service is
  selected. [Tabliss privacy](https://tabliss.io/privacy.html)

## Delivery plan

### Phase 0 — measure before changing

- Record current first contentful paint, time to usable, idle CPU/GPU, memory
  and frame time on 1080p and high-DPI screens.
- Capture the current Aurora at motion `0 / 0.5 / 1` and verify the static frame
  exactly matches the first animated frame.
- Define a visual distinctness review: silhouettes at thumbnail size, greyscale
  separation and side-by-side user recognition. Do not use pixel-distance alone
  as a proxy for meaning.

### Phase 1 — scene shell, no new renderer

- Introduce the scene registry and lifecycle around current Aurora, Solid and
  Personal media.
- Replace the technical picker with Scenes / Personal / Behaviour.
- Preserve all legacy `bgMode`, motion and intensity values through migration.
- Add static thumbnails and per-scene remembered parameters.

### Phase 2 — authored launch set

- Rename current Aurora family to Nordlys and art-direct 3–5 presets.
- Build Grain first (cheap, static, validates mixed renderer support).
- Build Fjord second (validates time variants and palette adaptation).
- Build Contour third (validates cached procedural SVG/Path2D).
- Add adaptive foreground/material tokens and photo luminance sampling.

### Phase 3 — behaviour and hardening

- Fixed, daily and time-of-day modes; consider new-tab rotation only after
  confirming it does not make the workspace feel unstable.
- Accessibility matrix, keyboard tests and reduced-motion snapshots.
- Performance budgets and automatic quality tier.
- Import/export migration tests from every shipped schema.

### Explicit non-goals for this redesign

- no generative-AI wallpaper service;
- no mandatory Unsplash or other remote dependency;
- no public preset marketplace;
- no node/layer editor in the normal settings;
- no dozen gradient cards that differ only by blob position;
- no WebGL solely to make the implementation sound advanced.

## Acceptance criteria

The redesign is successful when:

1. a first-time user chooses a *mood* without learning renderer terminology;
2. each family is recognisable from a small greyscale thumbnail;
3. changing scene cannot produce unreadable clock, search or bookmark text;
4. reduced motion shows the same artistic idea without continuous animation;
5. a hidden tab schedules no scene frames;
6. all built-in scenes work fully offline and make zero network requests;
7. legacy backups preserve background intent through migration;
8. settings show no more than three primary scene controls;
9. the new default remains fast enough that the background never appears after
   the foreground shell;
10. Nordlys is identifiable from the background system without relying on a
    logo or a screenshot caption.

## Sources

### Products

- [Tabliss official site](https://tabliss.io/)
- [Tabliss 2.6 release](https://tabliss.io/posts/tabliss-version-2-6.html)
- [Tabliss privacy policy](https://tabliss.io/privacy.html)
- [Bonjourr official site](https://bonjourr.fr/)
- [Bonjourr settings reference](https://bonjourr.fr/docs/reference/settings-reference/)
- [nightTab official repository](https://github.com/zombieFox/nightTab)
- [nightTab background guide](https://github.com/zombieFox/nightTab/wiki/Setting-a-background-video-or-image)
- [Momentum official site](https://momentumdash.com/)
- [Momentum theme and font help](https://get.momentumdash.help/hc/en-us/articles/360012372373-Theme-and-Font)
- [Apple wallpaper guide](https://support.apple.com/en-qa/guide/mac-help/mchlp3013/mac)

### Design and engineering

- [Apple Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple reduced-motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)
- [Android Material 3 and Dynamic Color](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Android Dynamic Color tokens](https://developer.android.com/develop/ui/views/theming/dynamic-colors)
- [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN: `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)
- [web.dev: OffscreenCanvas](https://web.dev/articles/offscreen-canvas)
- [Stripe: Connect front-end experience](https://stripe.com/blog/connect-front-end-experience)
- [Stripe: interactive globe](https://stripe.com/blog/globe)
- [Vercel: interactive WebGL experience](https://vercel.com/blog/building-an-interactive-webgl-experience-in-next-js)

