/* Renders the films and what ships with them, and checks them.

   node scripts/render.cjs [--out dir] [--plates plates] [--only youtube|store] [--preview]
                           [--skip-render] [--concurrency 4] [--maps-only]

   Into --out (default out/):
     nordlys-youtube-4k.mp4    3840 x 2160, 60 fps, H.264 High (x264 slow, CRF 16), AAC 320 kb/s, faststart
     nordlys-store-4k.mp4      the store cut, the same
     nordlys-store-1080.mp4    the store cut at 1920 x 1080
     tour.mp4                  the YouTube cut at 1920 x 1080 for the website, under 15 MB (two-pass)
     tour-poster.webp          its poster frame for the website
     thumbnail.png             the YouTube thumbnail, 1280 x 720, from a clean frame of a plate
     sheets/                   contact sheets: around every cut (a quarter second before, just after,
                               0.3 s after) and the middle of every shot
     edit-map.json, edit-map.md  every shot and caption with its frame, its time, and the bar and beat
                               of the track it lands on (and how far from the beat grid)
     checks.txt                a full decode of every file, and loudness (target about -14 LUFS
                               integrated, true peak at most -1 dBTP)
   --preview renders the YouTube cut at half size to preview.mp4 and checks only that.
   --maps-only writes the edit map and the music map, and renders nothing. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const editData = require('./edit-data.cjs');

const HERE = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const has = (name) => args.includes(`--${name}`);
const OUT = path.resolve(HERE, flag('out', 'out'));
const PLATES = flag('plates', 'plates');
const ONLY = flag('only', null);
const PREVIEW = has('preview');
/* Four tabs, not more: each holds decoders for several 5K plates and 4K effect
   canvases on the GPU. With eight, a 16 GB card filled up and some frames came out
   black or half decoded, with no error. */
