# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: ordinary people, not developers, who open a new tab many times a day and want a calmer, nicer one with their favourite sites close at hand. They reach the website from a store page, the promo film on YouTube, a search, or a link someone sent them, mostly on a desktop browser.
- Also: people who like to plan their day and want a light dashboard next to their sites, and privacy-minded people who want nothing tracked.
- Some visitors arrive on a phone, where the extension cannot be installed.

## Product Purpose

Nordlys replaces the browser's new tab page: the person's favourite sites in folders, over a sky that moves, and a dashboard for the day when they want one. The website's job is that a visitor gets it in seconds, feels it by trying the real thing, and adds it to their browser.

## Positioning

- The skies are drawn live in the browser (nine animated scenes), not wallpapers or looping video.
- Nothing leaves the device: there is no Nordlys account and nothing is tracked. Sync, when turned on, goes through the browser's own sync.
- The website runs the real extension (a live demo built from the same code), not pictures of it.
- It is free and open source, and one extension covers Chrome, Edge, Firefox and Safari.

## Operating Context

- Used as the browser's new tab: opened again and again through the day, so it must feel calm and appear at once.
- Distribution: the Chrome Web Store (live). Edge Add-ons, Firefox Add-ons and the Mac App Store (Safari) have the 2.5.1 build in review as of 2026-09-27. It also runs in Brave, Opera and other Chromium browsers from the Chrome Web Store.
- The website is static, on GitHub Pages at https://sa1ntsinner.github.io/nordlys-tab/, assembled by `tools/site-build.cjs` from `site/` plus a live demo of the extension (`.site-dist/demo`).
- A promo film made from the real product exists (YouTube cut, store cuts, and the site's tour video); a new cut is being made in Remotion.

## Capabilities and Constraints

What ships in 2.5.1:
- Favourite sites in folders; move folders, change tile size and spacing, tidy them in one click, undo.
- Nine animated skies, 21 colour themes (11 dark, 10 light, including pure black for OLED), or your own picture or looping video.
- The search box uses the browser's search engine, finds your sites as you type, does math, and takes commands after `>`.
- Brand icons by name (Iconify's Simple Icons), a site's favicon, an image link or a letter.
- Profiles such as Work and Home, with optional sync through the browser's own sync.
- A dashboard when wanted: tasks with dates and steps, habits, a focus timer and a full-page focus mode with sounds, notes, weather, world clocks, a countdown, a tab stash, and an Ask card for a model the person chooses (the browser's built-in model, their own key, or a model on their computer). Cards can be dragged and stretched.
- Tasks from the task managers and code hosts people already use, and events from any calendar with an ICS link, read straight from the browser with a token that stays on the device.
- A folder can mirror a browser bookmark folder (read only).
- The extension is in English, Russian, Spanish, German, French, Japanese, Chinese and Turkish.

Website constraints:
- Zero third-party requests: no analytics, no CDNs. Fonts, libraries and media are served from the site itself.
- English only for now, built so translations can be added later.

Copy constraints:
- Plain, human and short; no slogans, no business hype, no superlatives.
- Promise and claim as little as possible. On price, say only that it is free; never "free forever", and never mention future paid plans (they exist only as ideas in `docs/product-plan.md`).
- Never compare Nordlys with other products or name them. Never present AI as the author of anything.
- British spelling, as in the product (colour, favourite).
- Store availability is stated as it is at the time, with as little promise as possible for the stores still in review.

## Brand Commitments

- The name Nordlys (Norwegian for the northern lights) and its icon, a four-pointed star on a blue-to-teal square (`icons/icon.svg`).
- The product's own fonts, Outfit and Instrument Sans, are bundled in `src/fonts/`; the website may use them, but they are not a binding choice for it.
- The voice of the project is personal and modest (the README opens with "I wanted a new tab page with my bookmarks and something nice to look at, so I made one.").

## Evidence on Hand

- The live demo: the real extension with demo data, built by `npm run site` into `.site-dist/demo/`.
- Real screenshots: `site/assets/*.webp`, `site/assets/skies/*.webp`, and the store images in `docs/store-assets/`.
- The promo film: `site/assets/tour.mp4` (and the 4K cuts, kept outside git).
- The Chrome Web Store listing, the open-source repository, `CHANGELOG.md` and `PRIVACY.md`.
- Not on hand, and never to be invented: user counts, ratings, reviews, testimonials, press, awards, partner or customer logos.

## Product Principles

1. Show the real thing: the live product before any picture of it.
2. Calm, not loud: the page should feel like the new tab it sells.
3. Claim little and let the product prove it.
4. Private by default, the website included.
5. For everyone: keyboard, reduced motion, readable text over any sky, and phones.

## Accessibility & Inclusion

- WCAG 2.2 AA. Every action works from the keyboard with a visible focus.
- `prefers-reduced-motion` is honoured: moving scenes rest and scroll effects show their final state.
- Text keeps at least 4.5:1 contrast over any sky it sits on; nothing is told by colour alone.
