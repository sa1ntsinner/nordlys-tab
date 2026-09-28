/* The Mac App Store preview, 28 s: a cut of the YouTube film, not a film of
   its own. Its music is one stretch of the track, bars 4 to 15.25, then the
   film's own ending from the final whoosh (bar 47.25) through the last hit (the
   one join, on a beat of the rising tone of bar 15, which leads into the
   whoosh). Over it, five moments of the film, each with its own shots, camera,
   words and accents, taken whole from src/edit/youtube.ts and cut end to end,
   so the preview follows the film:

     music  4-9      film  4-9      the name, the window, the drop on the folders, held
     music  9-11     film 16.5-18.5 a task typed the way you say it, and its line
     music 11-13     film 26-28     focus mode: Go, Rain, the timer running
     music 13-15.25  film 33.5-35.75 profiles: Home, with its own sites and look, and its line
     music 47.25-50  film 47.25-50  the page fading into the sky on the whoosh, the name on the hit

   Bars are the track's, as in youtube.ts. Each moment starts on the same place
   in the bar as in the film, or two beats off, so what lands on a beat there
   lands on a beat here. Apple asks for straight cuts and dissolves only: the
   moments join with cuts. */
import type { Accent, Caption, Card, Cut, Key, Shot, WindowKey } from './types';
import { youtube } from './youtube';

const BAR = 120; // frames at 60 fps
const film = (b: number) => Math.round((b - 3) * BAR); // youtube.ts starts on bar 3
export const MUSIC: [number, number][] = [[4, 15.25], [47.25, 50]];
// Frame of the preview at bar b of its soundtrack.
const music = (b: number) => {
  let f = 0;
  for (const [a, z] of MUSIC) {
    if (b <= z) return f + Math.round((b - a) * BAR);
    f += (z - a) * BAR;
  }
  return f;
};
const MOMENTS: { film: [number, number]; at: number }[] = [
  { film: [4, 9], at: 4 },
  { film: [16.5, 18.5], at: 9 },
  { film: [26, 28], at: 11 },
  { film: [33.5, 35.75], at: 13 },
  { film: [47.25, 50], at: 47.25 },
];

const keys = <K extends Key | WindowKey>(ks: K[] | undefined, d: number) => ks?.map((k) => ({ ...k, f: k.f + d }));

function excerpt(cut: Cut): Cut {
  const shots: Shot[] = [], captions: Caption[] = [], cards: Card[] = [], accents: Accent[] = [];
  for (const { film: [fa, fb], at } of MOMENTS) {
    const A = film(fa), B = film(fb), d = music(at) - A;
    for (const s of cut.shots) {
      if (s.to <= A || s.from >= B) continue;
      const from = Math.max(s.from, A);
      const later = ((from - s.from) * (s.rate ?? 1)) / 60; // plate seconds cut off the head
      shots.push({
        ...s,
        from: from + d,
        to: Math.min(s.to, B) + d,
        tau: (s.tau ?? 1) + later,
        // A moment opens on a cut; a transition inside it stays.
        enter: s.from > A ? s.enter : undefined,
        cam: keys(s.cam, d),
        window: s.window && { ...s.window, keys: keys(s.window.keys, d)!, backdropTau: (s.window.backdropTau ?? s.tau ?? 1) + later, backdropCam: keys(s.window.backdropCam, d) },
        grid: s.grid && { ...s.grid, appear: s.grid.appear.map((f) => f + d), zoomFrom: s.grid.zoomFrom != null ? s.grid.zoomFrom + d : undefined, zoomTo: s.grid.zoomTo != null ? s.grid.zoomTo + d : undefined },
        pull: s.pull && { ...s.pull, from: s.pull.from + d, to: s.pull.to + d },
        veil: s.veil && { ...s.veil, from: s.veil.from + d, to: s.veil.to + d },
        hint: s.hint && { ...s.hint, from: s.hint.from + d, to: s.hint.to + d },
      });
    }
    for (const c of cut.captions) if (c.to > A && c.from < B) captions.push({ ...c, from: Math.max(c.from, A) + d, to: Math.min(c.to, B) + d });
    for (const c of cut.cards) {
      if (c.to <= A || c.from >= B) continue;
      const span = { from: c.from + d, to: Math.min(c.to, B) + d };
      if (c.kind === 'title') cards.push({ ...c, ...span });
      // The Mac App Store is Safari's own, and App Review asks that no other platform be named there.
      else if (c.kind === 'end') cards.push({ ...c, ...span, tags: c.tags.map((f) => f + d), browsers: false });
      else cards.push({ ...c, ...span, beats: c.beats.map((f) => f + d) });
    }
    // An accent a few frames before a moment belongs to its first hit (a light leak starts early).
    for (const a of cut.accents) if (a.f >= A - 12 && a.f < B) accents.push({ ...a, f: a.f + d });
  }
  return { name: 'app-preview', frames: music(50), audio: 'music/app-preview.wav', shots, captions, cards, accents };
}

export const appPreview: Cut = excerpt(youtube);
