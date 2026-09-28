/* The words: captions, the title, a statement, the end card. Outfit for
   what is said, Instrument Sans for the small print, as on the website.
   Every word arrives on its own frame (rising, sharpening, fading in) and
   leaves together with the others, a little before the cut. A caption never
   sits on busy text alone: just behind its words the page is softly blurred
   and shaded, dark words and a light shade over a light theme. */
import { loadFont } from '@remotion/fonts';
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { Caption } from './edit/types';
import { H, W } from './music';

loadFont({ family: 'Outfit', url: staticFile('fonts/outfit.woff2'), weight: '100 900' });
loadFont({ family: 'Instrument Sans', url: staticFile('fonts/instrument-sans.woff2'), weight: '100 900' });

const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN = Easing.bezier(0.55, 0, 1, 0.45);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// A word (or any part) coming in at frame a and going out at frame b.
const arrive = (f: number, a: number, b: number, rise = 0.5) => {
  const i = interpolate(f, [a, a + 18], [0, 1], { ...clamp, easing: OUT });
  const o = interpolate(f, [b - 12, b], [0, 1], { ...clamp, easing: IN });
  return {
    opacity: i * (1 - o),
    translate: `0px ${((1 - i) * rise - o * 0.22) * 1}em`,
    filter: i < 1 || o > 0 ? `blur(${(1 - i) * 14 + o * 8}px)` : undefined,
  } as React.CSSProperties;
};

const SPOT: Record<string, React.CSSProperties> = {
  bl: { left: 220, bottom: 190 },
  tl: { left: 220, top: 170 },
  br: { right: 220, bottom: 190, textAlign: 'right' },
  tr: { right: 220, top: 170, textAlign: 'right' },
};

