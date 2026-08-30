# State-of-the-art minimal interface design — decision brief for Nordlys

Scope: what published, credible 2020–2026 design work implies for a Chrome new-tab page
(clock, search, bookmark tiles in cards, themes, animated canvas). Written to be applied
directly to CSS and interaction code. Numbers are stated as decisions, with the source of
the number named. Where a widely repeated claim is weak, it is flagged as weak.

Two framings run through the whole document:

1. **A new-tab page is a glanceable surface, not an app.** It is opened 30–100× a day and
   looked at for 1–2 seconds. Anything that costs the user time on open costs them that
   time a hundred times.
2. **The current product's problem is not taste, it is variance.** An audit of `src/css`
   found 20 distinct `font-size` values (including `9.5px`, `10.5px`, `11.5px`, `12.5px`,
   `13.5px`, `14.5px`, `15.5px`), 15 distinct `border-radius` values (including both
   `999px` and `9999px`), 80 distinct `box-shadow` declarations, 42 `backdrop-filter`
   uses, 23 theme blocks, 22 distinct `--accent-glow` values, and six parallel custom
   property namespaces (`--nl-*`, `--glass-*`, `--card-*`, `--shader-*`, `--void*`, plus
   bare `--ink/--dim/--faint/--frost/--accent`). Nothing below fixes a taste problem. It
   fixes a *decision* problem: right now no one decided, so every file decided again.

---

## 1. Rules I would enforce

Each rule is checkable — you can grep for a violation or measure it. Rationale is one
line; the source of the number follows in brackets.

### Colour

**R1. Author every colour in OKLCH. Ship an sRGB hex fallback, generated, never hand-picked.**
Equal `L` in OKLCH means equal perceived lightness across hues; equal `L` in HSL does not,
which is why hand-built HSL ramps go muddy in the middle and neon at the ends.
[Ottosson's OKLab; Evil Martians, *OKLCH in CSS*. Linear migrated their theme engine from
HSL to LCH for exactly this reason.]

**R2. One 12-step ramp per colour role, with fixed step semantics.**
Steps 1–2 = page/subtle background · 3–5 = component background (rest / hover / active) ·
6–8 = borders (subtle / interactive / interactive-hover) · 9–10 = solid fill and its hover ·
11–12 = low-contrast and high-contrast text. If a value in the codebase is not a step, it
is a bug. [Radix Colors, *Understanding the scale*.]

**R3. No pure black and no pure white as a surface or as text.**
Dark base sits around OKLCH `L 0.15–0.19`; light base around `L 0.98`, not `1.0`. Pure
`#000` behind light text causes halation — the text appears to glow and vibrate — and it
is markedly worse on OLED and for the sizeable share of adults with astigmatism.
The repo currently sets `--ink: #ffffff` in three themes; that is step 12's job, not
`#fff`'s. [Halation/astigmatism literature; Material and Apple both avoid pure black.]

**R4. Neutrals are tinted, not neutral. Carry chroma 0.005–0.02 at (or near) the accent hue.**
A pure-grey chrome under a coloured accent reads as two unrelated products. Radix ships
`slate`/`sage`/`olive`/`sand`/`mauve` precisely so the neutral can be saturated toward the
accent; the effect is subtle per-pixel and large across a dense page.
[Radix Colors, *Composing a palette*.]

**R5. Dark-mode elevation is lightness, not shadow. +0.02 to +0.04 OKLCH `L` per step, four levels maximum.**
Shadows barely read on dark surfaces, so luminance is the only depth cue you have.
Levels: canvas → card → popover/menu → tooltip. Material expresses the same idea as a
white overlay: 1dp = 5 %, 2dp = 8 %, 8dp = 12 %, 24dp = 16 %.
[Material Design dark-theme elevation overlays.]

**R6. Reduce accent chroma by roughly 10–20 % in dark themes relative to light.**
Saturated colour on a dark ground blooms and fights the text. This is a per-theme
adjustment, not a global one.

