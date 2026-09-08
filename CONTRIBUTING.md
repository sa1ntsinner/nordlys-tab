# Contributing to Nordlys

Thanks for looking under the hood. This page is everything you need to run the
extension from source, change it with confidence, and send a change back.

## Running it

There is no build step. The page is plain HTML, CSS and JavaScript, loaded as
classic scripts in the order `newtab.html` lists them.

1. `git clone` the repository.
2. Open `chrome://extensions`, turn on **Developer mode**, choose **Load
   unpacked**, and pick the repository folder.
3. Open a new tab.

Edit a file, reload the extension from `chrome://extensions`, open a new tab
again. That is the whole loop.

One thing to know: Chrome refuses to load an unpacked extension whose folder
contains any file whose name starts with `_`. Keep scratch files named
otherwise.

## Tests

```
npm install
npm test
```

`npm test` runs, in order:

| Step | What it checks | How long |
| --- | --- | --- |
| `npm run lint` | ESLint: undefined names, unused variables, `==`, `var` | seconds |
| `npm run test:syntax` | every script parses | seconds |
| `npm run test:unit` | pure logic under Node: the calculator, the config schema, the icon resolver, the design-token rules, the store-listing limits | seconds |
| `npm run test:ui` | Playwright, 4 workers | about 1.5 minutes |

The UI suite has two kinds of test, and the difference matters.

**Fixture tests** (`tests/ui/*.spec.cjs` using `nordlys-fixture.cjs`) serve
`newtab.html` over HTTP with a small shim standing in for `chrome.*`. They are
fast and right for layout, keyboard behaviour and most logic. They are not the
product: there is no content security policy, storage answers from a stub, and
there is one page where the real extension may have several.

**Real-extension tests** (`tests/ui/extension-*.spec.cjs` using
`real-extension.cjs`) load the actual unpacked extension in a throwaway
Chromium profile and drive it the way a user would — typing into the field,
pressing the key, choosing the file. Anything that depends on the policy, on
real storage, or on Chrome APIs has to be proven there. The calculator once
passed every fixture test and did nothing in the product, because
`new Function()` is fine over HTTP and forbidden under the extension's CSP.

When you fix a bug, add the test that would have caught it, in the tier that
can actually see it.

## How the code is organised

| File | Owns |
| --- | --- |
| `src/js/boot.js` | The first frame: runs in `<head>` before any stylesheet and paints the stored theme so a dark-theme user never sees white. Reads only. |
| `src/js/app.js` | `NordlysApp`: loading, saving and migrating the config; the restore point; theme, glass and header application. |
| `src/js/config-schema.js` | What a config may look like: validation for imports, repair for stored configs. |
| `src/js/grid.js` | The board: folder cards, tiles, drag and drop, context menus. |
| `src/js/widgets.js` | Clock, greeting, the search box and its suggestions. |
| `src/js/calc.js` | The arithmetic evaluator behind the search box. No `eval`. |
| `src/js/background.js` | The aurora canvas and `MediaVault` (wallpapers in IndexedDB). |
| `src/js/settings*.js`, `icon-picker.js` | The settings drawer and its sections. |
| `src/js/bookmark-sync.js` | One-way mirroring of a browser bookmark folder. |
| `src/js/icons-db.js`, `icon-presentation.js` | The vector icon library, domain matching, and how a tile decides what to draw. |
| `src/js/i18n.js` | Eight locales. Every locale carries exactly the same keys; a test enforces it. |
| `src/css/foundations.css` | Design tokens: type scale, spacing, elevation, z-index, motion. Tests enforce that the other stylesheets use them. |

Scripts share globals by name. `eslint.config.mjs` lists every one of them;
if you add a top-level name that another file uses, add it there. When that
list shrinks, the code got more modular.

## Rules the tests hold you to

These are not style preferences. Each exists because its absence produced a
real defect that a user saw.

- **Storage is written only with a config this page loaded or adopted.** Never
  with defaults. Every migration takes a restore point before it writes.
- **Nothing leaves the machine unless the user asked.** No request on open, no
  request while typing, no silent fallback to a remote service. A test watches
  every outbound request.
- **Design values come from tokens.** Font sizes, shadows, z-indices, radii and
  motion curves are defined once in `foundations.css`; a literal elsewhere
  fails the suite. State transitions and travelling transitions use different
  curves — use the named composites, never a hand-written pair.
- **Every message key is used, and used in all eight locales.** Add a string to
  every locale or to none. Machine translation reads as broken software; if
  you cannot write a locale well, ask in the pull request.
- **An id is declared once per stylesheet.** A second declaration lower in the
  file is an override the next person will not find.
- **Reduced motion means a painted frame, not an absent one.**

## Sending a change

- One concern per commit. The message says what was wrong, for whom, and why
  the fix is the right one — not just what changed. Read `git log` for the
  house style.
- Run `npm test` before opening the pull request. If a real-extension test is
  the right place for your check, put it there even though it is slower.
- Screenshots of the store listing are generated, not hand-made: `npm run
  artwork` rebuilds them.
- The store listing text lives in `docs/store-listing.md` and is pasted into
  the Developer Dashboard verbatim. Field limits are enforced by tests.

## Releasing

`npm run package` verifies that `manifest.json` and `src/js/app.js` agree on
the version, that no file in the package starts with `_`, and writes
`nordlys-v<version>.zip`. The release checklist is in `RELEASE_GUIDE.md`.
