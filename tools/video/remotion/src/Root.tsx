/* The two cuts. Both 3840 x 2160 at 60 fps; render at --scale=0.5 for a
   quick look, or give --props='{"plates":"plates-1080"}' to cut from the
   draft plates. The plates' index is read once, before the render. */
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { store } from './edit/store';
import type { Cut } from './edit/types';
import { youtube } from './edit/youtube';
import { Film } from './Film';
import { FPS, H, W } from './music';
import { loadPlates, type Plates } from './plates';

type Props = { plates: string; index?: Plates };

const cutFilm = (cut: Cut): React.FC<Props> => {
  const C: React.FC<Props> = ({ plates, index }) => <Film cut={cut} plates={index ?? {}} dir={plates} />;
  C.displayName = cut.name;
  return C;
};
const YouTube = cutFilm(youtube);
const Store = cutFilm(store);

const withPlates: CalculateMetadataFunction<Props> = async ({ props }) => ({ props: { ...props, index: await loadPlates(props.plates) } });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="YouTube" component={YouTube} durationInFrames={youtube.frames} fps={FPS} width={W} height={H} defaultProps={{ plates: 'plates' }} calculateMetadata={withPlates} />
    <Composition id="Store" component={Store} durationInFrames={store.frames} fps={FPS} width={W} height={H} defaultProps={{ plates: 'plates' }} calculateMetadata={withPlates} />
  </>
);
