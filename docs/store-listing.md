# Store listings

Copy this text into the Chrome Web Store developer dashboard, and the Edge,
Firefox and Safari sections below into theirs. Keep this file in step with the
listings.

Its version is 2.x because the store only accepts higher version numbers. The
description no longer calls it a beta: a copy of the setup kept before every
update is the promise that matters, and the description says that instead.

## Title

```
Nordlys
```

The dashboard takes the title from `name` in `manifest.json`. You can't edit it
there.

The title doesn't say "new tab", so the summary and description say it early.

## Summary (132 characters maximum)

```
Your favourite sites in folders on every new tab, over a sky that moves. Free, with no account and no tracking.
```

111 characters. This is also the `description` in `manifest.json`.
It names no count (of skies or themes), which changed three times in a month.

## Category

Productivity.

## Detailed description

```
Nordlys replaces your new tab page with your favourite sites, in folders, over a sky that moves. There is no account and no tracking: your bookmarks and settings stay on your computer. It's free, and what is free stays free: there is no paid plan and there won't be one.

Folders and bookmarks
• Drag folders and sites where you want them, change sizes and spacing, undo anything.
• Start from your browser's bookmarks, your most visited sites, a bookmarks file, or a backup from FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss.

Skies and themes
• Animated skies, among them the northern lights, the real stars over you tonight and meteor showers on their nights. A sky too heavy for your computer holds still by itself.
• 21 colour themes, dark and light, or your own picture or video.

Search and keys
• The search box uses your browser's search engine, finds your sites and does math. Hide it if you don't need it.
• Commands after >, and ? shows the keyboard shortcuts.

When you want more
• A dashboard: tasks, a focus timer with sounds, notes, weather, clocks, a tab stash. Off until you turn it on.
• Tasks from Todoist and GitHub, events from any calendar link.
• Profiles such as Work and Home, and sync through your browser's own sync.

Before every update, a copy of your whole setup is kept in Settings → Backup.

In English, Russian, Spanish, German, French, Japanese, Chinese and Turkish. Open source (MIT): https://github.com/sa1ntsinner/nordlys-tab
```

The description is 1487 characters, under the 1,500 the store shows
before "More". Privacy and the price come first: they are why people leave
other new-tab extensions.

## Privacy practices

Answer the dashboard's justification fields from `PRIVACY.md`:

| Field | Answer |
| --- | --- |
| Single purpose | Replaces the new tab page with a start page of the user's own bookmarks. Searching from it goes to the search engine already set in Chrome, through chrome.search; the extension has no engine setting of its own. |
| `storage` | Saves bookmarks, themes and settings on the device. |
| `unlimitedStorage` | Holds user wallpaper images and video loops in IndexedDB. |
| `favicon` | Draws site icons from Chrome's local favicon cache. |
| `search` | Sends what is typed in the search box to the search engine the user has set in Chrome. The extension never chooses the engine. |
| Host permissions | None at install. |
| `tabs` (optional) | Requested only when the user presses "Stash the tabs of this window" on the Tab stash card, to save and close that window's tabs. |
| `topSites` (optional) | Requested only when the user presses "Start from my most visited sites" on an empty board, to make one folder of them. |
| Optional host permissions | Asked one site at a time, when the user connects Todoist, GitHub or a calendar link. `https://*/*` is listed because a calendar link can be on any server; only that one address is ever requested. |
| `bookmarks` (optional) | Requested only when the user points a folder at a browser bookmark folder, and only read from. Never requested at install. |
| Remote code | None. The CSP is `script-src 'self'; object-src 'self'`. |
| Data collection | None. Declare no collected data. |

## Permission justifications

The dashboard asks for a justification per permission in its own field, capped
at **1000 characters**, and a reviewer will not accept "required for
functionality" for any of them. Each one below names the user-visible feature
that needs it and stays inside the cap; the count is in the heading so a later
edit can be checked against it. Paste verbatim.

### `bookmarks` (optional) — 905 chars

```
Nordlys replaces the new tab page with a grid of bookmark tiles. One feature lets a user point a Nordlys folder at a folder of their own Chrome bookmarks, so tiles fill from bookmarks they already have instead of being typed in one at a time.

That feature is the only use of the API: getTree() lists their folders so they can pick one, getChildren(id) reads the links inside the folder they picked, and the change events keep that copy current when they edit it in Chrome.

Nothing is written: there is no create, update, move or remove call anywhere in the source. The mirror runs one way and Chrome keeps ownership.

It is in optional_permissions, so nothing is asked at install and the extension works fully without it. permissions.request() runs only from the click that links a folder; declining changes nothing. Mirrored titles and URLs go only to local extension storage and are never transmitted.
```

### `tabs` (optional) — 463 chars

```
The dashboard has a Tab stash card. When the user presses "Stash the tabs of this window", Nordlys reads the titles and addresses of that window's tabs once, saves them as a group on the device and closes those tabs; "Open all" brings them back later. That is the only use of the API.

It is in optional_permissions: nothing is asked at install, and permissions.request() runs only from that button. Nothing is read in the background and nothing is sent anywhere.
```

