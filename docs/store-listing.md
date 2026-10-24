# Store listings

Copy this text into the Chrome Web Store developer dashboard, and the Edge,
Firefox and Safari sections below into theirs. Keep this file in step with the
listings.

The description doesn't call it a beta: a copy of the setup kept before every
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
• Drag folders and sites where you want them, change sizes, undo anything.
• Start from your browser's bookmarks, your most visited sites, a bookmarks file, or a backup from FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss.
• Save the page you're on from the toolbar or the right-click menu. Find the bookmarks that are gone or there twice.

Skies and pages
• The northern lights, the real stars over you tonight, a black hole, photographs in your mood's colours, or a picture of the day. Your own picture or video too.
• 21 colour themes. The page can be a board, columns, a dock or only the search box.

Search
• Your browser's search engine, your sites, open tabs and your own keywords. Units, time zones and money are answered on the spot.

When you want more
• A dashboard: tasks, a focus timer that can keep distracting sites shut, notes, calendars with a Join button, feeds, weather.
• Spaces such as Work and Home, and sync through your browser's own sync.

Before every update, a copy of your whole setup is kept in Settings → Backup.

In English, Russian, Spanish, German, French, Japanese, Chinese and Turkish. Open source (MIT): https://github.com/sa1ntsinner/nordlys-tab
```

The description is 1498 characters, under the 1,500 the store shows
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
| `tabs` (optional) | Requested only from the click that turns on something that reads tabs: the Tab stash, Tabs and Recently closed cards, open tabs in the search box, or sites kept shut while a focus runs. |
| `history` (optional) | Requested only when the user turns on "Pages you visited" in Settings → General, so the search box can find pages they visited. |
| `sessions` (optional) | Requested only when the user adds the Recently closed card, to list and reopen what they closed lately. |
| `activeTab` | Gives the toolbar button the address and title of the page in view when it is pressed, to save that page to a folder. |
| `contextMenus` | Adds "Save to Nordlys" to the right-click menu of pages and links. |
| `topSites` (optional) | Requested only when the user presses "Start from my most visited sites" on an empty board, to make one folder of them. |
| Optional host permissions | Asked from the click that needs them: Todoist, GitHub, a calendar link, a feed, a JSON address, a list of links, an address to read settings from, or, while Check the bookmarks runs, the sites on the board. `https://*/*` is listed because these can be on any server; only the origins of addresses the user gave are requested. |
| `bookmarks` (optional) | Requested only when the user brings their browser bookmarks onto the board, points a folder at a browser bookmark folder, or lets the search box find bookmarks. Only read from. Never requested at install. |
| Remote code | None. The CSP is `script-src 'self'; object-src 'self'`. |
| Data collection | None. Declare no collected data. |

## Permission justifications

The dashboard asks for a justification per permission in its own field, capped
at **1000 characters**, and a reviewer will not accept "required for
functionality" for any of them. Each one below names the user-visible feature
that needs it and stays inside the cap; the count is in the heading so a later
edit can be checked against it. Paste verbatim.

### `bookmarks` (optional) — 945 chars

```
Three things the user turns on read their browser bookmarks, and nothing else does:
• "Bring my browser's bookmarks" on an empty board copies their folders onto it once (getTree).
• A Nordlys folder can mirror one of their bookmark folders: getTree() lists their folders so they can pick one, getChildren(id) reads the links in the one they picked, and the change events keep that copy current when they edit it in Chrome.
• With "Your browser's bookmarks" turned on in Settings → General, the search box finds bookmarks that match what they type (search()).

Nothing is written: there is no create, update, move or remove call anywhere in the source.

It is in optional_permissions, so nothing is asked at install and the extension works fully without it. permissions.request() runs only from the click that turns one of these on; declining changes nothing. Bookmark titles and URLs go only to local extension storage and are never transmitted.
```

### `tabs` (optional) — 828 chars

```
The dashboard's Tab stash card: when the user presses "Stash the tabs of this window", Nordlys reads the titles and addresses of that window's tabs once, saves them on the device and closes those tabs. The Tabs card lists the tabs open more than once and those not looked at for days, and closes only the ones the user picks. The Recently closed card shows the titles of tabs closed lately. The search box can offer to switch to an open tab whose title matches what is typed. The Focus timer card can keep sites the user lists shut while a focus session runs: only then does the service worker listen for the address a tab goes to, and compare it with that list.

It is in optional_permissions: nothing is asked at install, and permissions.request() runs only from the click that turns one of these on. Nothing is sent anywhere.
```

### `topSites` (optional) — 526 chars

