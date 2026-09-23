# Changelog

All user-visible changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the
Chrome Web Store's rule that they only ever go up.

## [Unreleased]

### Added

- **Six authored skies.** Nordlys, Halo, Silk, Frost, Contour and Fjord, each a
  different kind of picture. Halo is a moon inside its ice ring, with moondogs,
  a tangent arc and cirrostratus drifting through; Silk walks threads through a
  slow current, with a sheen that crosses the weave; Frost grows fern ice in
  from the corners and edges and leaves the middle of the page clear; Contour
  is a survey map — hills and hollows that wander slowly, drawn in contour
  lines with a heavier index line every fifth, clear on the darkest theme.
- **Colour moods you mix yourself.** Three colours and a name, with the sky
  following your picks while you choose; edit or remove them later, with undo.
- **The scene thumbnails are the sky.** Each preview is painted by the scene
  itself, in the mood you have chosen — including one you are still mixing.
- **A sky that stays yours.** The stars, threads and frost are scattered from a
  stored seed, so a new tab is the same sky. *Shuffle this sky* makes another;
  one undo brings the last one back. Backups carry it.
- **High legibility.** Solid glass, a quieter sky and stronger text, from a
  switch in Appearance or automatically when the system asks for more contrast.
  Forced colours hide the painted sky.
- **Hold Alt to see which bookmarks Alt+1 to Alt+9 open.** The shortcut now
  reaches the first nine tiles on the whole board, not only the first folder.
- **The board is a command line.** Type `>` in search: `theme nord`, `sky
  frost`, `mood ember`, `move YouTube to Daily`, `new folder Reading`,
  `rename`, `hide`, `show`, `shuffle`, `arrange`, `size`, `settings`. The page shows the result
  before Enter keeps it, with one undo; a bare `>` lists them all. The verbs
  work in all eight languages, and in English everywhere.
- **Share a look.** Copy your theme, sky, mood, fonts and the shape of the
  board as one line of text — never your bookmarks, name, wallpaper or custom
  CSS — and save a picture of it. Paste someone else's to try it on; nothing
  is saved until you keep it.
- **Halo shows tonight's moon**, worked out from the date alone, with the lit
  side the way your hemisphere sees it. It can be held full instead.
- **Bring your browser's bookmarks.** A new board offers the bookmarks bar and
  its folders in one click, as folders that follow the browser from then on.
- **The board from the keyboard.** Each folder is one Tab stop; the arrow keys
  walk its tiles by where they sit, Alt+Shift+Arrow moves a bookmark, and a
  skip link goes straight to the board.
- **Moods from harmonies or from your wallpaper.** Start a mood from
  neighbouring hues, a three-way split of your first colour, or the three
  colours your wallpaper is mostly made of.
- **Arrange the board.** Rows are yours now: drag a folder into a gap, or
  between two rows to start a new one, and the board shows exactly where it
  will land before you let go. *Fitted* runs every row edge to edge with
  folders of one height; *Tidy up* puts folders of a similar height side by
  side in one click. Open it from a folder's grip, the board's menu,
  Settings → Bookmarks or `> arrange`; everything in it works from the keyboard
  and has Undo, and Done leaves one more undo for the whole session.
- **Bookmarks slide into place.** Dragging a bookmark makes room for it as it
  passes through a folder and into another, and it settles where it lands.
  While arranging, folders and bookmarks can be moved on a touch screen too.
- **The sky can follow the time of day.** One switch beside the colour moods
  lights every atmosphere by where the sun is in your time zone — a warm glow at
  sunrise and sunset, a pale calm sky by day, a cool blue hour, stars at night.
  *Watch a day go by* plays the next twenty-four hours in fourteen seconds.
  Nothing is sent anywhere; the place is your time zone's city.
- **Size and spacing, set where you arrange.** Bookmark size (Small, Medium,
  Large or anything between), the space between bookmarks and between
  folders, how wide the board runs, and whether names show under the icons —
  with the board itself as the preview, one Undo per change, and *Back to
  defaults*.
- **An icon remembers where it came from.** The address an icon was taken
  from is kept with the bookmark and shown when the picker opens again, with
  the last few it has used as a strip of small pictures: go back to one,
  change its address, or remove it with undo. The pictures are drawn from the
  saved icon, so showing them asks the network for nothing.
- **Size and spacing from Settings.** Settings → Bookmarks opens the panel
  directly.
- **Ctrl+Z (⌘Z) takes back the last change** while its notice is showing, from
  anywhere but a text field — including inside a dialog, where the notice's
  own Undo button is out of the keyboard's reach.
- **Motion that says what changed.** Menus grow from where they were opened
  and dialogs settle into place; settings tabs share one travelling
  indicator; a folder folds into its chip in the dock and grows back out of
  it; a theme chosen with a click spreads from the pointer; the clock turns
  over digit by digit. Anything done from the keyboard, or done again and
  again, stays immediate, and reduced motion keeps the picture and drops the
  travel.

### Changed

- **Rows that wrap come out even.** A board too wide for one row used to fill
  the first and leave a stub; the rows are now as close in width as the window
  allows. Nothing is reordered — only where the rows break.
