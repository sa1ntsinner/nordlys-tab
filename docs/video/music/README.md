# Music for the promo videos

## In use: "Ramp It Up" by Ahjay Stelino

- Track page: https://mixkit.co/free-stock-music/item/69/ (Mixkit #69, Rhythmic
  Underscore, tagged Positive and Futuristic; published on Mixkit 2020-01-28;
  1:42).
- File: https://assets.mixkit.co/music/69/69.mp3, downloaded 2026-09-27
  (SHA-256 `9bc229673cc94e25df71d77ff9ced2a4cd6f73fc51f5d572c886c5621301957c`).
- Licence: the Mixkit Stock Music Free License, https://mixkit.co/license/#musicFree.

The licence says, as shown on that page on 2026-09-27:

> Items under the Mixkit Stock Music Free License can be used in your
> commercial and non-commercial projects for free.
>
> You're permitted to download, copy, modify, distribute and publicly perform
> the Music Items on any web or social media platform, including
> internet-based video on demand services, podcasts and advertisements.
>
> You're not allowed to use them in CDs or DVDs, video games or tv or radio
> broadcast. You're also not allowed to remix them (or incorporate in a
> music-only track), claim them as your own or register them on any rights
> management service.
>
> There are some important limits to these rights, described in our User Terms.
>
> \* If you receive a claim, please forward the details to team@mixkit.co for
> assistance.

The same page lists it as allowed for YouTube videos, social media video
posts, online marketing ads, podcasts and educational purposes, and not
allowed for CDs and DVDs, TV and radio broadcasts and video games. Mixkit's
own summary (https://mixkit.co/llm-info/) says: "Free License: Allows use in
commercial projects (YouTube videos, social media marketing, online ads,
music videos) and personal projects. No attribution required." No credit is
needed; the YouTube description gives one as a courtesy.

The User Terms it points to (https://mixkit.co/terms/, revised 2025-10-02)
add that an Item may not be handed on or sold as it is, only as part of new
work made with it. That is why the file is not in the repo.

Content ID: the licence promises nothing about it. It says only that a claim
should be forwarded to team@mixkit.co for help. Independent reports say
Mixkit tracks do not trigger claims and that Mixkit clears one when it
appears.

The file may not be handed on, so it is not in the repo. It lives in
`docs/video/music/licensed/` (ignored): download it again from the track page
to `licensed/ramp-it-up.mp3` to render. Its map, `ramp-it-up.json`, is ours
and is kept. The YouTube film uses bars 3 to 50 in one piece. The store film
joins bars 5 to 15 to the last hit at bar 48. Both are cut at bar lines and
faded (tools/video/remotion/scripts/setup.cjs). That is an edit for length in
a video, not a remix into another piece of music.

### How it was chosen

938 tracks were listed from Mixkit's genre, mood and tag pages. The 384 with
drums, 70 to 240 s long and not calm were measured by
`tools/video/music-events.py scan` (321 of them downloaded for this, 63 kept
from the last search). It fits a steady beat grid to the kicks
(2 to 3 ms off on these produced tracks). Then it finds the hits the groove
does not repeat, swells of noise (whooshes, sweeps, risers, downlifters),
drops, stops, a break with the drums out, and an ending. The best 27 went
through Demucs (`tools/video/stems.py`). Tracks with a singing voice were set
aside, for example "Sparta", with 26 % of its energy in the vocal stem. The 20
clean ones were mapped from their stems and looked at as spectrograms
(`tools/video/music-plot.py`).

"Ramp It Up" was picked for its shape, which is the film's own:

| bars | seconds | what happens | the film |
| --- | --- | --- | --- |
| 0-6 | 0-14 | a held chord, no beat | the sky and the name |
| 7 | 14-16 | hats and a noise riser | the page flies in |
| 8 | 16 | the drop: kick and bass | the full page, a flash |
| 10-11 | 20.6-22 | a pitch sweep up | the math answer, punched in |
| 14-16 | 28-32 | a rising tone, a bar without the bass | a push into the dashboard |
| 23 | 46-48 | a downlifter | into focus mode |
| 24-31 | 48-64 | the break: drums out, a pulsing pad | focus mode, calm |
| 32 | 64 | the second drop, a sweep | the themes |
| 34-35 | 68.5-70 | a pitch sweep up | pure black |
| 39-40 | 79.5-80 | a noise build | connected apps |
| 48 | 96 | the last hit, a clean decay | the end card |

It runs at exactly 120 bpm, so a beat is 30 frames at 60 fps. It has claps on
two and four and a kick on every beat through the drops, and Demucs finds no
voice (vocal share 0.0007). The runners-up were "Downtown Rags" (the same
artist: a fine break, but no intro and few swells) and "Purple J's" (trap,
with strong stops, but dark and without a calm break).

## Before: "Rising Forest" by Diego Nava

The 2026-09 film was cut to "Rising Forest" (Mixkit #471), under the same
licence. Its map, `rising-forest.json`, is kept for
`tools/video/films/rising-forest.cjs`. (This file used to say "no Content ID
claims". The licence does not promise that. It asks for a claim to be
forwarded to Mixkit.)

## Earlier: original instrumentals

The eight mp3 files here were made for the first promo drafts with
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) (`tools/video/music-gen.py`)
and are not used by the current films. The films now use a recording made by
a person.