```
A new tab page is only useful once it holds the user's sites, and many people have no bookmarks worth bringing. An empty Nordlys board therefore offers "Start from my most visited sites". When the user presses it, Nordlys calls topSites.get() once and makes one folder of up to twelve of those sites on the device. That is the only use of the API.

It is in optional_permissions: nothing is asked at install, and permissions.request() runs only from that button. Nothing is read in the background and nothing is sent anywhere.
```

### `history` (optional) — 358 chars

```
The search box can also find pages the user visited. When they turn on "Pages you visited" in Settings → General, history.search() is called with what they type, and a few matching pages are shown. That is the only use of the API.

It is in optional_permissions: permissions.request() runs only from that switch. Nothing is kept and nothing is sent anywhere.
```

### `sessions` (optional) — 349 chars

```
The dashboard's Recently closed card lists the tabs and windows the user closed lately (sessions.getRecentlyClosed) and brings one back when they click it (sessions.restore). That is the only use of the API.

It is in optional_permissions: permissions.request() runs only when the user adds that card. Nothing is stored and nothing is sent anywhere.
```

### `activeTab` — 250 chars

```
The toolbar button saves the page in view to one of the user's folders. activeTab gives the popup that page's address and title when the button is pressed, and nothing else. The page waits in local storage until the next new tab puts it on the board.
```

### `contextMenus` — 183 chars

```
Adds "Save to Nordlys" to the right-click menu of pages and links. The page or link is kept on the device until the next new tab puts it on the user's board. Nothing is sent anywhere.
```

### Optional host permissions — 737 chars

```
Nothing is granted at install. Sites are asked for from the click that needs them: Todoist (api.todoist.com) and GitHub (api.github.com) for the user's own tasks; the address of a calendar link; the feeds and sites the user lists on the Feeds card; the JSON address on a Value card; a list of links a folder follows; an address the user reads settings from; and, for "Check the bookmarks", the sites on the user's board, handed back with permissions.remove() when the check ends. Because these can be at any address, the list includes https://*/*, but Nordlys only ever requests the origins of addresses the user has given. Cards refresh only while they are on the dashboard, and a followed list at most once an hour, as PRIVACY.md says.
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
No build step: every file in the package is the source as written. There is no remote code (CSP script-src 'self'). The optional host permission https://*/* is never requested as a whole: Nordlys asks only for the origins of addresses the user gives (a calendar link, a feed, a JSON address, a list of links, an address to read settings from) and, while Check the bookmarks runs, the sites on the user's board, from the click that needs them. bookmarks, tabs, topSites, history and sessions are optional and requested only from the buttons and switches that use them.
```

## Safari (App Store)

Built on a Mac: `npm run ports safari`, then `xcrun safari-web-extension-converter dist/safari --app-name Nordlys --bundle-identifier io.github.sa1ntsinner.nordlys`. Safari has no search API for extensions, so the Safari build asks for a search engine once in Settings → General. Say so in the App Store text. Safari has no favicon cache for extensions and no most-visited list, so the Safari build has neither. Safari extensions can't read the browser's bookmarks, history or recently closed tabs, and the Safari build has no background page: no "Save to Nordlys" in the right-click menu (the toolbar button still saves), no `nl` in the address bar and no sites kept shut while focusing.

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
- Weather card, and the place search for the sky: Open-Meteo (api.open-meteo.com and geocoding-api.open-meteo.com), for the place the user chooses. No key or account.
- Photos and picture of the day skies, only while one is shown: Wikimedia Commons (api.wikimedia.org, commons.wikimedia.org, upload.wikimedia.org), the Metropolitan Museum (collectionapi.metmuseum.org, images.metmuseum.org) or NASA EPIC (epic.gsfc.nasa.gov).
- Money typed in the search box ("100 usd to eur"): ExchangeRate-API (open.er-api.com), at most once a day, carrying nothing the user typed.
- Icon search: Iconify's public API (api.iconify.design), only when the user searches for an icon; images.weserv.nl, only to load an icon image address the user pasted.
- Addresses the user gives: feeds, a value from a JSON address, a list of links a folder follows, settings read from an address, and the user's own bookmarks when they ask to check them or to see whether a site is up.
- Connected apps (optional, off by default): Todoist, GitHub, or a calendar link (ICS), with a token the user enters. The token stays on the Mac. While such a card is on the dashboard it refreshes itself every few minutes.
The privacy policy lists all of it: https://github.com/sa1ntsinner/nordlys-tab/blob/main/PRIVACY.md

5. Regions
The app works the same in all regions. Its interface is in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

6. Regulated industries and third-party material
Not applicable: Nordlys is not in a regulated industry and includes no protected third-party material.
```

