# Store listings

Copy this text into the Chrome Web Store developer dashboard, and the Edge,
Firefox and Safari sections below into theirs. Keep this file in step with the
listings.

Nordlys is still a beta. Its version is 2.x because the store only accepts
higher version numbers. The description says it's a beta.

## Title

```
Nordlys
```

The dashboard takes the title from `name` in `manifest.json`. You can't edit it
there.

The title doesn't say "new tab", so the summary and description say it early.

## Summary (132 characters maximum)

```
A Chrome new tab page with bookmark folders, a dashboard for tasks and focus, 9 animated backgrounds and 21 themes.
```

115 characters. This is also the `description` in `manifest.json`.

## Category

Productivity.

## Detailed description

```
Nordlys replaces Chrome's new tab page. I wanted my bookmarks and something nice to look at in one place, so I made this.

It's still a beta. Before an update changes how your setup is stored, Nordlys keeps a restore point.

Bookmarks
Put bookmarks in folders and move the folders around. You can see where one will land before you drop it. Fitted mode lines rows up edge to edge; Tidy up puts folders of similar height together. Adjust tile size, spacing, board width and icon labels in one panel. Fold folders you rarely use under the board, or turn on One page fit to keep everything on screen. You can use the keyboard, undo changes and right-click to edit.

Icons
Press Search to look up brand icons from Iconify's Simple Icons set. The icon you pick is saved on your device. You can also use Chrome's favicon, an image link, a file or a letter. Dark logos are adjusted on dark themes, and you can turn that off per bookmark.

Backgrounds
Choose from 9 animated backgrounds: Nordlys (the aurora), Polaris (star trails round the pole star), Halo (a moon inside an ice ring), Pillars (columns of light over a frozen town), Nacre (mother-of-pearl clouds at dusk), Silk (threads in a slow current), Baikal (black lake ice with frozen bubbles), Contour (a map of slowly moving hills) and Fjord. You can also use your own picture, a looping video or a plain colour. Colour moods tint the background, and you can mix one from three colours. Slow the motion down to Still; it switches to Still automatically if your system asks for reduced motion. Follow the time of day uses your clock and time zone to change the light. It doesn't ask for your location.

Themes
There are 21 themes: 11 dark and 10 light. Each also recolours the background, so Gruvbox gets an amber sky and OLED Obsidian stays black. You can follow the system setting, choose dark or light, make a theme or write CSS. Pick bundled fonts or fonts on your computer for the clock, interface and monospace text. Nordlys dims the area behind the clock, date and search box when needed, including over your own wallpaper.

Search
The search box uses the search engine set in Chrome. It shows your bookmarks, recent searches and answers to math like 45 * 12 + sqrt(144) as you type. It sends nothing while you type; pressing Enter sends the search through Chrome.

Type > for commands such as theme nord, sky polaris or move YouTube to Daily. You can see the result before you press Enter and undo it afterward. Copy your theme, background, mood and fonts as one line of text, or save the look as a picture. Bookmarks aren't included.

Profiles and sync
Keep several whole setups, like Work and Home, and switch from the chip under the greeting. Turn on sync and your setup follows you to every Chrome you're signed in to, through Chrome's own sync, with no account of ours. Edits from different devices merge instead of overwriting each other. A bookmark or folder can stay on one device only, or have a different address there.

Dashboard
Turn on the dashboard and cards for the day sit above your folders: focus of the day, tasks, habits, a focus timer, notes, weather, world clocks, a countdown, a tab stash and a line for the day. Drag a card by its title to move it and the others make room; stretch it by its corner. Start from one of five layouts, and hide the folders while it's on. It's free, like everything else here.

Tasks understand dates and importance typed in words ("call mum tomorrow !"), have steps inside, and sort into Today, Later and Done.

Focus mode gives the whole page to one thing: a large Pomodoro or count-up timer, sounds made in the browser (rain, ocean, wind, deep noise), your tasks at the side and how long you've focused today.

Connected apps
See your tasks from the task managers and code hosts you already use, and your events from any calendar with an ICS link. Nordlys talks to each app directly with a token you create there. The token stays on your device, and Nordlys asks for access to an app's address only when you connect it.

Ask
The Ask card talks to a model you choose: Chrome's built-in model on your device, your own key for OpenAI, Anthropic, Gemini or OpenRouter, or a model on your computer through Ollama. Type ? and a question in the search box to ask it.

Chrome bookmarks
A folder can mirror one of your Chrome bookmark folders. Nordlys only reads it. It asks for bookmark access when you link the folder, not at install.

Privacy
No account, analytics, tracking or remote code. Settings and bookmarks stay on your device. Brand icon search contacts Iconify only after you press Search, sending only the phrase you typed. The weather card asks Open-Meteo for the place you chose. Keys and tokens for Ask and connected apps stay on your device and go only to the service they belong to. You can export your setup as JSON.

Nordlys is available in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

It's free and open source under the MIT licence: https://github.com/sa1ntsinner/nordlys-tab

There's a Buy me a coffee link in Settings → Support.
```

