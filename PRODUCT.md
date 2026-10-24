# Product

## Platform

web

## Users

- Primary: ordinary people, not developers, who open a new tab many times a day and want a calmer, nicer one with their favourite sites close at hand. They find it on a store page, mostly on a desktop browser.
- Also: people who like to plan their day and want a light dashboard next to their sites, and privacy-minded people who want nothing tracked.

## Product Purpose

Nordlys replaces the browser's new tab page: the person's favourite sites in folders, over a sky that moves, and a dashboard for the day when they want one.

## Positioning

- The skies are drawn live in the browser: nine scenes of its own, among them the real stars over the person and a black hole drawn from the way light bends near one. Photographs in the colours of the mood, a picture of the day, or the person's own picture or video, when they want one.
- Nothing leaves the device: there is no Nordlys account and nothing is tracked. Sync, when turned on, goes through the browser's own sync.
- It is free and open source, and one extension covers Chrome, Edge, Firefox and Safari.

## Operating Context

- Used as the browser's new tab: opened again and again through the day, so it must feel calm and appear at once.
- Distribution: the Chrome Web Store (live). Edge Add-ons, Firefox Add-ons and the Mac App Store (Safari) have the 2.5.1 build in review as of 2026-09-27. It also runs in Brave, Opera and other Chromium browsers from the Chrome Web Store.

## Capabilities and Constraints

What ships in 2.5.3:
- Favourite sites in folders; move folders, change tile size and spacing, tidy them in one click, undo. Save any page from the toolbar button or the right-click menu, or drop a link onto the board.
- Page layouts: the board, Columns, Dock, Today (the dashboard beside the folders), Prompt (only the search box) and Poster (a large clock).
- Skies in kinds: the nine Nordlys skies drawn live, photographs by subject from Wikimedia Commons' featured pictures in the colours of the mood or their own, a picture of the day (Wikimedia Commons, the Met, NASA EPIC), or your own picture, looping video or colour. Shuffle, saved skies, a sky that changes by itself, colours from the picture, a night light. 21 colour themes (11 dark, 10 light, including pure black for OLED) and eleven colour moods.
- The search box uses the browser's search engine, finds your sites, open tabs, the browser's bookmarks and history and places in Settings, answers units, times and money, takes your own keywords (also `nl` in the address bar), adds a task after `+`, takes commands after `>`, and offers what you usually open at this hour.
- Brand icons by name (Iconify's Simple Icons), a site's favicon, an image link or a letter.
- Spaces such as Work and Home, each with its own folders, look and keywords, opening by themselves at set hours if wanted; optional sync through the browser's own sync.
- A dashboard when wanted: tasks with dates and steps, a focus timer and a full-page focus mode with sounds and sites kept shut while focusing, notes, weather, world clocks, a countdown, a tab stash, feeds, a value from any JSON address, tabs open twice or idle, recently closed tabs; habits and a line for the day under More cards. Cards can be dragged and stretched.
- Tasks from Todoist and GitHub, and events from any number of calendar links with a Join button for meetings, read straight from the browser with a token that stays on the device.
- A bookmark can show whether its site is up; Check the bookmarks finds the ones there twice and the pages that are gone.
- A first board from the browser's bookmarks (copies), its most visited sites, a bookmarks file, or the backup of FVD Speed Dial, Speed Dial 2, Infinity, nightTab, Bonjourr or Tabliss. Settings as text, read from a file, typed in or read from an address.
- A folder can mirror a browser bookmark folder, or follow a list of links kept at a web address (both read only).
- A copy of the whole setup before every update, kept in Settings → Backup.
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
