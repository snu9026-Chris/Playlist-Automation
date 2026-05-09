import { Composition } from "remotion";
import { ShortsComposition, type ShortsProps } from "./compositions/ShortsComposition";
import { LongformComposition, type LongformProps } from "./compositions/LongformComposition";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Shorts"
        component={ShortsComposition}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioUrl: "",
          imageUrl: "",
          subtitleLines: [],
          eqType: "none",
          showPlayerBar: false,
        } satisfies ShortsProps}
      />
      <Composition
        id="Longform"
        component={LongformComposition}
        durationInFrames={9000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioUrl: "",
          imageUrls: [],
          loopType: "crossfade",
          eqType: "freqbar",
          imageLoopDuration: 10,
          overlays: [],
        } satisfies LongformProps}
      />
    </>
  );
};
