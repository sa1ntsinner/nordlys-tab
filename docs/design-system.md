# The Nordlys design system

This is the spine. It exists because the product did not have one, and it showed:
an audit found twenty distinct font sizes (seven of them on half-pixel steps),
eighty-four distinct box-shadows across a hundred and four uses, both `999px` and
`9999px`, and six parallel token namespaces. None of that was a taste problem.
It was a *decision* problem: nobody had decided, so every file decided again.

Every rule below is enforced by a test in `tests/unit/design-tokens.test.cjs` or
`tests/unit/motion-language.test.cjs`. A scale that is not enforced is a
suggestion, and suggestions decay.

---

## The rule behind the rules

**A scale is worth something only when it is closed.** The moment one literal is
allowed back in, the next person has permission, and a year later there are
twenty font sizes again. If a value you need is not on a scale here, the answer
is to change the scale deliberately — not to write the literal.

---

## Type

Seven steps. No fractional sizes, ever.

| Token | Size | Used for |
| --- | ---: | --- |
| `--nl-text-2xs` | 11px | Uppercase group labels only |
| `--nl-text-xs` | 12px | Dense secondary text, badges |
| `--nl-text-sm` | 13px | Menu items, captions, hints |
| `--nl-text-md` | 14px | Body text and control labels |
| `--nl-text-lg` | 16px | Search input, dialog titles |
| `--nl-text-xl` | 20px | Section headings |
| `--nl-text-2xl` | 24px | The largest thing that is not the clock |

The clock is the one deliberate exception and scales fluidly with
`clamp(62px, 12vh, 120px)`, because it is the only element on the page that is
read rather than used.

**Tracking comes from a table indexed by size, never from per-element taste.**

| Token | Value | Applies to |
| --- | ---: | --- |
| `--nl-track-tight` | −0.01em | Display sizes, 24px and up |
| `--nl-track-none` | 0 | All body text |
| `--nl-track-label` | 0.06em | Uppercase labels, 12px |
| `--nl-track-wide` | 0.12em | Uppercase labels, 11px |

Positive tracking on body text is the most common "designed by a developer"
signal there is. It belongs to small uppercase labels and to nothing else.

Weight: 400 for text, 600 for emphasis, 200 for the clock alone. To de-emphasise
something, change its colour, not its weight.

---

## Elevation

One light source for the entire product: above, and slightly in front. Three
steps, and a theme may tint and damp the ladder but never redeclare it.

| Token | Meaning |
| --- | --- |
| `--nl-shadow-1` | A control that lifts off its surface |
| `--nl-shadow-2` | A surface that floats over the page — menus, popovers, toasts |
| `--nl-shadow-3` | A surface that owns the screen — dialogs, the settings drawer |

Themes set `--nl-shadow-ink` and `--nl-shadow-strength`. Light themes cast a
softer, cooler shadow, because black at full strength on white reads as grime.

**Selection and focus are a ring, not a bloom.** `--nl-ring` for focus and
selection, `--nl-ring-tight` where a crisp edge is wanted. A saturated halo
around a hovered element is the fastest possible way to date an interface; the
only coloured glows left in the product mark a drag target, where the colour
carries meaning.

Never put a specular rim and a drop shadow on the same element. That is a light
above and a light in front at the same time, and it is the clearest tell that a
surface was assembled rather than designed.

---

## Motion

Motion explains or it does not happen. The rules, in `src/css/motion.css`
where every animation lives:

1. **Something moves to show where it came from, where it went, or that it
   heard you** — never to decorate.
2. **The more often a thing happens, the less it moves.** A new tab opens
   finished: nothing plays on arrival, and nothing transitions until the page
   has arrived. Search, its suggestions and every keyboard action are
   immediate, because they happen hundreds of times a day.
3. **Things grow out of where they were asked for:** a menu from the cursor,
   a list from its field, a folder from its chip in the dock, a theme from the
   click that chose it.
4. **Arrivals take their time and departures do not.**
5. **Only what the compositor can move is animated** — transform, opacity, a
   clip. A disclosure opening is the one exception, because its height is the
   whole point of it.

Three kinds of motion, three curves, and the durations travel with them:

