/* The music's time. "Ramp It Up" (Ahjay Stelino, Mixkit) runs at exactly
   120 bpm: a beat is half a second, 30 frames at 60 fps, and a bar is 120
   frames. The map (docs/video/music/ramp-it-up.json, tools/video/music-events.py)
   holds the grid and every event found in the track; the cues below are the
   ones the edit is cut to, each checked on the spectrogram
   (tools/video/music-plot.py), in the track's own bars (bar 0 is its first
   downbeat, 0.112 s in). */
import map from '../../../../docs/video/music/ramp-it-up.json';

export const FPS = 60;
export const W = 3840;
export const H = 2160;
export const BEAT = map.beat;
export const BAR = map.bar;
export const BEAT_FRAMES = BEAT * FPS;
export const BAR_FRAMES = BAR * FPS;
export const musicMap = map;

/* What happens in the track, bar by bar (bar.beat, beats 0 to 3). Claps are
   on beats 1 and 3 of every bar of the drops, kicks on all four. */
export const CUES = {
  padIntro: 0,          // a held chord, no beat, to bar 7
  build: 7,             // hats and a noise riser for one bar, into
  drop1: 8,             // kick and bass: the first drop
  riser1: 10.3125,      // a pitch sweep up (bar 10 beat 1.25) ...
  riser1Lands: 11,      // ... landing on bar 11
  slowRise: 14,         // a tone rising for two bars, into
  bassOut: 15,          // a bar without the bass
  drop1b: 16,           // the bass back, a new part of the drop
  downlifter: 23.0625,  // noise falling away, into
  breakdown: 24,        // the break: drums out, a pulsing pad, a new bass note every two bars
  breakChords: [26, 28, 30],
  drop2: 32,            // everything back, with a sweep
  riser2: 34.25,        // a pitch sweep up, landing on
  riser2Lands: 35,
  noiseBuild: 39.75,    // a noise build into
  part2b: 40,
  finalWhoosh: 47.25,   // a swell into
  finalHit: 48,         // the last hit; the chord rings out to about bar 50.5
} as const;
