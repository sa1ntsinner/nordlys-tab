/* The store film: 26.5 s, the strongest moments of the long one on bars 5
   to 15 of the track, then straight to its last bar: the soundtrack
   (scripts/setup.cjs) joins bar 15, where a tone rises into the next part,
   to the final hit of bar 48, so the rise lands on the end.

     bars 5-7    the sky, the name; the window rising in
     bar  7      the build: the window fills the frame
     bars 8-15   one thing a bar: folders, math, the dashboard, a task, focus, skies, themes, profiles
     bar 48      the name and where to get it

   at(bar, beat) is in the track's bars up to bar 16; the ending is at(48...). */
import type { Accent, Caption, Card, Cut, Shot } from './types';

const START = 5;
const JOIN = 16;     // the soundtrack's bar 16 is the track's bar 48
const at = (b: number, k = 0) => {
  const bars = b >= 48 ? JOIN - START + (b - 48) : b - START;
  return Math.round((bars * 4 + k) * 30 - (b >= 48 ? 0.6 : 0));
};
const END = at(50, 1) - 1;

const shots: Shot[] = [
  { name: 'sky', plate: 'sky-aurora', from: at(5), to: at(6, 2), tau: 3, grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 }, cam: [{ f: at(5), z: 1.08 }, { f: at(8), z: 1.0, ease: 'soft' }] },
  {
    name: 'window', plate: 'hero', from: at(6, 2), to: at(9),
    grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 },
    window: {
      backdrop: 'sky-aurora', backdropTau: 6,
      backdropCam: [{ f: at(5), z: 1.08 }, { f: at(8), z: 1.0, ease: 'soft' }],
      keys: [
        { f: at(6, 2), s: 0.5, rx: 24, ry: -18, rz: 3.5, y: 0.8, r: 70 },
        { f: at(7), s: 0.57, rx: 13, ry: -11, rz: 1.8, y: 0.03, r: 62, ease: 'soft' },
        { f: at(8), s: 1, rx: 0, ry: 0, rz: 0, y: 0, r: 0, ease: 'accel' },
      ],
    },
    cam: [{ f: at(7), z: 1.0 }, { f: at(8), z: 1.04, ease: 'in' }, { f: at(8, 1), z: 1.0, ease: 'punch' }, { f: at(9), z: 1.05, ease: 'glide' }],
  },
  { name: 'math', plate: 'search', from: at(9), to: at(10), tau: 1.5,
    cam: [{ f: at(9), z: 1.0 }, { f: at(9, 3) - 1, z: 1.0 }, { f: at(10) - 2, z: 1.2, x: 0.5, y: 0.55, ease: 'punch' }] },
  { name: 'dashboard', plate: 'dash-in', from: at(10), to: at(11), enter: { type: 'zoom', frames: 18 },
    cam: [{ f: at(10), z: 1.05 }, { f: at(10, 2), z: 1.0, ease: 'punch' }] },
  { name: 'task', plate: 'task', from: at(11), to: at(12), tau: 1.5,
    cam: [{ f: at(11), z: 1.45, x: 0.3, y: 0.7 }, { f: at(11, 3) - 1, z: 1.47, ease: 'linear' }, { f: at(11, 3) + 8, z: 1.7, x: 0.26, y: 0.74, ease: 'punch' }] },
  { name: 'focus', plate: 'focus', from: at(12), to: at(13), tau: 5, enter: { type: 'zoom', frames: 18 },
    cam: [{ f: at(12), z: 1.06 }, { f: at(13), z: 1.0, ease: 'soft' }] },
  { name: 'halo', plate: 'sky-halo', from: at(13), to: at(13, 1), rate: 2 },
  { name: 'nacre', plate: 'sky-nacre', from: at(13, 1), to: at(13, 2), rate: 2.4 },
  { name: 'baikal', plate: 'sky-baikal', from: at(13, 2), to: at(13, 3), rate: 2.8 },
  { name: 'drift', plate: 'sky-drift', from: at(13, 3), to: at(14), rate: 3.2 },
  {
    name: 'themes', plate: 'theme-aurora-void', from: at(14), to: at(15),
    grid: {
      plates: ['theme-aurora-void', 'theme-nord-frost', 'theme-catppuccin-mocha', 'theme-dracula-velvet', 'oled', 'theme-tokyo-night', 'theme-gruvbox-dark', 'theme-porcelain-light', 'theme-sakura-daylight'],
      cols: 3, rows: 3,
      appear: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => at(14) - 12 + [3, 2, 4, 1, 0, 5, 7, 6, 8][i] * 4),
      into: 4, zoomFrom: at(14, 2), zoomTo: at(15),
    },
  },
  { name: 'profiles', plate: 'profiles', from: at(15), to: at(48), tau: 2.0,
    cam: [{ f: at(15), z: 1.3, x: 0.5, y: 0.34 }, { f: at(15, 2), z: 1.0, y: 0.5, ease: 'inOut' }, { f: at(48), z: 1.25, ease: 'accel' }] },
  { name: 'end', plate: 'sky-end', from: at(48), to: END, enter: { type: 'zoom', frames: 16 }, grade: { brightness: 1.22, contrast: 1.04, saturate: 1.12 },
    cam: [{ f: at(48), z: 1.0 }, { f: END, z: 1.04, ease: 'linear' }] },
];

const captions: Caption[] = [
  { text: 'Your favourite sites, in folders', eyebrow: 'Nordlys', from: at(8, 1), to: at(9) - 2 },
  { text: 'Math right in the search box', eyebrow: 'Search', from: at(9, 0.5), to: at(10) - 2, where: 'tl' },
  { text: 'A dashboard for your day', eyebrow: 'Dashboard', from: at(10, 1), to: at(11) - 2 },
  { text: 'Type tasks the way you say them', eyebrow: 'Tasks', from: at(11, 0.5), to: at(12) - 2 },
  { text: 'One thing at a time', eyebrow: 'Focus mode', from: at(12, 0.5), to: at(13) - 2, where: 'tl' },
  { text: 'Nine skies, drawn live', eyebrow: 'Looks', from: at(13, 0.5), to: at(14) - 2 },
  { text: '21 colour themes', eyebrow: 'Looks', from: at(14, 1), to: at(15) - 2 },
  { text: 'Profiles for work and home', eyebrow: 'Profiles', from: at(15, 0.5), to: at(48) - 2 },
];

const cards: Card[] = [
  { kind: 'title', from: at(5), to: at(6, 3) },
  { kind: 'end', from: at(48), to: END, tags: [at(48, 2), at(48, 3), at(49)] },
];

const accents: Accent[] = [
  { kind: 'flash', f: at(8), strength: 0.45 },
  { kind: 'leak', f: at(8) - 10, frames: 70, seed: 3, hue: 232 },
  { kind: 'flash', f: at(10), strength: 0.3 },
  { kind: 'flash', f: at(14), strength: 0.35 },
  { kind: 'flash', f: at(48), strength: 0.5 },
  { kind: 'leak', f: at(48) - 6, frames: 90, seed: 7, hue: 240 },
];

export const store: Cut = { name: 'store', frames: END, audio: 'music/store.wav', shots, captions, cards, accents };
