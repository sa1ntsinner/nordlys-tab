/* The YouTube film: 94 s, from bar 3 of "Ramp It Up" to the end of its last
   chord. Every time here is a place in the music: at(bar, beat) in the
   track's own bars (src/music.ts, CUES), so the edit reads against the
   music map; the film's frame 0 is bar 3.

     bars  3-7    the held chord      the sky, the name, the page floating in as a window
     bar   7      the build           the window straightens and fills the frame, faster and faster
     bars  8-15   the first drop      bookmarks and search: math, a command that changes the sky, find
     bars 16-23   the drop, part two  the dashboard: tasks, habits, cards moved and stretched, five layouts
     bars 24-31   the breakdown       focus mode, calm; then the skies, faster and faster
     bars 32-39   the second drop     21 themes in a grid, black for OLED, light, profiles
     bars 40-47   the drop, part two  connected apps, the inbox, the calendar, weather; no account; a recap
     bar  48      the last hit        the name, and where to get it */
import type { Accent, Caption, Card, Cut, Shot } from './types';

const START = 3; // the bar the film begins on
// Frame of the film at bar b, beat k of the track (a beat is 30 frames, a bar 120).
const at = (b: number, k = 0) => Math.round(((b - START) * 4 + k) * 30);
const END = at(50);

