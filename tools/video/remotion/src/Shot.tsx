/* A shot: one plate under the camera, arriving and leaving as the edit
   says. Motion blur comes from the motion itself: the pose is asked for half
   a frame before and after, and whatever moves fast (a whip, a punch-in, a
   fly-through) is smeared along its path by the effects on the <Video>
   (directional blur for pans, zoom blur for zooms), as a 180-degree shutter
   would. Blur is measured in the plate's own pixels, so a 5K plate and a
   draft one blur alike. */
import { Video } from '@remotion/media';
import { blur } from '@remotion/effects/blur';
import { radialProgressiveBlur } from '@remotion/effects/radial-progressive-blur';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { camAt, clamp01, EASE, transitionAt, windowAt } from './camera';
import type { Shot } from './edit/types';
import { FPS, H, W } from './music';
import { usePlate, usePlateSrc } from './plates';

export type ScreenPose = { x: number; y: number; z: number; tx: number; ty: number; opacity: number; mask?: string };

export const screenPose = (shot: Shot, next: Shot | undefined, f: number): ScreenPose => {
  const cam = camAt(shot.cam, f);
  const m = transitionAt(shot, next, f);
  return { x: cam.x, y: cam.y, z: cam.z * m.zMul, tx: m.tx, ty: m.ty, opacity: m.opacity, mask: m.mask };
};

// Where a point of the plate (0..1) is on screen, for a pose.
export const toScreen = (p: ScreenPose, u: number, v: number) => ({
  x: W / 2 - p.x * W * p.z + p.tx + u * W * p.z,
  y: H / 2 - p.y * H * p.z + p.ty + v * H * p.z,
});

const SHUTTER = 0.5; // half a frame of exposure

type Hint = { kind: 'x' | 'y' | 'zoom'; px: number; at?: [number, number] };

type PlateLayerProps = {
  plate: string;
  trimBefore: number;
  rate: number;
  pose: ScreenPose;
  before: ScreenPose;
  after: ScreenPose;
  extraZoomRate?: number;
  pull?: { x: number; y: number; w: number; h: number; blur: number };
  hint?: Hint;
};

// The plate itself, placed by a pose, with the blur its motion calls for.
export const PlateLayer: React.FC<PlateLayerProps> = ({ plate, trimBefore, rate, pose, before, after, extraZoomRate = 0, pull, hint }) => {
  const meta = usePlate(plate);
  const src = usePlateSrc(plate);
  const k = meta.width / (W * pose.z); // plate pixels per screen pixel
  const vx = after.tx - before.tx - (after.x - before.x) * W * pose.z;
  const vy = after.ty - before.ty - (after.y - before.y) * H * pose.z;
  const vz = Math.log(after.z / before.z) + extraZoomRate;
  const effects = [];
  if (pull && pull.blur > 0.5) {
    effects.push(radialProgressiveBlur({ center: [pull.x, pull.y], width: pull.w * 1.6, height: pull.h * 1.6, start: 0.62, startBlur: 0, endBlur: pull.blur * (meta.width / W) }));
  }
  if (hint && hint.px > 0.5) {
    if (hint.kind === 'zoom') effects.push(zoomBlur({ amount: Math.min(160, hint.px * k), center: hint.at ?? [0.5, 0.5], samples: 32 }));
    else effects.push(blur({ radius: Math.min(220, hint.px * k), horizontal: hint.kind === 'x', vertical: hint.kind === 'y' }));
  }
  if (Math.abs(vx) > 2) effects.push(blur({ radius: Math.min(220, Math.abs(vx) * SHUTTER * 0.5 * k), horizontal: true, vertical: false }));
  if (Math.abs(vy) > 2) effects.push(blur({ radius: Math.min(220, Math.abs(vy) * SHUTTER * 0.5 * k), horizontal: false, vertical: true }));
  // A zoom moves the frame's edge by (W/2) * rate; smear it over the shutter.
  if (Math.abs(vz) > 0.002) effects.push(zoomBlur({ amount: Math.min(160, Math.abs(vz) * (W / 2) * SHUTTER * k), center: [pose.x, pose.y], samples: 32 }));
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: '0 0',
          transform: `translate(${W / 2 - pose.x * W * pose.z + pose.tx}px, ${H / 2 - pose.y * H * pose.z + pose.ty}px) scale(${pose.z})`,
        }}
      >
        <Video src={src} trimBefore={Math.max(0, Math.round(trimBefore))} playbackRate={rate} muted objectFit="fill" style={{ width: W, height: H }} effects={effects} />
      </div>
    </AbsoluteFill>
  );
};

