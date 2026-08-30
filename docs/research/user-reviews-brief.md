# What real users say about new-tab / start-page extensions

Evidence brief for the Nordlys roadmap. Compiled 2026-08-30.

---

## 0. Method, sample and source coverage

### What I actually mined

| Source | Access | What I got |
|---|---|---|
| **addons.mozilla.org public ratings API** (`/api/v5/ratings/rating/`) | Full | **725 review texts rated 1–3 stars** across 14 extensions, plus 5-star samples, plus exact star totals. This is the backbone of the frequency counts below. |
| **chrome-stats.com** (Chrome Web Store mirror) | Partial | Exact star distributions + aggregate pros/cons + the 10 most recent reviews per extension. Full review corpus is paywalled. |
| **GitHub Issues API** | Full (rate-limited) | Issues sorted by reactions and by comment count for Bonjourr, Tabliss, Mue, nightTab, Dashy, Homer, gethomepage; full comment threads for 5 key issues. |
| **Hacker News (Algolia API)** | Full | Complete comment trees for *"Show HN: I solved my New Tab page"* (332 pts, 141 comments, id 33351585) and *"Ask HN: How do you build your personal start page?"* (147 pts, 116 comments, id 29414763). |

### What I could NOT access — stated plainly, not guessed at

- **Reddit — completely inaccessible.** Every route failed: `reddit.com` is blocked to the search tool's user agent (hard API error); `old.reddit.com/*.json` redirects to a login wall; `r.jina.ai` proxy returns Reddit's *"You've been blocked by network security"* page; PullPush (Pushshift successor) returns *"Rate limit exceeded. This website does not provide free scraping resources for agents"*; the redlib/libreddit mirrors I probed were either dead (000/403/503) or sitting behind an Anubis proof-of-work challenge. **So there are zero r/startpages, r/chrome, r/browsers, r/unixporn or r/productivity findings in this document.** Anything below attributed to "Reddit" would have been invented, so nothing is. This is the single biggest gap in the brief and the one place I'd spend a human hour with a browser.
- **Chrome Web Store review pages directly.** `chromewebstore.google.com/.../reviews` is a JS-rendered SPA behind a consent redirect; with the consent cookie it returns a 748 KB shell containing no review text. The "sort by lowest rating" view is therefore not reachable programmatically. chrome-stats.com is the substitute — good for distributions and aggregate pros/cons, thin on individual 1-star text.
- **Product Hunt comment threads.** No retrievable thread for any of these products.
- **Workona, start.me and iTab.** chrome-stats rate-limited me out on Workona and I could not resolve store IDs for start.me's and iTab's new-tab extensions. Nothing in this brief speaks to those three.
- **Mue** yielded almost nothing anywhere: 25 Chrome ratings, 10 AMO ratings, zero 1–3 star AMO reviews, and only 80 GitHub issues with reaction counts topping out at 3. Its GitHub requests (reorder quick links, offline quick links, batch image upload, custom Unsplash collection) match the patterns below but carry no independent weight.
- **Muzli** was mined but is a different product — a curated design-inspiration feed. Its one transferable finding: its top aggregate con is *"Reliability issues: homepage errors like 'Oops! Something went wrong' and occasional outages,"* i.e. a server-dependent new tab fails visibly and often. Another argument for local-first.
- **Dashy / Homer / gethomepage** were mined, but see §7: their issue mix is a *different market* and I've kept them separate rather than blending them into the counts.

### Sample composition

The 1–3 star corpus. Note the harvest capped at 75 texts per (product, rating) bucket, so *totals* are exact but *sampled texts* are capped for the four biggest offenders.

| Extension (AMO slug) | 1–3★ total | Overall AMO rating | 1–3★ as share of all ratings |
|---|---|---|---|
| Tabliss | 214 | 4.63 (2,442) | 8.8 % |
| Group Speed Dial | 214 | 4.37 (1,368) | 15.6 % |
| New Tab Override | 170 | 4.39 (1,031) | 16.5 % |
| Speed Dial 2 (`new-tab-speed-dial`) | 168 | **3.66** (501) | **33.5 %** |
| Momentum | 122 | 4.39 (811) | 15.0 % |
| Speed Dial Lite | 97 | **2.97** (182) | 53.3 % |
| Speed Dial (fast) | 91 | **3.54** (235) | 38.7 % |
| New Tab Homepage | 62 | 3.92 (217) | 28.6 % |
| Toby for Tabs | 21 | 3.96 (77) | 27.3 % |
| **Bonjourr** | **20** | **4.90 (1,808)** | **1.1 %** |
| nightTab | 9 | 4.83 (200) | 4.5 % |
| **Humble New Tab Page** | **7** | **4.78 (136)** | **5.1 %** |
| TablissNG | 5 | 4.69 (48) | 10.4 % |
| Mue | 0 | 5.00 (10) | — |

Chrome Web Store star distributions (chrome-stats), for the same products:

| Extension | CWS rating | Ratings | 5★ | 1★ | **Recent** avg |
|---|---|---|---|---|---|
| Bonjourr | 4.90 | 23,878 | 91 % | 0 % (37) | 4.70 |
| TablissNG (the fork) | 4.81 | 27 | 81 % | 0 % | 4.40 |
| Humble New Tab Page | 4.74 | 1,105 | 86 % | 1 % (2) | 4.70 |
| nightTab | 4.69 | 444 | 77 % | 3 % (10) | 4.10 |
| Tabliss | 4.66 | 385 | 77 % | 3 % (8) | 4.00 |
| Infinity New Tab | 4.57 | 11,808 | 82 % | 6 % (118) | 3.90 |
| Muzli | 4.51 | 831 | 74 % | 6 % (29) | 4.10 |
| Momentum | 4.49 | 13,745 | 56 % | **12 %** (116) | 4.00 |
| Mue | 4.48 | 25 | 67 % | 6 % (1) | 3.70 |
| Toby | 4.21 | 3,287 | 52 % | **23 %** (196) | 3.50 |
| Speed Dial 2 | 4.10 | 7,704 | 26 % | **43 %** (411) | **1.70** |

Mue (25 CWS ratings, 10 AMO ratings) and TablissNG (27 CWS ratings) are too small for their percentages to mean much — included for completeness, not weight. One detail is worth flagging though: chrome-stats' auto-generated aggregate **"Cons" list is empty for exactly three products — Bonjourr, Humble New Tab Page and TablissNG** — i.e. the reviews contain no complaint recurrent enough to summarise. All three are free, local-first, no-account, bookmark-or-background-focused pages. That is Nordlys's shape.

**Read that last column.** The product satisfaction ranking is almost perfectly predicted by two variables: *does it retrofit a paywall*, and *does it lose your data*. Bonjourr and Humble — free, local, no accounts — sit at the top with near-zero 1-star rates. Speed Dial 2, which moved previously-free features behind a subscription, has a **recent** rating average of 1.70.

---

## 1. Complaints ranked by frequency

Counts are keyword-matched over the 725-review 1–3★ corpus. One review can hit several themes. **Caveats you should hold onto:** the patterns are English-heavy with partial Russian/German/Spanish coverage, so non-English complaints are systematically *undercounted*; and the corpus is skewed toward speed-dial products because they generate more negativity. Treat the ordering as solid and the absolute percentages as a floor.

### 1.1 Genuine product failures

**#1 — Data loss / settings silently reset (68 hits, 9.4 %)**
`tabliss:31 · groupspeeddial:14 · speed-dial-2:10 · speed-dial-lite:4`