const shots: Shot[] = [
  // ── The name, over the sky (the held chord) ──
  { name: 'sky', plate: 'sky-aurora', from: at(3), to: at(6), grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 }, cam: [{ f: at(3), z: 1.1, y: 0.5 }, { f: at(6), z: 1.052, y: 0.5, ease: 'soft' }] },
  /* The page rises in as a window over the same sky, floats, and on the build
     straightens and grows to fill the frame exactly on the drop. */
  {
    name: 'window', plate: 'hero', from: at(6), to: at(10),
    grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 },
    window: {
      backdrop: 'sky-aurora', backdropTau: 7,
      // The sky moves less than the window over it, and the other way: it sinks a touch as the window rises.
      backdropCam: [{ f: at(3), z: 1.1, y: 0.5 }, { f: at(6), z: 1.052, y: 0.5, ease: 'soft' }, { f: at(8), z: 1.0, y: 0.47, ease: 'soft' }],
      keys: [
        { f: at(6), s: 0.5, rx: 26, ry: -20, rz: 4, y: 0.78, r: 70 },
        { f: at(6, 3), s: 0.56, rx: 15, ry: -13, rz: 2.2, y: 0.05, r: 64, ease: 'soft' },
        { f: at(7), s: 0.58, rx: 12, ry: -10, rz: 1.6, y: 0.02, r: 60, ease: 'linear' },
        { f: at(8), s: 1, rx: 0, ry: 0, rz: 0, y: 0, r: 0, ease: 'accel' },
      ],
    },
    // On the drop the page lands a touch large and settles; then a slow push towards the folders.
    cam: [{ f: at(7), z: 1.0 }, { f: at(8), z: 1.04, ease: 'in' }, { f: at(8, 1), z: 1.0, ease: 'punch' }, { f: at(10), z: 1.07, y: 0.53, ease: 'glide' }],
  },

  // ── Search: math on the first riser, then a command that changes the sky ──
  {
    name: 'math', plate: 'search', from: at(10), to: at(13, 2),
    cam: [
      { f: at(10), z: 1.05 }, { f: at(10, 1), z: 1.0, ease: 'punch' },
      // The riser lands on bar 11 with the answer on screen: punch in on it.
      { f: at(11) - 1, z: 1.0 }, { f: at(11, 1), z: 1.26, x: 0.5, y: 0.55, ease: 'punch' },
      { f: at(11, 3), z: 1.08, y: 0.5, ease: 'inOut' },
      // Enter on bar 12.5: the sky turns to Polaris and the page's own camera pulls back; ours follows.
      { f: at(12, 2), z: 1.08 }, { f: at(13, 2), z: 1.0, y: 0.5, ease: 'soft' },
    ],
  },
  { name: 'find', plate: 'find', from: at(13, 2), to: at(16), enter: { type: 'whip', frames: 14 },
    // Bar 15 drops the bass and a tone rises: a slow push that speeds up into the next drop.
    cam: [{ f: at(13, 2), z: 1.0 }, { f: at(15), z: 1.06, ease: 'soft' }, { f: at(16), z: 1.3, y: 0.52, ease: 'accel' }] },

  // ── The dashboard (the drop, part two) ──
  { name: 'dashboard', plate: 'dash-in', from: at(16), to: at(17), enter: { type: 'zoom', frames: 20 },
    cam: [{ f: at(16), z: 1.06 }, { f: at(16, 2), z: 1.0, ease: 'punch' }, { f: at(17), z: 1.02, ease: 'linear' }] },
  { name: 'task', plate: 'task', from: at(17), to: at(18, 2),
    cam: [{ f: at(17), z: 1.45, x: 0.3, y: 0.7 }, { f: at(18) - 1, z: 1.48, ease: 'linear' }, { f: at(18, 1), z: 1.75, x: 0.26, y: 0.74, ease: 'punch' }] },
  { name: 'habit', plate: 'habit', from: at(18, 2), to: at(19, 1), enter: { type: 'whip', frames: 12 },
    cam: [{ f: at(18, 2), z: 1.0 }, { f: at(18, 3) - 1, z: 1.0 }, { f: at(18, 3) + 6, z: 1.1, x: 0.52, y: 0.56, ease: 'punch' }] },
  // The page's camera pans from the countdown to the clocks on the clap (a beat long).
  { name: 'cards', plate: 'cards', from: at(19, 1), to: at(20),
    cam: [{ f: at(19, 1), z: 1.0 }, { f: at(20), z: 1.04, ease: 'linear' }],
    hint: { from: at(19, 2), to: at(19, 3), kind: 'x', px: 16 } },
  { name: 'drag', plate: 'drag', from: at(20), to: at(21), enter: { type: 'whipUp', frames: 12 },
    cam: [{ f: at(20), z: 1.16, x: 0.6, y: 0.42 }, { f: at(20, 3), z: 1.2, x: 0.66, y: 0.42, ease: 'inOut' }, { f: at(21), z: 1.2 }] },
  { name: 'stretch', plate: 'stretch', from: at(21), to: at(22),
    cam: [{ f: at(21), z: 1.0 }, { f: at(21, 3), z: 1.06, x: 0.4, y: 0.55, ease: 'inOut' }] },
  // Five layouts, framed alike: a cut on each beat.
  { name: 'calm', plate: 'layout-calm', from: at(22), to: at(22, 1) },
  { name: 'travel', plate: 'layout-travel', from: at(22, 1), to: at(22, 2) },
  { name: 'minimal', plate: 'layout-minimal', from: at(22, 2), to: at(22, 3) },
  { name: 'deep', plate: 'layout-deep', from: at(22, 3), to: at(23) },
  // The planner: the page's camera flies into its focus timer on the downlifter; the card becomes focus mode.
  { name: 'planner', plate: 'layout-planner', from: at(23), to: at(24), tau: 0.5,
    hint: { from: at(23, 2), to: at(24), kind: 'zoom', px: 60, shape: 'ramp', at: [0.79, 0.6] } },

  // ── The breakdown: focus mode ──
  { name: 'focus', plate: 'focus', from: at(24), to: at(30), enter: { type: 'zoom', frames: 22 },
    cam: [{ f: at(24), z: 1.08 }, { f: at(25), z: 1.0, ease: 'soft' }, { f: at(30), z: 1.05, ease: 'linear' }],
    pull: { from: at(24, 2), to: at(26), x: 0.5, y: 0.47, w: 0.5, h: 0.5, blur: 18 } },
  // Nine skies, drawn live: cuts on every half bar, then every beat, into the drop.
  { name: 'halo', plate: 'sky-halo', from: at(30), to: at(30, 2), enter: { type: 'fade', frames: 18 }, rate: 1.5 },
  { name: 'pillars', plate: 'sky-pillars', from: at(30, 2), to: at(31), rate: 1.8 },
  { name: 'nacre', plate: 'sky-nacre', from: at(31), to: at(31, 1), rate: 2.2 },
  { name: 'silk', plate: 'sky-silk', from: at(31, 1), to: at(31, 2), rate: 2.6 },
  { name: 'baikal', plate: 'sky-baikal', from: at(31, 2), to: at(31, 3), rate: 3 },
  { name: 'drift', plate: 'sky-drift', from: at(31, 3), to: at(32), rate: 3.4,
    cam: [{ f: at(31, 3), z: 1.0 }, { f: at(32), z: 1.18, ease: 'accel' }] },

  // ── The second drop: looks ──
  {
    name: 'themes', plate: 'theme-aurora-void', from: at(32), to: at(34),
    grid: {
      plates: ['theme-aurora-void', 'theme-nord-frost', 'theme-catppuccin-mocha', 'theme-dracula-velvet', 'oled', 'theme-tokyo-night', 'theme-gruvbox-dark', 'theme-porcelain-light', 'theme-sakura-daylight'],
      cols: 3, rows: 3,
      // The tiles arrive in a burst across the drop, the middle one (black) first and already there on the hit.
      appear: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => at(32) - 14 + [3, 2, 4, 1, 0, 5, 7, 6, 8][i] * 5),
      into: 4, zoomFrom: at(33, 2), zoomTo: at(34),
    },
  },
  { name: 'oled', plate: 'oled', from: at(34), to: at(35, 2), tau: 3,
    cam: [{ f: at(34), z: 1.0 }, { f: at(35) - 1, z: 1.02, ease: 'linear' }, { f: at(35, 1), z: 1.12, x: 0.55, y: 0.6, ease: 'punch' }] },
  { name: 'light', plate: 'light', from: at(35, 2), to: at(37), enter: { type: 'wipe', frames: 22 }, light: true,
    cam: [{ f: at(35, 2), z: 1.05 }, { f: at(37), z: 1.0, ease: 'soft' }] },
  { name: 'profiles', plate: 'profiles', from: at(37), to: at(40),
    // Close on the chip and its menu; out to the whole page as Home's look comes in.
    cam: [{ f: at(37), z: 1.5, x: 0.5, y: 0.32 }, { f: at(37, 3) + 8, z: 1.5, x: 0.5, y: 0.32 }, { f: at(38, 3), z: 1.0, y: 0.5, ease: 'inOut' }, { f: at(40), z: 1.04, ease: 'linear' }] },

  // ── Connected apps; the inbox; the calendar; weather ──
  // Settings open from the gear in the corner: the new shot opens out of it.
  { name: 'apps', plate: 'apps', from: at(40), to: at(41, 1), enter: { type: 'iris', frames: 26, at: [0.972, 0.945] },
    cam: [{ f: at(40), z: 1.0 }, { f: at(41, 1), z: 1.06, ease: 'linear' }] },
  { name: 'inbox', plate: 'inbox', from: at(41, 1), to: at(42, 3),
    cam: [{ f: at(41, 1), z: 1.0 }, { f: at(41, 3) - 1, z: 1.0 }, { f: at(41, 3) + 8, z: 1.12, x: 0.42, y: 0.4, ease: 'punch' }] },
  { name: 'agenda', plate: 'agenda', from: at(42, 3), to: at(43, 3), enter: { type: 'whip', frames: 12 } },
  { name: 'weather', plate: 'weather', from: at(43, 3), to: at(45), enter: { type: 'whipUp', frames: 12 },
    hint: { from: at(44), to: at(44, 2), kind: 'x', px: 14 } },

  // ── No account; a recap on the beat; into the last hit ──
  { name: 'statement', plate: 'hero-dash', from: at(45), to: at(46, 2),
    cam: [{ f: at(45), z: 1.0 }, { f: at(46, 2), z: 1.05, ease: 'linear' }],
    pull: { from: at(45) - 20, to: at(46, 2) + 40, x: 0.5, y: 0.5, w: 0.02, h: 0.02, blur: 34 } },
  { name: 'r-oled', plate: 'oled', from: at(46, 2), to: at(46, 3), tau: 2 },
  { name: 'r-focus', plate: 'focus', from: at(46, 3), to: at(47), tau: 12 },
  { name: 'r-mocha', plate: 'theme-catppuccin-mocha', from: at(47), to: at(47, 1), tau: 2.5 },
  { name: 'r-home', plate: 'profiles', from: at(47, 1), to: at(47, 2), tau: 6.5 },
  { name: 'r-polaris', plate: 'sky-polaris', from: at(47, 2), to: at(47, 3) },
  { name: 'r-hero', plate: 'hero-dash', from: at(47, 3), to: at(48), tau: 3,
    cam: [{ f: at(47, 3), z: 1.0 }, { f: at(48), z: 1.35, ease: 'accel' }] },
  { name: 'end', plate: 'sky-end', from: at(48), to: END, enter: { type: 'zoom', frames: 16 }, grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 },
    cam: [{ f: at(48), z: 1.0 }, { f: END, z: 1.05, ease: 'linear' }] },
];

