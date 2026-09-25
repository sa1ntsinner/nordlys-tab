# Chrome Web Store listing

Copy this text into the Chrome Web Store developer dashboard. Keep this file in
step with the listing.

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
A Chrome new tab page with bookmark folders, 9 animated backgrounds, 21 themes, math and commands in the search box.
```

116 characters. This is also the `description` in `manifest.json`.

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

Chrome bookmarks
A folder can mirror one of your Chrome bookmark folders. Nordlys only reads it. It asks for bookmark access when you link the folder, not at install.

Privacy
No account, analytics, tracking or remote code. Settings and bookmarks stay on your device. Brand icon search contacts Iconify only after you press Search, sending only the phrase you typed. You can export your setup as JSON.

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

## Artwork

Run `npm run artwork` to capture the extension for `docs/store-assets/`, the
link preview and `site/assets/`. It takes about five minutes. The aurora needs
about fourteen seconds to settle, and the icon close-up needs a connection to
Iconify.

The artwork generators aren't part of `npm test`; they don't check a result.

| File | Size | Shows |
| --- | --- | --- |
| `screenshot-1-sky.png` | 1280x800 | "Bookmarks on your new tab": Aurora Void on Nordlys, with two folders folded under the board |
| `screenshot-2-skies.png` | 1280x800 | "9 animated backgrounds": every background, each in a different theme |
| `screenshot-3-arrange.png` | 1280x800 | "Move folders around": Catppuccin Mocha on Silk, Fitted, with Size & spacing open |
| `screenshot-4-extras.png` | 1280x800 | "Search, icons and time of day": math and commands, brand icon search, and Boreal Emerald through a day in Berlin |
| `screenshot-5-themes.png` | 1280x800 | "21 themes": Porcelain Light on Baikal, and Gruvbox Dark on Silk with the themes open |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee tile |
| `promo-small-440x280.png` | 440x280 | Small tile |
| `docs/brand/buymeacoffee-cover.png` | 2400x600 | Cover for the Buy Me a Coffee page (not uploaded to the store) |
| `site/assets/og.png` | 1200x630 | The picture chats and social sites show for a link to the website |

`store-board.cjs` sets up the boards. `store-shots.spec.cjs` and `promo.spec.cjs`
take the captures; `compose.cjs` lays them out. `site-assets.cjs` makes the
WebP files for the site and README. Upload the screenshots in number order.
The store shows the first one in search. To retake only the store pictures:
`npx playwright test --config=tools/artwork/playwright.config.cjs store-shots promo`.