This is the deadliest complaint in the entire corpus. Not because it is the most frequent overall, but because it is the one that converts a 5-star user into a 1-star uninstall in a single event. **Within Tabliss's negative reviews specifically, 24.2 % are about data loss.** The corresponding GitHub issue, [tabliss#268](https://github.com/joelshepherd/tabliss/issues/268), has **104 comments** — the most-discussed issue in the whole repository.

> "It worked really well — until it reset my settings. The first time it happened, I redid them all. It's not the fastest process, and a bit finnicky, but not too bad. The second time it reset my settings — today — I uninstalled it. I have a custom new tab window for a reason, and I can't keep redoing it."
> — AMO 1★, Tabliss v2.0.3, 2021-01-27

> "This extension was everything i could have wanted, but its constant unstableness has caused me stress not knowing when it will reset back to default, losing all my effort in customizing it. i was able to endure it, but today is the final straw. i dont know how many times i had to rework it again and again."
> — AMO 1★, Tabliss v2.0.3, 2021-01-02

> "Absolutely focused on an anti-user-friendly way… Don't bother with this dialer. It keeps deleting all of my bookmarks that I spend quite a bit of time setting up. Sometimes they'll last for a few months, sometimes only a few days."
> — AMO 1★, Group Speed Dial v23.0, 2023-08-23

