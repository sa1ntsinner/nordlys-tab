/* Accents on the hits: a soft flash, a light leak on the drops, and a ring
   around the control being used, placed where the shot's camera puts it. */
import { lightLeak } from '@remotion/effects/light-leak';
import React from 'react';
import { AbsoluteFill, Easing, interpolate, Solid, useCurrentFrame } from 'remotion';
import type { Accent, Shot } from './edit/types';
import { H, W } from './music';
import type { Plates } from './plates';
import { screenPose, toScreen } from './Shot';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const FlashView: React.FC<{ f0: number; strength?: number }> = ({ f0, strength = 0.5 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [f0, f0 + 2, f0 + 22], [0, strength, 0], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ opacity: o, mixBlendMode: 'screen', background: 'radial-gradient(75% 65% at 50% 46%, rgba(255,255,255,0.9), rgba(255,255,255,0) 72%)' }} />;
};

export const LeakView: React.FC<{ f0: number; frames: number; seed?: number; hue?: number }> = ({ f0, frames, seed = 2, hue = 170 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [f0, f0 + frames], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  return (
    // From one corner, not over everything: a leak is light getting in at the edge.
    <AbsoluteFill style={{ mixBlendMode: 'screen', opacity: 0.3, maskImage: 'radial-gradient(circle at 10% 12%, #000 0%, rgba(0,0,0,0.5) 32%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle at 10% 12%, #000 0%, rgba(0,0,0,0.5) 32%, transparent 68%)' }}>
      <Solid width={W} height={H} color="black" effects={[lightLeak({ seed, hueShift: hue, progress: p })]} />
    </AbsoluteFill>
  );
};

export const RingView: React.FC<{ a: Extract<Accent, { kind: 'ring' }>; shot: Shot; next?: Shot; plates: Plates }> = ({ a, shot, next, plates }) => {
  const f = useCurrentFrame();
  if (f < a.f || f > a.f + a.frames) return null;
  const meta = plates[shot.plate];
  if (!meta) return null;
  const named = typeof a.rect === 'string' ? meta.rects[a.rect] : null;
  const r = named ?? (Array.isArray(a.rect) ? { x: a.rect[0] * meta.width, y: a.rect[1] * meta.height, w: a.rect[2] * meta.width, h: a.rect[3] * meta.height } : null);
  if (!r) return null;
  const pose = screenPose(shot, next, f);
  const pad = a.pad ?? 22;
  const p0 = toScreen(pose, r.x / meta.width, r.y / meta.height);
  const p1 = toScreen(pose, (r.x + r.w) / meta.width, (r.y + r.h) / meta.height);
  const i = interpolate(f, [a.f, a.f + 12], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const o = interpolate(f, [a.f + a.frames - 14, a.f + a.frames], [0, 1], { ...clamp, easing: Easing.bezier(0.55, 0, 1, 0.45) });
  const s = 1.14 - 0.14 * i;
  const x = p0.x - pad, y = p0.y - pad, w = p1.x - p0.x + 2 * pad, h = p1.y - p0.y + 2 * pad;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x + (w * (1 - s)) / 2,
          top: y + (h * (1 - s)) / 2,
          width: w * s,
          height: h * s,
          borderRadius: Math.min(h * s, 64),
          opacity: i * (1 - o),
          boxShadow: '0 0 0 5px rgba(236,244,255,0.92), 0 0 60px 8px rgba(160,210,255,0.35), inset 0 0 40px rgba(160,210,255,0.18)',
        }}
      />
    </AbsoluteFill>
  );
};

// The very end: down to black over the last frames.
export const FadeOut: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: 'black', opacity: o }} />;
};
