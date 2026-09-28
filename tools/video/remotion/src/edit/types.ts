/* What an edit is made of. Every time is a frame of the film (60 fps),
   written in the edit files through the music's bars and beats. */

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'soft' | 'land' | 'fly';

/* The camera over a plate: where it looks (x, y: the plate's centre is 0.5,
   0.5) and how close (z: 1 fills the frame with the whole plate). A key is
   reached at frame f, arriving with its ease. */
export type Key = { f: number; x?: number; y?: number; z?: number; ease?: Ease };

export type TransitionType =
  | 'cut'      // a hard cut on the beat
  | 'whip'     // a fast pan to the left, blurred, the next shot coming in from the right
  | 'whipUp'   // the same, upwards
  | 'zoom'     // flying into the old shot and out into the new one, with zoom blur
  | 'iris'     // the new shot opening in a circle from a point
  | 'wipe'     // a soft edge sweeping left to right
  | 'fade';    // a dissolve
export type Transition = { type: TransitionType; frames?: number; at?: [number, number] };

/* A plate floating as a window in 3D: its size (s, of the frame), tilt
   (degrees), lift (y, of the frame height) and corner radius (px). */
export type WindowKey = { f: number; s: number; rx: number; ry: number; rz: number; y: number; r: number; ease?: Ease };

export type Shot = {
  name: string;
  plate: string;
  from: number;           // the frame it cuts in on
  to: number;             // the frame it cuts out on
  tau?: number;           // plate seconds shown at `from` (default 1: plates have a second of handle)
  rate?: number;          // playback speed of the plate
  cam?: Key[];
  enter?: Transition;
  light?: boolean;        // a light theme: the words over it are dark
  grade?: { brightness?: number; contrast?: number; saturate?: number }; // a gentle grade (the sky at night is dark)
  window?: { keys: WindowKey[]; backdrop: string; backdropTau?: number; backdropCam?: Key[] };
  grid?: { plates: string[]; cols: number; rows: number; appear: number[]; into?: number; zoomFrom?: number; zoomTo?: number };
  // A focus pull: everything but a box goes soft, then sharp again.
  pull?: { from: number; to: number; x: number; y: number; w: number; h: number; blur: number };
  // A veil: the top of the plate goes soft, sharp at y0 and fully soft from y1 up (the clock, under a caption in the top corner).
  veil?: { from: number; to: number; y0: number; y1: number; blur: number };
  /* Motion blur for a fast move filmed inside the plate (the page's own camera
     panning or flying in), which the edit cannot measure: a blur that swells
     over the move (bell) or grows into its end (ramp), in screen pixels. */
  hint?: { from: number; to: number; kind: 'x' | 'y' | 'zoom'; px: number; shape?: 'bell' | 'ramp'; at?: [number, number] };
};

export type Caption = {
  text: string;
  eyebrow?: string;
  from: number;
  to: number;
  where?: 'bl' | 'tl' | 'br' | 'tr';
  light?: boolean;
  step?: number;          // frames between words (default an eighth of a beat's worth)
};

export type Card =
  | { kind: 'title'; from: number; to: number }
  | { kind: 'end'; from: number; to: number; tags: number[] }
  | { kind: 'statement'; from: number; to: number; lines: string[]; beats: number[] };

export type Accent =
  | { kind: 'flash'; f: number; strength?: number }
  | { kind: 'leak'; f: number; frames: number; seed?: number; hue?: number }
  // A soft ring on a box of a plate, where the shot's camera puts it: a box the plate's script
  // recorded (by name), or [x, y, w, h] as fractions of the plate.
  | { kind: 'ring'; shot: string; f: number; frames: number; rect: string | [number, number, number, number]; pad?: number };

export type Cut = {
  name: string;
  frames: number;
  audio: string;
  shots: Shot[];
  captions: Caption[];
  cards: Card[];
  accents: Accent[];
};
