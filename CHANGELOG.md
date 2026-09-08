# Changelog

All user-visible changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the
Chrome Web Store's rule that they only ever go up.

## [2.2.3] — 2026-09-08

### Fixed

- **Enter in a confirm dialog answers with the focused button.** It used to
  confirm no matter which button had focus, so moving to Cancel and pressing
  Enter deleted the folder anyway. Destructive dialogs now open on Cancel.
- **Arithmetic in the search box works in the real extension.** The calculator
  ran on `new Function()`, which the extension's content security policy
  forbids; typing `2+2` produced nothing. A hand-written evaluator replaces it.
- **An import is checked before it is written.** A file such as
  `{"groups": {}}` used to be saved and then stop the page from starting. Every
  wrong type is now named, nothing is written until the file is sound, and the
  setup being replaced is kept in the restore point. A config already broken
  in storage no longer stops the page.
- **The icon picker contacts nobody until a remote source is chosen.** It used
  to fetch a Google favicon the moment it opened and fall back to DuckDuckGo
  on failure. The browser's own cache is the default; remote providers are
  contacted only when their chip is pressed.
- **Icons are recognised by whole domain labels.** Gmail, Drive and Gemini
  were drawn as plain Google; `github.example.org` was drawn as GitHub. And a
  bookmark recognised from its address alone is now drawn with the library
  mark instead of a monogram — imported and browser-mirrored bookmarks most
  of all.
- **A folder that follows the browser behaves like one everywhere.** The
  watch now starts when the first folder is linked, not on the next open; the
  menu, the move-to-folder list and the drop target refuse additions that
  would vanish on refresh; linking a folder that has bookmarks asks first and
  keeps the state before; the folder picker lists every folder with a filter
  instead of stopping at forty.

### Added

- Real-extension tests: the unpacked extension is loaded in a throwaway
  profile and driven like a user would, under its actual policy and storage.
- ESLint, an `.editorconfig`, `CONTRIBUTING.md`, and `npm run package`.

## [2.2.2] — 2026-09-02

### Changed

- Search goes to the search engine set in Chrome, through `chrome.search`. The
  extension no longer carries an engine list, bang shortcuts, a custom
  template or live web suggestions; seven suggestion hosts left the manifest.
- Internal names are Nordlys throughout. Settings, search history, language,
  drawer width, custom themes and the wallpaper database move to the new names
  automatically on first run.

## [2.2.1] — 2026-08-31

### Changed

- Four still background compositions are gone; the aurora with its motion at
  zero is the still background, painted once and held. Reduced motion now
  holds the picture instead of leaving the canvas blank.
- Motion: two easing curves instead of one, the gear turns under the pointer
  again, the drawer's shadow falls onto the page it covers.
- Themed selects no longer close when their own list scrolls.