| Kind | Curve | Tokens |
| --- | --- | --- |
| A state changing — a colour, an opacity | `--nl-ease-state` | `--nl-transition-fast`, `--nl-transition-control` |
| Something travelling — a panel, a menu | `--nl-ease-emphasized` | `--nl-transition-panel`, `--nl-transition-enter`, `--nl-transition-reveal` |
| Something put down — a folder settling, a tile landing | `--nl-ease-spring` | `--nl-transition-settle`, `--nl-transition-settle-fast` |

The spring is a damped spring sampled into `linear()`, about 2% overshoot; a
browser without `linear()` gets the emphasized curve. Use the composed
tokens: a unit test refuses a bare duration or a hand-paired curve outside
`foundations.css`.

Entrances start from `@starting-style`; exits let `display` change at the
end (`transition-behavior: allow-discrete`) so they can be seen. A change to
the whole board — folding a folder, restoring one, a new arrangement — is one
view transition; a delete glides in place instead, because a view transition
swallows clicks and Undo must be pressable at once.

Under `prefers-reduced-motion` the picture stays and the travel goes: a
transition may only fade or recolour, briefly, so nothing slides, scales or
reflows over time; transforms, parallax, view transitions and the canvas stop.
Anything that must stay centred uses `translate`, which that leaves alone. The
glass loses its blur, so it becomes solid rather than a tint chosen to be
read with blur behind it — as it does for `prefers-reduced-transparency` and
high legibility, and the Glass choice says so.

---

## Colour and contrast

Themes carry the palette and nothing else. A theme that declares its own
shadows, radii or font sizes is a theme that will disagree with the others.

**Text contrast is a guarantee, not an aspiration.** A theme built in the studio
derives its text colours by searching the greyscale for the value that clears
WCAG AA against the *worse* of the two surfaces the user chose — the page and
the cards. Some pairs have no answer at all: a mid grey page with mid grey cards
tops out around 4.2:1. When that happens the product says so and keeps the best
compromise, rather than quietly shipping something unreadable.

Primary text takes the end of the qualifying range that suits the theme.
Subdued text takes the end nearest the bar — that is what makes it subdued,
while staying above AA rather than dropping to the 3:1 meant for large text.

**The built-in themes are held to the same guarantee, and it is measured, not
declared.** Every theme names three text tiers — ink, dim, faint — and three
surfaces; `tests/unit/theme-contrast.test.cjs` holds each tier to a floor on
every surface (ink 7, dim 5, faint 4.8) and the tiers to their order. Eleven
of the twenty-one themes shipped a faint tier under 4.5:1 on their own card
before that test existed. Where the accent is a word rather than a fill — a
menu heading, an Undo, a slider's value — a theme's `--accent-ink` carries it,
because a light theme's accent is a mid-tone that fills well and reads at
three to one. Status colours have a light-theme set for the same reason.

The static floors are not the whole story, because text on this page sits on
translucent glass over a sky a scene paints and a mood tints. So
`tools/qa-contrast.cjs` photographs the page with and without its glyphs and
measures every run of text against the pixels actually behind it, across every
theme, scene, mood and two moments of each scene at 150% intensity. The first
full sweep found 7,058 of 31,753 runs under AA. `tests/ui/contrast.spec.cjs`
re-measures the hardest skies that sweep found and fails the build on any.

**Emphasis is colour and size, never opacity.** Four places dimmed an already
quiet tier with opacity — the search hint, the suggestion addresses, the menu
heading, the clock colon — and each landed under the bar on some sky. A tier
exists so that nothing needs to be faded on top of it.

**Never weight.** A theme is a palette and must not move anything: light themes
used to set heavier weights, a heavier face is a wider one, and switching theme
reflowed the board. `tests/ui/theme-geometry.spec.cjs` holds every folder and
tile to the same box in all twenty-one themes.

**High legibility** — the switch in Appearance, or `prefers-contrast: more` —
makes glass solid, pulls the quieter tiers towards the ink, holds the sky at a
whisper and the quiet zones to 7:1. Forced colours hide the painted sky, which
is the one thing the system cannot recolour.

---

## Surfaces