const CONCURRENCY = flag('concurrency', '4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m, exe) => `ffprobe${exe || ''}`);
const FONT = process.platform === 'win32' ? 'C\\:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });

const run = (cmd, argv, opts = {}) => {
  console.log(`> ${path.basename(cmd)} ${argv.join(' ').slice(0, 220)}`);
  const r = spawnSync(cmd, argv, { stdio: 'inherit', cwd: HERE, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
};
// The Remotion CLI, run by this node: no shell, so nothing is re-quoted on Windows.
const REMOTION = path.join(HERE, 'node_modules/@remotion/cli/remotion-cli.js');
const ff = (argv) => execFileSync(FFMPEG, ['-hide_banner', ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });

const edit = editData();
const { musicMap: map, FPS, BAR, BEAT } = edit.music;

function render(comp, file, cut, extra = []) {
  const tmp = file.replace(/\.mp4$/, '.remotion.mp4');
  const props = path.join(require('node:os').tmpdir(), `nordlys-props-${PLATES}.json`);
  fs.writeFileSync(props, JSON.stringify({ plates: PLATES }));
  run(process.execPath, [REMOTION, 'render', comp, tmp, `--props=${props}`, '--codec=h264', '--crf=16', '--x264-preset=slow', '--pixel-format=yuv420p',
    '--color-space=bt709', '--muted', `--concurrency=${CONCURRENCY}`, '--gl=angle', '--jpeg-quality=95', '--log=warn', ...extra]);
  mux(tmp, cut, file);
  fs.rmSync(tmp);
}
/* The picture from Remotion, the soundtrack added here, and the index at the start
   (faststart) for the web. Remotion's own AAC plays 2048 samples (42.7 ms) late: its
   edit list skips none of the encoder's priming. ffmpeg's skips exactly that, so the
   music plays where the edit put it (checked on every file: audioLag). */
function mux(video, cut, file) {
  ff(['-y', '-loglevel', 'error', '-i', video, '-i', path.join(HERE, 'public', cut.audio), '-map', '0:v:0', '-map', '1:a:0', '-t', String(cut.frames / FPS),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', file]);
}

/* ── The edit map: where every shot and word lands in the music ── */
function editMap(cut, startSeconds, pieces) {
  /* The track's time of a film frame: the soundtrack is pieces of the track, joined
     with a 10 ms crossfade. A frame within half a frame of a join is the next
     piece's (the cut onto the final hit is on the frame nearest that hit). */
  const trackTime = (f) => {
    let t = f / FPS;
    for (const [i, [a, b]] of pieces.entries()) {
      const len = (b - a) * BAR;
      if (i === pieces.length - 1 || t < len - 0.01 - 0.5 / FPS) return map.downbeats[0] + a * BAR + t;
      t -= len - 0.01;
    }
    return NaN;
  };
  const where = (f) => {
    const t = trackTime(f);
    const beats = (t - map.downbeats[0]) / BEAT;
    const nearest = Math.round(beats * 4) / 4; // to the nearest sixteenth
    const bar = Math.floor(nearest / 4), beat = nearest - bar * 4;
    const off = (beats - nearest) * BEAT * 1000;
    /* What is in the music there: the place in the bar (claps are on 2 and
       4, a kick on every beat, except in the break, bars 24-31), and any cue
       of src/music.ts or strong swell or drop of the map within 60 ms. */
    const inBreak = bar >= 24 && bar < 32, intro = bar < 7;
    const place = !Number.isInteger(beat) ? 'off-beat' : beat === 0 ? 'downbeat' : `beat ${beat + 1}`;
    const groove = intro ? 'the held chord' : inBreak ? 'the break' : beat === 1 || beat === 3 ? 'clap' : Number.isInteger(beat) ? 'kick' : '';
    const cues = Object.entries(edit.music.CUES).flatMap(([name, b]) => [].concat(b).map((x) => [name, x])).filter(([, x]) => Math.abs(map.downbeats[0] + x * BAR - t) < 0.06).map(([name]) => name);
    const swells = map.events.filter((e) => ['drop', 'whoosh', 'sweep', 'downlifter', 'stop'].includes(e.type) && (e.s ?? 0) >= 0.3 && (Math.abs(e.t - t) < 0.06 || (e.end != null && Math.abs(e.end - t) < 0.06))).map((e) => `${e.type} ${e.end != null && Math.abs(e.end - t) < 0.06 ? 'ends' : 'peaks'}`);
    const on = [place, groove, ...cues, ...new Set(swells)].filter(Boolean).join(', ');
    return { film: +(f / FPS).toFixed(3), frame: f, track: +t.toFixed(3), bar, beat, offMs: +off.toFixed(1), on };
  };
  const shots = cut.shots.map((s) => ({ shot: s.name, plate: s.plate, arrives: s.enter?.type ?? 'cut', ...where(s.from), seconds: +((s.to - s.from) / FPS).toFixed(2) }));
  /* What happens inside the plates (a key pressed, a click), where it lands in the
     film: the plate's script marked the plate time, the shot maps plate time to frames. */
  const plates = loadIndex();
  const actions = [];
  for (const s of cut.shots) {
    const meta = plates[s.plate];
    if (!meta) continue;
    for (const [mark, t] of Object.entries(meta.marks)) {
      const f = Math.round(s.from + ((t - (s.tau ?? 1)) * FPS) / (s.rate ?? 1));
      if (f >= s.from && f < s.to) actions.push({ shot: s.name, action: mark, ...where(f) });
    }
  }
  const captions = cut.captions.map((c) => ({ text: c.text, ...where(c.from), until: +(c.to / FPS).toFixed(2) }));
  const accents = cut.accents.map((a) => {
    // A light leak starts a few frames early, so its light is already coming in on the hit.
    const hit = a.kind === 'leak' && cut.accents.find((b) => b.kind === 'flash' && b.f >= a.f && b.f - a.f <= 12);
    const h = hit && where(hit.f);
    return { accent: a.kind, ...where(a.f), ...(h ? { on: `starts ${hit.f - a.f} frames before the flash on ${h.bar}.${h.beat}` } : {}) };
  });
  return { cut: cut.name, frames: cut.frames, seconds: +(cut.frames / FPS).toFixed(3), soundtrack: pieces.map(([a, b]) => `track bars ${a}-${b}`).join(', then '), shots, actions, captions, accents };
}

/* ── The music map, to read: the grid, the cues the edit is cut to, and every
   strong event the analysis found (the full data is the JSON beside it). ── */
function writeMusicMap() {
  fs.copyFileSync(path.join(HERE, '../../../docs/video/music/ramp-it-up.json'), path.join(OUT, 'music-map.json'));
  const bar = (b) => map.downbeats[0] + b * BAR;
  const md = ['# Music map: "Ramp It Up" by Ahjay Stelino (Mixkit #69)', '',
    `${map.tempo} bpm (a beat ${BEAT} s, a bar ${BAR} s), ${map.duration} s, ${map.bars.length} bars; bar 0 is the first downbeat, at ${map.downbeats[0]} s.`,
    `Grid: fitted to the kicks, median distance of strong onsets from it ${map.grid.residual_ms} ms. From tools/video/music-events.py, on the Demucs stems.`, '',
    '## The cues the edit is cut to (checked on the spectrogram)', '', '| cue | bar | seconds |', '|---|---|---|'];
  for (const [name, b] of Object.entries(edit.music.CUES)) {
    for (const x of [].concat(b)) md.push(`| ${name} | ${x} | ${bar(x).toFixed(3)} |`);
  }
  md.push('', '## Sections', '', '| from bar | to bar | seconds | kind | energy dB | drums dB |', '|---|---|---|---|---|---|');
  for (const s of map.sections) md.push(`| ${s.from_bar} | ${s.to_bar} | ${s.start.toFixed(2)}-${s.end.toFixed(2)} | ${s.kind} | ${s.energy_db} | ${s.drums_db} |`);
  md.push('', '## Events (strength 0.3 and up; kicks, claps and hats are on every beat of the drops, see the JSON)', '', '| seconds | bar.beat | kind | strength | length s |', '|---|---|---|---|---|');
  for (const e of map.events) {
    if (['kick', 'clap', 'hat'].includes(e.type) || (e.s ?? 0) < 0.3) continue;
    md.push(`| ${e.t.toFixed(3)} | ${e.bar}.${e.beat.toFixed(2)} | ${e.type} | ${e.s.toFixed(2)} | ${e.dur ?? ''} |`);
  }
  fs.writeFileSync(path.join(OUT, 'music-map.md'), `${md.join('\n')}\n`);
}

function writeEditMaps() {
  const maps = [editMap(edit.youtube, 0, [[3, 50]]), editMap(edit.store, 0, [[5, 16], [48, 50.25]])];
  fs.writeFileSync(path.join(OUT, 'edit-map.json'), JSON.stringify(maps, null, 1));
  const md = ['# Edit map', '', 'Where every shot, word and accent of the films lands in "Ramp It Up" (120 bpm; bar 0 is the track\'s first downbeat, 0.112 s in). "off" is the distance of the frame from the sixteenth-note grid, in ms (a frame is 16.7 ms).', ''];
  for (const m of maps) {
    md.push(`## ${m.cut} (${m.seconds} s; ${m.soundtrack})`, '', '| # | shot | plate | arrives | film s | frame | bar.beat | off ms | on | length s |', '|---|---|---|---|---|---|---|---|---|---|');
    m.shots.forEach((s, i) => md.push(`| ${i + 1} | ${s.shot} | ${s.plate} | ${s.arrives} | ${s.film} | ${s.frame} | ${s.bar}.${s.beat} | ${s.offMs} | ${s.on} | ${s.seconds} |`));
    md.push('', '| in the plate | shot | film s | frame | bar.beat | off ms | on |', '|---|---|---|---|---|---|---|');
    for (const a of m.actions) md.push(`| ${a.action} | ${a.shot} | ${a.film} | ${a.frame} | ${a.bar}.${a.beat} | ${a.offMs} | ${a.on} |`);
    md.push('', '| caption | film s | frame | bar.beat | off ms | on |', '|---|---|---|---|---|---|');
    for (const c of m.captions) md.push(`| ${c.text.replace(/\|/g, '/')} | ${c.film} | ${c.frame} | ${c.bar}.${c.beat} | ${c.offMs} | ${c.on} |`);
    md.push('', '| accent | film s | frame | bar.beat | on |', '|---|---|---|---|---|');
    for (const a of m.accents) md.push(`| ${a.accent} | ${a.film} | ${a.frame} | ${a.bar}.${a.beat} | ${a.on} |`);
    const worst = Math.max(...m.shots.map((s) => Math.abs(s.offMs)));
    md.push('', `Largest distance of a cut from the grid: ${worst.toFixed(1)} ms.`, '');
  }
  fs.writeFileSync(path.join(OUT, 'edit-map.md'), md.join('\n'));
  return maps;
}

function loadIndex() {
  const file = path.join(HERE, 'public', PLATES, 'index.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

/* ── Checks ── */
function probe(file) {
  const j = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate,nb_frames', '-of', 'json', file]).toString());
  return j;
}
// Faststart: the index (moov) comes before the media (mdat), so the web can play it while it loads.
function faststart(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    for (let at = 0, size = fs.fstatSync(fd).size; at < size;) {
      fs.readSync(fd, head, 0, 16, at);
      const type = head.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      const n = head.readUInt32BE(0);
      at += n === 1 ? Number(head.readBigUInt64BE(8)) : n || size;
    }
    return false;
  } finally { fs.closeSync(fd); }
}
function decodeAll(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  return { ok: r.status === 0 && !r.stderr.trim(), errors: r.stderr.trim() };
}
/* Where the music in a finished file sits against the soundtrack the edit was cut to:
   a second of the soundtrack at a fifth, two fifths ... of the film, cross-correlated
   with the file's audio over +-50 ms. 0 samples is where the edit put it. */
function audioLag(file, cut) {
  const pcm = (src) => {
    const b = execFileSync(FFMPEG, ['-v', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  };
  const a = pcm(file), b = pcm(path.join(HERE, 'public', cut.audio));
  const SR = 48000, M = SR / 20, n = SR;
  return [1, 2, 3, 4].map((q) => {
    const i = Math.round(((q / 5) * cut.frames * SR) / FPS);
    let best = -Infinity, lag = 0;
    for (let k = -M; k <= M; k++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += a[i + k + j] * b[i + j];
      if (s > best) { best = s; lag = k; }
    }
    return lag;
  });
}
function loudness(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=summary', '-f', 'null', '-'], { encoding: 'utf8' });
  const get = (label) => { const m = r.stderr.match(new RegExp(`${label}:\\s+([-+\\d.]+)`)); return m ? Number(m[1]) : NaN; };
  return { integrated: get('Input Integrated'), truePeak: get('Input True Peak'), lra: get('Input LRA') };
}

/* ── Contact sheets ── */
function sheets(file, cut, name) {
  const w = 480;
  const picks = [];
  cut.shots.forEach((s, i) => {
    if (i > 0) for (const [d, label] of [[-15, 'before'], [1, 'cut'], [18, 'after']]) picks.push([s.from + d, `${s.name} ${label}`]);
    picks.push([Math.round((s.from + s.to) / 2), `${s.name} middle`]);
  });
  // In the order they come in the file (select gives them that way), each frame once.
  const seen = new Set();
  const frames = picks.filter(([f]) => f >= 0 && f < cut.frames).sort((a, b) => a[0] - b[0]).filter(([f]) => !seen.has(f) && seen.add(f));
  const dir = path.join(OUT, 'sheets', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const scale = `scale=${w}:-1`;
  // A pass over the file for every forty frames: a longer select is too much for ffmpeg's parser.
  for (let k = 0; k < frames.length; k += 40) {
    const sel = frames.slice(k, k + 40).map(([f]) => `eq(n\\,${f})`).join('+');
    ff(['-y', '-loglevel', 'error', '-i', file, '-vf', `select='${sel}',${scale}`, '-fps_mode', 'passthrough', '-start_number', String(k), path.join(dir, 'f%04d.png')]);
  }
  const imgs = fs.readdirSync(dir).filter((n) => /^f\d+\.png$/.test(n)).sort();
  imgs.forEach((img, i) => {
    const [f, label] = frames[i] ?? [0, ''];
    const text = `${label}  ${(f / FPS).toFixed(2)} s  f${f}`.replace(/:/g, '\\:').replace(/'/g, '');
    ff(['-y', '-loglevel', 'error', '-i', path.join(dir, img), '-vf', `drawtext=fontfile='${FONT}':text='${text}':x=6:y=6:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.65`, path.join(dir, `l${img}`)]);
  });
  const per = 48; // 8 x 6 a sheet
  const labelled = fs.readdirSync(dir).filter((n) => /^lf\d+\.png$/.test(n)).sort();
  for (let k = 0; k * per < labelled.length; k++) {
    const list = labelled.slice(k * per, (k + 1) * per);
    const listFile = path.join(dir, `list${k}.txt`);
    fs.writeFileSync(listFile, list.map((n) => `file '${path.join(dir, n).replace(/\\/g, '/')}'`).join('\n'));
    ff(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `tile=8x6:padding=4:color=black`, '-frames:v', '1', path.join(OUT, 'sheets', `${name}-cuts-${k + 1}.jpg`)]);
  }
  // And the whole film at a frame a second.
  ff(['-y', '-loglevel', 'error', '-i', file, '-vf', `fps=1,scale=${w / 2}:-1,tile=12x${Math.ceil(cut.frames / FPS / 12)}:padding=2`, '-frames:v', '1', path.join(OUT, 'sheets', `${name}-overview.jpg`)]);
  fs.rmSync(dir, { recursive: true, force: true });
}

(async () => {
  const checks = [];
  const note = (line) => { console.log(line); checks.push(line); };
  const maps = writeEditMaps();
  writeMusicMap();
  if (has('maps-only')) return;
  for (const m of maps) note(`${m.cut}: ${m.shots.length} shots, largest cut distance from the grid ${Math.max(...m.shots.map((s) => Math.abs(s.offMs))).toFixed(1)} ms`);
  const files = [];
  if (PREVIEW) {
    if (!ONLY || ONLY === 'youtube') {
      const file = path.join(OUT, 'preview.mp4');
      if (!has('skip-render')) render('YouTube', file, edit.youtube, ['--scale=0.5']);
      files.push(['preview', file, edit.youtube]);
    }
    if (!ONLY || ONLY === 'store') {
      const file = path.join(OUT, 'preview-store.mp4');
      if (!has('skip-render')) render('Store', file, edit.store, ['--scale=0.5']);
      files.push(['preview-store', file, edit.store]);
    }
  } else {
    if (!ONLY || ONLY === 'youtube') {
      const yt = path.join(OUT, 'nordlys-youtube-4k.mp4');
      if (!has('skip-render')) render('YouTube', yt, edit.youtube);
      files.push(['youtube', yt, edit.youtube]);
      /* The tour on the website: the same cut at 1080, two-pass, aimed at 14.4 MB
         (million bytes) so that it stays under 15 MB however that is counted. */
      const tour = path.join(OUT, 'tour.mp4');
      const seconds = edit.youtube.frames / FPS;
      const kbps = Math.floor((14.4e6 * 8) / 1000 / seconds - 128);
      const log = path.join(OUT, 'tour-pass');
      for (const pass of [1, 2]) {
        ff(['-y', '-loglevel', 'error', '-i', yt, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', `${kbps * 2}k`, '-bufsize', `${kbps * 4}k`,
          '-pass', String(pass), '-passlogfile', log, '-profile:v', 'high', '-pix_fmt', 'yuv420p', ...(pass === 1 ? ['-an', '-f', 'mp4', process.platform === 'win32' ? 'NUL' : '/dev/null'] : ['-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tour])]);
      }
      for (const f of fs.readdirSync(OUT)) if (f.startsWith('tour-pass')) fs.rmSync(path.join(OUT, f));
      files.push(['tour', tour, edit.youtube]);
      // Its poster on the website (site/assets/tour-poster.webp): the dashboard and its caption.
      ff(['-y', '-loglevel', 'error', '-ss', '27.5', '-i', tour, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', path.join(OUT, 'tour-poster.webp')]);
      // The YouTube thumbnail, from a clean frame (no caption): the dashboard over the aurora, from its plate.
      run(process.execPath, [path.join(HERE, '../thumbnail.cjs'), path.join(HERE, 'public', PLATES, 'hero-dash.mp4'), path.join(OUT, 'thumbnail.png'), '--at', '2.0'], { env: { ...process.env, FFMPEG } });
    }
    if (!ONLY || ONLY === 'store') {
      const st = path.join(OUT, 'nordlys-store-4k.mp4');
      if (!has('skip-render')) render('Store', st, edit.store);
      files.push(['store', st, edit.store]);
      const st1080 = path.join(OUT, 'nordlys-store-1080.mp4');
      ff(['-y', '-loglevel', 'error', '-i', st, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', st1080]);
      files.push(['store-1080', st1080, edit.store]);
    }
  }
  for (const [name, file, cut] of files) {
    const p = probe(file);
    const v = p.streams.find((s) => s.width), a = p.streams.find((s) => s.sample_rate);
    const size = Number(p.format.size);
    note(`${path.basename(file)}: ${v.width}x${v.height} ${v.r_frame_rate} ${v.codec_name} ${v.profile} ${v.pix_fmt}; audio ${a ? `${a.codec_name} ${a.sample_rate} Hz ${Math.round((a.bit_rate || 0) / 1000)} kb/s` : 'none'}; ${Number(p.format.duration).toFixed(3)} s; ${(size / 1e6).toFixed(2)} MB (${(size / 1048576).toFixed(2)} MiB)`);
    note(`  frames: ${v.nb_frames} (the edit: ${cut.frames}); faststart: ${faststart(file) ? 'yes' : 'NO'}`);
    const d = decodeAll(file);
    note(`  full decode: ${d.ok ? 'clean' : `ERRORS ${d.errors.slice(0, 400)}`}`);
    const l = loudness(file);
    note(`  loudness: ${l.integrated} LUFS integrated, true peak ${l.truePeak} dBTP, LRA ${l.lra} LU`);
    note(`  audio against the soundtrack (at 1/5 ... 4/5 of the film): ${audioLag(file, cut).map((k) => `${k >= 0 ? '+' : ''}${k}`).join(', ')} samples at 48 kHz`);
    if (name !== 'tour' && name !== 'store-1080') sheets(file, cut, name);
  }
  fs.writeFileSync(path.join(OUT, PREVIEW ? 'checks-preview.txt' : 'checks.txt'), `${checks.join('\n')}\n`);
})().catch((error) => { console.error(error); process.exit(1); });
