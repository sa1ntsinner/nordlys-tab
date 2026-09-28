---
name: Nordlys website
description: The public website of Nordlys, a free new-tab extension, drawn as a star atlas over the product's own live sky.
colors:
  lamp: "#ff6a4d"
  lamp-hover: "#ff8166"
  lamp-ink: "#1c0802"
  plate: "#07080c"
  plate-2: "#0d0f15"
  ink: "#e9e4d4"
  ink-2: "rgb(233 228 212 / 0.76)"
  ink-3: "rgb(233 228 212 / 0.6)"
  hair: "rgb(233 228 212 / 0.14)"
  hair-2: "rgb(233 228 212 / 0.26)"
  frame-black: "#000000"
  starlight: "#ffffff"
  shader-1: "#35d6c0"
  shader-2: "#5b6cff"
  shader-3: "#9d4edd"
typography:
  display:
    fontFamily: '"Bodoni Moda", "Bodoni 72", Didot, serif'
    fontSize: "clamp(3.4rem, 7vw, 6rem)"
    fontWeight: 500
    lineHeight: 0.9
    letterSpacing: "0.07em"
  plate-title:
    fontFamily: '"Bodoni Moda", "Bodoni 72", Didot, serif'
    fontSize: "clamp(2.2rem, 5vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
  headline:
    fontFamily: '"Bodoni Moda", "Bodoni 72", Didot, serif'
    fontSize: "clamp(2.3rem, 4.2vw, 3.8rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"Bodoni Moda", "Bodoni 72", Didot, serif'
    fontSize: "clamp(1.7rem, 2.5vw, 2.35rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  entry:
    fontFamily: '"Bodoni Moda", "Bodoni 72", Didot, serif'
    fontSize: "1.6rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "clamp(1.3rem, 1.9vw, 1.7rem)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.012em"
  question:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
  lead:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.02em"
    fontFeature: '"tnum"'
  button:
    fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 650
    letterSpacing: "0"
rounded:
  focus: "4px"
  control: "10px"
  frame: "14px"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 5vw, 76px)"
  nav-h: "68px"
  stack: "1rem"
  row: "22px"
  block-sm: "6vh"
  block: "8vh"
  section: "20vh"
components:
  button-lamp:
    backgroundColor: "{colors.lamp}"
    textColor: "{colors.lamp-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 1.45rem"
    height: "48px"
  button-lamp-hover:
    backgroundColor: "{colors.lamp-hover}"
  button-lamp-small:
    padding: "0 1.05rem"
    height: "38px"
  button-lamp-big:
    padding: "0 2.1rem"
    height: "60px"
  button-lamp-unlit:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0"
    height: "44px"
  button-pill:
    backgroundColor: "rgb(7 8 12 / 0.82)"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "40px"
  button-pill-small:
    backgroundColor: "rgb(7 8 12 / 0.7)"
    typography: "{typography.caption}"
    padding: "0 0.9rem"
    height: "36px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 0.95rem"
    height: "36px"
  tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
  select:
    backgroundColor: "{colors.plate-2}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 2.1rem 0 0.8rem"
    height: "38px"
  button-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 0.9rem"
    height: "38px"
  frame:
    backgroundColor: "{colors.frame-black}"
    rounded: "{rounded.frame}"
  header:
    backgroundColor: "transparent"
    height: "{spacing.nav-h}"
    padding: "0 clamp(20px, 5vw, 76px)"
  header-solid:
    backgroundColor: "{colors.plate}"
  nav-link:
    textColor: "{colors.ink-2}"
    typography: "{typography.small}"
  nav-link-hover:
    textColor: "{colors.ink}"
  readout:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  skip-link:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
---

# Design System: Nordlys website

## Overview

**Creative North Star: "The Star Atlas"**

The website is drawn as a star atlas over the product's own sky. Behind the whole page, on a fixed canvas, runs the extension's real sky engine; the page is the chart printed over it in ivory ink and hairlines: a graticule and an hour ring around a circular window in the opening, constellation lines for the visitor's sites, ruled lines between the entries of a catalogue. The nine skies are nine numbered plates, I to IX, each shown across the whole screen. The page's own colours are plate black and ivory, with one lamp red for the main action and for whatever is live; the rest of the colour on screen comes from the sky, and from the product itself in the demo and the film.