One translucent material, at one level, never nested inside itself. At most two
filter functions: reaching for a third means colour-correcting toward a colour
that should have been declared, and it makes text contrast a function of the
user's wallpaper.

Where the browser cannot blur, the surface is already opaque enough to read
against. The fallback is the default, not the exception.

---

## Icons

One grid: 16px box in chrome, 2px stroke, one cap and join style. Emoji and
vector icons never appear in the same row — mixed stroke weights between icon
sets is the most visible "assembled from parts" tell there is, and it survives
every other improvement.

---

## Backgrounds

Nine authored skies — Nordlys, Polaris, Halo, Pillars, Nacre, Silk, Baikal,
Contour and Fjord — the user's own image or video, and a flat colour. Each sky
is a different *kind* of picture: curtains, star trails turning round the pole,
an optical display around a moon, columns of light over a far horizon, banded
mother-of-pearl cloud, threads walked through a vector field, black ice with
its bubbles and cracks, a survey map of hills and hollows, a low horizon. Frost,
rime grown in from the edges, was retired; a stored Frost becomes Baikal.
Contour was once nine sine waves at an eighth of an opacity —
a paler Silk that vanished on dark themes — and became a map: closed contour
lines traced from a seeded, slowly wandering terrain (marching squares), a
heavier index line every fifth, coloured by elevation through the mood.

**A scene earns its place by being a different kind of thing, not a different
arrangement of the same thing.** Two former scenes measured 0.08 and 3.02 of 255
away from a plain colour and 3.09 from each other; they were removed. Four still
compositions measured 4.55 to 8.68 apart and were removed as well. A new sky has
to be unmistakable at thumbnail size, which is now easy to check, because —

**The thumbnails are the sky.** `paintStill` renders each scene at a small size
with the code that paints the full one, in the palette the sky has resolved, so
a preview cannot fall behind its scene the way the CSS imitations did.

**Every scene is a pure function of time, and of a seed.** Stars, threads,
bubbles and cracks are scattered from `config.bgSeed` — zero is the authored composition —
so a new tab is the same sky, and "Shuffle this sky" is a new one kept until
shuffled again. Each scene has a rest phase, the frame chosen by looking at it,
which is what motion at zero, reduced motion and the thumbnails all hold.

**Rest is a painted frame, never an absent one.** Reduce motion, hold the
picture. And moving frames are budgeted: thirty a second, fifteen after a minute
without input, at the same pace either way, because every painted frame makes
each glass surface above the canvas blur what is behind it again.

