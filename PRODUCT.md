# Product

## Platform

web

## Users

- Primary: ordinary people, not developers, who open a new tab many times a day and want a calmer, nicer one with their favourite sites close at hand. They find it on a store page, mostly on a desktop browser.
- Also: people who like to plan their day and want a light dashboard next to their sites, and privacy-minded people who want nothing tracked.

## Product Purpose

Nordlys replaces the browser's new tab page: the person's favourite sites in folders, over a sky that moves, and a dashboard for the day when they want one.

## Positioning

- The skies are drawn live in the browser (nine animated scenes), not wallpapers or looping video.
- Nothing leaves the device: there is no Nordlys account and nothing is tracked. Sync, when turned on, goes through the browser's own sync.
- It is free and open source, and one extension covers Chrome, Edge, Firefox and Safari.

## Operating Context

- Used as the browser's new tab: opened again and again through the day, so it must feel calm and appear at once.
- Distribution: the Chrome Web Store (live). Edge Add-ons, Firefox Add-ons and the Mac App Store (Safari) have the 2.5.1 build in review as of 2026-09-27. It also runs in Brave, Opera and other Chromium browsers from the Chrome Web Store.

## Capabilities and Constraints

What ships in 2.5.1:
- Favourite sites in folders; move folders, change tile size and spacing, tidy them in one click, undo.
- Nine animated skies, 21 colour themes (11 dark, 10 light, including pure black for OLED), or your own picture or looping video.
- The search box uses the browser's search engine, finds your sites as you type, does math, and takes commands after `>`.
- Brand icons by name (Iconify's Simple Icons), a site's favicon, an image link or a letter.
- Profiles such as Work and Home, with optional sync through the browser's own sync.
- A dashboard when wanted: tasks with dates and steps, a focus timer and a full-page focus mode with sounds, notes, weather, world clocks, a countdown and a tab stash; habits and a line for the day under More cards. Cards can be dragged and stretched.
- Tasks from Todoist and GitHub, and events from any calendar link, read straight from the browser with a token that stays on the device. (2.6.0 cut the Ask card, seven other connectors and the never-working Google and Microsoft sign-ins.)
- A first board from the browser's bookmarks (copies), its most visited sites, a bookmarks file, or the backup of FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss.
- A copy of the whole setup before every update, kept in Settings → Backup.
- A folder can mirror a browser bookmark folder (read only).
- The extension is in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

Copy constraints:
- Plain, human and short; no slogans, no business hype, no superlatives.
- Promise and claim as little as possible, with one exception the owner chose on 2026-10-21: what is free stays free. Say it as "free, and what is free stays free; there is no paid plan and there won't be one", and never hedge it. (This replaces the earlier rule against promising it.)
- Never compare Nordlys with other products or name them.
- British spelling, as in the product (colour, favourite).
- Store availability is stated as it is at the time, with as little promise as possible for the stores still in review.

## Brand Commitments

- The name Nordlys (Norwegian for the northern lights) and its icon, a four-pointed star on a blue-to-teal square (`icons/icon.svg`).
- The product's own fonts, Outfit and Instrument Sans, are bundled in `src/fonts/`.
- The voice of the project is personal and modest (the README opens with "I wanted a new tab page with my bookmarks and something nice to look at, so I made one.").

## Evidence on Hand

- Screenshots of the real extension in `docs/screenshots/`.
- The Chrome Web Store listing, the open-source repository, `CHANGELOG.md` and `PRIVACY.md`.
- Not on hand, and never to be invented: user counts, ratings, reviews, testimonials, press, awards, partner or customer logos.

## Product Principles

1. Calm, not loud: it is opened many times a day.
2. Claim little and let the product prove it.
3. Private by default.
4. For everyone: keyboard, reduced motion, readable text over any sky, and phones.

## Accessibility & Inclusion

- WCAG 2.2 AA. Every action works from the keyboard with a visible focus.
- `prefers-reduced-motion` is honoured: moving skies rest on a painted frame.
- Text keeps at least 4.5:1 contrast over any sky it sits on; nothing is told by colour alone.