const pullAt = (shot: Shot, f: number) => {
  const p = shot.pull;
  if (!p) return undefined;
  const ramp = 36;
  const amount = interpolate(f, [p.from, p.from + ramp, p.to - ramp, p.to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.inOut });
  return { x: p.x, y: p.y, w: p.w, h: p.h, blur: p.blur * amount };
};

const hintAt = (shot: Shot, f: number): Hint | undefined => {
  const h = shot.hint;
  if (!h || f < h.from || f > h.to) return undefined;
  const p = (f - h.from) / Math.max(1, h.to - h.from);
  const w = h.shape === 'ramp' ? p * p : Math.sin(Math.PI * p) ** 2;
  return { kind: h.kind, px: h.px * w, at: h.at };
};

type ShotViewProps = { shot: Shot; next?: Shot; seqFrom: number };

export const ShotView: React.FC<ShotViewProps> = ({ shot, next, seqFrom }) => {
  const f = seqFrom + useCurrentFrame();
  const rate = shot.rate ?? 1;
  // The plate frame at the start of this sequence: tau at `from`, run back to where the sequence starts.
  const trimBefore = (shot.tau ?? 1) * FPS - (shot.from - seqFrom) * rate;
  const pose = screenPose(shot, next, f);
  const before = screenPose(shot, next, f - 0.5);
  const after = screenPose(shot, next, f + 0.5);

  if (shot.grid) return <GridView shot={shot} f={f} seqFrom={seqFrom} pose={pose} />;

  const layer = <PlateLayer plate={shot.plate} trimBefore={trimBefore} rate={rate} pose={pose} before={before} after={after} pull={pullAt(shot, f)} hint={hintAt(shot, f)} />;
  const g = shot.grade;
  const grade = g ? `brightness(${g.brightness ?? 1}) contrast(${g.contrast ?? 1}) saturate(${g.saturate ?? 1})` : undefined;
  const outer: React.CSSProperties = { opacity: pose.opacity, WebkitMaskImage: pose.mask, maskImage: pose.mask, filter: grade };

  if (shot.window) {
    const w = windowAt(shot.window.keys, f);
    const w0 = windowAt(shot.window.keys, f - 0.5), w1 = windowAt(shot.window.keys, f + 0.5);
    const full = w.s >= 0.999 && Math.abs(w.rx) + Math.abs(w.ry) + Math.abs(w.rz) < 0.01 && w.r < 0.5;
    const bd = shot.window.backdrop;
    const bdPose = { ...camAt(shot.window.backdropCam, f), tx: 0, ty: 0, opacity: 1 };
    const bdBefore = { ...camAt(shot.window.backdropCam, f - 0.5), tx: 0, ty: 0, opacity: 1 };
    const bdAfter = { ...camAt(shot.window.backdropCam, f + 0.5), tx: 0, ty: 0, opacity: 1 };
    const edge = clamp01((1 - w.s) / 0.04);
    // The grade is the sky's (the backdrop), not the page's in the window.
    return (
      <AbsoluteFill style={{ ...outer, filter: undefined }}>
        {!full && <AbsoluteFill style={{ filter: grade }}><PlateLayer plate={bd} trimBefore={(shot.window.backdropTau ?? shot.tau ?? 1) * FPS - (shot.from - seqFrom) * rate} rate={rate} pose={bdPose} before={bdBefore} after={bdAfter} /></AbsoluteFill>}
        <AbsoluteFill style={{ perspective: 3600 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: W,
              height: H,
              transformOrigin: '50% 50%',
              transform: `translateY(${w.y * H}px) rotateX(${w.rx}deg) rotateY(${w.ry}deg) rotateZ(${w.rz}deg) scale(${w.s})`,
              borderRadius: w.r / w.s,
              overflow: 'hidden',
              boxShadow: edge > 0 ? `0 ${60 / w.s}px ${160 / w.s}px rgba(0,0,0,${0.55 * edge}), 0 0 0 ${3 / w.s}px rgba(214,226,255,${0.16 * edge})` : undefined,
            }}
          >
            <PlateLayer plate={shot.plate} trimBefore={trimBefore} rate={rate} pose={pose} before={before} after={after} extraZoomRate={Math.log(w1.s / w0.s)} />
            {edge > 0 && (
              <AbsoluteFill style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 38%)', opacity: edge }} />
            )}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={outer}>{layer}</AbsoluteFill>;
};

/* A grid of plates, each coming in on its beat, then the camera flies into
   one of them until it fills the frame (the next shot takes it from there). */
const GridView: React.FC<{ shot: Shot; f: number; seqFrom: number; pose: ScreenPose }> = ({ shot, f, seqFrom, pose }) => {
  const g = shot.grid!;
  const gap = 28, margin = 64;
  const tw = (W - 2 * margin - gap * (g.cols - 1)) / g.cols;
  const th = (H - 2 * margin - gap * (g.rows - 1)) / g.rows;
  const cell = (i: number) => ({ x: margin + (i % g.cols) * (tw + gap), y: margin + Math.floor(i / g.cols) * (th + gap) });
  const target = cell(g.into);
  const zease = EASE.inOut;
  const zp = zease(clamp01((f - g.zoomFrom) / (g.zoomTo - g.zoomFrom)));
  const zp0 = zease(clamp01((f - 0.5 - g.zoomFrom) / (g.zoomTo - g.zoomFrom)));
  const zp1 = zease(clamp01((f + 0.5 - g.zoomFrom) / (g.zoomTo - g.zoomFrom)));
  // The whole grid scaled and moved so the target tile grows to the frame.
  const gs = (p: number) => Math.exp(Math.log(W / tw) * p);
  const s = gs(zp);
  const ox = -target.x * s * zp + 0 * (1 - zp), oy = -target.y * s * zp;
  const trim = (shot.tau ?? 1) * FPS - (shot.from - seqFrom);
  const still = { x: 0.5, y: 0.5, z: 1, tx: 0, ty: 0, opacity: 1 };
  return (
    <AbsoluteFill style={{ backgroundColor: '#03050a', opacity: pose.opacity }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${ox}px, ${oy}px) scale(${s})` }}>
        {g.plates.map((plate, i) => {
          const c = cell(i);
          const t = interpolate(f, [g.appear[i], g.appear[i] + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });
          // The other tiles fly out of the frame with the grid; they fade only at the very end.
          const others = i === g.into ? 1 : 1 - clamp01((zp - 0.7) / 0.3);
          return (
            <div
              key={plate}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                width: tw,
                height: th,
                borderRadius: 26 * (1 - zp),
                overflow: 'hidden',
                opacity: t * others,
                transform: `scale(${0.9 + 0.1 * t})`,
                filter: t < 1 ? `blur(${(1 - t) * 18}px)` : undefined,
                boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ width: W, height: H, transform: `scale(${tw / W})`, transformOrigin: '0 0' }}>
                <PlateLayer plate={plate} trimBefore={trim} rate={1} pose={still} before={still} after={still} extraZoomRate={i === g.into ? Math.log(gs(zp1) / gs(zp0)) : 0} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
