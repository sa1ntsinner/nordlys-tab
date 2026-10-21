<p align="center">
  <img src="icons/icon128.png" width="84" height="84" alt="">
</p>

<h1 align="center">Nordlys</h1>

<p align="center">
  A new tab page with bookmark folders, a dashboard for your day and animated backgrounds.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc">Chrome Web Store</a> ·
  <a href="https://sa1ntsinner.github.io/nordlys-tab/">Website</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="site/assets/board.webp" alt="Nordlys with a clock, search box and four bookmark folders over the Nordlys background.">
</p>

I wanted a new tab page with my bookmarks and something nice to look at, so I made one.

- Keep bookmarks in folders. Move the folders around, adjust tile size and spacing, and undo changes.
- Pick from 9 animated backgrounds and 21 themes (11 dark, 10 light), or use your own picture or looping video.
- Search with the engine set in Chrome. The box also does math and takes commands after `>`, such as `theme nord`. You can hide it.
- Press Search to find brand icons from Iconify's Simple Icons set. You can also use a site's favicon, an image link or a letter.
- Several profiles (say, Work and Home), and optional sync through your browser's own sync. There's no account of ours.
- A dashboard when you want one: tasks with dates and steps, a focus timer and a full-page focus mode with sounds, notes, weather, world clocks, a countdown and a tab stash. Drag the cards anywhere and stretch them by the corner.
- Tasks from Todoist and GitHub, and events from any calendar link. Nordlys talks to each straight from your browser, with a token that stays on your device.
- Bring your bookmarks from the browser, or a backup from FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss.
- Before every update a copy of your whole setup is kept, so an update can always be undone.
- It's in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.
- There's no account and no tracking.

<p align="center">
  <img src="site/assets/dashboard.webp" alt="The dashboard: focus of the day, tasks, habits and a focus timer above the bookmark folders.">
</p>

<p align="center">
  <img src="site/assets/skies.webp" alt="The nine backgrounds: Nordlys, Polaris, Halo, Star map, Meteors, Silk, Midnight sun, Contour and Fjord.">
</p>

## Free, and staying free

Nordlys is free, and what is free stays free. There is no paid plan and there won't be one: no feature will be moved behind a subscription, no free one will start costing money, and there are no ads. If you'd like to help, there's a "Buy me a coffee" link in Settings → Support, and that's the whole business model.

## Install

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/nordlys/fepiibfbbjhaoldgcfpfcikbonnjbfdc). It also works in Edge, Brave and other Chromium browsers.

Builds for Edge Add-ons and Firefox, and a folder ready for Safari's converter, come from the same code with `npm run ports`. In Firefox the search box uses Firefox's engine; in Safari, which gives extensions no way to do that, you pick an engine once in Settings → General.

To run it from source instead:

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click Load unpacked and pick the folder.

## Privacy

Settings and bookmarks stay on your device, and in your browser's own sync only if you turn sync on. Searches go through Chrome to your chosen search engine when you press Enter. Brand icon searches contact Iconify only after you press Search. Pasted image links may also load online. See [PRIVACY.md](PRIVACY.md) for the full details.

## Development

There's no build step. The extension uses plain JavaScript and CSS.

```sh
npm install
npm test          # lint, unit and browser tests
npm run artwork   # store and site pictures, taken from the running extension
npm run site      # builds the website into .site-dist/
npm run ports     # Chrome, Edge and Firefox packages, and dist/safari
```

Nordlys is still a beta. The version is 2.x because Chrome Web Store versions can only go up. Updates that change how your setup is stored keep a restore point first.

## License

MIT licence. See [LICENSE](LICENSE).
