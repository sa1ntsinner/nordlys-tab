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

Four durations, two curves, and they travel together.

| Token | Duration | For |
| --- | ---: | --- |
| `--nl-motion-fast` | 120ms | A state change on something already on screen |
| `--nl-motion-control` | 170ms | A control answering a press |
| `--nl-motion-panel` | 260ms | Something appearing or disappearing in place |
| `--nl-motion-enter` | 320ms | A panel that travels |

`--nl-ease-emphasized` for everything. `--nl-ease-pop` is one deliberate
overshoot, and the moment it is on three elements at once it reads as a
template.

Use the composed tokens — `--nl-transition-fast`, `--nl-transition-control`,
`--nl-transition-panel` — so a duration cannot be paired with a bare `ease` by
accident.

**The page does not animate on arrival.** It is opened dozens of times a day and
looked at for a second or two; a staged entrance at that frequency is a toll,
not a flourish. Motion belongs to things the user starts.

Under `prefers-reduced-motion`, transforms, parallax and the canvas stop.
Opacity and colour transitions stay: a 120ms crossfade is not vestibular.

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

One living scene (Aurora) and four still compositions built in CSS from the
theme's own colours. Stillness is not a lesser option: anything moving behind
glass forces every `backdrop-filter` above it to re-blur on every frame, so a
still field is both calmer to look at and cheaper to hold.

A scene earns its place by being visibly different from the others. Two former
scenes were measured at 0.08 and 3.02 of 255 away from a plain colour, and 3.09
from each other. They were removed.

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
card backgrounds can stay quiet.

Hit targets are at least 40px.