## Privacy practices

Answer the dashboard's justification fields from `PRIVACY.md`:

| Field | Answer |
| --- | --- |
| Single purpose | Replaces the new tab page with a start page of the user's own bookmarks. Searching from it goes to the search engine already set in Chrome, through chrome.search; the extension has no engine setting of its own. |
| `storage` | Saves bookmarks, themes and settings on the device. |
| `unlimitedStorage` | Holds user wallpaper images and video loops in IndexedDB. |
| `favicon` | Draws site icons from Chrome's local favicon cache. |
| `search` | Sends what is typed in the search box to the search engine the user has set in Chrome. The extension never chooses the engine. |
| Host permissions | One host, `images.weserv.nl`, used only when a pasted icon URL blocks cross-origin loading. |
| `tabs` (optional) | Requested only when the user presses "Stash the tabs of this window" on the Tab stash card, to save and close that window's tabs. |
| `identity` (optional) | Requested only when the user signs in to Google or Microsoft to connect their tasks or calendar. |
| Optional host permissions | Asked one site at a time, when the user connects an AI provider, an app or a calendar link. `https://*/*` is listed so a self-hosted address (GitLab, Jira, a calendar) can be asked for; it is never requested as a whole. |
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

### `identity` (optional) — 465 chars

```
The dashboard can show tasks and events from Google Tasks, Google Calendar and Microsoft To Do. Connecting one opens that company's own sign-in page through chrome.identity.launchWebAuthFlow, with PKCE. Nordlys never sees the password; it keeps the access token on the device only and uses it to read the user's own tasks and events straight from that company's API.

It is in optional_permissions and is requested only from the Sign in button of those connections.
```

### Optional host permissions — 667 chars

```
Nothing beyond images.weserv.nl is granted at install. The optional list covers features the user turns on one at a time: the Ask card calls the AI provider the user picked with their own key (api.openai.com, api.anthropic.com, generativelanguage.googleapis.com, openrouter.ai, or localhost for a model on their computer), and connected apps read the user's own tasks and events from the service they connect. Because GitLab, Jira and calendar links can live at any address the user owns, the list includes https://*/*, but Nordlys only ever requests the single origin the user has just typed, at the moment they press Connect. Nothing is contacted in the background.
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

### Host permissions — 528 chars

```
One host: images.weserv.nl. It is used only when a user pastes their own image URL for a bookmark icon and that server refuses a cross-origin request; the image is fetched through this proxy so the icon can be drawn. It never sees browsing data or any page the user visits, and it is not contacted unless the user pastes such an address.

