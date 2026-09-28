/* The YouTube film: 94 s, from bar 3 of "Ramp It Up" to the end of its last
   chord. Every time here is a place in the music: at(bar, beat) in the
   track's own bars (src/music.ts, CUES), so the edit reads against the
   music map; the film's frame 0 is bar 3.

     bars  3-7    the held chord      the sky, the name, the page rising in as a window
     bar   7      the build           the window grows to fill the frame on the drop
     bars  8-15   the first drop      the folders; a sum and a site found in the search box
     bars 14-23   the rise, the drop  the dashboard: a task typed as you say it, a card moved and stretched,
                                      the layout changed to the planner, and into its focus timer
     bars 24-31   the breakdown       focus mode, calm, the whole break
     bars 32-39   the second drop     the looks, once: the themes, then Home's own sites and look; connected apps
     bars 40-47   the drop, part two  tasks and events from those apps; the whole page
     bar  48      the last hit        the name, and where to get it

   Few words, few moves: a line only where the picture cannot say it, and a
   camera that moves only to go where the action is, then holds. Every move
   is one eased curve (src/camera.ts), zooming about its subject. */
import type { Accent, Caption, Card, Cut, Key, Shot } from './types';

const START = 3; // the bar the film begins on
// Frame of the film at bar b, beat k of the track (a beat is 30 frames, a bar 120).
const at = (b: number, k = 0) => Math.round(((b - START) * 4 + k) * 30);
const END = at(50);

/* The pose that zooms from `a` to z about the plate point p, which stays where
   it is on screen (the camera zooms about the one point two poses share). */
const about = (a: { x?: number; y?: number; z?: number }, p: [number, number], z: number) => {
  const ax = a.x ?? 0.5, ay = a.y ?? 0.5, az = a.z ?? 1;
  return { x: p[0] - ((p[0] - ax) * az) / z, y: p[1] - ((p[1] - ay) * az) / z, z };
};

const SKY = { brightness: 1.22, contrast: 1.04, saturate: 1.12 }; // the sky at night is dark

// Profiles: close on the chip and its menu, then out to the whole page as Home's look settles.
const CHIP = { x: 0.5, y: 0.37, z: 1.35 };
const HOME = at(33, 3); // Home clicked, on the clap
const profilesCam: Key[] = [{ f: at(33), ...CHIP }, { f: at(34), ...CHIP }, { f: at(35), x: 0.5, y: 0.5, z: 1.0, ease: 'inOut' }];

/* Where the flight into the planner's focus timer ends: its "25:00" (the plate's
   rect 'face', at 0.745, 0.619, 0.040 of the frame wide) at the size and place
   focus mode's own "25:00" (0.174 wide, a little above the middle) has as the zoom
   cut swaps them: z 3.2 here, times the cut's own zoom (about 1.48 at the swap),
   against about 1.1 on the other side. */
const FACE = { x: 0.745, y: 0.632, z: 3.2 };

// The inbox and the calendar, side by side in one plate (the inbox plate's rects).
const INBOX = { x: 0.357, y: 0.61, z: 1.4 };
// The calendar closer and in the middle of the frame, its events in the upper half.
const AGENDA = { x: 0.706, y: 0.55, z: 1.7 };