### `topSites` (optional) — 526 chars

```
A new tab page is only useful once it holds the user's sites, and many people have no bookmarks worth bringing. An empty Nordlys board therefore offers "Start from my most visited sites". When the user presses it, Nordlys calls topSites.get() once and makes one folder of up to twelve of those sites on the device. That is the only use of the API.

It is in optional_permissions: nothing is asked at install, and permissions.request() runs only from that button. Nothing is read in the background and nothing is sent anywhere.
```

### Optional host permissions — 633 chars

```
Nothing is granted at install. The optional list covers the dashboard's connected apps, which the user turns on one at a time: Todoist (api.todoist.com) and GitHub (api.github.com) read the user's own tasks with a token they paste, and a calendar link reads the user's own events. Because a calendar link (Google Calendar, Outlook, iCloud, Proton, a self-hosted server) can be at any address, the list includes https://*/*, but Nordlys only ever requests the single origin of the link the user has just pasted, at the moment they press Connect. Each card refreshes itself only while it is on the user's dashboard, as PRIVACY.md says.
```

### `storage` — 233 chars

```
Stores the user's own configuration on the device: their bookmark folders and tiles, and the theme, fonts, layout and background they chose. The extension has no account and no server, so this is the only place a user's setup exists.
```

### `unlimitedStorage` — 336 chars

```
Users can set their own image or a looping video as the page background. These are held as blobs in IndexedDB on the device and routinely exceed the 5 MB default quota - a short 1080p loop passes it on its own - so without this the feature fails on the files people actually pick. Nothing is uploaded; the file never leaves the machine.
```

### `favicon` — 327 chars

```
Bookmark tiles can show a site's icon. This reads Chrome's own local favicon cache at the extension's /_favicon/ path, so an icon can be drawn for a site the user has already visited without sending that address to a third-party favicon service. Remote favicon providers are contacted only when the user explicitly chooses one.
```

### `search` — 600 chars

```
The new tab page has a search box. What is typed there is handed to chrome.search.query(), which sends it to the search engine the user has already chosen in Chrome's own settings, in the current tab or a new one according to their preference.

That is the permission's only use. The extension has no search engine of its own, no list to choose from, and no setting that changes which engine is used; it never learns which engine answered. A previous version carried its own engine list and was rejected for it. Using this API is how the box respects the user's choice instead of making one for them.
```

### Host permissions — 464 chars

```
None. Nordlys asks for no site at install. Earlier versions listed images.weserv.nl, a fallback for an icon image address a site will not hand over; that service allows cross-origin requests, so it is used without a permission, and only when the user pastes such an address.

Earlier versions also listed seven search-suggestion endpoints. Those are gone: the box no longer fetches live suggestions, so nothing typed leaves the device until the user presses Enter.
```

### Remote code — 167 chars

```
None. All JavaScript ships in the package. The content security policy is "script-src 'self'; object-src 'self'", so the extension cannot load or evaluate remote code.
```

## Edge Add-ons

Upload `nordlys-edge-v<version>.zip` (`npm run ports`). It is the Chrome build with a summary that doesn't name Chrome.

- **Summary:** Your favourite sites in folders on every new tab, over a sky that moves. Free, with no account and no tracking.
- **Description:** the Chrome text above, word for word: it names no browser.
- **Category:** Productivity.
- **Privacy policy URL:** the PRIVACY.md link on GitHub.
- Edge asks the same permission questions as Chrome; the answers above apply word for word.

## Firefox (addons.mozilla.org)

Upload `nordlys-firefox-v<version>.zip`. The add-on id is `nordlys@sa1ntsinner.github.io` and can't change after the first upload.

- **Summary (250 characters):** Your favourite sites in folders on every new tab, over a sky that moves. Free, with no account and no tracking.
- **Description:** the Chrome text above, word for word: it names no browser.
- **Differences in Firefox**, worth one line in the description: site icons come from the site or a provider you pick, because Firefox has no icon cache for extensions; Focus mode has no small floating timer window (Firefox has no document picture-in-picture yet).
- **Categories:** Tabs; Appearance.
- **Data collection:** the manifest declares `data_collection_permissions: { required: ["none"] }`. Answer "none" in the form as well.
- **Source code:** not needed. Nothing is minified or built; the package is the source.
- **Notes for the reviewer** (paste):

```
No build step: every file in the package is the source as written. There is no remote code (CSP script-src 'self'). The optional host permission https://*/* is requested one origin at a time, only for the calendar link the user pastes, from the Connect button. topSites and tabs are optional and requested only from the buttons that use them.
```

## Safari (App Store)

Built on a Mac: `npm run ports safari`, then `xcrun safari-web-extension-converter dist/safari --app-name Nordlys --bundle-identifier io.github.sa1ntsinner.nordlys`. Safari has no search API for extensions, so the Safari build asks for a search engine once in Settings → General. Say so in the App Store text. Safari has no favicon cache for extensions and no most-visited list, so the Safari build has neither.

### Notes for App Review

App Review asked for these on 2.5.1 (Guideline 2.1, "Information Needed", for
a new developer account). They are in the version's App Review Information
notes, and go in the reply with a screen recording made on a Mac: launching
the app, turning the extension on in Safari, then a new tab and its main
features.