Previous versions also listed seven search-suggestion endpoints. Those are gone: the box no longer fetches live suggestions, so nothing typed leaves the device until the user presses Enter.
```

### Remote code — 167 chars

```
None. All JavaScript ships in the package. The content security policy is "script-src 'self'; object-src 'self'", so the extension cannot load or evaluate remote code.
```

## Edge Add-ons

Upload `nordlys-edge-v<version>.zip` (`npm run ports`). It is the Chrome build with a summary that doesn't name Chrome.

- **Summary:** A new tab page with bookmark folders, a dashboard for tasks and focus, 9 animated backgrounds and 21 themes.
- **Description:** the Chrome text above, with "Chrome" replaced by "Edge" in the first line, the Search paragraph and the Chrome bookmarks heading ("Edge favourites"). Sync goes through Edge's own sync.
- **Category:** Productivity.
- **Privacy policy URL:** the PRIVACY.md link on GitHub.
- Edge asks the same permission questions as Chrome; the answers above apply word for word.

## Firefox (addons.mozilla.org)

Upload `nordlys-firefox-v<version>.zip`. The add-on id is `nordlys@sa1ntsinner.github.io` and can't change after the first upload.

- **Summary (250 characters):** A new tab page with bookmark folders, a dashboard for tasks, habits and focus, 9 animated backgrounds and 21 themes. No account, no tracking.
- **Description:** the Chrome text above with these changes: "Nordlys replaces Firefox's new tab page"; Search: "The search box uses the search engine set in Firefox"; drop the "Chrome bookmarks" paragraph's last sentence about Chrome and say "Firefox bookmarks"; Profiles and sync: sync goes through Firefox Sync.
- **Differences in Firefox**, worth one line in the description: site icons come from the site or a provider you pick, because Firefox has no icon cache for extensions; Focus mode has no small floating timer window (Firefox has no document picture-in-picture yet).
- **Categories:** Tabs; Appearance.
- **Data collection:** the manifest declares `data_collection_permissions: { required: ["none"] }`. Answer "none" in the form as well.
- **Source code:** not needed. Nothing is minified or built; the package is the source.
- **Notes for the reviewer** (paste):

```
No build step: every file in the package is the source as written. There is no remote code (CSP script-src 'self'). The optional host permission https://*/* is requested one origin at a time, only when the user connects a self-hosted service (GitLab, Jira) or a calendar link, from the Connect button. identity is used only for the Google/Microsoft sign-in window for the task connections, and only after the user presses Sign in.
```

## Safari (App Store)

Built on a Mac: `npm run ports safari`, then `xcrun safari-web-extension-converter dist/safari --app-name Nordlys --bundle-identifier io.github.sa1ntsinner.nordlys`. Safari has no search API for extensions, so the Safari build asks for a search engine once in Settings → General. Say so in the App Store text. Safari has no favicon cache for extensions and no sign-in window API, so Google and Microsoft connections show "Soon" there.

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
Nordlys is for everyday Mac users who open many tabs a day. Each new tab shows their favourite sites in folders over an animated sky, with a search box, and, if they turn it on, a dashboard for the day: tasks, habits, notes, world clocks, a countdown, weather and a focus timer. It saves the time of finding the sites they use most and keeps the day's tasks in view, without an account and without tracking. It is free and open source: https://github.com/sa1ntsinner/nordlys-tab

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
- Connected apps (optional, off by default): Todoist, GitHub, GitLab, Trello, Asana, ClickUp, Linear, Jira, Notion, or a calendar link (ICS), with a token the user enters. The token stays on the Mac.
- Ask card (optional, off by default): sends the user's question to the AI provider the user sets up with their own API key (OpenAI, Anthropic, Google Gemini, OpenRouter, or a server they name), or to a model running on their own Mac (Ollama). Nothing is sent until the user adds a provider and asks a question.
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
| `screenshot-1-dashboard.png` | 1280x800 | "A dashboard for your day": Nord Frost on Halo, the Planner layout with a morning's tasks and habits |
| `screenshot-2-sky.png` | 1280x800 | "Bookmarks on your new tab": Aurora Void on Nordlys, with two folders folded under the board |
| `screenshot-3-focus.png` | 1280x800 | "Focus mode": OLED Obsidian, a Pomodoro six minutes in, rain on |
| `screenshot-4-skies.png` | 1280x800 | "9 animated backgrounds": every background, each in a different theme |
| `screenshot-5-connect.png` | 1280x800 | "Your tasks from the apps you use": the dashboard on Polaris, and the apps it connects to |
| `screenshot-6-arrange.png` | 1280x800 | "Move folders around": Catppuccin Mocha on Silk, Fitted, with Size & spacing open |
| `screenshot-7-extras.png` | 1280x800 | "Search, icons and time of day": math and commands, brand icon search, and Boreal Emerald through a day in Berlin |
| `screenshot-8-themes.png` | 1280x800 | "21 themes": Porcelain Light on Baikal, and Gruvbox Dark on Silk with the themes open |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee tile |
| `promo-small-440x280.png` | 440x280 | Small tile |
| `docs/brand/buymeacoffee-cover.png` | 2400x600 | Cover for the Buy Me a Coffee page (not uploaded to the store) |
| `site/assets/og.png` | 1200x630 | The picture chats and social sites show for a link to the website |

`store-board.cjs` sets up the boards. `store-shots.spec.cjs`, `dash-shots.spec.cjs`
(the dashboard, Focus mode and connected apps) and `promo.spec.cjs` take the captures; `compose.cjs` lays them out. `site-assets.cjs` makes the
WebP files for the site and README. Upload the screenshots in number order.
The store shows the first one in search. The Chrome Web Store takes five: use 1 to 5.
Edge Add-ons takes up to ten and addons.mozilla.org has no limit: use all eight. To retake only the store pictures:
`npx playwright test --config=tools/artwork/playwright.config.cjs store-shots promo`.