const shots: Shot[] = [
  // ── The name, over the sky (the held chord): the page's own slow drift is the only move ──
  { name: 'sky', plate: 'sky-aurora', from: at(3), to: at(6), grade: SKY, cam: [{ f: at(3), z: 1.08 }] },
  /* The page rises in as a window over the same sky and comes to rest, then on
     the build grows to fill the frame, gathering speed and landing softly
     exactly on the drop. Then it holds on the folders. */
  {
    name: 'window', plate: 'hero', from: at(6), to: at(10), grade: SKY,
    window: {
      backdrop: 'sky-aurora', backdropTau: 7,
      // The sky sinks a touch as the window rises.
      backdropCam: [{ f: at(6), z: 1.08, y: 0.5 }, { f: at(8), z: 1.08, y: 0.47, ease: 'inOut' }],
      keys: [
        { f: at(6), s: 0.5, rx: 26, ry: -20, rz: 4, y: 0.78, r: 70 },
        { f: at(7), s: 0.58, rx: 12, ry: -10, rz: 1.6, y: 0.02, r: 60, ease: 'soft' },
        // At rest a tenth of a second before the hit, so the drop lands on a still, full frame.
        { f: at(8) - 6, s: 1, rx: 0, ry: 0, rz: 0, y: 0, r: 0, ease: 'land' },
      ],
    },
  },

  /* ── Search: a sum typed into the riser, its answer as the riser lands on bar
     11; then the box cleared and a site found by name. One slow push towards the
     box and the answer under it, then held. ── */
  { name: 'search', plate: 'search', from: at(10), to: at(14),
    cam: [{ f: at(10), z: 1.0 }, { f: at(11, 2), ...about({}, [0.5, 0.53], 1.08), ease: 'inOut' }] },

  // ── The dashboard comes in on the rising tone (its own entrance, from the plate's first frame) ──
  { name: 'dashboard', plate: 'dash-in', from: at(14), to: at(16), tau: 0 },
  /* A task typed the way you say it: close on the tasks card, a slow push
     through the typing that arrives on Enter (bar 17), then held on the new task. */
  { name: 'task', plate: 'task', from: at(16), to: at(19),
    cam: [{ f: at(16), x: 0.4, y: 0.6, z: 1.25 }, { f: at(17), ...about({ x: 0.4, y: 0.6, z: 1.25 }, [0.12, 0.8], 1.35), ease: 'inOut' }] },
  // A card dragged into the countdown's place, dropped on the clap; one stretched, let go on the clap.
  { name: 'drag', plate: 'drag', from: at(19), to: at(20, 2), cam: [{ f: at(19), z: 1.16, x: 0.62, y: 0.42 }] },
  { name: 'stretch', plate: 'stretch', from: at(20, 2), to: at(22) },
  /* The planner layout, held; on the downlifter the camera flies into the ring of
     its focus timer (1.75 s, gathering speed), which becomes focus mode's ring on
     bar 24. On the still plate, so the text does not crawl as it starts, and its
     motion blur is measured from the move. */
  { name: 'planner', plate: 'layout-planner', from: at(22), to: at(24),
    cam: [{ f: at(23, 0.5), z: 1.0 }, { f: at(24), ...FACE, ease: 'fly' }] },

  /* ── The breakdown: focus mode, the whole break. The intention typed under a
     focus pull, Go on the chord change (bar 26), Rain on the next bar; then one
     slow push to the timer, and a long hold with it running. ── */
  { name: 'focus', plate: 'focus', from: at(24), to: at(32), enter: { type: 'zoom', frames: 30 },
    cam: [{ f: at(27, 1), z: 1.0 }, { f: at(28, 2), ...about({}, [0.5, 0.44], 1.12), ease: 'inOut' }],
    pull: { from: at(24, 2), to: at(26), x: 0.5, y: 0.47, w: 0.5, h: 0.5, blur: 18 } },

  // ── The second drop: the looks, once. The same page in nine themes, bursting in on the hit ──
  {
    name: 'themes', plate: 'theme-aurora-void', from: at(32), to: at(33),
    grid: {
      plates: ['theme-aurora-void', 'theme-nord-frost', 'theme-catppuccin-mocha', 'theme-dracula-velvet', 'oled', 'theme-tokyo-night', 'theme-gruvbox-dark', 'theme-porcelain-light', 'theme-sakura-daylight'],
      cols: 3, rows: 3,
      // The middle one (black) first and already there on the hit.
      appear: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => at(32) - 14 + [3, 2, 4, 1, 0, 5, 7, 6, 8][i] * 5),
    },
  },
  /* Profiles: the chip, its menu, Home on the clap. The product changes the look
     with a view transition that arrives in one frame of the plate (14 frames
     after the click); instead, the plate filmed after the switch dissolves in
     before it. Then out to the whole page, landing on the riser (bar 35). */
  { name: 'profiles', plate: 'profiles', from: at(33), to: HOME + 7, cam: profilesCam },
  { name: 'home', plate: 'profiles-home', from: HOME + 7, to: at(37), enter: { type: 'fade', frames: 12 }, cam: profilesCam },

  // ── Connected apps; the tasks and events they bring, in the inbox and the calendar ──
  { name: 'apps', plate: 'apps', from: at(37), to: at(38) },
  { name: 'inbox', plate: 'inbox', from: at(38), to: at(44),
    // A task ticked on the clap (bar 38, beat 4), then one move across to the calendar, held there.
    cam: [{ f: at(38), ...INBOX }, { f: at(40, 2), ...INBOX }, { f: at(41, 1), ...AGENDA, ease: 'inOut' }] },

  // ── The whole page; then the page fades away into the sky on the final whoosh, the name on the hit ──
  { name: 'page', plate: 'hero-dash', from: at(44), to: at(47, 2.5) },
  // The dissolve runs from the whoosh (bar 47, beat 2) to the hit.
  { name: 'end', plate: 'sky-end', from: at(47, 2.5), to: END, enter: { type: 'fade', frames: 90 }, grade: SKY },
];

const captions: Caption[] = [
  // After Enter, so the new task can be read with it; over the empty top right of the frame.
  { text: 'Type tasks the way you say them', from: at(17), to: at(19) - 4, where: 'tr' },
  // The top corners are the empty ones (the sky); the sites and the cards are below.
  { text: 'Work and Home, each with its own sites', from: at(34, 1), to: at(36, 3), where: 'tl' },
  // Below the calendar's few events, where its card is empty.
  { text: 'Tasks and events from your apps and calendars', from: at(38, 1), to: at(40, 2), where: 'br' },
  { text: 'Nothing is tracked', from: at(44, 1), to: at(45, 3), where: 'tl' },
];

const cards: Card[] = [
  { kind: 'title', from: at(4), to: at(6, 1) },
  { kind: 'end', from: at(48), to: END, tags: [at(48, 2)] },
];

const accents: Accent[] = [
  { kind: 'flash', f: at(8), strength: 0.45 },
  { kind: 'leak', f: at(8) - 10, frames: 70, seed: 3, hue: 232 },
  { kind: 'flash', f: at(32), strength: 0.4 },
  { kind: 'leak', f: at(32) - 8, frames: 64, seed: 5, hue: 255 },
  { kind: 'flash', f: at(48), strength: 0.5 },
  { kind: 'leak', f: at(48) - 6, frames: 90, seed: 7, hue: 240 },
];

export const youtube: Cut = { name: 'youtube', frames: END, audio: 'music/youtube.wav', shots, captions, cards, accents };