```text
Nordlys is a Safari web extension that replaces the new tab page. The Mac app is its container: it installs the extension and shows how to turn it on. There is no account, no sign-in, no purchase, and nothing users make is shared with others.

1. Screen recording: attached to our reply in App Store Connect.

2. Purpose and audience
Nordlys is for everyday Mac users who open many tabs a day. Each new tab shows their favourite sites in folders over an animated sky, with a search box, and, if they turn it on, a dashboard for the day: tasks, notes, world clocks, a countdown, weather and a focus timer. It saves the time of finding the sites they use most and keeps the day's tasks in view, without an account and without tracking. It is free and open source: https://github.com/sa1ntsinner/nordlys-tab

3. Setup and main features
a. Open Nordlys from the Applications folder. Its window says whether the extension is on and has one button, "Quit and Open Safari Settings...".
b. In Safari Settings > Extensions, tick Nordlys.
c. Open a new window or tab (Command-N or Command-T). Nordlys shows its page. If Safari still shows its own start page, choose Nordlys under Safari Settings > General > "New windows open with" and "New tabs open with".
d. Main features: add sites to folders, drag tiles and folders to arrange them, search from the box at the top, and open Settings with the gear at the bottom right (skies, colour themes, languages). The dashboard is off by default: turn it on in Settings > Dashboard, and start Focus mode from its timer card.
No login or sample files are needed.

4. External services
Nordlys has no server of its own, and no analytics or ads. It makes a request only when the user uses a feature that needs one:
- Search: the search engine the user picks in Settings > General.
- Weather card: Open-Meteo (api.open-meteo.com and geocoding-api.open-meteo.com), for the city the user chooses. No key or account.
- Icon search: Iconify's public API (api.iconify.design), only when the user searches for an icon; images.weserv.nl, only to load an icon image address the user pasted.
- Connected apps (optional, off by default): Todoist, GitHub, or a calendar link (ICS), with a token the user enters. The token stays on the Mac. While such a card is on the dashboard it refreshes itself every few minutes.
The privacy policy lists all of it: https://github.com/sa1ntsinner/nordlys-tab/blob/main/PRIVACY.md

5. Regions
The app works the same in all regions. Its interface is in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

6. Regulated industries and third-party material
Not applicable: Nordlys is not in a regulated industry and includes no protected third-party material.
```

The App Store preview is `docs/video/app-preview-1080p30.mp4`, the film's
28-second cut. Its end card leaves out the line that names other browsers.

## Artwork

Run `npm run artwork` to capture the extension for `docs/store-assets/`, the
link preview and `site/assets/`. It takes about five minutes. The aurora needs
about fourteen seconds to settle, and the icon close-up needs a connection to
Iconify.

The artwork generators aren't part of `npm test`; they don't check a result.

| File | Size | Shows |
| --- | --- | --- |
| `screenshot-1-board.png` | 1280x800 | "Your sites on every new tab": Aurora Void on Nordlys, as a new tab looks once installed, with two folders folded under the board |
| `screenshot-2-dashboard.png` | 1280x800 | "A dashboard for your day": Nord Frost on Halo, the Planner layout with a morning's tasks |
| `screenshot-3-focus.png` | 1280x800 | "Focus mode": OLED Obsidian, a Pomodoro six minutes in, rain on |
| `screenshot-4-skies.png` | 1280x800 | "9 animated backgrounds": every background, each in a different theme |
| `screenshot-5-connect.png` | 1280x800 | "Tasks from Todoist and GitHub": the dashboard on Polaris, and the three apps it reads from |
| `screenshot-6-arrange.png` | 1280x800 | "Move folders around": Catppuccin Mocha on Silk, Fitted, with Size & spacing open |
| `screenshot-7-extras.png` | 1280x800 | "Search, icons and time of day": math and commands, brand icon search, and Boreal Emerald through a day in Berlin |
| `screenshot-8-themes.png` | 1280x800 | "21 themes": Porcelain Light on the Star map, and Gruvbox Dark on Silk with the themes open |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee tile |
| `promo-small-440x280.png` | 440x280 | Small tile |
| `docs/brand/buymeacoffee-cover.png` | 2400x600 | Cover for the Buy Me a Coffee page (not uploaded to the store) |
| `site/assets/og.png` | 1200x630 | The picture chats and social sites show for a link to the website |

`store-board.cjs` sets up the boards. `store-shots.spec.cjs`, `dash-shots.spec.cjs`
(the dashboard, Focus mode and connected apps) and `promo.spec.cjs` take the captures; `compose.cjs` lays them out. `site-assets.cjs` makes the
WebP files for the site and README. Upload the screenshots in number order.
The store shows the first one in search, so it is the board as installed: the
dashboard is off by default and is second. The Chrome Web Store takes five: use 1 to 5.
Edge Add-ons takes up to ten and addons.mozilla.org has no limit: use all eight. To retake only the store pictures:
`npx playwright test --config=tools/artwork/playwright.config.cjs store-shots promo`.