- **The text over the sky is judged against the page it is really on.** The
  measure behind the clock, the date and the greeting used the theme's flat
  background colour, while most themes lay a glow or a lighter base over it
  near the top; and on a line as thin as the date, the softening it is applied
  with gave the words only part of what was measured. Both are fixed, and a
  sweep of every theme, sky, mood and time of day finds no text under AA.
- **Spacing and Corner radius do what they say.** Both sliders in Appearance →
  Advanced were drawn over by fixed values and moved nothing on the board;
  Spacing now opens up the tiles and the folders together.
- **A wallpaper is measured too.** Behind the clock a bright photo gets a soft
  shade from the top, like a lock screen, and a folder over a bright or busy
  patch gets more solid glass — each exactly as much as its words need, and
  the rest of the photo is left as it is.
- **Settings between 760 and 1023 pixels wide** leave one steady band of the
  page instead of a sliver of half a search field.
- **Text stays readable on every sky, and it is measured.** The engine measures
  the sky behind the clock, the date, the greeting and the search field after
  every scene it paints, and takes back exactly as much as the text needs. The
  text colours of eleven themes, the accent-as-text of all ten light themes and
  the status colours of light themes were raised to clear WCAG AA on their own
  surfaces; the first measured sweep found 7,058 of 31,753 text runs under AA.
- **A theme never moves anything.** Light themes no longer set heavier weights,
  so switching theme — or Auto at dusk — no longer reflows the board.
- **Folders are as tall as their tiles**, rather than stretched to the tallest
  folder in the row.
- **The Appearance preview shows your own first bookmarks** instead of an
  invented one.
- **Quieter secondary actions in Settings.** *Add Folder* and the CSS guide are
  no longer the brightest things in the panel.
- **Every button uses Nordlys's own typefaces**; the browser's default face had
  been reaching buttons all over the panel.
- **The sky paints at thirty frames a second, fifteen when idle**, at the same
  pace as before, so the glass above it re-blurs far less often.

### Fixed

- **Reduced motion is less motion again.** It had stretched every transition
  on the page to 80ms, so layout began to glide instead of changing at once;
  keyboard menus opened with nothing focused; the undo notice slid half off a
  phone's screen; and text over the glass lost the blur it was measured
  against. Menus take focus, things land at once, the notice stays centred,
  and without its blur the glass is solid.
- **High contrast mode shows what is chosen.** Tabs, segments, themes, scenes
  and switches used to look unselected in Windows high contrast, because
  each showed its state only by a background.
- **A damaged setting in storage no longer stops the page.** Fuzzing thousands
  of corrupted configs found two values that took it down; every setting,
  folder field and bookmark field of the wrong kind is now put right on load.
- **Reverting a tried-on look keeps what you did meanwhile.** It used to put
  the whole board back, so a bookmark added during the trial was lost.
- **Notices wait while you read them.** A notice, and its Undo, no longer
  leaves while the pointer rests on it or focus is inside it.
- **Another tab's save no longer interrupts typing here**, and an edit
  finished after it lands in the live board instead of an orphaned copy. An
  open editor or menu follows its own bookmark or folder, wherever the other
  tab moved it.
- **At 200% zoom** the size panel and the bookmark editor stay on the screen
  and scroll inside instead of running off both edges.
- **A system that asks for less transparency gets solid glass.** macOS
  "Reduce transparency" and Windows "Transparency effects" off used to get the
  frosted glass all the same.
- **The Glass choice says why it changes nothing** while reduced motion,
  reduced transparency or high legibility hold the glass solid.
- **Arrange on an empty board says there is nothing to arrange** instead of
  opening a bar of controls that move nothing, and Board width says when the
  window is too narrow to show it.
- **A tab left open no longer writes over another tab's changes.** Each new
  tab kept the board it opened with, so a bookmark added in one tab was lost
  the moment anything changed in another. Tabs now take each other's saves.
- **A followed folder keeps the look you gave it.** Every refresh from the
  browser dropped the icons, letters, colours and tones set on its bookmarks.
  What a refresh would undo — renaming, moving, reordering, deleting — is no
  longer offered there, with a line saying where to do it instead.
- **Every panel reads in every theme.** In light themes the icon picker's
  address box was near-black with dark words on it, under 2:1; a measured
  pass over every overlay in all 21 themes fixed that and a handful of
  smaller misses, and a test now keeps them there.
- **The icon picker, the cropper, the font list and the bookmark list's
  accessible names speak your language**; they had been English everywhere.
- **A command entered faster than its list appeared ran nothing**, or ran
  what had been typed before.
- **Nothing moves as a new tab opens.** Hidden menus and dialogs sometimes
  played their closing transition on arrival.
- **Settings labels were nearly invisible in all ten light themes.** They were
  hard-coded near-white.
- **Frosted Glass showed Aurora Void's colours.** Its own were declared but
  lost on load order.
- **A save the browser refuses is said**, once, with a way to export a backup,
  instead of being lost in silence.
- **An icon address that gives no image says so**, and a file over 5 MB is
  refused with the reason instead of "Image loaded successfully!".
- **A pale library glyph is shown in a readable shade of its own colour**, and
  monochrome marks are toned for the theme being switched to, not the old one.
- **Tooltips, accessible names, placeholders and announcements are translated**
  in all eight languages.

### Privacy

- **Nothing is web-accessible any more.** Websites could load files from the
  extension to learn that it was installed; favicons never needed that.

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
