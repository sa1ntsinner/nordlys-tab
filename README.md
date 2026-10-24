<p align="center">
  <img src="icons/icon128.png" width="72" height="72" alt="">
</p>

<h1 align="center">Nordlys</h1>

<p align="center">
  Your bookmarks on every new tab, over a sky that moves.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc">Chrome Web Store</a> ·
  <a href="https://sa1ntsinner.github.io/nordlys-tab/">Website</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="docs/screenshots/board.webp" alt="Nordlys: a clock, the search box and four bookmark folders over the Aurora sky.">
</p>

I wanted a new tab page with my bookmarks and something nice to look at, so I made one.

- Bookmarks in folders. Drag the folders around, set tile size and spacing, undo a change. Save the page you're on from the toolbar button or the right-click menu.
- The page as a board, columns, a dock, the dashboard beside your folders, only the search box, or a large clock.
- Nine skies drawn live in the browser, among them the real stars over you and a black hole, photographs in the colours of your mood, a picture of the day, or your own picture or looping video. 21 colour themes.
- A search box that uses your browser's engine, finds your sites, open tabs and places in Settings, works out units, times and money, and takes your own keywords and commands after `>`.
- Brand icons by name, a site's favicon, an image link or a letter.
- A dashboard if you want one: tasks, a focus timer that can keep sites shut, notes, weather, world clocks, feeds, calendars with a Join button, plus tasks from Todoist and GitHub.
- Spaces for Work and Home, each with its own folders and look. Turn on sync and your browser carries them to your other computers.
- Start from your browser's bookmarks, or import a backup from FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss. A folder can also follow a list of links kept at a web address.
- English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

<p align="center">
  <img src="docs/screenshots/dashboard.webp" alt="The dashboard over the Star map: focus of the day, a countdown, tasks, habits, a focus timer and a note.">
</p>

## Free, and staying free

Nordlys is free, and what is free stays free. There is no paid plan and there won't be one, and there are no ads. If you'd like to say thanks, Settings → Support has a "Buy me a coffee" link.

## Install

Get it from the [Chrome Web Store](https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc). The same listing works in Edge, Brave, Opera and other Chromium browsers.

To run it from source, clone the repo, open `chrome://extensions`, turn on Developer mode, click Load unpacked and pick the folder.

## Privacy

There's no account, no server and no tracking. A new tab without dashboard cards, under a sky drawn on your computer, makes no network request at all. Your setup stays in your browser, and leaves it only through the browser's own sync, if you turn that on. Searches, icon lookups, weather, photos and the picture of the day, feeds and connected apps go online when you use them, each straight to its own service. [PRIVACY.md](PRIVACY.md) lists every request.

## Development

Plain JavaScript and CSS, with no build step.

```sh
npm install
npm test        # lint, unit tests and browser tests
npm run ports   # packages for Chrome, Edge and Firefox, and a folder for Safari
```

[CONTRIBUTING.md](CONTRIBUTING.md) explains how the code is laid out and which rules the tests hold you to.

Nordlys is still a beta. Before an update changes how your setup is stored, it keeps a copy you can restore in Settings → Backup.

## License

[MIT](LICENSE)