const captions: Caption[] = [
  { text: 'Your favourite sites, in folders', eyebrow: 'Nordlys', from: at(8, 1), to: at(10) - 4 },
  // Over the search shots the top-left corner is the empty one (the bookmarks, with their names, are below).
  { text: 'Math right in the search box', eyebrow: 'Search', from: at(10, 1), to: at(11, 2) - 2, where: 'tl' },
  { text: 'Commands after the > sign', eyebrow: 'Search', from: at(11, 2), to: at(13, 1), where: 'tl' },
  { text: 'Find any site as you type', eyebrow: 'Search', from: at(13, 3), to: at(15, 2), where: 'tl' },
  { text: 'A dashboard for your day', eyebrow: 'Dashboard', from: at(16, 1), to: at(17) - 2 },
  { text: 'Type tasks the way you say them', eyebrow: 'Tasks', from: at(17, 1), to: at(18, 2) - 2 },
  { text: 'Drag and stretch any card', eyebrow: 'Dashboard', from: at(20, 1), to: at(22) - 2 },
  { text: 'Five layouts to start from', eyebrow: 'Dashboard', from: at(22), to: at(23, 2) },
  { text: 'One thing at a time', eyebrow: 'Focus mode', from: at(24, 2), to: at(26, 3), where: 'tl' },
  { text: 'Rain, ocean or wind, made in the browser', eyebrow: 'Focus mode', from: at(27, 1), to: at(29, 3), where: 'tl' },
  { text: 'Nine skies, drawn live', eyebrow: 'Looks', from: at(30, 1), to: at(32) - 2 },
  { text: '21 colour themes', eyebrow: 'Looks', from: at(32, 2), to: at(33, 3) },
  { text: 'Pure black, for OLED screens', eyebrow: 'Looks', from: at(34, 1), to: at(35, 2) - 2 },
  { text: 'Or light, if you like', eyebrow: 'Looks', from: at(35, 3), to: at(37) - 2, light: true },
  { text: 'Profiles for work and home', eyebrow: 'Profiles', from: at(37, 1), to: at(39, 3) },
  { text: 'Tasks from the apps you already use', eyebrow: 'Connected apps', from: at(40, 1), to: at(41, 1) - 2 },
  { text: 'Everything that’s due, in one list', eyebrow: 'Connected apps', from: at(41, 2), to: at(43, 3) - 2 },
  { text: 'Weather, clocks and countdowns', eyebrow: 'Dashboard', from: at(44), to: at(45) - 2 },
  { text: 'Free, and nothing to sign up for', eyebrow: 'Nordlys', from: at(46, 2), to: at(48) - 2 },
];

