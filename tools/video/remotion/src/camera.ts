/* The camera and the moves between shots, as plain functions of the frame,
   so that a pose can also be asked for half a frame before and after: the
   difference is how fast things move, and so how much motion blur they get. */
import { Easing } from 'remotion';
import { H, W } from './music';
import type { Ease, Key, Shot, Transition, WindowKey } from './edit/types';

export const EASE: Record<Ease, (t: number) => number> = {
  linear: Easing.linear,
  in: Easing.bezier(0.55, 0, 1, 0.45),
  out: Easing.bezier(0, 0.55, 0.45, 1),
  inOut: Easing.bezier(0.45, 0, 0.2, 1),
  // A punch-in: nearly all of the move in the first frames, then a long settle.
  punch: Easing.bezier(0.16, 1, 0.3, 1),
  soft: Easing.bezier(0.33, 0, 0.2, 1),
  glide: Easing.bezier(0.25, 0.1, 0.25, 1),
  // Speeding up all the way into the end: for moves that land on a hit.
  accel: Easing.bezier(0.7, 0, 0.92, 0.45),
  settle: Easing.spring({ damping: 200 }),
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export type Pose = { x: number; y: number; z: number };

// Keep the frame inside the plate once it is at least full size.
const inside = ({ x, y, z }: Pose): Pose => {
  if (z < 1) return { x, y, z };
  const h = 0.5 / z;
  return { x: Math.min(1 - h, Math.max(h, x)), y: Math.min(1 - h, Math.max(h, y)), z };
};

export const camAt = (keys: Key[] | undefined, f: number): Pose => {
  const ks = keys && keys.length ? keys : [{ f: 0 }];
  let prev = { f: ks[0].f, x: ks[0].x ?? 0.5, y: ks[0].y ?? 0.5, z: ks[0].z ?? 1 };
  if (f <= prev.f) return inside(prev);
  for (let i = 1; i < ks.length; i++) {
    const k = ks[i];
    const next = { f: k.f, x: k.x ?? prev.x, y: k.y ?? prev.y, z: k.z ?? prev.z };
    if (f <= next.f) {
      const p = EASE[k.ease ?? 'inOut'](clamp01((f - prev.f) / Math.max(1e-6, next.f - prev.f)));
      // Zoom in log space: the same speed whatever the zoom.
      const z = Math.exp(Math.log(prev.z) + (Math.log(next.z) - Math.log(prev.z)) * p);
      return inside({ x: prev.x + (next.x - prev.x) * p, y: prev.y + (next.y - prev.y) * p, z });
    }
    prev = next;
  }
  return inside(prev);
};

export const windowAt = (keys: WindowKey[], f: number): WindowKey => {
  let prev = keys[0];
  if (f <= prev.f) return prev;
  for (let i = 1; i < keys.length; i++) {
    const next = keys[i];
    if (f <= next.f) {
      const p = EASE[next.ease ?? 'inOut'](clamp01((f - prev.f) / Math.max(1e-6, next.f - prev.f)));
      const mix = (a: number, b: number) => a + (b - a) * p;
      return { f, s: Math.exp(mix(Math.log(prev.s), Math.log(next.s))), rx: mix(prev.rx, next.rx), ry: mix(prev.ry, next.ry), rz: mix(prev.rz, next.rz), y: mix(prev.y, next.y), r: mix(prev.r, next.r) };
    }
    prev = next;
  }
  return prev;
};

/* What a transition does to a shot at frame f: arriving (enter, the cut at
   shot.from) or leaving (exit, the next shot's enter, the cut at shot.to). */
export type Move = { tx: number; ty: number; zMul: number; opacity: number; mask?: string };
const still: Move = { tx: 0, ty: 0, zMul: 1, opacity: 1 };

export const DEFAULT_FRAMES: Record<string, number> = { cut: 0, whip: 14, whipUp: 14, zoom: 18, iris: 24, wipe: 20, fade: 20 };
export const transitionFrames = (t?: Transition) => (t ? t.frames ?? DEFAULT_FRAMES[t.type] ?? 0 : 0);
// Kinds where the shot going out stays on screen while the next one comes in.
export const overlaps = (t?: Transition) => Boolean(t && t.type !== 'cut' && transitionFrames(t) > 0);

// A whip: speeding up to the middle and slowing down after, like a fast pan.
const WHIP = Easing.bezier(0.65, 0, 0.35, 1);

const moveOf = (t: Transition, p: number, side: 'in' | 'out'): Move => {
  switch (t.type) {
    case 'whip': {
      const e = WHIP(clamp01(p));
      return side === 'out' ? { ...still, tx: -W * e } : { ...still, tx: W * (1 - e) };
    }
    case 'whipUp': {
      const e = WHIP(clamp01(p));
      return side === 'out' ? { ...still, ty: -H * e } : { ...still, ty: H * (1 - e) };
    }
    /* A zoom cut: the old shot flies in and the new one out of the same
       point; they swap in the two frames of fastest motion, where the zoom
       blur leaves nothing readable, so no text is ever seen through other text. */
    case 'zoom':
      return side === 'out'
        ? { ...still, zMul: 1 + 2.4 * EASE.in(clamp01(p)), opacity: 1 - smooth(0.47, 0.55, p) }
        : { ...still, zMul: 1.9 - 0.9 * EASE.out(clamp01(p)), opacity: smooth(0.45, 0.53, p) };
    case 'iris': {
      if (side === 'out') return still;
      const [ax, ay] = t.at ?? [0.5, 0.5];
      const far = Math.hypot(Math.max(ax, 1 - ax) * W, Math.max(ay, 1 - ay) * H);
      const r = far * EASE.inOut(clamp01(p)) * 1.08;
      return { ...still, mask: `radial-gradient(circle at ${ax * W}px ${ay * H}px, #000 ${Math.max(0, r - 90)}px, transparent ${r}px)` };
    }
    case 'wipe': {
      if (side === 'out') return still;
      const x = -0.1 + 1.2 * EASE.inOut(clamp01(p));
      return { ...still, mask: `linear-gradient(90deg, #000 ${(x - 0.05) * 100}%, transparent ${x * 100}%)` };
    }
    case 'fade':
      return side === 'out' ? still : { ...still, opacity: EASE.inOut(clamp01(p)) };
    default:
      return still;
  }
};

export const transitionAt = (shot: Shot, next: Shot | undefined, f: number): Move => {
  let m = { ...still };
  const add = (a: Move) => { m = { tx: m.tx + a.tx, ty: m.ty + a.ty, zMul: m.zMul * a.zMul, opacity: m.opacity * a.opacity, mask: a.mask ?? m.mask }; };
  if (overlaps(shot.enter)) {
    const d = transitionFrames(shot.enter);
    const p = (f - (shot.from - d / 2)) / d;
    if (p < 1) add(moveOf(shot.enter!, p, 'in'));
  }
  if (next && overlaps(next.enter)) {
    const d = transitionFrames(next.enter);
    const p = (f - (shot.to - d / 2)) / d;
    if (p > 0) add(moveOf(next.enter!, p, 'out'));
  }
  return m;
};
