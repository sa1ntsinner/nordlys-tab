/* A cut of the film, from its edit (src/edit/*.ts): the shots in order, each
   on the frames the music gives it, the words and the accents over them, and
   the soundtrack under them (public/music/<cut>.wav, made by scripts/setup.cjs
   from a bar line of the track, so frame 0 of the film is that bar).

   The shots come from data rather than one hand-placed <Sequence> each: the
   timeline is the edit file, and it is written in bars and beats. */
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { FadeOut, FlashView, LeakView, RingView } from './Accents';
import { overlaps, transitionFrames } from './camera';
import type { Cut } from './edit/types';
import { PlatesContext, type Plates } from './plates';
import { ShotView } from './Shot';
import { CaptionView, EndView, StatementView, TitleView } from './Type';

export const Film: React.FC<{ cut: Cut; plates: Plates; dir: string }> = ({ cut, plates, dir }) => {
  const shots = cut.shots;
  return (
    <PlatesContext.Provider value={{ dir, plates }}>
      <AbsoluteFill style={{ backgroundColor: '#03050a' }}>
        {shots.map((shot, i) => {
          const next = shots[i + 1];
          // A shot is on screen for half its own transition before its cut, and half the next one's after.
          const pre = overlaps(shot.enter) ? Math.ceil(transitionFrames(shot.enter) / 2) : 0;
          const post = next && overlaps(next.enter) ? Math.ceil(transitionFrames(next.enter) / 2) : 0;
          const from = shot.from - pre;
          return (
            <Sequence key={`${shot.name}-${i}`} name={shot.name} from={from} durationInFrames={shot.to + post - from} premountFor={40}>
              <ShotView shot={shot} next={next} seqFrom={from} />
            </Sequence>
          );
        })}
        {cut.accents.map((a, i) => {
          if (a.kind === 'flash') return <FlashView key={`a${i}`} f0={a.f} strength={a.strength} />;
          if (a.kind === 'leak') return <LeakView key={`a${i}`} f0={a.f} frames={a.frames} seed={a.seed} hue={a.hue} />;
          const k = shots.findIndex((s) => s.name === a.shot);
          return k < 0 ? null : <RingView key={`a${i}`} a={a} shot={shots[k]} next={shots[k + 1]} plates={plates} />;
        })}
        {/* The words are timed in film frames and draw nothing outside their own time. */}
        {cut.captions.map((c, i) => <CaptionView key={`c${i}`} c={c} />)}
        {cut.cards.map((card, i) =>
          card.kind === 'title' ? <TitleView key={`k${i}`} from={card.from} to={card.to} />
            : card.kind === 'end' ? <EndView key={`k${i}`} from={card.from} to={card.to} tags={card.tags} browsers={card.browsers !== false} />
              : <StatementView key={`k${i}`} from={card.from} to={card.to} lines={card.lines} beats={card.beats} />)}
        <FadeOut from={cut.frames - 24} to={cut.frames} />
        <Audio src={staticFile(cut.audio)} />
      </AbsoluteFill>
    </PlatesContext.Provider>
  );
};