**R7. Contrast targets: body text ≥ APCA Lc 75, secondary text ≥ Lc 60, decorative/disabled ≥ Lc 30 and never load-bearing. Certify against WCAG 2 4.5:1 as the legal floor.**
APCA predicts perceived readability across the range where WCAG 2's ratio is known to give
false passes near black and false failures in mid-tones. Radix guarantees step 11 ≥ Lc 60
and step 12 ≥ Lc 90 against step 2. APCA's own guidance: Lc 90 preferred for body text,
Lc 75 the minimum for columns of body text (≈18px/400), Lc 60 for non-body content text
(≈24px/400 or 16px/700), Lc 45 for large headlines (≈36px/400 or 24px/700).
[APCA documentation, *APCA in a Nutshell*; Radix Colors.]

**R8. Maximum one accent hue plus three semantic hues (success / warning / danger). No decorative colour.**
Vercel's Geist is a near-monochrome system — `#fafafa` canvas, `#171717` ink, hairline
borders, no marketing accent — and it reads as the most "designed" developer surface of
the last five years precisely because the colour budget is spent on nothing.
[Geist design system.]

### Typography

**R9. Nothing below 12px. 11px is permitted only for uppercase labels with added tracking. No fractional font sizes, ever.**
Apple's HIG floor is 11pt. A `12.5px` in a stylesheet is not a decision, it is a nudge that
nobody will be able to reproduce. [Apple HIG typography.]

**R10. Use a fixed, rounded step list — not a ratio.**
`12 / 13 / 14 / 16 / 20 / 24 / 32 / 48 / 72`. A 1.25ⁿ modular scale produces 12.8 / 16 /
20 / 25 / 31.25 — numbers that must then be rounded anyway, and the rounding destroys the
ratio's only claimed benefit. Ratios are a starting heuristic, not a system. Reserve fluid
`clamp()` for exactly one element (the clock).

**R11. `font-variant-numeric: tabular-nums` on the clock, and on every number that updates in place.**
Proportional digits are different widths, so a proportional clock shifts horizontally as
digits change — the eye re-fixates on every tick. One CSS property, no font swap, no
monospace compromise. [MDN, `font-variant-numeric`.]

**R12. Tracking is a function of size, applied from a table, never per-element.**
≥48px → `-0.025em` · 32–47px → `-0.02em` · 20–31px → `-0.01em` · 14–19px → `0` ·
12–13px → `+0.005em` · uppercase ≤11px → `+0.08em`. The *direction* of this curve is
universal across Apple's optical sizes, Material's type scale, and Geist (whose display
sizes run to −0.04em); the exact magnitudes are taste, so pick these and stop arguing.
Per-size em values quoted in secondary blog sources vary a lot — trust the direction, not
their numbers. [SF Pro Text/Display optical sizing; Material 3 type scale; Geist.]

**R13. Two weights in the product chrome. 400/450 for text, 600 for emphasis. No weight below 400.**
Sub-400 weights fail APCA at small sizes and look thin and cheap on Windows rendering,
which is your primary platform. To de-emphasise, use colour, not weight.
[Refactoring UI.]

**R14. Build hierarchy with weight and colour first, size last.**
The amateur move is to express every level of importance as a different size — which is
how a codebase ends up with 20 font sizes. Two sizes and three text colours cover most of
a dense UI. [Refactoring UI.]

**R15. Uppercase is legitimate in exactly one place: a ≤11px label that is never read as a sentence (section headers, unit suffixes, "PRO"). Always with tracking. Never for buttons, never for a word longer than about 12 characters.**
Uppercase removes ascender/descender word-shape cues, so reading slows; at label length
that cost is nil and the typographic gain is real.

**R16. Set `line-height` explicitly everywhere. 1.5 for paragraphs, 1.25–1.3 for headings, 1.0 for the clock.**
Inherited line-height is the most common source of "why is this card 3px taller than that one".

### Space and geometry

