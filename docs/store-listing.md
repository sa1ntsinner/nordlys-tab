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
A new tab page with 21 themes, animated canvas scenes, bookmark folders you arrange yourself, and search that does arithmetic.
```

126 characters. Identical to the `description` field in `manifest.json`.

## Category

Productivity.

## Detailed description

```
Nordlys replaces the new tab page. It opens instantly, keeps everything on your machine, and is meant to be looked at rather than got past.

This is a beta. Things get removed as well as added — two background scenes and four gradient variants have already gone, each one dropped because it measured as indistinguishable from another rather than because someone disliked it. What does not change without warning is your setup: every upgrade that migrates anything keeps a restore point you can go back to.

Bookmarks live in folders you arrange yourself. Drag a tile into another folder, drag folders around, pull a corner to change how many columns a folder has, fold the ones you rarely open into a dock at the bottom. Right click anything to edit it in place.

Icons come from a built-in vector set that recognises most sites by domain, or from a favicon, an image URL, a local file, or a monogram. A black logo on a black theme used to disappear. Nordlys now measures every icon against the plate behind it and re-tones only the ones that would vanish, so coloured logos keep their colour. You can override that decision on any bookmark.

21 themes, 11 dark and 10 light. Each one sets the background, the glass tint and the colours of the canvas behind it, so Gruvbox gets an amber sky and OLED Obsidian stays properly black. Follow the system, or pin it to dark or light. If none of the 21 fit, build your own in the theme studio or write CSS directly.

Type is split into three slots: the clock and headings, the interface, and monospace. Choose from the bundled faces or from the fonts already installed on your computer.

One living scene — the aurora it is named after — your own image or a looping video, stored locally, or a flat theme colour. Motion and Atmosphere dial the aurora from a slow shimmer down to Still, where the scene is painted once and held. If your system asks for reduced motion, that is what you get automatically: the picture, without the movement.

Search covers ten engines with bang shortcuts, or any engine you like by pasting its address with %s where the query goes. It mixes in your own bookmarks and recent searches, and does arithmetic: type 45 * 12 + sqrt(144) and the answer sits above the suggestions.

A folder can follow one of your browser's bookmark folders instead of being filled in by hand. It mirrors one way, so the browser keeps the data — which also means an update here cannot lose it. Nordlys asks for permission to read bookmarks at the moment you link a folder, never at install.

No account, no analytics, no telemetry, no remote code. Settings and bookmarks live in local storage, and the only requests are search suggestions from the engine you chose and the favicons you ask for. Export the lot to JSON whenever you want.

Available in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

Open source under the MIT licence: https://github.com/sa1ntsinner/nordlys-tab
```

## Privacy practices

Answer the dashboard's justification fields from `PRIVACY.md`:

| Field | Answer |
| --- | --- |
| Single purpose | Replaces the new tab page with a customisable start page. |
| `storage` | Saves bookmarks, themes and settings on the device. |
| `unlimitedStorage` | Holds user wallpaper images and video loops in IndexedDB. |
| `favicon` | Draws site icons from Chrome's local favicon cache. |
| Host permissions | Search-suggestion endpoints for the ten engines, plus `images.weserv.nl` when a pasted icon URL blocks cross-origin loading. |
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

### `storage` — 248 chars

```
Stores the user's own configuration on the device: their bookmark folders and tiles, and the theme, fonts, layout, background and search engine they chose. The extension has no account and no server, so this is the only place a user's setup exists.
```

### `unlimitedStorage` — 336 chars

```
Users can set their own image or a looping video as the page background. These are held as blobs in IndexedDB on the device and routinely exceed the 5 MB default quota - a short 1080p loop passes it on its own - so without this the feature fails on the files people actually pick. Nothing is uploaded; the file never leaves the machine.
```

### `favicon` — 262 chars

```
Bookmark tiles can show a site's icon. This reads Chrome's own local favicon cache via chrome.runtime.getURL("/_favicon/?pageUrl=..."), so an icon can be drawn for a site the user has already visited without sending that address to a third-party favicon service.
```

### Host permissions — 636 chars

```
Seven of the eight are search-suggestion endpoints for the engines offered: suggestqueries.google.com, duckduckgo.com, api.bing.com, search.brave.com, ac.ecosia.org, suggest.yandex.com and en.wikipedia.org. One request goes to exactly one of them - whichever engine the user selected - carrying only what they typed in the search box, so suggestions can appear below it.

The eighth, images.weserv.nl, is used only when a user pastes their own image URL for a bookmark icon and that server refuses a cross-origin request; the image is fetched through it so the icon can be drawn. It never sees browsing data or any page the user visits.
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
