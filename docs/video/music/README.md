# Music for the promo videos

## In use: "Rising Forest" by Diego Nava

From [Mixkit](https://mixkit.co/free-stock-music/), under the Mixkit Stock
Music Free License: free for commercial use including YouTube and ads, no
credit required, no Content ID claims. It may not be handed on as a file, so
the audio lives outside the repo (`docs/video/music/licensed/`, ignored);
download it again from Mixkit (track 471) to re-render. Its map,
`rising-forest.json`, is ours and is kept.

Picked from 63 Mixkit tracks (EDM, electronic, house, future bass, pop) by
`tools/video/music-map.py`: 123 bpm, steady beat, and the shape the film
needs (a 6-bar groove, a one-bar dip, an 8-bar drop, an 8-bar breakdown, a
16-bar second drop, a calm outro). Demucs found no vocals in it (checked on
the ten best fits; one with vocals half the time was dropped).

## Earlier: original instrumentals

All eight tracks here are original instrumentals made for Nordlys with
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5), which is MIT-licensed
and free for commercial use; its authors say it was trained on royalty-free
material. No sample, loop or existing recording is used, and there is no one
to credit.

`tools/video/music-gen.py` made them (four styles, seeds 11 and 29, 70 s,
instrumental, shaped Intro → Build → Drop → Breakdown → Build → Drop → Outro).
`tools/video/music-map.py` measured each one:

| Track | Tempo | Dynamic range | Drops |
| --- | --- | --- | --- |
| futurebass-11 (used) | 129 | 0.80 | 7.6 s, 15.2 s, 37.8 s |
| trailer-29 | 129 | 0.71 | 3.9 s, 15.0 s, 57.5 s |
| house-29 | 123 | 0.58 | 19.9 s |
| electropop-29 | 117 | 0.56 | 7.6 s, 33.6 s, 55.6 s |
| trailer-11 | 129 | 0.55 | 15.5 s, 36.2 s, 43.7 s |
| futurebass-29 | 129 | 0.54 | 3.8 s, 39.4 s |
| house-11 | 123 | 0.53 | 31.9 s |
| electropop-11 | 123 | 0.25 | none |

futurebass-11 was picked for its shape: a quiet four-bar intro, a drop at
7.6 s, a breakdown at 30–38 s and a second drop at 37.8 s. To cut the video
to another one: `python tools/video/music-map.py <track> <map.json>`, then
`node tools/video/record3.cjs <map.json> <track> <out.mp4>`.

The `.wav` of the track in use is kept locally (it is not committed); the
recorder reads either.
