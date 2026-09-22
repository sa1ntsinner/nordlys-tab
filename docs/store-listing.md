# Chrome Web Store listing

The exact text to paste into the Developer Dashboard. Keep this file and the
dashboard in step; when one changes, change the other.

**On the version number.** This is still a beta, and the number does not say so.
It cannot: the store accepts only versions that increase, and this line started
at 2.x before the product had earned it. Renumbering down to 0.x would be
rejected on upload and would strand everyone already installed, so the word
carries what the number cannot — the description below opens by saying it.

## Title

```
Nordlys
```

There is nothing to paste. The dashboard shows the title read-only and takes it
from `name` in `manifest.json`, so the way to change it is to change the
manifest and upload a new package.

The name carries no keyword, which is the deliberate trade: someone browsing for
"new tab" will not match on the title, and has to match on the summary and
description instead. Both say it in their first line.

## Summary (132 characters maximum)

```
A new tab page with 21 themes, six living skies you can recolour, folders you arrange, and a search box that does arithmetic.
```

125 characters. Identical to the `description` field in `manifest.json`, and a unit test keeps it so.

## Category

Productivity.

## Detailed description

```
Nordlys replaces the new tab page. It opens instantly, keeps everything on your machine, and is meant to be looked at rather than got past.

This is a beta. Things get removed as well as added — two background scenes and four gradient variants have already gone, each one dropped because it measured as indistinguishable from another rather than because someone disliked it. What does not change without warning is your setup: every upgrade that migrates anything keeps a restore point you can go back to.

Bookmarks live in folders you arrange yourself. Drag a bookmark into another folder and the tiles make room for it as it goes; drag a folder into a gap, or between two rows to start a new row, and the board shows exactly where it will land before you let go. Choose Fitted and every row runs edge to edge with folders of one height, or press Tidy up and folders of a similar height line up side by side. Pull a folder's edge to change how many columns it has, and fold the ones you rarely open into a dock at the bottom. All of it works from the keyboard, and all of it has Undo. Right click anything to edit it in place.

Search for a brand or product and Nordlys offers clean Simple Icons vectors, then saves your choice locally instead of hotlinking it. Chrome's favicon cache, an image URL, a local file and a monogram remain available. A black logo on a black theme used to disappear; Nordlys now measures every icon against its plate and re-tones only marks that would vanish, so coloured logos keep their colour. You can override that decision on any bookmark.

21 themes, 11 dark and 10 light. Each one sets the background, the glass tint and the colours of the canvas behind it, so Gruvbox gets an amber sky and OLED Obsidian stays properly black. Follow the system, or pin it to dark or light. If none of the 21 fit, build your own in the theme studio or write CSS directly.

Type is split into three slots: the clock and headings, the interface, and monospace. Choose from the bundled faces or from the fonts already installed on your computer.

Six living skies, each its own composition: Nordlys, the aurora it is named after; Halo, a moon inside its ice ring; Silk, threads drawn through a slow current; Frost, fern ice growing in from the edges; Contour, a survey map of slowly wandering hills; and Fjord. Or your own image or looping video, stored locally, or a flat theme colour. Colour moods tint any sky, and you can mix your own from three colours while the sky follows your picks. Motion and Atmosphere dial a scene from a slow shimmer down to Still, where it is painted once and held; if your system asks for reduced motion, that is what you get automatically. Shuffle a sky you like into a new arrangement, and it stays that way on every new tab. Turn on Follow the time of day and every sky is lit by where the sun is in your time zone: a warm glow at sunrise and sunset, a pale calm sky by day, a cool blue hour, stars at night — worked out on your machine, with no location permission.

Text stays readable on every sky. Behind the clock, the date and the search field, Nordlys measures the sky it has just painted and quiets it exactly as much as the text needs, and every theme's text colours are held above the contrast readable text requires on each surface they sit on. Your own wallpaper is measured too: a bright photo gets a soft shade from the top and more solid glass where the words are, and stays itself everywhere else.

Type > in the search box and the board takes commands: theme nord, sky frost, mood ember, move YouTube to Daily, new folder Reading. The page shows the result before you press Enter, and one undo takes it back. And a look — theme, sky, mood, fonts — can be copied as one line of text or saved as a picture, without a single bookmark in it.

The search box uses whichever search engine you have set in Chrome — it does not have one of its own and does not ask you to pick. As you type it offers your own bookmarks, your recent searches, and arithmetic: 45 * 12 + sqrt(144) gets its answer right there, one click to copy. Nothing you type is sent anywhere until you press Enter.

A folder can follow one of your browser's bookmark folders instead of being filled in by hand. It mirrors one way, so the browser keeps the data — which also means an update here cannot lose it. Nordlys asks for permission to read bookmarks at the moment you link a folder, never at install.

No account, no analytics, no telemetry, no remote code. Settings and bookmarks live in local storage. Brand-icon search contacts Iconify only after Search is pressed, sends only the phrase in that field, and stores the selected vector locally. Export the lot to JSON whenever you want.

Available in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

Open source under the MIT licence: https://github.com/sa1ntsinner/nordlys-tab
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

Run `npm run artwork`. Everything in `docs/store-assets/` and `docs/assets/` is
generated from the running extension by `tools/artwork/`, so a picture cannot
claim a feature the code no longer has. It takes a few minutes, most of it
deliberate canvas warm-up: the aurora needs roughly fourteen seconds before it
draws ribbons worth showing. The README animations also need `ffmpeg` on PATH.

The generators are not part of `npm test`, since they assert nothing.

| File | Size | Shows |
| --- | --- | --- |
| `screenshot-1-aurora.png` | 1280x800 | The board on the Aurora scene, with two folders in the dock |
| `screenshot-2-themes.png` | 1280x800 | Settings, Appearance: the 11 dark theme presets |
| `screenshot-3-scenes.png` | 1280x800 | Settings, Background: scene cards with Motion and Atmosphere |
| `screenshot-4-light.png` | 1280x800 | The same board on Nordic Snow |
| `screenshot-5-search.png` | 1280x800 | The search bar answering `45 * 12 + sqrt(144)` |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee tile |
| `promo-small-440x280.png` | 440x280 | Small tile |