Density is low. Most sections are at least a screen tall and carry one idea, with text kept to a short measure so the sky has room. Two grounds alternate down the page: sky sections, where the page is clear and the sky shows through, and plate sections, solid plate black under a hairline rule, for reading and for the live demo. Nothing is raised on cards; words over the sky are made readable by darkening the sky under them. The live demo embedded in the page is the product itself and keeps its own design; this document covers the website around it.

Motion is authored once and tied to the scroll. On arrival the window opens and the ring's ticks come round; scrolling on, the window widens until the sky fills the page, the constellations draw themselves, and on a computer the stars fly into the real new tab, which then settles into its frame beside the demo's chapters. Plates change through a short dip to black. State changes are quick and plain: colour over 0.2 to 0.4s with a plain ease, movement on one ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)). With reduced motion, everything rests in its final state. The direction for this build refused the usual dark product page, with its glass header, eyebrow pills, gradient blobs and browser mockup under a headline; none of them is in the build.

**Key Characteristics:**
- The real sky, drawn live behind the whole page, is the only colour besides the lamp.
- Ivory chart ink on plate black, in three text strengths and two hairlines.
- One lamp red, for the main action and for what is live.
- Bodoni Moda for titles, with engraved capitals for the atlas and the plates; Schibsted Grotesk for everything read.
- Hairline drawing: graticule, hour ring, constellations, ruled lists.
- Sections measured in screens, alternating between sky and plate.
- Scroll-scrubbed scenes on computers; everything at rest with reduced motion.

## Colors

A near-monochrome of plate black and ivory ink with one lamp red; the sky supplies every other colour.