**R17. One spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. No other value appears in a margin, padding, or gap.**
8 divides cleanly into 1×/1.5×/2×/3× device-pixel ratios, and 4 is the half-step for dense
controls. The value of the scale is not the numbers, it is that the scale is *closed*.
[Material's 8dp baseline / 4dp subdivision, in general use since 2014.]

**R18. Four radii plus one pill: 6 / 10 / 14 / 20 / 9999px. Nested radius follows `inner = outer − padding`, clamped at 0.**
Concentric corners share an arc centre; equal inner and outer radii do not, and the inner
corner visibly bulges. Express it as
`border-radius: max(0px, calc(var(--r-card) - var(--pad)))`.
[The concentric radius rule, `r = R − p`; Cloud Four.]

**R19. Optical alignment is applied only to asymmetric glyphs, by 3–6 % of the icon box, and to nothing else.**
A play triangle inside a circle needs the nudge; a plus, a gear, and a square do not, and
nudging them makes it worse. Cap-height alignment, not bounding-box alignment, for text
inside buttons.

**R20. One icon grid: 24px box, 2px stroke, one cap style, one join style, one corner radius, across every icon in the product.**
Mixed stroke weights between icon sets is the single most visible "assembled from parts"
tell, and it survives every other improvement you make. Emoji and vector icons never sit
in the same row. [Material 3 icon design; standard iconography practice.]

### Motion

**R21. Exactly three durations: 120ms / 200ms / 320ms.**
120 = state change on an element already on screen (hover, toggle, focus ring).
200 = something appears or disappears in place (menu, tooltip, tile insert).
320 = a panel that travels (settings drawer). Nothing exceeds 320ms without a written
reason. Carbon's production scale sits at 70 / 110 / 150 / 240 / 400 / 700ms with 400ms+
reserved for "large expansion" and background dimming; Material's tokens run to 600ms
because they are calibrated for *full-screen phone* transitions, which you do not have.
[Carbon `@carbon/motion` duration tokens; Material 3 motion tokens.]

**R22. Exactly two easing curves, plus one overshoot used at most once per screen.**
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for anything entering or leaving.
`--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for something moving on screen.
Overshoot (`cubic-bezier(0.2, 0.9, 0.3, 1.25)`) is a garnish; the moment it is on three
elements it reads as a template. CSS's built-in `ease`/`ease-out` are too weak to register
as intentional. [Emil Kowalski, animation standards; Material's `emphasized` family is the
same two-curve idea, at `cubic-bezier(0.2, 0, 0, 1)` and `cubic-bezier(0.05, 0.7, 0.1, 1)`.]

**R23. Never `ease-in` on UI that is entering. Never animate `blur()` radius, `width`, `height`, `top`, or `left`. Never `transition: all`.**
`ease-in` starts slow, which is exactly the moment the user is watching, so a 200ms
`ease-in` *feels* slower than a 200ms `ease-out`. Animating blur radius re-triggers GPU
compositing every frame. Scale in from 0.95–0.97, never from `scale(0)`.
[Emil Kowalski.]

**R24. Feedback within 100ms; anything that will take longer than 1s must show that it is working.**
0.1s is the limit for the interface feeling directly manipulated; 1s is the limit for
uninterrupted flow. These are the two motion-adjacent numbers that actually have a
citation. [Nielsen, *Response Time Limits*, after Miller 1968.]

**R25. `prefers-reduced-motion: reduce` keeps opacity and colour transitions, drops every transform, parallax, and the canvas animation entirely.**
Reduced motion does not mean no motion; a 120ms crossfade is not vestibular. What must go
is translation, scale, and continuous background movement. Gate hover-only flourishes
behind `@media (hover: hover) and (pointer: fine)` while you are there.
[Smashing Magazine, *Designing With Reduced Motion*; MDN.]

### Translucency ("glass")

**R26. Glass is permitted over a background you control. Over user imagery it requires a scrim, always.**
The scrim is a solid or gradient layer, not more blur. 40–60 % black is the working range
for white text over arbitrary photography. [NN/g, *Ensure High Contrast for Text Over
Images*; Material scrim guidance.]

**R27. One glass level in the entire product. Glass never nests inside glass.**
Stacked materials compound the contrast loss and destroy the depth cue they were meant to
provide — this is the concrete mechanism behind the iOS 26 legibility complaints. Apple's
own guidance requires vibrant foreground colours *on* a material, one material at a time,
and content-first hierarchy. [Apple HIG Materials; NN/g, *Liquid Glass Is Cracked*.]

**R28. Text on glass is measured against the lightest pixel that can appear behind it, and must still clear Lc 60.**
If you cannot guarantee that, the surface is not glass, it is a tinted panel — which is
fine, and cheaper. Blur cost scales with radius and with area, and the browser re-blurs
whenever the content behind it changes; with a *live animated canvas* behind it, that is
every frame.

**R29. One blur radius and at most two filter functions.**
Reaching for `saturate(190%) contrast(94%) brightness(106%)` means you are colour-correcting
your way to a colour you should have declared. Four stacked filter functions make the
resulting text colour a function of the user's wallpaper, which is not a thing you can test.

---

## 2. Where the reference systems genuinely disagree

### APCA vs WCAG 2 contrast

Radix, the Washington Post design system, and most colour tooling built after 2021 target
APCA. WCAG 2.2 (4.5:1) remains the only thing with legal standing, and APCA is still not
normative — the WCAG 3 work it belongs to has been in draft for years and the peer-review
thread is contentious.

**Which is better argued:** APCA, on the substance. WCAG 2's ratio ignores font weight and
size entirely, and its behaviour near black is known to be wrong — it will pass
combinations that are unreadable in dark mode and fail combinations that read fine. But
"better model" is not "safe to ship alone."

**What I would do:** design to APCA, then verify nothing regresses below WCAG 2 AA, and
when they disagree take whichever is stricter. For this product that means the dark themes
get audited by APCA (where WCAG 2 is least trustworthy) and the light themes get the WCAG
check as a formality.

### Perceptually-uniform ramps vs hand-tuned ramps

Evil Martians' position — increment `L` linearly and you get an even scale — is true and
also produces slightly lifeless palettes, because chroma must *fall* at both ends of a real
ramp (near-white and near-black cannot hold chroma). Radix's ramps are explicitly not
uniform-`L`; they are hand-tuned per step, and Radix says outright that customising them
breaks the guarantees.

**Which is better argued:** Radix. Uniformity is a tool for *generating a first draft*, not
a description of a good palette. The end steps need hand correction.

**What I would do:** generate in OKLCH, then hand-correct steps 1, 2, 11, 12 against APCA
and freeze the result as literal values. Do not ship a runtime `calc()` colour engine —
which is effectively what "23 themes × 22 accent glows" already is, and it is why they
don't agree with each other.

### Material 3 Expressive vs the Vercel/Linear restraint school

Google claims 46 studies, 18,000 participants, key UI elements identified "up to four times
faster" with expressive designs, and 87 % preference among 18–24s. Vercel and Linear went
the other way: monochrome, hairline, tighter, quieter.

**Which is better argued:** neither cleanly, but Google's numbers should be treated as
marketing until the studies are published. "Four times faster to find a UI element" is not
evaluable without the stimulus set, and the comparison baseline is Google's own previous
design. The restraint school has no numbers at all — it has a track record.

**What I would do:** the real split is not expressive-vs-restrained, it is *where*.
Expressive where the eye lands in the first 300ms (the clock, the tile grid, the theme's
colour identity). Restrained everywhere the user has to work (settings, editing, forms).
A new tab page is one screen containing both, which is exactly why it currently reads as
two products stapled together.

### Motion duration: Material's 300–600ms vs the sub-300ms school

Material 3's `medium`/`long` tokens go to 400–600ms. Emil Kowalski's guidance, Linear's
feel, and Carbon's *productive* mode all live under 300ms.

**Which is better argued:** the sub-300ms school, decisively, for this product. Material's
longer tokens are calibrated for full-screen transitions on a phone, where the travelled
distance is large and the transition carries navigational meaning. On a desktop start page
nothing travels far and nothing needs explaining. Carbon's "duration scales with distance"
rule is the honest reconciliation: both camps are right about their own distances.

### Spring vs cubic-bezier

Springs are physically correct and interruptible; cubic-beziers are declarative, cheap, and
native to CSS.

**What I would do:** cubic-bezier for everything that is not gesture-driven. A spring's real
advantage is that it can be interrupted mid-flight and retarget gracefully — you have no
drags and no gestures, so you would be paying a JS runtime for a property you never use.
(If tile drag-to-reorder ships, that one interaction earns a spring.)

### Glass: Apple's HIG vs the 2024–25 backlash

Apple's Materials guidance says translucency creates depth and hierarchy, and that vibrancy
keeps foreground content legible. NN/g's analysis of iOS 26 documents text over images at
inadequate contrast, icons lost in map backgrounds, shrunken touch targets, and controls
animating for no informational reason.

**Which is better argued:** the critics — and Apple effectively conceded, shipping a
"Tinted" mode in iOS 26.1 that flattens the effect. Note *what* Apple's own guidance
actually requires: system vibrant colours on top of materials, one material at a time,
content-first hierarchy. Most third-party "liquid glass" — including this codebase's
`liquid-glass.css` — copies the visual effect and skips all three conditions.

### Pure black on OLED

Battery saving vs halation. **Halation wins** for a surface you stare at. A start page is on
screen for two seconds at a time; the battery delta is noise, the readability delta is not.

### Claims I would treat as unsupported

- **The "Doherty threshold" (400ms).** Real paper (Doherty & Thadani, IBM Systems Journal,
  1982), real finding — about *mainframe command response* and operator productivity. It
  says nothing about how long a menu should take to open. It is cited constantly as an
  animation-duration rule; it does not support one.
- **"Dark mode reduces eye strain."** The controlled evidence mostly runs the other way for
  text-heavy reading, and roughly a third of adults have some astigmatism, for whom light
  text on dark is measurably harder. Dark mode is a preference and an aesthetic, both
  entirely legitimate. Don't put the health claim in the store listing.
- **"Users judge a site in 50ms."** Real study (Lindgaard et al.) about *aesthetic*
  judgement, routinely stretched into claims about usability and trust.
- **Material 3 Expressive's "4× faster."** Unpublished, vendor-internal, baseline is their
  own prior design.

---

## 3. Specifically for a new-tab / start page

The defining constraint: **this page is opened dozens of times a day and looked at for about
two seconds.** That inverts several normal priorities.

**The cost of everything is multiplied by fifty.** A 320ms entrance animation is sixteen
seconds of the user's day spent watching the page assemble itself. **Entrance animation on
the page itself should be zero.** The page should appear *already arrived*. Motion belongs
to interactions the user initiates (opening settings, dragging a tile), not to arrival.

**A white flash before the dark theme paints is the single worst defect this product can
have,** because it is a physical discomfort delivered dozens of times a day. Set the theme
background on `<html>` in inline critical CSS in `newtab.html`, before any stylesheet link,
and read the persisted theme synchronously. Nothing else in this brief matters as much.

**Layout must be stable before content loads.** Tiles reserve their final box; favicons fade
in *inside* an already-correct box. A grid that reflows when icons resolve is the same
defect as the white flash, in slower motion.

**Position is the memory, not the label.** After a week the user is not reading tile names —
they are hitting a coordinate. Consequences: tile order must be stable across sessions and
across window widths (beware a responsive reflow that reorders), and any "most visited"
auto-ordering is actively harmful unless it is opt-in. Preattentive processing resolves
colour and position in well under 250ms; text takes longer. **Favicon colour and grid
position are the real interface** — which also means favicon quality and consistent icon
sizing matter more than any card treatment around them.

**Don't rebuild the omnibox.** Chrome focuses the address bar when a new tab opens, and has
restricted new-tab-override extensions from stealing that focus since Chrome 27; an
autofocused search field in the page either loses the race or fights the user's muscle
memory. Either drop the in-page search field, or make it do something the omnibox cannot
(search *within* bookmarks, filter tiles as you type) and bind a key to focus it rather than
autofocusing. Verify the current behaviour empirically before changing it — the Chromium
issue history here is messy.

**The clock is the only element read passively — treat it as the typographic subject.**
Tabular figures (R11), `line-height: 1`, one fluid `clamp()`, and **seconds off by default.**
A ticking second display is peripheral motion in a page you have open constantly; it is the
animation equivalent of a dripping tap. Offer it, don't default to it.

**The animated canvas needs a budget and three kill switches.** Pause on
`document.visibilitychange` (a background tab must cost 0 % CPU), disable under
`prefers-reduced-motion`, and offer a static-image fallback. Cap it well below 60fps — a
slow gradient field at 30fps is indistinguishable and halves the cost. Critically:
**anything animated behind text forces `backdrop-filter` to re-blur every frame.** If you
keep both the live canvas and the glass cards, put a static, opaque-enough scrim between
them so the blur samples a still layer — or drop the blur and use a tinted panel (R28).

**Tiles are Fitts targets.** ≥40px hit box (the existing `--nl-target-min: 40px` is right;
WCAG 2.2 AA floor is 24×24 CSS px, Apple recommends 44pt, Material 48dp). Gap between tiles
smaller than the tile itself (so they group), never below 8px (so they don't misfire). Gaps
*between* groups larger than gaps *within* a group — let proximity do the grouping, and the
card backgrounds and borders can then be far quieter than they currently are. That single
change removes most of the need for glass.

**Themes need a spine, not a catalogue.** 23 theme blocks each defining ~22 raw values is 23
chances to disagree. Linear reduced 98 variables per theme to **three inputs: base colour,
accent colour, contrast** and generated the rest in LCH. That is the model to copy. It also
yields a better feature: users get *their* colour instead of your list of twenty-three.

**The settings panel should hide the machinery.** Exposing `--glass-saturate`,
`--glass-contrast: 94%`, and `--glass-brightness: 106%` as user sliders is not
configurability, it is an unmade decision handed to the user — and it guarantees some users
will drive themselves into unreadable states. Progressive disclosure: one visible tier
(theme, accent, density, what's shown), one "Advanced" tier for the rest, nothing that can
produce a broken result without a reset path. macOS and Windows system preferences are the
canonical example of that split.

---

## 4. Traps — things that look sophisticated and are amateur tells

Ranked. The top of the list is what makes a product read as "several different hands,"
which is the stated problem.

1. **Fractional font sizes.** `12.5px`, `11.5px`, `10.5px`, `9.5px` all appear in this
   codebase. Nothing is a half-pixel on purpose. These are the fossil record of someone
   nudging a value until one screen looked right. Round to the scale; if the scale is
   wrong, change the scale.
2. **A shadow vocabulary instead of a shadow scale.** 80 distinct `box-shadow` declarations.
   Real systems ship three or four. Every extra shadow is a different implied light source.
3. **Multiple, contradictory light models on one element.** The current card has a top inset
   white "specular" rim, a bottom inset dark line, *and* a 70px drop shadow. That is a light
   above, a light below, and a light in front, simultaneously. Pick one direction (top-left
   is the convention) and make every shadow and rim obey it.
4. **Two token systems living in the same file.** `--nl-*` aliasing to bare `--ink` / `--dim`
   / `--glass` / `--void` means every value has two names and two owners. One namespace.
   Delete the other; don't alias it.
5. **Naming another company's material in your source.** A header reading "AUTHENTIC APPLE
   iOS 18 & macOS FROSTED / LIQUID GLASS DESIGN SYSTEM", with theme keys `liquid-glass`,
   `liquid-tahoe`, and `frosted-glass` all pointing at the same rules, is three generations
   of borrowed vocabulary in one file. It also names the thing you will be compared against
   and lose to. Name your materials after what they do.
6. **Coloured glows.** 22 distinct `--accent-glow` values. A saturated halo around a focused
   or hovered element is the fastest possible signal of a 2013 dashboard template. Use a
   crisp ring (`outline` + `outline-offset`), not a bloom.
7. **Gradient text.** `background-clip: text` on a headline. It defeats subpixel rendering,
   it fails at small sizes, and on a page that already has a gradient background it is the
   second gradient competing with the first.
8. **Overshoot easing used as the default.** Bounce reads as delightful once and as
   unserious on the fifth repetition of the day.
9. **`999px` and `9999px` in the same codebase.** Both mean "pill." Having both means nobody
   owns the file.
10. **Stacking filter functions to correct a colour.** `saturate(190%) contrast(94%)
    brightness(106%)` is four knobs approximating a colour you could have declared once. It
    also makes your text contrast a function of the user's wallpaper.
11. **Border + background + shadow all separating the same two surfaces.** Pick one
    separation mechanism per boundary. On dark surfaces it is usually lightness (R5); on
    light surfaces usually a hairline border.
12. **Blur as the answer to "the background is too busy."** The correct answer is a scrim or
    a quieter background. Blur is expensive, it re-blurs on every frame of your canvas, and
    it does not actually guarantee contrast.
13. **`letter-spacing` on body text.** Tracking is for display sizes and small caps. Positive
    tracking on 14px body type is the most common "designed by a developer" signal there is.
14. **Themes that differ only by accent hue.** If two themes differ by four hex values they
    aren't two themes, they are one theme with a colour picker — which is the better product
    anyway.
15. **Everything centred.** Centred blocks share no edge, so nothing aligns to anything.
    Centre the clock; left-align the rest of the composition and let the grid do the work.
16. **Emoji standing in for icons.** They render differently on every platform, they don't
    inherit `currentColor`, and one emoji beside one vector icon destroys the illusion that a
    system exists.
17. **Animating on page load.** See §3. On a page opened fifty times a day it is not a
    flourish, it is a tax.
18. **Pure `#ffffff` text and pure `#000000` surfaces.** See R3. It is what anyone reaches
    for who has not decided on a ramp.
19. **Settings that expose CSS variables.** A "Glass contrast: 94 %" slider is a design
    decision escaping into the UI.
20. **A "custom CSS" escape hatch used to paper over an unsettled system.** A legitimate
    power-user feature; not a substitute for the system agreeing with itself. Ship it
    *after* the tokens are frozen, not instead of freezing them.

---

## 5. Sources

**Colour**
- Radix Colors — Understanding the scale: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Radix Colors — Composing a palette (tinted greys): https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette
- Radix Colors — Scales: https://www.radix-ui.com/colors/docs/palette-composition/scales
- Evil Martians — OKLCH in CSS: why we moved from RGB and HSL: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- Stripe — Designing accessible color systems: https://stripe.com/blog/accessible-color-systems
- Linear — How we redesigned the Linear UI (HSL→LCH; 98 variables → 3): https://linear.app/now/how-we-redesigned-the-linear-ui
- Vercel Geist — Introduction: https://vercel.com/geist/introduction

**Contrast**
- APCA in a Nutshell (Lc thresholds by size and weight): https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html
- Why APCA as a New Contrast Method: https://git.apcacontrast.com/documentation/WhyAPCA.html
- WCAG 2 vs APCA — a contrast in applied maths (Myndex): https://gist.github.com/Myndex/069a4079b0de2930e72d5401bde9af98
- W3C WCAG 3 issue #29 — APCA peer reviews (the dispute, live): https://github.com/w3c/wcag3/issues/29
- NN/g — Ensure high contrast for text over images: https://www.nngroup.com/articles/text-over-images/
- Smashing — Designing accessible text over images: https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/

**Typography**
- Apple HIG — Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple WWDC20 — The details of UI typography (optical sizes, tracking): https://developer.apple.com/videos/play/wwdc2020/10175/
- MDN — `font-variant-numeric`: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Material 3 — Type scale tokens: https://m3.material.io/styles/typography/type-scale-tokens
- Refactoring UI (Wathan & Schoger) — hierarchy via weight and colour: https://www.refactoringui.com/

**Motion**
- Material 3 — Easing and duration tokens: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Material Components Android — Motion tokens (exact ms and bezier values): https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md
- Carbon Design System — Motion: https://carbondesignsystem.com/elements/motion/overview/
- Emil Kowalski — animation standards (durations, curves, "never ease-in"): https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md
- Emil Kowalski — Animations on the Web: https://animations.dev/
- NN/g — Response time limits (0.1s / 1s / 10s): https://www.nngroup.com/articles/response-times-3-important-limits/
- Smashing — Designing with reduced motion for motion sensitivities: https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/
- MDN — `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- The Doherty threshold, critiqued: https://www.flashover.blog/posts/dohertys-threshold-is-a-lie/ · https://news.ycombinator.com/item?id=24031938

**Materials and glass**
- Apple HIG — Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- NN/g — Liquid Glass is cracked, and usability suffers in iOS 26: https://www.nngroup.com/articles/liquid-glass/
- MacRumors — iOS 26 Liquid Glass criticism: https://www.macrumors.com/2025/09/17/ios-26-liquid-glass-critiques/
- MDN — `backdrop-filter`: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- Mozilla bug 1718471 — backdrop-filter blur is laggy with many elements: https://bugzilla.mozilla.org/show_bug.cgi?id=1718471

**Layout, density, icons**
- Material 3 — Designing icons (grid, keylines, stroke weight): https://m3.material.io/styles/icons/designing-icons
- Design Systems — A complete guide to iconography: https://www.designsystems.com/iconography-guide/
- Cloud Four — The math behind nesting rounded corners: https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/
- WCAG 2.2 SC 2.5.8 Target Size (Minimum), 24×24: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Utopia — fluid type and space scales: https://utopia.fyi/

**Progressive disclosure and glanceability**
- NN/g — Progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Google Design — Expressive Material Design research (the 46-study claim): https://design.google/library/expressive-material-design-google-research

**Platform specifics**
- Chromium issue 40313398 — omnibox focus and new-tab-override extensions: https://issues.chromium.org/issues/40313398
- chromium-extensions — Focus on override newtab's search: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/abJf8SLWMSM