**The root cause is documented and it is a warning shot for Nordlys.** Tabliss shipped `storage.sync` in v2. The maintainer wrote in [tabliss#69](https://github.com/joelshepherd/tabliss/issues/69):

> "The strict 100KB limit prevents me from storing every setting (most notably, the upload photo images)"
> "There is **no conflict resolution logic**, which can cause overriding/losing settings between browsers"

And in #268, on the Firefox side:

> "Mozilla made some changes to the Firefox `storage.sync` Api with Firefox 79. I suspect that the addon can't handle these changes properly." — maintainer, 2020-08-10

A user connected the dots unprompted in April 2020:

> "Until version 2.0 I would rate as 5 stars. The sync is a good feature, but needs to have an 'off' switch… **There was no warning the quick links were being overwritten**, and I can find no way to turn it off in the settings page. PLEASE ADD A DO NOT SYNC OPTION."
> — AMO 3★, Tabliss v2.0.3, 2020-04-22

**28 of Tabliss's negative reviews on v2.x versions mention reset/lost/disappear/not-saving.** Adding sync is what broke Tabliss. That is the most important single fact in this document.

A separate but related failure: **destructive actions with no confirmation.**

> "I've been really enjoying Tabliss until I misclicked the quick-links config button and just deleted the widget with all my links. **With just one click.** Now I have to manually restore 20+ links. Wtf? Just add one fucking confirmation box just in case."
> — AMO 2★, Tabliss v2.0.3, 2020-06-14

And update-migration bugs, which read to the user as data loss even when the data is intact. Bonjourr's [#458](https://github.com/victrme/Bonjourr/issues/458) (27 comments) — after 20.1.1, all links vanished because `linkgroups.selected` migrated to `""` instead of `"default"`. Data was recoverable, but the user experience was identical to deletion:

> "Same with US English version, all of mine are just… gone."

**#2 — Retrofitted paywalls and forced accounts (65 hits, 9.0 %)**
`speed-dial-2:29 · momentum:17 · groupspeeddial:13 · toby:4`

Users do not object to paying. They object to *losing something they already had*. Every single high-rage review in this cluster is about a feature being **taken away**, not about a feature never having existed.

> "Hiding previously free features behind a paywall, instead of developing new features to justify a payment, **is a dark pattern**. And this is not even touching on the fact, how ridiculous it is to expect a freaking subscription for such an addon."
> — AMO 1★, Speed Dial 2 v3.8.5, 2025-08-23

> "Speed Dial 2 is quite literally the only addon I've ever paid for… After their October 24 update: they say I'm on a 'legacy' plan that they're taking away. So I paid money for features and the promise of lifetime support… **I will find a new speed dial addon, and I'm never coming back.** I now regret ever giving this developer a penny of my money, because they broke their promise."
> — AMO 1★, Speed Dial 2 v3.3.4, 2022-10-26

> "monthly subscription for an html page. nah."
> — AMO 1★, Momentum v2.16.16, 2024-12-25

> "$3 a month for most of the basics tasks like multiple todo list… When you know that Netflix is at 9.99…"
> — AMO 1★, Momentum v1.4.12, 2018-12-30

> "The Toby team have become increasingly greedy and are now pay-walling the core feature of the app: Saving tabs. You will only be able to save 60 tabs without a subscription. **Literal killobytes of data.**"
> — AMO 1★, Toby v1.4.0, 2024-10-16

There is a consistent, articulate line about *what* is legitimate to charge for:

> "Sure, charge a monthly fee for hard cost items like online cloud storage, any-device settings synchronization, and image upload to their servers, but putting a custom URL to pull an image places ZERO financial [burden]…"
> — AMO 1★, Speed Dial 2 v3.7.3, 2023-11-14

Forced account creation is its own trigger, separate from money:

> "They want you to create an account with your email and know your name. Why?" — AMO 1★, Momentum, 2024-01-17
> "I won't give my personal data just to add a nice image with a clock atop my browser while that's exactly what I have in my desktop. THE NERVE…!" — AMO 1★, Momentum, 2018-04-17
> "Right after creating the account you are prompted for a credit card to trial their Pro plan. Immediately hit with an upsell is a large red alert." — AMO 1★, Toby, 2024-03-18

**#3 — Icons / favicons / thumbnails broken or missing (60 hits, 8.3 %)**
`speed-dial-2:17 · groupspeeddial:16 · speed-dial-fast:7 · tabliss:6`

The most under-appreciated complaint in the set. For a tile-based product, **the icon *is* the product.** A tile grid with half its icons showing as blank squares or first-letter initials looks broken in a way that no amount of polish elsewhere compensates for.

> "Seems quite nice but without any option to add custom images for the quick-links/speed-dial it's unusable for me. **Too many websites, even popular ones, fail to load their icons properly.**"
> — AMO 3★, Tabliss v2.6.0, 2025-08-30

> "When I was adding links to the quick links features I found that the icons from the website might be **missing, incorrect or even blurry**."
> — [tabliss#650](https://github.com/joelshepherd/tabliss/issues/650), 11 reactions

> "This app is poorly programmed. After every update of Firefox something doesn't work, currently **all dial thumbs are no longer recognized**." — AMO 1★, Group Speed Dial, 2024-01-24
> "Icons do not work? Something is broken." — Chrome Web Store, Infinity New Tab, 2026-08-03

Infinity New Tab's chrome-stats aggregate con list literally reads *"Icons frequently disappear or are blank, disrupting usability."* This is a top-2 con for a product with 11,808 ratings.

Bonjourr has the same class of problem in a milder form: [#58](https://github.com/victrme/Bonjourr/issues/58) *"Quick link icons take some time to load — when I open a new tab, the quick link icons are white for a few moments… **every time** I open a new tab"* (15 comments), and an icon-caching request with 9 comments.

**#4 — Cannot import existing browser bookmarks (32 hits, 4.4 %)**
`groupspeeddial:11 · tabliss:10 · speed-dial-2:4 · nighttab:2`

The onboarding cliff. Users arriving from a browser with hundreds of bookmarks will not hand-enter them, full stop.

> "being a bookmarks extension the most obvious thing is that one can import all the bookmarks you have in Firefox… but it turns out that [it] only allows to import the bookmarks from the same extension? so if you are a new user you are screwed… which is not only ridiculous but a useless and titanic task! **I'm not going to put one by one, if I have about 2000.**"
> — AMO 3★, nightTab v7.3.0, 2023-04-05

> "This is the best designed dial that I've found, **but it needs to sync with the bookmarks folder to be useful.** I have way too many bookmarks to add them one by one. If this were implemented, then I would definitely rate it 5 stars."
> — AMO 3★, nightTab v6.1.1, 2020-10-26

> "没法导入浏览器的书签，没法搜索书签，一百多个书签你是打算让我一个一个导进去然后一个一个找么？" *(Can't import the browser's bookmarks, can't search bookmarks — with a hundred-plus bookmarks are you expecting me to enter them one by one and then find them one by one?)*
> — AMO 2★, Speed Dial 2 v2.4.7, 2021-11-24

Notably, this is where **Bonjourr wins**: its top unprompted praise includes "Love the synced bookmark quick-access grid," and its most-reacted-ever issue ([#34](https://github.com/victrme/Bonjourr/issues/34), 8 reactions) was *"groups for bookmarks"* — which they shipped.

**#5 — Steals or loses address-bar focus (32 hits, 4.4 %)**
`new-tab-override:14 · momentum:8 · new-tab-homepage:4 · groupspeeddial:3`

This is a *pure regression against the default new tab* and users treat it as such. It has nothing to do with aesthetics — it breaks the muscle memory of Ctrl+T → type.

> "I disabled momentum because I couldn't straight away type in the address bar like in chrome. Or only before momentum could load. I have to use the cursor to start typing. **Sometimes I think I started a search only to find out I haven't.**"
> — AMO 2★, Momentum v0.99.5, 2017-11-22

> "New tab stopped setting focus to the address bar. **Have to hit tab 4-5 times** to get focus to address bar." — AMO 3★, Momentum, 2020-07-14
> "5 stars if it put the cursor in the address field. On second window it does, but before that you type for no effing reason." — AMO 3★, Speed Dial 2, 2023-02-05
> "For some reason, this extension blocks me from automatically typing in the address bar immediately after opening a new tab. **It's a breaking bug for me.** Beautiful images though!" — AMO 2★, Earth View from Google, 2022-10-20

There is a genuine, unsolvable-by-extension tension here, documented in [Bonjourr#503](https://github.com/victrme/Bonjourr/issues/503) (14 comments). Users want the *opposite* thing too:

> "the not being able to autofocus the search tab is a dealbreaker for me"
> Maintainer: "Yes this is the plan. We might add a **'Focus search bar on new tabs' option** to make sure the page is never slowed down by default."
> Maintainer: "**We're not forcing the focus on our page**, so this might be a Firefox issue."

The resolution both camps converge on: *default to not stealing focus; offer an opt-in toggle; document `Esc` then `/` as the keyboard path.*

**#6 — Search engine forced / cannot be changed (30 hits, 4.1 %)**
`speed-dial-fast:26 · tabliss:2 · nighttab:2`

Overwhelmingly one product (Speed Dial fast, which silently switches users to Yahoo), so treat 26 of those 30 as a single bad actor rather than a general pattern. **But the residual signal is real and it is about respect:**

> "Does not use the search engine configured in the browser but imposes google… Very bad idea." — AMO 1★, Tabliss, 2024-01-14
> "Can't switch the search bar search engine" — AMO 1★, nightTab v7.3.0, 2026-05-24
> "Search engine defaults to Google, and the 'Cool stuff' section comes with links to GMail and Google Drive." — AMO 3★, nightTab, 2022-07-10

[tabliss#342](https://github.com/joelshepherd/tabliss/issues/342) — *"Allow the search widget to use custom search engines (e.g. searx)"* — has 17 comments. A custom-URL search-engine field with `{searchTerms}` is table stakes for the privacy-minded segment.

**#7 — Privacy, permissions, unexplained network traffic (29 hits, 4.0 %)**

> "It looked good, but on installing it wanted permission to access data, share my data with every site in the Momentum website domain, and something about **storing unlimited data client side**. It all looked a bit dodgy without some word of explanation." — AMO 3★, Momentum, 2017-12-19

> "Bad privacy, grabs website logos online from a server and allows that server to track your IP, one's fav sites and how often one accesses them. This is not compliant to GDPR's data minimisation… Better would be to **store and load website images locally** and not establish an online connection by default."
> — AMO 2★, Speed Dial 2 v2.4.1, 2019-12-10

> "I noticed my PC was sending DNS requests all day long for sites that would be in my very very old bookmarks. Upon further investigation, I saw it was actually **opening connections and sending HTTP requests to all those servers via QUIC**. Constantly contacting these websites I haven't touched in years even while I'm away at work."
> — AMO 3★, Humble New Tab Page v1.26.2, 2026-08-22

That last one is **n=1**, but it's a specific, checkable technical claim (bookmark link prefetching) against the single highest-rated product in the sample. If a favicon fetcher or a `<link rel=prefetch>` does this in Nordlys, someone will eventually notice and it will cost more than the feature is worth.

Related, and a live risk for a locally-stored product: an offline feature that secretly needs the network.

> "Used it for a year already, but some time ago it became unusable in Russia without VPN. **Even local image import is broken until the connection with Bonjourr servers is established (?)**… I have no idea why offline functions requires internet."
> — AMO 3★, Bonjourr v21.1.0, 2025-08-31

**#8 — Rigid layout: cannot resize, reorder or arrange (28 hits, 3.9 %)**
`groupspeeddial:15 · speed-dial-lite:4 · tabliss:3 · speed-dial-fast:3`

Tile *size* specifically comes up over and over.

> "You literally created every possible option someone could think of, but **there is no way to make those thumbnails smaller**… changing the size should be the priority #1 for speed dial rather than 100 colors of shadows etc."
> — AMO 2★, Group Speed Dial v27.0, 2025-03-18

> "In the nonpro version you can't resize the size of the dials. Which makes it useless for me." — AMO 1★, Group Speed Dial, 2024-04-26
> "Dials are way too big. Can't resize." — AMO 3★, Yet Another Speed Dial, 2024-04-26
> "the widgets are not drag and drop while editing; you click a button and it gets sent to that part of the screen." — AMO 3★, Tabliss, 2021-03-02

[Bonjourr#288](https://github.com/victrme/Bonjourr/issues/288) (11 comments) — *"Allow quicklinks to be positioned manually / switch off auto position."*

**#9 — Slow load, lag, CPU (26 hits, 3.6 %)** — see §5 for full treatment.

**#10 — Sync broken or absent (26 hits, 3.6 %)**
`speed-dial-2:9 · groupspeeddial:8 · tabliss:3 · momentum:3`

Note the direction of the complaints: they are as often *"your sync destroyed my data"* as *"I wish you had sync."*

> "I sync my browser on two computers… I've spent hours setting up this add-on multiple times, only to have my settings reset randomly. **There's no way to 'save' settings so they can't be reset or overridden at random.**" — AMO 2★, Tabliss, 2020-10-27
> "I like it and have used it for a long time (several years); but, it is starting to get **too complicated to synch and edit between multiple PCs**. I think I may drop it." — AMO 3★, Group Speed Dial, 2022-05-23
> "Please add the ability to **manually export the settings** from extension, i.e. to transfer settings to another browser where I don't want to login." — tabliss#69

**#11 — Blank / black / white new tab (22 hits, 3.0 %)** — usually version-specific regressions. Bonjourr's [#621](https://github.com/victrme/Bonjourr/issues/621) (17 comments, *"New update to 21.0.0 broke Firefox — black screen"*), [#863](https://github.com/victrme/Bonjourr/issues/863) (27 comments, *"Bonjourr crashes on 22.2.0"*), Tabliss v2.4.0 (*"Now i get a Black Screen ???!!! I went back to version 2.3.0 and it works again"*), nightTab [#190](https://github.com/zombieFox/nightTab/issues/190) (28 comments, *"5.36.0 completely broken on FF and Chrome"*).

**#12 — Third-party API / widget rot (14 hits, 1.9 %, but structurally huge)**

Small count, enormous consequence: this is the mechanism by which a maintained-looking product becomes worthless. Tabliss's Quotes widget broke when `quotes.rest` changed; the GitHub contributions widget broke when GitHub changed its HTML — that issue, [#620](https://github.com/joelshepherd/tabliss/issues/620), has **44 reactions**, the highest of any Tabliss issue.

> "Quotes stopped working many months ago with fixes proposed on Github but not implemented. The weather information for my area is inaccurate. That means this extension **functionally only serves as a wallpaper splash screen, which is kind of pointless.**"
> — AMO 3★, Tabliss v2.6.0, 2024-03-13

> "Only the Developer Excuses quotes are working (ironically)." — AMO 3★, Tabliss, 2023-10-26

Also killed: Giphy backgrounds ([#418](https://github.com/joelshepherd/tabliss/issues/418), 13 reactions, expired token), Dark Sky weather ([#252](https://github.com/joelshepherd/tabliss/issues/252), API sunset). The HN thread has the general form of this law:

> "**Before you do this, consider my discovery after running one for 2 years: all the integrations break, all the time.** I'm now running weather and calendar widgets on my ipad home screen and some pinned favourites in Safari and that's it."
> — hvgk, HN 29414763

**#13 — Confusing settings / poor localisation (15 hits, 2.1 %)**

nightTab is the case study: it has an *enormous* settings surface and its chrome-stats aggregate con list is exactly two items, one of which is translation quality.

> "Unverständliche Einstellungen, keine Einstellung für Anzahl der Zeilen gefunden. Geht sicher irgendwie, aber alles zu unübersichtlich und zeitaufwendig. **Wieder deinstalliert.** […] die deutsche Übersetzung in nightTab ist wirklich ein Desaster ('Rinne' statt Gitterabstand, 'Kaffee' statt Spenden…)"
> *(Incomprehensible settings, couldn't find a setting for number of rows. Doable somehow, but all too confusing and time-consuming. Uninstalled again. […] the German translation is a disaster — "Rinne"/gutter instead of grid spacing, "Kaffee"/coffee instead of donate…)*
> — Chrome Web Store 1★, nightTab, 2026-03-14

> "There's settings to change that, but **there are a lot of settings, and so it feels a bit daunting to configure** when search and shortcuts work fine in the default FF new tab page."
> — AMO 3★, nightTab, 2022-07-10

The maintainer himself opened [nightTab#173](https://github.com/zombieFox/nightTab/issues/173): *"Balance features vs complexity — simplify UI with simple mode and tooltips."* Machine-translated UI strings are worse than English-only strings; a mistranslated label reads as *broken*, not as *foreign*.

**#14 — Abandonment (12 hits, 1.8 % — but see §3, where it dominates)**

**#15 — Flash of unstyled content (8 hits, 1.1 % — but see §5)**

### 1.2 User error, or the browser's fault — not the product's

Roughly 10–15 % of the 1–3★ corpus is misattributed. Worth separating so you don't build for it:

- **Firefox/Chrome forbid `file://` and local HTML as a new-tab target.** A large share of New Tab Override's and Custom New Tab Page's 1-star reviews are rage at the browser, aimed at the extension. *"Don't work"*, *"It does not work!"*, *"Qu'est ce que c'est débile que Firefox n'autorise plus la redirection vers des fichiers locaux."* Nothing the extension author can do.
- **Clearing cookies/site data wipes extension storage.** *"Loses settings when cookies are deleted."* *"CCleanerPro always deleted the cookie."* *"You lose all your custom settings … every time you delete history (specifically cookies or offline website data — when range set to 'Everything')."* Real cause, but user-configured. The correct product response is not a fix, it's **a visible, nagging backup affordance** (see recs).
- **Browser can't set a homepage and a new-tab page independently.** Many Momentum 1–3★ reviews (*"Hate that I can't set it to newtab ONLY"*) are browser limitations.
- **Mobile Firefox does not support new-tab override at all.** Several Group Speed Dial 1★ reviews are about this.
- **Antivirus false positives** (Norton flagging Infinity New Tab as malware) — not the developer's bug, but it *is* the developer's problem.
- **Genuine noise:** language complaints ("no my language"), star ratings with no text, and one review complaining that Bonjourr's analog clock is "weird, european."

---

## 2. What users praise unprompted

Sampled from 5-star reviews across Bonjourr (1,656), Tabliss (1,967), nightTab (182), Humble (119), TablissNG (42), plus HN.

**1. "It's mine now" — identity, not features.** The strongest 5-star language is about ownership and aesthetic pleasure, and it's disproportionate to what the software does.

> "This is peak cinema, I really LOVE how beautiful this masterpiece is, **if I could use this as my desktop I would!**" — AMO 5★, Bonjourr, 2026-07-23
> "Incredible. **I just finished reorganizing my Firefox UI around this extension.**" — AMO 5★, Bonjourr, 2026-07-23
> "its sooo good! the way it contrasts with some other extensions gives you that feeling of **'i am relaxed big time.'**" — AMO 5★, Bonjourr, 2026-07-21
> "Beautifully and easily customizes the function of the firefox starter page **to my personality and interests**." — AMO 5★, Bonjourr, 2026-08-17

**2. Being un-distracting is a feature people actively thank you for.** This is the single loudest theme on Hacker News, and it cuts directly against the "add more widgets" instinct.

> "The last thing I want to see are widgets, data feeds, 'suggestions', etc." — simonsarris, HN 29414763
> "I made one… I had one that I had also made with lots of nice widgets like you are suggesting, but **I realized that I wasn't using 90% of them**, and so I reverted to something simpler." — duiker101, HN 29414763
> "same on distractions. if I have good intentions opening a new tab (e.g. I'm going to open GCP logging to debug something), **I don't want a random story from HN pulling me in.**" — mritchie712, HN 33351585
> "Мне очень нравится, спасибо за расширение, то что я хотел, **без лишнего визуального мусора**" *(exactly what I wanted, without unnecessary visual clutter)* — CWS 5★, Humble New Tab Page, 2026-08-17

**3. "No bloat" is said as the highest compliment.**

> "Terrific to see Tabliss so well maintained. The new features are subtle and welcome; **no bloat!** :)" — AMO 5★, TablissNG, 2026-01-11
> "As speed dials go, this strikes **a fair balance between features and bloat**" — AMO 3★, Group Speed Dial, 2017-10-08
> "+ not bloated with lots of useless features which is also a plus." — AMO 2★, Speed Dial 2 — *note: a 2-star review still volunteering this as a pro*

**4. Local-only storage and low permissions, praised explicitly.**

> "Great! And **doesn't need any permissions** and open-source." — AMO 3★, Tabliss, 2019-03-17 (still a compliment inside a complaint)
> "Very nicely done. A lot of customization, and **no permissions needed**. Thank you." — AMO 2★, Tabliss, 2021-11-25
> "Lots of Options, **Strong Security & Privacy**, Easy, Fast. Strength: • Open source… • Attractive MIT license." — AMO 5★, Humble New Tab Page, 2020-07-09
> "I love how its open source and **you use local storage**." — breck, HN 33351585

**5. Speed, stated as a hard requirement rather than a nice-to-have.**

> "**it loads instantly which is critical for any start page in my opinion**" — fractal618, HN 29414763
> "I love how fast everything works!" — just-tom, HN 33351585
> "No useless bells an whistles (sorry author), **no external API references, blazingly fast**, nicely done" — jesterson on Homer, HN 33351585

**6. Bookmarks as the actual job-to-be-done.** The people who evangelise Humble New Tab Page all say the same thing:

> "Humble New Tab Page is how I solved mine. **I don't need any distractions. Just the title and icon of the bookmarks I need.**" — nipperkinfeet, HN 33351585
> "It might not seem like much, but this is something I interact with virtually every time I'm using my internet browser, and for my tastes, **a nice customized display of my bookmarks is really all I ever want**… It hasn't exactly added any new features, or had any major changes in years — **but that's fine.**" — AMO 5★, Humble New Tab Page, 2023-11-02
> "Absolutely stunning design. I was looking for a nicer way to browse my bookmarks, and I found it!" — AMO 5★, Humble, 2023-05-23
> "I like having half a dozen frequently used sites on my start page, **as a better bookmark solution**. Don't want a bar taking up screen real estate." — vollmond, HN 29414763

**7. Export/import that just works.** This gets called out by name, unprompted, repeatedly — a rare thing for a feature this boring:

> "the way to backup and restore settings from the abandoned Tabliss to TablissNG is **super easy** as well" — AMO 5★, TablissNG, 2025-12-01
> "Glad someone is keeping it alive! **Importing the JSON from the old install works a treat too!**" — AMO 5★, TablissNG, 2025-10-01
> "Additionally I can export/import existing configurations." — arvigeus on nightTab, HN 29414763

**8. Consistent behaviour in private windows.**

> "unlike the standaard FF Home/New tab page **it works exactly the same in Private Windows**. Happy with it so far." — AMO 5★, TablissNG, 2026-06-05

**9. Keyboard access.**

> "add links that you can open with the number keys which is convenient and **saves a solid quarter second of typing every time I open a new tab**" — xypage, HN 33351585

---

## 3. Reasons people abandon

Ranked by how decisively they end the relationship.

### A. A paywall arrived after they'd committed. (Strongest, most permanent.)

Speed Dial 2's recent CWS rating average is **1.70** against an all-time **4.10**; 43 % of its 7,704 ratings are 1-star. Group Speed Dial and Toby show the same shape. This is not attrition, it's a rout — and it is uniquely irreversible because it destroys trust rather than satisfaction.

> "**DON'T DO IT** — Unless you are prepared to pay a subscription price. I've had Speed Dial 2 for years… but no longer… **Just stop breaking what is working fine.** Leave my version alone — I'll use it and never want an upgrade again! IT'S. WORKING. FINE!" — AMO 1★, 2022-10-24
> "Just realized that you need to pay for pro account to use custom icon which was a free option before, **now I switched to Group Speed Dial** that does the same thing but with more customization options." — AMO 1★, 2024-01-23
> "The developer is a rip-off artist and therefore not trustworthy. **start.me helped me out**, they have had a reliable track record." — AMO 1★, 2025-11-20
> "If you want a better speed dial like this without Pro then use: **Yet Another Speed Dial**" — AMO 1★, 2026-01-01

Note that departing users **name the replacement**, which accelerates the exodus.

### B. It lost their data — once is forgivable, twice is not.

The pattern is remarkably consistent: users rebuild after the first incident and leave after the second.

> "I loved it at first. Anytime I shut down or restart my computer, all of my saved setting disappear… **I just can't reformat the page everyday.**" — AMO 1★, Tabliss, 2020-11-19
> "Has lost my settings 2 or 4 times now. I close the browser and when I reopen it, gone. **I'm finally tired of re-adding my links and re-setting my options. Deleting the extension from my browser.**" — AMO 1★, Tabliss, 2020-10-11
> "It was great, I used it for easy access to a few websites… Today the thing reset as if I had just installed it. **If this can happen, dont even bother installing it.**" — AMO 1★, Tabliss, 2020-11-09
> "После установки… 7 июля 2026 тупо слетели все мои закладки, которые создавались месяцами. Спасибо! **Буду искать аналоги.**" *(all my bookmarks, built up over months, just vanished. Thanks! I'll go look for alternatives.)* — CWS, Infinity New Tab, 2026-07-08
> "数年間使わせていただきましたが、先日、突然バグって全部消えました。**二度と使わない！**" *(Used it for several years, then the other day it suddenly bugged out and everything vanished. Never using it again!)* — CWS 1★, Speed Dial 2, 2026-06-15

### C. It was abandoned by its maintainer.

Tabliss is the canonical case. Its last release was 2022; users spent three years telling each other so in the reviews, and then a fork took the userbase.

> "Works occasionally, but **has been abandoned**." — AMO 1★, Tabliss, 2026-06-22
> "The most sleek and clean new-tab extension you can find. **Sadly not maintained anymore, what is a dealbreaker for me.** If you want to check out the extensions install TABLISS-NG instead. It's actively maintained and has new features not present in the original extension." — AMO 1★, Tabliss, 2026-06-04
> "Another extension that was really good for as long as the developer was still up for it. No updates since 2022… **Mozilla should finally remove extensions whose developers no longer feel responsible.**" — AMO 1★, Tabliss, 2024-05-26
> "Este proyecto está abandonado desde hace 3 años." — AMO 1★, Tabliss, 2025-07-23

And on the receiving side:

> "Thanks for developing this fork. I deeply like tabliss but **I did not want to use an addon that's not maintained anymore. Bugs will occur sooner or later** so I moved to tabliss-ng." — AMO 5★, TablissNG, 2026-06-04

TablissNG's chrome-stats/AMO reviews are ~40 % *"thank you for keeping it alive"* messages. **A visible maintenance heartbeat is itself a retention feature.**

### D. It made the browser worse.

> "If you watch youtube regularly while this extension is enabled, I found that youtube takes for ever to load or not load at all. Once disabled I was able to load and watch youtube much smoother… **I have removed your extension and now magically Youtube is working perfectly fine.**" — AMO 1★, New Tab Override v19.0.0, 2026-08-02
> "It has a genuinely infuriating side effect where URLs you've visited and your favorites **won't auto-fill the address bar. Not just from the Tabliss new tab page, this happens when entering URLs from ANY site.**" — AMO 2★, Tabliss, 2025-02-19 *(n=1, but a serious claim worth testing for)*
> "I was getting lag spikes really frequently, both in Firefox **and in my games too**. It took days of testing… to figure out the problem was this extension." — AMO 1★, Momentum, 2020-06-27

### E. The setup cost exceeded the payoff.

> "I don't have the time to guess how this thing works. No instructions — not even on its web page." — AMO 1★, Momentum, 2019-03-04
> "I loved Speed Dial for years and then, the last update turned to be a total nightmare, I tried several hours but it's just zero. **I don't want to spend hours to set up something that should help.**" — AMO 1★, Group Speed Dial, 2021-11-24
> "Works well after a **steep learning curve.**" — AMO 3★, Group Speed Dial, 2021-11-25

### F. A redesign broke their layout.

> "Last update broke some features that I'm using. My tabs UI looks ugly now. Custom CSS options removed. This plugin was great for many years, but **now this is not usable for me…**" — AMO 1★, Speed Dial 2, 2022-10-25
> "New update puts a gigantic margin on top and on bottom, **had to reconfigure the whole thing**… and even zoom out to have a decent layout." — AMO 2★, Speed Dial 2, 2023-07-25
> "the new update now centers the + as well, which means now I need to hide the + button in order to keep my bookmarks centered." — AMO 3★, Speed Dial 2, 2023-07-16

### G. They just went back to `about:blank`.

A real and non-trivial cohort, well represented on HN. Not winnable, and not worth chasing.

> "About blank. That's the only home page I want to have set on any browser I use." — bradknowles
> "**about:blank gang** here" — emptyparadise
> "The fewer things displayed on my screen trying to distract me, the better :-)" — jraph
> "The last thing I need is such a stream of information in my new tab page. I would never get anything done. Thank the Lord for about:blank" — fazfq

---

## 4. Most requested features, with demand evidence and trap assessment

Ranked by measured demand. GitHub reaction counts are the least-noisy demand signal available (a 👍 costs effort; a review does not).

| Rank | Request | Evidence | Verdict for Nordlys |
|---|---|---|---|
| 1 | **Bookmark-folder → tile group binding** | tabliss#389 (16 👍), tabliss#34 (12 👍), nightTab#90 (5 👍), Bonjourr#34 (8 👍, shipped), homepage#174, Homer#202; 32 AMO complaints | **Build.** Highest-value, lowest-risk. |
| 2 | **Custom images / icons per tile** | tabliss#650 (11 👍), tabliss#31 (10 👍), Speed Dial 2's paywalling of this triggered its collapse; 60 AMO icon complaints | **Build, and never charge for it.** |
| 3 | **Reliable settings backup & restore** | tabliss#257 (11 👍), nightTab#163, nightTab#33; TablissNG praise cites it by name | **Build. Make it prominent, not buried.** |
| 4 | **Cross-device sync** | tabliss#69 (21 comments), nightTab#93 (22 comments), Bonjourr cloud/WebDAV request | **⚠️ TRAP.** See below. |
| 5 | **Custom search engine (URL template)** | tabliss#342 (17 comments), 30 AMO complaints | **Build.** Trivial; prevents a whole complaint class. |
| 6 | **Show bookmarks bar on new tab** | tabliss#171 (16 👍), Bonjourr#265, Bonjourr#405, recent CWS reviews | **Investigate.** Chrome shows the hidden bookmarks bar on its *own* new tab; an extension page suppresses it. Users read this as a regression. |
| 7 | **Todo list / notes** | tabliss#19, tabliss#58, nightTab#248, Bonjourr#133 (11 comments) | **⚠️ TRAP.** See below. |
| 8 | **Calendar / Google Calendar integration** | tabliss#9 (19 👍), Bonjourr#416 (7 👍), Bonjourr#529, dashy#1201 (10 👍) | **⚠️ TRAP.** Highest-reaction feature request in the sample, and the one most certain to break. |
| 9 | **RSS feed widget** | Bonjourr#647 (5 👍), Homer#446 (11 👍), repeated HN nostalgia for iGoogle/Netvibes/My Yahoo | **Don't build.** See below. |
| 10 | **Per-tile / per-group accent colours** | nightTab#31, nightTab#196, nightTab#235, Homer#184 | **Build.** Cheap, high identity value, zero external dependency. |
| 11 | **Follow OS light/dark theme for the page itself** | Bonjourr#243 (6 comments), Bonjourr 3★ review, idk1 on HN | **Build. High priority.** |
| 12 | **Weather** | tabliss#110 (8 👍), nightTab#203 | **⚠️ TRAP.** Every weather widget in this study broke or was inaccurate. |
| 13 | **Keyboard shortcuts to open tiles** | Bonjourr#768, Group Speed Dial reviews begging for Ctrl+1–9, xypage on HN | **Build.** Cheap and beloved by the power segment. |
| 14 | **Collapsible / mass-open groups** | nightTab#115, Homer#161 (10 👍), cseleborg on HN | **Build "open all in group."** Cheap; replaces a bookmark-folder middle-click. |
| 15 | **Custom CSS** | Bonjourr#142, Bonjourr#634 (14 comments), Speed Dial 2 users raged when it was removed | **Keep it.** You already have it; it absorbs 20 % of feature requests for free. |
| 16 | **Custom quotes** | tabliss#309 (14 👍) — but only because the *stock* quotes broke | **Don't build.** The demand is a symptom of #12's rot, not a real want. |

### The traps, explained

**Sync is the biggest trap in this entire document.** It has genuine demand (tabliss#69: 21 comments; nightTab#93: 22 comments) and it is the direct documented cause of the worst outcome observed anywhere in this research. `storage.sync` gives you a 100 KB quota and **no conflict resolution**. Tabliss shipped it in v2 and generated 214 negative reviews, a 104-comment bug thread, and eventually a fork. A user diagnosed the failure mode perfectly in 2020: *"There was no warning the quick links were being overwritten."* If Nordlys ever ships sync, it must be **off by default, explicitly opt-in, last-write-wins with a visible timestamp and a one-click local restore point taken automatically before the first sync.** Anything less trades your top-quartile rating for a mid-tier one.

**Calendar has the highest raw reaction count (tabliss#9, 19 👍) and I recommend against it.** It requires OAuth, which requires an account or at minimum a Google consent screen — which collides head-on with the #2 complaint cluster (forced accounts) and with Nordlys's entire positioning. It is also the archetype of "all the integrations break, all the time."

**Todo lists look free and are not.** They are the feature most likely to hold data users cannot afford to lose, in a product whose storage is local and wipeable by a cookie clear. Tabliss shipped one and got: *"Was working great until it randomly reset and cleared my to do list. This is extra frustrating as there's no backup, so all my info and settings are simply gone"* — twice, from two different users. A todo list turns a cosmetic reset into a real one.

**Weather and quotes are third-party API dependencies that will rot on your watch.** Tabliss's weather uses a dead API and is described by its own users as "inaccurate"; its quotes have been broken for years; Dark Sky sunset; Giphy token expired. Bonjourr shipped weather and immediately got [#784](https://github.com/victrme/Bonjourr/issues/784) (icons broke when the provider changed `data-condition` format) and #72 (feels-like vs real temperature, 8 comments). Each one is a permanent maintenance tax paid in 1-star reviews when you're busy.

**RSS is nostalgia, not demand.** The HN threads are full of warm memories of iGoogle, My Yahoo, Netvibes and Pageflakes — and, in the same breath, of people explaining they don't use them any more (*"Don't really miss it anymore"*, *"as less sites have RSS feeds"*). Sentiment ≠ usage.

---

## 5. Performance and reliability expectations

### Load time: the bar is "instant," and the measured failures are in the 200 ms – 4 s range

Users open this page dozens of times a day. Their reference point is `about:blank`, which is free.

> "**it loads instantly which is critical for any start page in my opinion**" — fractal618, HN
> "New tab are quit slow to load. Look like it take **~200ms**: The background is white, then black, then the tab load with some kind of fading." — [tabliss#67](https://github.com/joelshepherd/tabliss/issues/67)
> "When I open a new tab, it takes **3-4 seconds** to actually load a Tabliss custom 'new tab' page, on a powerful PC that is under 0 load." — AMO 1★, TablissNG v1.7.1, 2026-06-05
> "you know how it takes like **3 - 5 seconds** to load the new tab if you have a really complex setup, with a lot of images, effects, wide and tall tiles etc." — [nightTab#230](https://github.com/zombieFox/nightTab/issues/230)
> "great design, but runs too slowly, as in **it sits at a blank white new tab screen for a few seconds** before displaying the dash." — AMO 3★, Momentum, 2017-11-16
> "Frequently it can take **several seconds to load** into a new tab (5-12)… As this should simply load small, internally saved files for the dial faces, this pause is hard to explain." — AMO 3★, Group Speed Dial, 2017-10-08

**Consequences of a heavy canvas/animation.** Two data points aimed squarely at Nordlys's animated background:

> "extremely high CPU usage — edit: happens when Top-Pages widget is added" — AMO 2★, TablissNG, 2026-06-04
> "Immediate power supply current draw and CPU temperature spike to 100C upon attempting to use the Pomodoro timer function… I've used other Pomodoro focus tools but never had one blitz the power supply and send the CPU into thermal runaway. **Uninstalled immediately.**" — AMO 1★, Momentum, 2025-12-24 *(n=1 and extreme, but Momentum has recurring CPU complaints across 2018, 2020×2 and 2025 — enough to call it a pattern, not a one-off)*

A canvas animation running on every new tab, in every window, is a battery and fan-noise liability. Nobody will file a bug titled "your background costs me 40 minutes of battery"; they'll just uninstall.

### Flash of unstyled content: a first-class, named grievance

FOUC gets its own vocabulary in these reviews — "flashbang." It is **the** complaint of the dark-theme user.

> "Set a dark new tab page, for some reason during the already sluggish feeling redirect, **the extension flashbangs my eyes with a wall of white every time.** Seemingly no option to change that." — AMO 1★, New Tab Override, 2023-02-26
> "**It flashbangs** — when opening new tab there's a flashbang of white, then switch to black. For me this defeats the whole purpose of this addon." — AMO 1★, New Tab Override, 2021-04-18
> "Fantastic in every way apart from the fact that **it flashes white when loading**." — AMO 3★, Custom New Tab Page, 2019-07-09
> "When I open a new tab in my browser, there is a flash of white in a brief moment before nightTab properly loads in. I've tried different background options, but that doesn't [help]" — [nightTab#443](https://github.com/zombieFox/nightTab/issues/443), still open, *"any update on this? it's still an issue"* (March 2026)
> "Since firefox 151… **When I open new tab it is black for 1s** before it loads my 5 speed dial pages. This issue was never present and I use this add-on for a few years." — AMO 3★, Group Speed Dial, 2026-06-15

There are three distinct causes and Nordlys can only fix two:
1. **Chromium's own new-tab white flash with dark themes** — a real upstream bug ([crbug 126341](https://bugs.chromium.org/p/chromium/issues/detail?id=126341); a Microsoft engineer's fix landed and it is [reported as nearly resolved](https://www.pcworld.com/article/2571708/the-dark-theme-white-flash-bug-in-chrome-and-edge-is-soon-to-be-history.html)). Not yours, but you'll be blamed.
2. **Theme read from storage after DOM paint.** Yours. The fix is to paint the background colour synchronously from inline CSS in `<head>` before any async storage read.
3. **Background image fading in after the shell paints.** Yours. *"The background photo taking a quarter second to fade in is annoying"* — AMO 3★, Bonjourr, 2021-12-01. And [tabliss#465](https://github.com/joelshepherd/tabliss/issues/465): refreshing loses the image cache entirely on restricted connections.

The nightTab thread also shows how *not* to solve it: the only known workaround (setting Firefox's background colour to black) *overrides the user's custom background* — "so it's not exactly a solution."

### Graceful degradation

> "It just shows me a blank page, like about:blank, only it uses **112% CPU**. Oh, I see: looking in the console is an infinity of error messages, mostly 'Error handling response: Error: Failed to read the localStorage property from Window: Access is denied for this document.' Yeah: yet another page that can't load correctly with cookies disabled — only this one also manages to **drain my battery**. Look: I am sure your page is very pretty, but **if you can't even manage to write code that fails gracefully in this very simple and common scenario, I don't think I trust you** to not have made mistakes with more serious consequences."
> — cpcallen, HN 33351585

That comment provoked a long argument about whether it's a reasonable complaint. It doesn't matter: the trust inference is the point.

### Reliability expectations, summarised

- **Every browser update is a regression risk.** Group Speed Dial has 1-star reviews tied to FF 59, 70, 79, 151. Tabliss broke at FF 79 (`storage.sync` change) and FF 75 (2.0.2, *"black screen for several seconds"*). Bonjourr broke at 21.0.0 on FF 139 and again at 22.2.0. **Budget for this.**
- **Version migrations are the second-highest data-loss vector**, after sync. Bonjourr#458 lost everyone's links to a single mis-migrated string. Test migration from *every* previously-shipped schema, not just the last one.
- **Private/incognito windows must behave identically.** Praised when true (TablissNG), complained about when not (Speed Dial 2 replayed its welcome tour in every private window).
- **Nobody expects a service. Everybody expects durability.** Users tolerate no weather, no quotes, no news. They do not tolerate their 40 tiles vanishing.

---

## 6. What this means for Nordlys

Nordlys is a clock, a search bar, bookmark tiles in cards, themes, and an animated canvas, stored locally with no accounts and no telemetry. **That is, almost exactly, the profile of the two highest-rated products in this entire study** (Bonjourr: 4.90/23,878, 0 % 1-star; Humble New Tab Page: 4.74/1,105, 1 % 1-star). The strategy is therefore *don't break the thing you already are.* Most of these recommendations are about defence.

### Build / fix

**1. Treat tile data as a database, not as settings.** — *Evidence: §1.1 #1; §3B.* Data loss is the #1 genuine failure (24 % of Tabliss's negative reviews) and the most decisive abandonment trigger. Concretely: write tiles to `storage.local` (not `sync`); keep the last N-good snapshots in a rotating slot; on every schema migration, snapshot before migrating and expose an "undo last update" restore. Never write a partial state.

**2. Auto-export a rescue file, and nag about it once.** — *Evidence: §1.2 (cookie-clear wipes are user-caused and unfixable); §2.7 (export/import is praised unprompted).* Users who clear site data will lose everything, and they will blame you. A one-click JSON export that also fires an unobtrusive "you haven't backed up in 60 days" hint converts an uninstall into a shrug. TablissNG's users cite easy export/import as a reason they *switched to it*.

**3. Confirm every destructive action, and offer undo on delete.** — *Evidence: §1.1 #1, the single-misclick Tabliss review; the Group Speed Dial review whose entire config vanished from one menu selection.* Deleting a card should be undoable for ~10 seconds. This is a two-hour feature that prevents 1-star reviews.

**4. Bind cards to browser bookmark folders (read-only, live).** — *Evidence: §1.1 #4 (32 complaints), rank-1 in §4, Bonjourr's #1 most-reacted issue ever.* This is the single highest-value feature you can ship. It removes the onboarding cliff *and* it means the browser owns the durable copy of the data — which structurally defuses recommendation #1. Users with 2,000 bookmarks will not hand-enter them; they will uninstall in the first 90 seconds.

**5. Fix FOUC before anything else on this list ships.** — *Evidence: §5, "flashbang."* Inline the theme background colour in `<head>` as a literal, synchronous style, before any storage read; never let a dark-themed user see white. Decode/cache the canvas or background asset so the first paint is already correct. This is the highest-frequency *aesthetic* complaint about dark-mode new-tab extensions and it disproportionately affects exactly the audience Nordlys is styled for.

**6. Do not steal address-bar focus by default; make it an explicit toggle.** — *Evidence: §1.1 #5 (32 complaints); Bonjourr#503 where the maintainer landed on precisely this.* The default new tab's contract is Ctrl+T → type. Breaking it is read as the extension being broken. Ship "Focus the Nordlys search bar on new tabs" as an off-by-default option, and document `Esc` then `/` in the settings copy.

**7. Bound the canvas animation, hard.** — *Evidence: §5 CPU/battery; TablissNG's high-CPU 2-star; Momentum's recurring lag/thermal reports.* Respect `prefers-reduced-motion`. Pause on `document.hidden`. Cap frame rate. Ship a "static background" preset and make it one click from the first-run screen. Publish the idle CPU figure in the store listing — nobody else does, and the privacy-minded audience will notice.

**8. Ship custom search-engine URLs with `{searchTerms}`, plus the obvious presets.** — *Evidence: §1.1 #6; tabliss#342 (17 comments); *"Does not use the search engine configured in the browser but imposes google."** Cheap, and it converts a hostile segment (SearXNG/DuckDuckGo/Startpage/Yandex users) into advocates. TablissNG's 5-star reviews note the wording of this setting needs to explain the copy-two-searches-and-diff trick — do that in a tooltip.

**9. Make icons your competitive edge, and cache them locally.** — *Evidence: §1.1 #3 (60 complaints, 8.3 %); §1.1 #7 (the GDPR/tracking objection to remote favicon services).* Three things: (a) allow a custom image or an uploaded icon per tile, always free; (b) fall back to a well-designed monogram tile rather than a blank square; (c) cache fetched favicons to local storage so they don't re-fetch (and re-flash white) on every new tab. Point (c) simultaneously fixes a performance complaint and a privacy complaint — for a product that advertises no telemetry, silently pinging a favicon service on every tab open is an inconsistency someone will publish.

**10. Follow the OS light/dark setting for the *page*, not just the settings panel.** — *Evidence: Bonjourr#243; the 3-star review "there's no separate system setting for background/text colour swapping… so right now I get flashbanged at night"; idk1 on HN wanting a theme per mode.* Bonjourr, the category leader, is losing 3-star reviews over precisely this gap. Let a user assign one theme to light and another to dark.

**11. Keyboard-open tiles (Alt/Ctrl + 1–9) and "open all in this card."** — *Evidence: §4 ranks 13–14; Bonjourr#768; the Group Speed Dial reviews that specifically miss Ctrl+1–9 from the old Speed Dial; cseleborg's HN middle-click-the-folder workflow.* Both are small, both are disproportionately loved by the people who write reviews.

**12. Localise properly or ship English only.** — *Evidence: §1.1 #13; nightTab's German translation is one of only two aggregate cons on its Chrome listing and directly caused an uninstall.* A machine-translated settings panel reads as *broken software*, not as *foreign software*. If you can't get a native reviewer for a locale, don't ship that locale.

**13. Publish a visible maintenance heartbeat.** — *Evidence: §3C; the entire TablissNG phenomenon.* Users audit "last updated" on the store listing and abandon on staleness — *"Sadly not maintained anymore, what is a dealbreaker for me."* A dated changelog, a small in-settings "Nordlys 2.x — updated August 2026" line, and a regular cadence of small releases is retention work, not marketing.

**14. Make "no accounts, no telemetry, works offline" a checkable claim, not a slogan.** — *Evidence: §2.4; §1.1 #7; the Bonjourr review where local image import required reaching Bonjourr's servers.* Request the minimum permission set and say why each one is needed in the listing (*"no permissions needed"* is quoted as praise even inside 2- and 3-star reviews). Verify with devtools that a cold new tab makes **zero** network requests when the background is a local/procedural one.

**15. Test the "cookies and site data disabled" path.** — *Evidence: cpcallen's HN comment; the many "loses settings when cookies are deleted" reviews.* Catch storage exceptions, render a correct page with defaults, and show a single honest line explaining that browser storage is blocked. Do not spin the CPU throwing errors.

### Do NOT build

**16. No sync. Not now, probably not ever.** — *Evidence: §4 trap analysis; tabliss#69 + #268 + #459; 28 negative Tabliss reviews on v2.x.* This is the recommendation I'd defend most strongly. Sync was the proximate cause of the worst outcome in this entire dataset. `storage.sync` gives 100 KB and no conflict resolution; a user's tiles will silently lose to another machine's stale copy. Ship **export/import** instead and describe it, honestly, as "move your setup between machines." If you later ship sync: opt-in, off by default, automatic local snapshot before first sync, visible last-synced timestamp, and a per-device "don't sync from this machine" switch — the exact thing a user asked Tabliss for in 2020 and never got.

**17. No accounts, no login, no email capture — including for "free" tiers.** — *Evidence: §1.1 #2; Momentum's "They want you to create an account with your email and know your name. Why?"; Toby's credit-card-on-signup 1-stars.* The moment there is a login screen, you inherit the complaint class that gave Toby a 23 % 1-star rate.

**18. Never move an existing free feature behind payment.** — *Evidence: §3A; Speed Dial 2's recent rating of 1.70.* If Nordlys ever monetises, it must be **additive only** (new capability, new price) and preferably one-time rather than subscription. The reviews are unusually articulate about the legitimate boundary: charge for things with a recurring server cost, never for a local capability that already exists. *"Hiding previously free features behind a paywall, instead of developing new features to justify a payment, is a dark pattern."*

**19. No calendar, no email, no news/RSS, no social feeds.** — *Evidence: §4 traps; hvgk's "all the integrations break, all the time"; the entire anti-distraction chorus in §2.2.* Every one requires OAuth (→ accounts, → recommendation 17) or a third-party API that will rot. And they contradict the product: users pick a page like this *to not be shown things*.

**20. No weather and no quotes unless you accept the permanent maintenance tax.** — *Evidence: §1.1 #12; Dark Sky sunset, Giphy token, quotes.rest CORS, Bonjourr's weather-icon breakage.* Both are heavily requested and both have a 100 % breakage rate across the products studied. If you ship weather anyway: use one provider with a documented stable API, degrade to hiding the widget rather than showing a broken icon, and never let a widget failure block the page render.

**21. Don't chase the `about:blank` cohort or the homelab-dashboard cohort.** — *Evidence: §3G; §0 note on Dashy/Homer/gethomepage.* The self-hosted dashboards' most-reacted issues are Deluge/Sonarr/qBittorrent/Uptime-Kuma widgets, OIDC auth, Docker UID:GID and env-var interpolation. That is service monitoring for homelabs, a genuinely different product. The only two transferable requests from that world are *auto-favicon for bookmarks* (Homer#202, homepage#174 — already covered by rec 9) and *collapsible groups* (Homer#161, 10 👍 — covered by rec 11).

**22. Don't add a settings option for everything.** — *Evidence: §1.1 #13; nightTab#173, opened by nightTab's own maintainer, titled "Balance features vs complexity"; the German uninstall review.* nightTab is the most configurable product in this study and its recent Chrome rating is 4.10 against an all-time 4.69, with "confusing settings" as a named cause. Bonjourr, with fewer knobs and better defaults, sits at 4.90. **Defaults are the feature.**

### One thing to verify that this brief could not

Everything above rests on store reviews, GitHub and Hacker News. **The Reddit dimension is entirely missing** and it is the one where the "which of these did you pick, and why did you switch" conversation actually happens — r/startpages in particular is where the aesthetic-identity segment that Nordlys targets lives. Half an hour in a browser on r/startpages, r/browsers and r/chrome searching "Bonjourr", "Tabliss", "why I stopped using", and "new tab extension" would either corroborate the abandonment ranking in §3 or reveal a driver none of these sources can see. I'd treat §3's ordering as provisional until that's done.