const cards: Card[] = [
  { kind: 'title', from: at(4), to: at(6, 1) },
  { kind: 'statement', from: at(45), to: at(46, 2), lines: ['No account.', 'Nothing tracked.'], beats: [at(45), at(45, 1), at(45, 2), at(45, 3)] },
  { kind: 'end', from: at(48), to: END, tags: [at(48, 2), at(48, 3), at(49)] },
];

const accents: Accent[] = [
  { kind: 'flash', f: at(8), strength: 0.45 },
  { kind: 'leak', f: at(8) - 10, frames: 70, seed: 3, hue: 232 },
  // The answer under the search box, as the riser lands.
  { kind: 'ring', shot: 'math', f: at(11), frames: 46, rect: [0.16, 0.565, 0.68, 0.09], pad: 6 },
  { kind: 'flash', f: at(16), strength: 0.35 },
  { kind: 'flash', f: at(32), strength: 0.4 },
  { kind: 'leak', f: at(32) - 8, frames: 64, seed: 5, hue: 255 },
  { kind: 'ring', shot: 'profiles', f: at(37, 1), frames: 50, rect: 'chip', pad: 14 },
  { kind: 'flash', f: at(48), strength: 0.5 },
  { kind: 'leak', f: at(48) - 6, frames: 90, seed: 7, hue: 240 },
];

export const youtube: Cut = { name: 'youtube', frames: END, audio: 'music/youtube.wav', shots, captions, cards, accents };