**A scene paints with what the GPU draws as it is.** Chrome's 2D canvas fills
gradients, circles, hairlines and images on the GPU, but a thick antialiased
stroke that runs across the window it rasterises on the processor, box and all:
Silk's threads cost a hundred milliseconds a frame that way and it ran at a
third of its budget. So soft light is gradients (`glow`, `drawShaft`), fine
lines are hairlines, whatever holds still is drawn once into a layer and laid
down each frame (Baikal's ice), and long lines go to the GPU layer
(`sky-gl.js`: Silk, Polaris, Contour), which draws them as triangle strips and
lays the frame onto the canvas in one `drawImage`. A still and the quiet-zone
sample are small enough to paint in 2D, and do. `tests/unit/scene-cost` holds
every scene to it: no thick stroke across more than a small box on the screen
canvas, and no more than a few hundred calls a frame.

**The sky yields to the words.** The app tells the engine where text sits
straight on the sky — the clock, the date, the greeting, the search field — and
what colour that text is; after a scene paints, the engine measures the sky
under each and takes back exactly as much as the text needs (`quietAlpha`),
feathered so nobody sees a box. On a dark evening it takes nothing. It belongs
to the engine rather than to any scene, so a scene added later is kept readable
without knowing it exists. Two things the solver must be told and once was not:
the page under the sky is not the flat `--void` but the theme's own gradients,
read at each zone (`NordlysColour.backgroundAt`) — a glow near the top made the
real page lighter than the one it solved against — and the feather has to reach
past the zone, or a blur wider than a line of text leaves the words under part
of the attenuation it asked for.

**The light can follow the sun.** One switch, beside the colour moods, for
every atmosphere: where the sun is comes from the time zone's city
(`sky-zones.js`, from the IANA database) and the date, with no permission and
no network. The mood is graded by the light — a hue is only drawn a little way
towards the nearest warm or twilight hue, so a teal stays teal instead of
souring into lime — and the warmth of a sunset is drawn as light, a gold,
coral and violet gradient off the horizon, never averaged with the mood (warm
light averaged with a cool mood is brown). By day the sky pales and steps
back, the aurora most; stars come out in the blue hour and the night. The quiet
zones solve against whatever is painted, and the contrast sweep measures four
moments of an equinox day (`--surfaces=daylight`).

**A wallpaper is measured the same way, and treated only where it must be.**
The photo is sampled as the stylesheet shows it. Behind the clock it gets a
band from the top, full strength to just past the words and then gone, the way
a lock screen handles a bright photo; a folder or the search field over a
bright or busy patch gets more solid glass. Each is solved for its own words,
and the rest of the photo is left alone — dimming the whole picture to rescue
the text was tried first, and made a snowfield grey. In a light theme the band
is a mist of the page colour rather than a shadow.

---

## What the settings panel may expose

A setting is a decision the user should make. `Glass contrast: 94%` is not that;
it is a decision the designer declined to make, handed over in raw form, and it
lets people drive themselves into states where text stops being readable.

One visible tier for what people actually choose — theme, accent, density, what
is shown. One `Advanced` tier for the rest. Nothing that can produce a broken
result without a way back.

---

## Layout

Position is the memory. After a week nobody reads the tile labels; they hit a
coordinate. So tile order is stable across sessions and across window widths,
and any automatic reordering would be a bug rather than a feature.

Gaps between tiles are smaller than the tiles, so they group. Gaps between
groups are larger than gaps within one, so proximity does the grouping and the
card backgrounds can stay quiet. Both follow the Spacing setting, the folders a
step wider apart than the tiles.

Hit targets are at least 40px.

**The board is rows, and the rows are the board's until someone arranges them.**
A row is a run of folders; when it is too wide for the window it wraps into
lines, and the lines come out as even as the width allows — the fewest lines,
then the split whose widest line is narrowest (`NordlysBoardLayout.balance`).
The old wrap filled a line and left a stub: nine folders at 2000px broke six
over three. Once somebody moves a folder, every folder carries the row it is on
(`group.row`), and rows stay theirs until *Automatic rows* hands them back.

**Two layouts, and no third.** *Natural*: each folder is as wide as its columns
and as tall as its tiles, lines centred. *Fitted*: every line runs edge to edge
and its folders share one height; the room left on a line is shared out by
columns, so tiles keep one rhythm along it, and a folder with fewer tiles than
columns spreads the tiles it has. Everything else a symmetric board needs is
done by moving folders and by one action, *Tidy up*, which puts folders of a
similar height side by side and chooses the rows for the window as it is. It
is the only thing that reorders folders, and only when asked, with undo.

**Moving things.** One way of picking up, for folders and bookmarks, that
follows the pointer (`board-arrange.js`). A bookmark slides through the tiles
as it goes, because tiles are all one size and making room never moves the
folder under the pointer; a folder it passes keeps its height until the drop.
A folder is too big to reflow under the pointer without the board jumping, so
the board holds still and a marker shows the landing — a bar in a gap, or a bar
across the gap between rows that says *New row* — and it settles on the drop.
Escape puts it back. Every move outside the arrangement is one toast from undo.

**Arranging is a place.** Entered on purpose — a folder's grip, the board's or a
folder's menu, Settings → Bookmarks, `> arrange` — it dims the clock and search,
outlines the rows, shows every handle and edge, takes the tiles out of the tab
order, and holds the choices in one bar: the layout, Tidy up, Automatic rows,
Size & spacing, Undo, Done. *Size & spacing* is five measures in a small panel
over the bar — bookmark size, the space between bookmarks and between folders,
the board's width, names under the icons — with the board as its preview; a
slider drag is one step of Undo and one save. The line above the bar says what the control under the pointer
does. Every choice in it is reachable from the keyboard: on a folder's grip the
arrows move it, up and down change its row, and each step is said aloud.
