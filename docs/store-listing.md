# Chrome Web Store listing

The exact text to paste into the Developer Dashboard. Keep this file and the
dashboard in step; when one changes, change the other.

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

Bookmarks live in folders you arrange yourself. Drag a tile into another folder, drag folders around, pull a corner to change how many columns a folder has, fold the ones you rarely open into a dock at the bottom. Right click anything to edit it in place.

Icons come from a built-in vector set that recognises most sites by domain, or from a favicon, an image URL, a local file, or a monogram. A black logo on a black theme used to disappear. Nordlys now measures every icon against the plate behind it and re-tones only the ones that would vanish, so coloured logos keep their colour. You can override that decision on any bookmark.

21 themes, 11 dark and 10 light. Each one sets the background, the glass tint and the colours of the canvas behind it, so Gruvbox gets an amber sky and OLED Obsidian stays properly black. Follow the system, or pin it to dark or light. If none of the 21 fit, build your own in the theme studio or write CSS directly.

Type is split into three slots: the clock and headings, the interface, and monospace. Choose from the bundled faces or from the fonts already installed on your computer.

One living scene — the aurora it is named after — and four still compositions built from the theme's own colours: Horizon, Bloom, Corner, Veil. The still ones are plain CSS, so they cost nothing to hold. Motion and Atmosphere dial the aurora down to a slow shimmer or almost nothing. Your own image or a looping video works too, stored locally.

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

Privacy policy URL: the raw `PRIVACY.md` on GitHub.

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