### Primary
- **Lamp Red** (#ff6a4d): the main action and what is live. As a button: "Add to your browser" in the opening and the colophon, "Get Nordlys" in the header once the opening's own button has gone, "Open the live demo" on phones. As a mark: the knob and its line on the hour ring, which show the sky's hour, and the numeral of the current plate in the list of skies. 7.1:1 on plate black.
- **Lamp Red, Lit** (#ff8166): the hover state of every lamp button.
- **Ember** (#1c0802): text on lamp buttons (6.8:1 on the lamp, 7.9:1 on its hover).

### Neutral
- **Plate Black** (#07080c): the ground of the page (also its browser theme colour): behind the sky, the solid header, the plate sections, the footer. At partial strength it is every scrim on the page: the dimming around the window (0.86), the side scrims on the plates (0.5), the fades into and out of the colophon, and the translucent fills of the pills over the sky (0.7 and 0.82).
- **Plate Black, Raised** (#0d0f15): the fill of the select fields under the demo, and nothing else.
- **Chart Ink** (#e9e4d4): heads, words over the sky, the selected view tab (ink fill, plate text), the focus outline, the text selection (inverted), the ring's three-hour ticks, and the drawn chart: graticule and constellation lines, each at its own stroke strength. 15.7:1 on plate.
- **Ink, Second** (rgb(233 228 212 / 0.76)): reading text on the plate (ledes, chapter text, table descriptions, answers), header and footer links, the list of skies, the ring's hours and hour ticks, the plates' numerals. 9.2:1 on plate.
- **Ink, Third** (rgb(233 228 212 / 0.6)): notes, readout keys, table heads and the "Where" column, field labels, footer text, the ring's quarter-hour ticks. 6.0:1 on plate.
- **Hairline** (rgb(233 228 212 / 0.14)): rules that divide: the top edge of each plate section, the solid header's bottom edge, table rows, the questions.
- **Hairline, Firm** (rgb(233 228 212 / 0.26)): edges of things you can press or look into: control borders, the two media frames, the ring's edges, the underline of quiet links, the rules over the colophon's steps. About 2:1 on plate, so it never carries meaning alone.
- **Frame Black** (#000000): inside the frames of the live demo and the film.
- **Starlight** (#ffffff): the constellation stars and their glow; the only pure white on the page.

### Sky
- **Sky One, Two and Three** (#35d6c0, #5b6cff, #9d4edd): the defaults of the three `--shader-*` custom properties, which the sky engine reads; they are plate I's palette (Northern lights). Each plate carries its own three colours in its `data-palette` attribute, and the script writes them onto these properties as the plate comes up.

### Named Rules
**The Lamp Rule.** Lamp red is only for the main action and for what is live: the sky's hour on the ring, the current plate, the live demo. Nothing decorative is ever lamp red.

**The Ink Ladder Rule.** Text and rules use the ladder and nothing between: ink, ink-2 and ink-3 for words, hair and hair-2 for lines. Only the drawn chart (graticule, constellations) sets its own stroke strengths, and always in ink.

**The Sky Is Not a Swatch Rule.** The sky's colours feed the engine and nothing else: no text, button, rule or ground on the page takes a sky colour. (The brand icon, a fixed asset, happens to share two of them.)

## Typography

**Display Font:** Bodoni Moda (with "Bodoni 72", Didot, serif)
**Body Font:** Schibsted Grotesk (with system-ui, -apple-system, "Segoe UI", sans-serif)
**Label/Mono Font:** none separate; readouts and the ring's hours are Schibsted Grotesk with tabular figures.

**Character:** A Didone with hairline serifs and steep contrast, set like the engraved titles of an atlas plate, over a plain, sturdy grotesque that does all the reading. Both are variable (weights 400 to 900, roman and italic), served from the site itself, and the roman cuts are preloaded.

### Hierarchy
- **Display** (500, clamp(3.4rem, 7vw, 6rem), line-height 0.9, tracking 0.07em, uppercase): the word NORDLYS in the opening and nowhere else, with optical sizing on; clamp(3rem, 14vw, 4.4rem) on phones.
- **Plate title** (500, clamp(2.2rem, 5vw, 4.6rem), 1, tracking 0.06em, uppercase): the nine sky names, each after its Roman numeral, set in italic at 0.46em in ink-2.
- **Headline** (500, clamp(2.3rem, 4.2vw, 3.8rem), 1.02, tracking -0.015em, sentence case): the heads of the demo, the catalogue and the questions. The other section heads keep the face, weight and case but take their own size: the colophon clamp(2.8rem, 6vw, 5.6rem), the skies clamp(2.5rem, 5vw, 4.6rem), the constellations clamp(2.1rem, 3.8vw, 3.4rem) and the film clamp(2rem, 3.4vw, 3rem), the last two at -0.012em.
- **Title** (500, clamp(1.7rem, 2.5vw, 2.35rem), 1.1, tracking -0.01em): the demo's five chapters.
- **Entry** (500, 1.6rem, 1.15, tracking -0.01em): the row heads of the catalogue.
- **Subtitle** (Schibsted Grotesk 500, clamp(1.3rem, 1.9vw, 1.7rem), 1.22, tracking -0.012em, balanced lines): the plain line under NORDLYS.
- **Question** (Schibsted Grotesk 500, 1.25rem, 1.3): the questions.
- **Lead** (400, 1.125rem, 1.6; 1.55 in the opening): the paragraph under a head. The plates' single lines are a step larger (1.1875rem).
- **Body** (400, 1.0625rem, 1.6): all other reading. Measures stay short: 32 to 46ch over the sky, up to 62ch on the plate.
- **Small** (400, 0.9375rem, 1.5): notes, header and footer links, the controls under the demo.
- **Caption** (400, 0.875rem): field labels, the note under the demo, "Back to now".
- **Label** (500, 0.8125rem, 1.35, tracking 0.02em, tabular figures): readouts and table heads; the list of skies uses the size at 400. The ring's hours are the same voice at 12px with 0.04em tracking.
- **Button** (650, 1rem): lamp buttons; 0.9375rem small and 1.125rem big.

Two smaller voices live in the header and the chart. The header's wordmark is Bodoni Moda 600 at 0.9375rem, uppercase, tracked 0.14em. In the constellation chart (a 1440 by 900 drawing) site names are Schibsted Grotesk 500 at 13 units in ink-2 and folder names Bodoni Moda italic 500 at 26 units in ink, enlarged to 22 and 40 units on phones, where the drawing shrinks.

### Named Rules
**The Engraved Capitals Rule.** Uppercase with wide tracking belongs only to the atlas title (0.07em), the plate titles (0.06em) and the header's wordmark (0.14em). Every other head is sentence case with slightly tight tracking.

**The Italic Numeral Rule.** The atlas's numbers and names are italic Bodoni: the plates' Roman numerals, the numerals in the list of skies, the constellations' folder names.

**The Tabular Readout Rule.** Anything that reads like an instrument (the time and phase, the plate label, the ring's hours) is Schibsted Grotesk 500 with tabular figures.

## Layout

The page is full bleed. Content hangs from one side gutter (clamp(20px, 5vw, 76px)) and never sits in a centred container; the fixed header is 68px tall (60px on phones). Two grounds alternate down the page: sky sections, which are clear (the opening and the constellations, the nine plates, the colophon), and plate sections, which are solid plate black with a hairline on top (the demo, the catalogue and the film, the questions, the footer).

Vertical rhythm is set in screen units. Sky sections are at least a screen tall (100svh). Each plate is 120svh with its words half a screen down (50lvh), so the sky changes as a plate crosses the middle of the window and its words come up from the bottom edge just then. Plate sections open with 20vh (the questions 18vh; the film, which follows the catalogue on the same ground, 4vh) and close with 14 to 18vh. After a head with a lede, 8vh to the content; after a bare headline, 6vh. Inside a block the steps are small and in rem: 1rem from head to lede (1.1rem in the opening), 0.8 to 0.9rem between stacked parts.

The opening is placed, not flowed. The title block sits top left, clamp(28px, 7vh, 88px) under the header, min(34rem, 38vw) wide; the actions sit bottom left, clamp(28px, 7vh, 72px) up; the readouts hold the right edge, the plate label under the header and the time and hint at the foot. The window is centred 66% across and 52% down, and its radius is the smaller of 36% of the height and 27% of the width: a diameter of about 72vh on most screens. The ring is drawn in a box 96px wider than the window (80px on phones).

The demo section is two columns: the chapters (minmax(16rem, 26rem)) and the deck (the rest), clamp(32px, 5vw, 88px) apart. Each chapter is 78vh tall (the first 60vh), so one sits beside the deck at a time, and the deck sticks just under the header. On the plates, the list of the nine skies sticks to the right edge, 18vh under the header, and rides its own track so it leaves with the last plate. The catalogue is a three-column table (what, how it works, where) up to 58rem. The colophon centres in a full screen, with its three steps in a row of three up to 70rem.

At 1100px and below, the demo section becomes one column, deck first and chapters after, all at full strength, and the colophon's steps stack. At 760px and below, the header drops its links; the opening flows in one column (title, window, lede, actions, readouts) with a window radius of the smaller of 32% of the width and 150px; the deck becomes a 3:4 frame whose demo starts on a tap; the catalogue's rows stack; the list of skies is hidden; and copy that only makes sense on a computer is swapped for phone copy.

### Named Rules
**The Two Grounds Rule.** Every section is either over the sky (clear) or on the plate (solid, with a hairline on top). There is no third ground.

## Elevation & Depth

Nothing is raised. Depth comes in three layers: the sky canvas at the back, fixed; a plate-black dip layer over it, fixed, used only to change plates; and the page, clear over the sky or solid plate. The header sits above them, and the skip link above that. Legibility over the sky comes from plate-black scrims and text halos, never from boxes.

The scrims, all plate black: around the window in the opening, 0.86 everywhere except the circle itself, cut with a radial mask with a 1.5px soft edge; on each plate, 0.5 at the left edge fading out by 60% of the width and 0.5 at the right fading out by 24%; at the foot of the plates, a fade to solid over the last 36vh into the catalogue; in the colophon, solid at the top and bottom edges fading out by 26% and from 80%, over a soft radial dim from 0.62 to 0.18.

### Shadow Vocabulary
- **Lamp drop** (`box-shadow: 0 12px 28px -16px rgb(0 0 0 / 0.9)`): under lamp buttons only (not the header's); the one drop shadow on the page.
- **Headline halo** (`text-shadow: 0 2px 34px rgb(0 0 0 / 0.5)`): Bodoni heads over the sky, on the plates and in the colophon. The constellation and skies heads use 28 and 30px at 0.55 and 0.5.
- **Text halo** (`text-shadow: 0 1px 16px rgb(0 0 0 / 0.7)`): text over the sky. The colophon's steps use 14px, the plates' lines 0.75.
- **Readout halo** (`text-shadow: 0 1px 12px rgb(0 0 0 / 0.6)`): readouts in the opening. The list of skies uses a tighter 10px at 0.8.
- **Unlit outline** (`box-shadow: inset 0 0 0 1px rgb(233 228 212 / 0.26)`): the header's lamp while the opening is on screen, drawn as an ink outline instead of a lit button.

### Named Rules
**The Scrim, Not Surface Rule.** Words over the sky get a darker sky under them (a halo, a scrim, or both), never a card or a panel.

**The Full Strength Rule.** Where a sky is shown, it is at full strength: through the window, behind the constellations, as a plate. Dimming belongs to the plate around the window and to the scrims under words.

## Shapes

Circles and straight hairlines. The window, the ring, the graticule and the stars are circles; everything else is ruled with straight 1px lines. Corners are soft and few: pills (999px) for the lamp buttons, the pills over the sky and the view tabs; 10px for the fields under the demo, the "All settings" button beside them, and the skip link; 14px for the two media frames, the deck and the film; 4px on the focus outline where an element has no corner of its own. The deck's corner scales with the assembly, so the demo is square-edged while it fills the screen.

The drawn geometry, for a window of radius r: the ring's edges at r + 0.5 and r + 24; ticks every quarter hour from r + 5 to r + 9, each hour to r + 15, every third hour to r + 22 and numbered at r + 38; noon at the top, turning clockwise; the knob a 7px lamp dot on the outer edge on a 1.5px lamp line. The graticule has circles at 0.36r and 0.7r inside the window (stroke opacity 0.13) and 1.6r, 2.3r and 3.1r outside (0.07); 24 spokes from 0.12r to r (0.14 every six hours, 0.07 otherwise); and 12 outer spokes from r + 80 to 3.4r (0.05). Stars have radii of 2.4 to 3.9 units, with a glow 4.2 times as wide.

Three small marks complete the set: the real-time mark, a small ink triangle just outside the ring that shows only when the ring is turned away from now; the arrow on "Try it here", a 15px stroke icon (1.4px, round caps and joins); and the questions' plus, two 1.4px bars that turn 45 degrees into a cross when a question is open.

### Named Rules
**The Hairline Rule.** Lines are 1px. Weight goes up only to mark something: 1.25px for the three-hour ticks, 1.4px for icons and the plus, 1.5px for the knob's line and the focused ring. Drawn SVG strokes keep their width at any scale.

## Components

Few and quiet, each drawn from the same ink, hairlines and lamp.

### Buttons
A lit lamp for the one action, a quiet line for the rest.
- **Shape:** pill (999px).
- **Primary:** the lamp: lamp red with ember text, Schibsted Grotesk 650 at 1rem, 48px tall with 1.45rem side padding, the lamp drop beneath. Small in the header (38px, 1.05rem padding, 0.9375rem, no drop); big in the colophon (60px, 2.1rem padding, 1.125rem). Its label follows the visitor's browser, and on phones it offers the demo instead.
- **Hover / Focus:** hover lights it to lamp red, lit, over 0.25s; pressed, it shrinks to 98% on the ease-out curve (0.5s); focus is the page's outline, 2px ink, 3px off.
- **Unlit:** the header's lamp while the opening is on screen: clear, ink text, a 1px firm hairline outline, an ink wash at 0.08 on hover. It lights when the header turns solid.
- **Quiet:** a link-button in ink, weight 500, underlined in the firm hairline 0.32em below the text; the underline turns ink on hover (0.25s). At least 44px tall, with an optional 15px arrow. "Try it here" and the chapters' actions ("Show the folders") use it.
- **Pills over the sky:** "Use it here" on the deck (40px, 1.1rem padding, 0.9375rem) and "Back to now" under the ring (36px, 0.9rem, 0.875rem): firm hairline border, translucent plate fill (0.82 and 0.7), ink text. "Back to now" turns its border ink on hover.

### Cards / Containers
There are no cards: the catalogue is a table and the questions are a ruled list. The only containers are the two media frames.
- **Corner Style:** 14px.
- **Background:** frame black.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px firm hairline.
- **Internal Padding:** none; the demo or the film fills the frame. The deck is 16:10 (3:4 on phones) and runs the demo's 1440 by 900 page scaled to its width; the film is 16:9, up to 76rem wide.

### Inputs / Fields
The controls under the demo, in one row with 12px by 22px gaps.
- **Style:** the view tabs are a segmented pill: a firm hairline outline with 3px inside, holding three pill tabs 36px tall (44px on phones) in ink-2. Each select is 38px tall with 10px corners, a firm hairline border, the raised plate fill, ink text at 0.9375rem, and a 12px ink chevron in 2.1rem of right padding; its label sits beside it in ink-3 at 0.875rem. "All settings" shares the select's shape without the fill.
- **Focus:** the page's outline (2px ink, 3px off).
- **Selected / Hover:** the selected tab fills with ink and its text turns plate (0.25s); field borders go to ink-3 on hover.
- **Error / Disabled:** none in the build.

### Navigation
- **Header:** fixed across the top, 68px, the gutter at each side. Over the opening it is clear: no wordmark, links in ink-2 at 0.9375rem with clamp(16px, 2.4vw, 34px) between them, and the unlit lamp at the end. Once the page has moved 80px it turns solid plate with a hairline beneath (0.4s), the wordmark fades in (the 22px icon and NORDLYS in Bodoni capitals) and the lamp lights. It slides up out of the way (0.6s, ease-out) while the deck is on screen (not on phones) and while the demo fills the screen. Links go to ink on hover (0.2s). On phones only the wordmark and the lamp remain.
- **List of skies:** the nine plates as a right-aligned list: the italic Bodoni numeral in a 2.6em column, then the name in ink-2 at 0.8125rem, with a tight halo. The current plate is ink with its numeral in lamp red; hover goes to ink (0.3s). The keys 1 to 9 go straight to a plate. Hidden on phones.
- **Footer:** plate with a hairline on top; the 16px icon and "Nordlys, open source" in ink-3; links in ink-2 that go to ink on hover, each at least 44px tall.
- **Skip link:** ink fill, plate text, weight 600, 10px corners, held above the top edge until it has focus.

### Hour ring
The planisphere's ring around the window, and the page's one direct control of the sky. It is a slider over the minutes of the day, spoken as a time and a phase ("21:40, night"): drag it, or use the arrow keys (15 minutes), Page Up and Page Down (an hour), Home and End. The lamp knob marks the sky's hour, which follows the clock until the ring is turned; then a small ink triangle marks the real time and a "Back to now" pill appears under the ring. Once a visit, 2.4s after arrival (never with reduced motion), the ring shows the other half of the day and comes back (1.9s there, 0.5s at rest, 1.7s back) on an ease-in-out, stopping at any touch. Focus draws both of the ring's edges in ink at 1.5px instead of an outline.

### Readouts
Instrument lines in the corners of the opening: a key in ink-3, then the value in ink, in the label voice with a halo; the time is set in 600. "Plate I Northern lights" at the top right; "Your sky at 21:40 tonight" and the hint "Turn the ring to change the hour" at the foot, the hint gone once the ring has been turned. The time line is a polite live region, silenced while the ring sweeps. On phones the readouts flow after the actions.

### Constellation chart and the assembly
The visitor's folders drawn as a star chart in a 1440 by 900 drawing: each site a white star with its name beside it, each folder the 1px ink lines (at 0.55) that join its stars, and the folder's name in italic Bodoni. As the section comes up the lines draw themselves one after another, the stars pop in and the names fade in. On a computer the section then holds for 2.4 screens of scroll: the words and lines fade, the demo's clock and search box appear, and folder by folder the stars fly into the real tiles of the running demo while the folder builds around them. While the demo fills the screen its frame is clear, so the page's sky stands in for the demo's own; as the demo section arrives, the demo's sky returns and the new tab shrinks into the deck, its corner coming back to 14px. Phones see the chart draw but skip the assembly; with reduced motion the chart is simply there, finished. The assembly goes beyond the direction for the build, which asked only for the lines to draw.

### Deck
The live demo in its frame, with the controls under it. The frame shows a still of the new tab until the demo has loaded, then cross-fades to it (0.8s). The demo ignores the pointer until the visitor chooses "Use it here" (on phones, the lamp "Open the live demo"). The chapters beside it change what it shows, and the chapter in view is marked as current. On wide screens the other chapters are dimmed to 0.72 opacity, which keeps their text above the 4.5:1 the product commits to.

### Plates
Each of the nine plates is a stretch of the page as tall as a screen and a fifth, with the sky painted in the plate's scene and its three colours, the title in engraved capitals after its italic numeral, and one short line. The sky changes as a plate crosses the middle of the window: the dip layer rises to 0.9 plate black over 0.22s, the new sky is painted, and the dip lifts over 0.7s. The plate readout in the opening follows. With reduced motion the new sky is painted at once. The direction asked for a cross-dissolve; the build dips through black.

### Catalogue
A ruled table. The head row is in the label voice in ink-3; each row has an entry in Bodoni (a 13rem column), the description in ink-2, and where it lives in the product in ink-3 at 0.9375rem (a 9rem column), with 22px above and below and a hairline over each row. On phones each row stacks into a block.

### Questions
A ruled list of disclosures. Each question is in Schibsted Grotesk 500 at 1.25rem, at least 64px tall, with an ink plus that turns into a cross when open (0.4s, ease-out); the answer follows in ink-2, up to 62ch, with 22px below. Hairlines run above each question and below the last.

## Do's and Don'ts

### Do:
- **Do** put every section on one of the two grounds: over the live sky (clear), or on solid plate black (#07080c) under a 1px hairline.
- **Do** keep lamp red (#ff6a4d) for the main action and for what is live; everything else is ink.
- **Do** give words over the sky full ink and a halo (`0 1px 16px rgb(0 0 0 / 0.7)` for text, `0 2px 34px rgb(0 0 0 / 0.5)` for heads), a plate-black scrim, or both.
- **Do** keep all text at 4.5:1 or more against what it sits on, the moving sky included, in every state it rests in.
- **Do** set heads in Bodoni Moda 500 and all reading in Schibsted Grotesk, and keep engraved capitals for the atlas title, the plate titles and the wordmark.
- **Do** number the skies with Roman numerals, I to IX, in italic Bodoni.
- **Do** draw with 1px ink hairlines, with SVG strokes that do not scale.
- **Do** make buttons pills (999px) and fields 10px, all with the 2px ink focus outline set 3px off.
- **Do** keep text over the sky to short measures (32 to 46ch).
- **Do** give every scroll scene a finished state that shows as it is under reduced motion.

### Don't:
- **Don't** use a glass header: no blur and no translucent bar. The header is clear over the opening and solid plate once the page moves.
- **Don't** put eyebrow labels or pill tags above heads.
- **Don't** use colour gradients or glowing blobs as decoration. The page's gradients are plate-black scrims under words, and the soft white glow of each star.
- **Don't** frame the product in a browser mockup under a headline; the real demo runs in a plain frame.
- **Don't** show the skies as thumbnails or swatches; a sky is shown across the screen or through the window.
- **Don't** use the sky's colours (the shader tokens, or any plate's palette) for text, buttons, rules or grounds.
- **Don't** raise anything on cards or drop shadows; the lamp's drop is the only one.
- **Don't** add a third typeface, a system display face, or glyph or emoji icons; icons are inline SVG strokes.
- **Don't** add ink strengths for text or rules beyond ink, ink-2, ink-3, hair and hair-2.
