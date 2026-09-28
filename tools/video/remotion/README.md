# The Nordlys films, edited in Remotion

The promo film (94 s, for YouTube, which the Chrome Web Store and Edge Add-ons
listings link to) and its 28-second cut for the Mac App Store are edited here,
in [Remotion](https://www.remotion.dev/) 4.0.529, cut to the music: "Ramp It
Up" by Ahjay Stelino (Mixkit, Stock Music Free License). The pictures are the
real extension: clean plates of the live demo, filmed by
`tools/video/plates.cjs`. Nothing of the interface is redrawn here. Remotion
does the editing: the cuts on the music, the camera, the transitions and their
motion blur, the words, the light on the drops.

## Where it is installed and rendered

The repo root is the unpacked extension, and a browser that loads it would
also crawl this project's `node_modules` (several hundred MB), which slows the
browser down. So this folder holds only the source. Install and render it on
this PC, in a clone of the repo that no browser loads as an extension (for
example the job folder it was made in), not in the folder Chrome loads.
`node_modules`, `out/` and `public/` are git-ignored.

## Render

From a clone that no browser loads:

```sh
npm ci                                   # in the repo root: Playwright, for the plates
npm run site                             # builds .site-dist/, the live demo the plates are filmed from
cd tools/video/remotion
npm ci
# The track: download "Ramp It Up" (https://mixkit.co/free-stock-music/item/69/)
# to docs/video/music/licensed/ramp-it-up.mp3 (git-ignored; Mixkit does not allow handing the file on).
FFMPEG=/path/to/ffmpeg node scripts/setup.cjs     # fonts, icon, and the two soundtracks into public/
# The plates, 5120 x 2880 at 60 fps (about 25 minutes on an RTX 5070 Ti). The nine
# theme plates are only seen a third of the frame wide, in the grid, and are filmed at
# 1920 x 1080, so the grid does not decode nine 5K videos at once:
PLATES=$(node -e "const f=require('../films/ramp-it-up.cjs'); console.log(f.plates({}).map(p=>p.name).filter(n=>!n.startsWith('theme-')).join(','))")
THEMES=$(node -e "const f=require('../films/ramp-it-up.cjs'); console.log(f.plates({}).map(p=>p.name).filter(n=>n.startsWith('theme-')).join(','))")
FFMPEG=/path/to/ffmpeg node ../plates.cjs ../films/ramp-it-up.cjs public/plates --only "$PLATES"
FFMPEG=/path/to/ffmpeg node ../plates.cjs ../films/ramp-it-up.cjs public/plates --only "$THEMES" --scale 1.3333333333
# The film, the tour and its poster, the app preview, the thumbnail, the checks (with the shake
# measurement), the maps (about 30 minutes):
FFMPEG=/path/to/ffmpeg node scripts/render.cjs      # into out/ (ignored); --out <dir> for elsewhere
```

On this PC ffmpeg is `D:\remote-jobs\tools\ffmpeg\bin\ffmpeg.exe`. The
render uses the GPU for the WebGL effects (`--gl=angle`, set in
`remotion.config.ts`) and to decode the plates. Keep to four render tabs (the
default, `--concurrency 4`) on a 16 GB card. With eight, the card filled up,
and some frames came out black or half decoded with no error. The render does
not notice such frames by itself: look at the contact sheets.

Previews:

```sh
npx remotion studio                                               # the Studio (props: plates)
node ../plates.cjs ../films/ramp-it-up.cjs public/plates-1080 --scale 1.3333333333   # quick plates, 1920 x 1080
node scripts/render.cjs --preview --plates plates-1080 --out out/preview   # both cuts at half size, sheets, checks
node scripts/render.cjs --maps-only                               # only the edit map and the music map
```

`render.cjs` hands the props to Remotion as a file: on Windows, JSON typed on
the command line loses its quotes on the way through `npx`.

## Checking the pictures

`render.cjs` checks what it can see in the files: the format, a full decode,
the loudness, and where the music sits against the soundtrack (0 samples). It
cannot see a frame drawn wrong, so two more checks (Python with numpy, from
the repo root):

```sh
# The plates: a frame further from both neighbours than they are from each
# other (a flash, a card left undrawn).
uv run --with numpy python tools/video/glitches.py "$FFMPEG" tools/video/remotion/public/plates/*.mp4
# The film against a half-size render of the same edit from the 1080 plates
# (in tools/video/remotion: node scripts/render.cjs --preview --plates plates-1080 --out out/ref):
# frames where picture was lost (black, half decoded).
R=tools/video/remotion/out
uv run --with numpy python tools/video/dropouts.py $R/nordlys-4k.mp4 $R/ref/preview.mp4 "$FFMPEG"
# Where the picture shakes (bounces, steps, doubled or dropped frames, wobble, shimmer), per shot;
# render.cjs runs it on every cut and writes it into checks.txt:
uv run --with numpy --with opencv-python-headless python tools/video/shake.py $R/nordlys-4k.mp4 $R/edit-map.json youtube "$FFMPEG"
```

## How it is put together

- `src/music.ts`: the music's time (120 bpm: a beat is 30 frames, a bar 120)
  and the cues the edit is cut to, checked on the spectrogram. The full map is
  `docs/video/music/ramp-it-up.json`, made by `tools/video/music-events.py`
  (beats, bars, and every hit, whoosh, riser, drop and stop found in the track).
- `src/edit/youtube.ts`: the edit. Each shot is a plate, the frames it is on
  (written as bars and beats of the music), what the camera does over it, and
  how it arrives: a cut, a zoom through, a dissolve. Then the few words, the
  title, the end card, and the accents (a flash and a light leak on a drop).
- `src/edit/preview.ts`: the Mac App Store preview, made from that edit: the
  film's own moments laid end to end over one stretch of the track, so the
  preview follows the film.
- `src/camera.ts`: the camera. A move is one eased curve from one pose to the
  next, with soft ends and no overshoot. When the zoom changes, it zooms about
  the one point of the plate that the two poses share, so the subject stays
  put, in log space, so the speed reads the same at any zoom.
- `src/Shot.tsx`: a plate under the camera. Motion blur comes from the motion
  itself. The pose is taken half a frame before and after, and whatever moves
  fast is smeared along its path, as a 180-degree shutter would do it:
  directional blur for pans and whips, zoom blur for pushes and
  fly-throughs. Also the page floating as a 3D window, the grid of themes, and
  the focus pulls.
- `src/Type.tsx`: the words, in Outfit and Instrument Sans as on the website.
- `scripts/setup.cjs`: the soundtracks. They are cut from the track at bar
  lines with ffmpeg and brought to about -14 LUFS with one static gain. The
  app preview joins bar 16 to the final hit of bar 48, the crossfade centred on
  the bar line.
- `scripts/render.cjs`: renders the film and its preview and makes the
  deliverables. It also runs the checks: loudness, a full decode, the music
  against the soundtrack, the shake measurement, contact sheets around every
  cut, the edit map.

The shots come from data (`src/edit/*.ts`) rather than one hand-placed
`<Sequence>` each. The timeline is written in bars and beats, and the edit
files are where it is edited.

## Licences

**Remotion** is used under its Free License. That licence covers individuals,
for-profit organisations with up to three employees, and non-profits (see
`LICENSE.md` in [remotion-dev/remotion](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)).
Nordlys is made by one person, as a personal open-source project, so the Free
License applies. If the project were ever made for a company with more than
three employees, that company would need a Remotion Company License.

**The music** is "Ramp It Up" by Ahjay Stelino, from Mixkit under the Mixkit
Stock Music Free License. See `docs/video/music/README.md` for what the licence
says, what it allows, and the proof kept of it.
