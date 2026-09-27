/* Fills public/ with what the films need besides the plates:

   - the fonts (Outfit, Instrument Sans) and the icon, copied from the extension;
   - the soundtrack of each cut, cut from the licensed track with ffmpeg:
     sample-exact from a bar line, faded, and brought to about -14 LUFS with
     one static gain (no compression). The music map
     (docs/video/music/ramp-it-up.json) and ffmpeg decode the mp3 to the same
     samples, so a bar of the map is a bar of the soundtrack.

   node scripts/setup.cjs            (FFMPEG=path/to/ffmpeg if it is not on PATH)

   The track is "Ramp It Up" by Ahjay Stelino, Mixkit Stock Music Free
   License. Mixkit does not allow the file to be handed on, so it is not in
   the repo: download it from https://mixkit.co/free-stock-music/item/69/ to
   docs/video/music/licensed/ramp-it-up.mp3 first. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HERE = path.resolve(__dirname, '..');
const REPO = path.resolve(HERE, '../../..');
const PUBLIC = path.join(HERE, 'public');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const TRACK = path.join(REPO, 'docs/video/music/licensed/ramp-it-up.mp3');
const map = require(path.join(REPO, 'docs/video/music/ramp-it-up.json'));

// Bar n of the track, in seconds (120 bpm: two seconds a bar).
const bar = (n) => map.downbeats[0] + n * map.bar;
/* One static gain per cut (no compression). The YouTube cut measured -10.3
   LUFS integrated and +0.5 dBTP: -3.7 dB brings it to -14 LUFS, the true peak
   near -3 dBTP. The store cut is quieter for its length (the held chord at
   the start, the ringing end): -1.4 dB brings it to about -14.9 LUFS with the
   true peak near -1.3 dBTP, as loud as it can go and stay under -1 dBTP. */
const GAIN_DB = { youtube: -3.7, store: -1.4 };

/* Each cut's soundtrack: pieces of the track, joined on bar lines with a
   10 ms crossfade, then the fades. The store cut goes from the build of the
   first drop (bar 15) straight to the last bar's final hit (bar 48): the
   riser of bar 15 lands on the hit instead of on bar 16. */
const CUTS = {
  youtube: { pieces: [[3, 50]], fadeIn: 0.8, fadeOut: 1.5 },
  store: { pieces: [[5, 16], [48, 50.25]], fadeIn: 0.5, fadeOut: 1.2 }
};

function soundtrack(name, { pieces, fadeIn, fadeOut }) {
  const out = path.join(PUBLIC, 'music', `${name}.wav`);
  const inputs = pieces.map(([a, b], i) => `[0:a]atrim=start=${bar(a).toFixed(6)}:end=${bar(b).toFixed(6)},asetpts=PTS-STARTPTS[p${i}]`);
  let chain = '[p0]';
  for (let i = 1; i < pieces.length; i++) {
    inputs.push(`${chain}[p${i}]acrossfade=d=0.01:c1=tri:c2=tri[j${i}]`);
    chain = `[j${i}]`;
  }
  const seconds = pieces.reduce((sum, [a, b]) => sum + (b - a) * map.bar, 0) - 0.01 * (pieces.length - 1);
  const filter = `${inputs.join(';')};${chain}afade=t=in:d=${fadeIn},afade=t=out:st=${(seconds - fadeOut).toFixed(4)}:d=${fadeOut},volume=${GAIN_DB[name]}dB[out]`;
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', TRACK, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out]);
  console.log(`music/${name}.wav: ${seconds.toFixed(3)} s`);
}

if (!fs.existsSync(TRACK)) {
  console.error(`Missing ${path.relative(REPO, TRACK)}: download "Ramp It Up" from https://mixkit.co/free-stock-music/item/69/ there.`);
  process.exit(1);
}
fs.mkdirSync(path.join(PUBLIC, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(PUBLIC, 'music'), { recursive: true });
for (const font of ['outfit.woff2', 'instrument-sans.woff2']) fs.copyFileSync(path.join(REPO, 'src/fonts', font), path.join(PUBLIC, 'fonts', font));
fs.copyFileSync(path.join(REPO, 'icons/icon.svg'), path.join(PUBLIC, 'icon.svg'));
for (const [name, cut] of Object.entries(CUTS)) soundtrack(name, cut);
