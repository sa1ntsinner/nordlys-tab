# The Nordlys films, edited in Remotion

The promo films (a 94 s cut for YouTube, a 26.5 s cut for the stores) are
edited here, in [Remotion](https://www.remotion.dev/) 4.0.529, cut to the
music: "Ramp It Up" by Ahjay Stelino (Mixkit, Stock Music Free License).
The pictures are the real extension: clean plates of the live demo, filmed by
`tools/video/plates.cjs`. Nothing of the interface is redrawn here. Remotion
does the editing: the cuts on the beats, the camera, the transitions and their
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
# The plates, 5120 x 2880 at 60 fps (about 20 minutes on an RTX 5070 Ti):
FFMPEG=/path/to/ffmpeg node ../plates.cjs ../films/ramp-it-up.cjs public/plates
FFMPEG=/path/to/ffmpeg node scripts/render.cjs    # both films, the 1080 copies, the tour, the checks
```

On this PC ffmpeg is `D:\remote-jobs\tools\ffmpeg\bin\ffmpeg.exe`. The
render uses the GPU for the WebGL effects (`--gl=angle`, set in
`remotion.config.ts`).

Previews:

```sh
npx remotion studio                                               # the Studio (props: plates)
npx remotion render YouTube out/preview.mp4 --scale=0.5           # half size
node ../plates.cjs ../films/ramp-it-up.cjs public/plates-1080 --scale 1.3333   # quick plates, 1920 x 1080
npx remotion render YouTube out/preview.mp4 --scale=0.5 --props='{"plates":"plates-1080"}'
```

## How it is put together

- `src/music.ts`: the music's time (120 bpm: a beat is 30 frames, a bar 120)
  and the cues the edit is cut to, checked on the spectrogram. The full map is
  `docs/video/music/ramp-it-up.json`, made by `tools/video/music-events.py`
  (beats, bars, and every hit, whoosh, riser, drop and stop found in the track).
- `src/edit/youtube.ts`, `src/edit/store.ts`: the edits. Each shot is a
  plate, the frames it is on (written as bars and beats of the music), what
  the camera does over it, and how it arrives: a cut, a whip, a zoom through,
  an iris, a wipe. Then the captions, the title, the statement, the end card,
  and the accents (a flash or a light leak on a drop, a ring on the control
  being used).
- `src/Shot.tsx`: a plate under the camera. Motion blur comes from the motion
  itself. The pose is taken half a frame before and after, and whatever moves
  fast is smeared along its path, as a 180-degree shutter would do it:
  directional blur for pans and whips, zoom blur for punch-ins and
  fly-throughs. Also the page floating as a 3D window, the grid of themes, and
  the focus pulls.
- `src/Type.tsx`: the words, in Outfit and Instrument Sans as on the website.
- `scripts/setup.cjs`: the soundtracks. They are cut from the track at bar
  lines with ffmpeg and brought to about -14 LUFS with one static gain. The
  store cut joins bar 15 to the final hit of bar 48.
- `scripts/render.cjs`: renders both films and makes the deliverables. It
  also runs the checks: loudness, a full decode, contact sheets around every
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
