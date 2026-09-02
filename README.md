# Nordlys

A new tab page for Chrome that opens instantly and looks like something you'd actually want to stare at all day. Frosted glass, a live aurora painted on canvas, and bookmarks organized the way you organize them, not the way the browser thinks you should.

No frameworks, no build step, no analytics. Plain JavaScript and CSS, everything stored on your machine.

**Still a beta.** The version number cannot say so — the store only accepts numbers that go up, and this line of them started at 2.x before the product deserved it — so it is said here instead. Things still get removed as well as added: two background scenes and four gradient compositions have already gone, each one measured rather than argued about. What does not get broken is your setup, which is why every migration keeps a restore point.

![Nordlys live aurora](docs/assets/aurora-live.gif)

## Why this exists

I wanted a start page as fast as Tabliss and as customizable as nightTab, and neither quite got there. Tabliss is quick but you can't shape it much. nightTab bends any way you want but my setup took ages to load even on decent hardware. So this is the attempt to have both: the page renders in one DOM pass, the shader pauses the moment the tab loses focus, and pretty much every visible surface has a knob somewhere in settings.

## Themes

21 built-in themes, 11 dark and 10 light, and they differ for real: each one drives the background gradient, the glass tint, and the colors of the canvas shader itself. Gruvbox gets an amber aurora, Boreal gets an emerald one, OLED Obsidian stays pure black with faint graphite curtains.

![Theme carousel](docs/assets/themes-carousel.gif)

| Gruvbox Dark | OLED Obsidian | Mint Breeze |
| :---: | :---: | :---: |
| ![Gruvbox](docs/assets/theme-gruvbox-dark.png) | ![OLED](docs/assets/theme-oled.png) | ![Mint](docs/assets/theme-mint.png) |

There's a Dark / Light / Auto switch (Auto follows your OS and flips live), and a theme studio that asks for three colors — the page, the glass and the accent — and derives the rest, holding the text colors above WCAG AA against both surfaces. The remaining four stay editable if you want them. If none of that is enough, a live CSS editor with a class reference is built in.

## What else it does

- **Folders that follow the browser.** Point a folder at one of your browser's bookmark folders and it mirrors it, one way, so the browser stays the owner of the data and nothing here can lose it. The permission is optional and asked for on the click that links a folder, so installing Nordlys shows no prompt about reading bookmarks.
- **Bookmarks as folders.** Drag tiles between folders, drag whole folders around, resize a folder's column count by pulling its corner, fold folders into a small dock at the bottom. Right click anything to edit it in place.
- **Icons your way.** A built-in vector library with auto-detection by domain, site favicons, any image URL, a local file, or a monogram. There's a small cropper studio with pan, zoom, and rotate for when a logo comes with junk around it.
- **Search that does math.** Type `45 * 12 + sqrt(144)` and the answer appears in the dropdown, one click to copy, next to your own bookmarks and recent searches. Pressing Enter hands the query to whatever search engine you have set in Chrome — the page does not have one of its own. It used to: ten engines, bang shortcuts, a custom template. The store read that as a second product bolted onto the first, and it was right; choosing a search engine is the browser's job.
- **Backgrounds.** One living scene — the aurora the product is named after — plus your own image or looping video, stored locally in IndexedDB with blur and dim, or a flat theme colour. Motion and Atmosphere dial the aurora from a slow shimmer down to Still, where the scene is painted once and held: no loop, nothing scheduled, and the glass above it stops re-blurring. That is also what a system-level Reduce Motion setting now gets — the picture held, rather than a blank canvas.
- **Type.** Three slots: the clock and headings, the interface, and monospace. Bundled faces, or the fonts already installed on your machine.
- **Icons that stay visible.** Each icon is measured against the plate behind it, and only the ones that would vanish get re-toned, so a coloured logo keeps its colour and a black mark on a black theme doesn't disappear. Overridable per bookmark.
- **Surfaces.** Glass at three levels — frosted, subtle, none — rather than four raw filter sliders, because those were a decision nobody made handed over in the form the renderer happens to take, and they reached states where text stopped being readable. Corner radius, tile size, spacing, icon shape, ambient glow and hover style stay as they were. Every control updates the page as you move it.
- **8 languages.** English, Russian, Spanish, German, French, Japanese, Chinese, Turkish.
- **Import and export.** Netscape HTML bookmarks from any browser in, JSON or HTML back out.

![Search calculator](docs/assets/still-search-calc.png)

| Settings, dark theme | Settings, light theme |
| :---: | :---: |
| ![Settings dark](docs/assets/still-settings-dark.png) | ![Settings light](docs/assets/still-settings-light.png) |

## Performance

The board is built with a single `DocumentFragment` and swapped in with `replaceChildren`, so first paint doesn't reflow. Edits patch individual tiles instead of re-rendering the page. The shader is time-based (same speed on 60 and 144 Hz panels), caps device pixel ratio at 1.5, and fully stops via the Page Visibility API when the tab is hidden, so idle CPU cost is zero.

## Privacy

Everything lives in local storage and IndexedDB. The only network request the extension makes on its own is an icon download when you paste an image URL. Typing in the search box sends nothing anywhere; pressing Enter goes to your browser's search engine, the same as the address bar. There is no `<all_urls>` permission and no telemetry of any kind. Details in [PRIVACY.md](PRIVACY.md).

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the project folder.
4. Open a new tab.

Works in Chrome, Brave, Edge, and other Chromium browsers. Publishing steps for the Chrome Web Store are in [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

## License

MIT. See [LICENSE](LICENSE).
