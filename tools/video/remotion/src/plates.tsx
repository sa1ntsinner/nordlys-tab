/* The plates: clean clips of the live demo, filmed by tools/video/plates.cjs
   into public/<dir>/ (plates/ at 5120 x 2880 for the films, a smaller set
   for drafts), each with a JSON of its size, length, and the times and boxes
   its script marked. calculateMetadata reads <dir>/index.json once and the
   films pass it down. */
import { createContext, useContext } from 'react';
import { staticFile } from 'remotion';

export type Rect = { t: number; x: number; y: number; w: number; h: number };
export type PlateMeta = {
  name: string;
  fps: number;
  frames: number;
  seconds: number;
  width: number;
  height: number;
  scale: number;
  marks: Record<string, number>;
  rects: Record<string, Rect>;
};
export type Plates = Record<string, PlateMeta>;

export const PlatesContext = createContext<{ dir: string; plates: Plates }>({ dir: 'plates', plates: {} });

export const usePlate = (name: string): PlateMeta => {
  const { plates } = useContext(PlatesContext);
  const p = plates[name];
  if (!p) throw new Error(`No plate "${name}": film it with tools/video/plates.cjs`);
  return p;
};

export const usePlateSrc = (name: string) => {
  const { dir } = useContext(PlatesContext);
  return staticFile(`${dir}/${name}.mp4`);
};

export const loadPlates = async (dir: string): Promise<Plates> => {
  const res = await fetch(staticFile(`${dir}/index.json`));
  if (!res.ok) throw new Error(`No ${dir}/index.json in public/: film the plates first`);
  return res.json();
};