export const CaptionView: React.FC<{ c: Caption }> = ({ c }) => {
  const f = useCurrentFrame();
  if (f < c.from - 12 || f > c.to + 2) return null;
  const where = c.where ?? 'bl';
  const step = c.step ?? 4;
  const words = c.text.split(' ');
  const shade = interpolate(f, [c.from - 8, c.from + 14, c.to - 14, c.to], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const ink = c.light ? '#0e1219' : '#f5f7fb';
  const dim = c.light ? 'rgba(14,18,25,0.62)' : 'rgba(245,247,251,0.74)';
  const tone = c.light ? '248,249,252' : '2,4,9';
  const bottom = where[0] === 'b';
  const left = where[1] === 'l';
  const gx = left ? '14%' : '86%', gy = bottom ? '100%' : '0%';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          opacity: shade,
          background: `radial-gradient(60% 46% at ${gx} ${gy}, rgba(${tone},${c.light ? 0.72 : 0.55}), rgba(${tone},0) 74%), linear-gradient(${bottom ? 180 : 0}deg, rgba(${tone},0) 50%, rgba(${tone},${c.light ? 0.34 : 0.28}) 72%, rgba(${tone},${c.light ? 0.7 : 0.62}))`,
        }}
      />
      <div style={{ position: 'absolute', maxWidth: 2600, ...SPOT[where] }}>
        <div
          style={{
            position: 'absolute',
            inset: '-150px -300px -150px -240px',
            opacity: shade,
            backdropFilter: 'blur(64px) saturate(0.85) brightness(0.9)',
            WebkitBackdropFilter: 'blur(64px) saturate(0.85) brightness(0.9)',
            maskImage: 'radial-gradient(closest-side, #000 64%, transparent)',
            WebkitMaskImage: 'radial-gradient(closest-side, #000 64%, transparent)',
          }}
        />
        {c.eyebrow && (
          <div style={{ position: 'relative', font: '600 36px/1 "Instrument Sans"', letterSpacing: '0.24em', textTransform: 'uppercase', color: dim, marginBottom: 34, ...arrive(f, c.from - 2, c.to, 0.6) }}>
            {c.eyebrow}
          </div>
        )}
        <div style={{ position: 'relative', font: '500 136px/1.04 Outfit', letterSpacing: '-0.035em', color: ink, whiteSpace: 'nowrap', textShadow: c.light ? '0 2px 60px rgba(255,255,255,0.55)' : '0 4px 70px rgba(0,0,0,0.38)' }}>
          {words.map((w, i) => (
            <React.Fragment key={i}>
              <span style={{ display: 'inline-block', ...arrive(f, c.from + i * step, c.to) }}>{w}</span>
              {i < words.length - 1 ? ' ' : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// The opening: the mark, the name tightening into place, one line under it.
export const TitleView: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < from - 2 || f > to + 2) return null;
  const t = interpolate(f, [from, from + 150], [0, 1], { ...clamp, easing: OUT });
  const leave = interpolate(f, [to - 36, to], [0, 1], { ...clamp, easing: IN });
  const icon = interpolate(f, [from, from + 70], [0, 1], { ...clamp, easing: OUT });
  const tag = 'Your favourite sites on every new tab'.split(' ');
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - leave, translate: `0px ${-leave * 90}px`, filter: leave > 0 ? `blur(${leave * 16}px)` : undefined }}>
      <AbsoluteFill style={{ background: 'radial-gradient(52% 46% at 50% 48%, rgba(3,5,10,0.42), rgba(3,5,10,0) 70%)', opacity: icon }} />
      <div style={{ textAlign: 'center', color: '#f5f7fb' }}>
        <Img src={staticFile('icon.svg')} style={{ width: 200, height: 200, display: 'block', margin: '0 auto 64px', opacity: icon, scale: `${0.84 + 0.16 * icon}`, filter: icon < 1 ? `blur(${(1 - icon) * 16}px)` : undefined }} />
        <div style={{ font: '500 330px/1 Outfit', letterSpacing: `${0.16 - 0.205 * t}em`, opacity: interpolate(f, [from + 10, from + 70], [0, 1], { ...clamp, easing: OUT }), filter: t < 0.98 ? `blur(${(1 - t) * 26}px)` : undefined, marginRight: `${0.16 - 0.205 * t}em` }}>
          Nordlys
        </div>
        <div style={{ marginTop: 70, font: '400 92px/1.3 "Instrument Sans"', color: '#c3cce0' }}>
          {tag.map((w, i) => (
            <React.Fragment key={i}>
              <span style={{ display: 'inline-block', ...arrive(f, from + 96 + i * 5, to + 999, 0.5) }}>{w}</span>
              {i < tag.length - 1 ? ' ' : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Big words in the middle, each on its beat, over a dimmed page.
export const StatementView: React.FC<{ from: number; to: number; lines: string[]; beats: number[] }> = ({ from, to, lines, beats }) => {
  const f = useCurrentFrame();
  if (f < from - 12 || f > to + 2) return null;
  const dim = interpolate(f, [from - 10, from + 18, to - 16, to], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  let k = 0;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ opacity: dim, background: 'radial-gradient(90% 80% at 50% 48%, rgba(3,5,10,0.55), rgba(3,5,10,0.9))' }} />
      <div style={{ textAlign: 'center', color: '#f5f7fb', font: '500 250px/1.06 Outfit', letterSpacing: '-0.04em' }}>
        {lines.map((line, li) => (
          <div key={li}>
            {line.split(' ').map((w, i, all) => {
              const a = beats[k++] ?? from;
              return (
                <React.Fragment key={i}>
                  <span style={{ display: 'inline-block', ...arrive(f, a, to, 0.4) }}>{w}</span>
                  {i < all.length - 1 ? ' ' : null}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// The name again on the hit, where to get it, and what it is.
export const EndView: React.FC<{ from: number; to: number; tags: number[]; browsers?: boolean }> = ({ from, to, tags, browsers = true }) => {
  const f = useCurrentFrame();
  if (f < from - 8 || f > to + 2) return null;
  // Readable within a fifth of a second of the hit; the letters go on closing up for a second more.
  const t = interpolate(f, [from, from + 70], [0, 1], { ...clamp, easing: OUT });
  const seen = interpolate(f, [from, from + 12], [0, 1], { ...clamp, easing: OUT });
  const dim = interpolate(f, [from - 6, from + 30], [0, 1], { ...clamp, easing: OUT });
  const line = { font: '400 84px/1.3 "Instrument Sans"', color: '#c3cce0' } as const;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ opacity: dim, background: 'radial-gradient(95% 85% at 50% 46%, rgba(3,5,10,0.45), rgba(3,5,10,0.88))' }} />
      <div style={{ textAlign: 'center', color: '#f5f7fb' }}>
        <Img src={staticFile('icon.svg')} style={{ width: 190, height: 190, display: 'block', margin: '0 auto 60px', ...arrive(f, from, to + 999, 0.3) }} />
        <div style={{ font: '500 320px/1 Outfit', letterSpacing: `${0.06 - 0.105 * t}em`, marginRight: `${0.06 - 0.105 * t}em`, opacity: seen, filter: seen < 0.98 ? `blur(${(1 - seen) * 18}px)` : undefined }}>Nordlys</div>
        {browsers ? <div style={{ marginTop: 64, ...line, ...arrive(f, from + 20, to + 999, 0.4) }}>For Chrome, Edge, Firefox and Safari</div> : null}
        <div style={{ marginTop: browsers ? 18 : 64, ...line, ...arrive(f, tags[0] ?? from + 60, to + 999, 0.4) }}>Free and open source. No account.</div>
      </div>
    </AbsoluteFill>
  );
};

export const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={{ width: W, height: H }}>{children}</AbsoluteFill>;
