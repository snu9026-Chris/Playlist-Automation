import { AbsoluteFill, Audio, useVideoConfig } from "remotion";
import { ImageSlideshow } from "../components/ImageSlideshow";
import { Equalizer, type EqualizerType } from "../components/Equalizer";
import { OverlayLayer, type OverlayConfig } from "../components/OverlayLayer";

type LoopType = "crossfade" | "zoom" | "slide";

export interface LongformProps {
  audioUrl: string;
  imageUrls: string[];
  loopType: LoopType;
  eqType: EqualizerType;
  imageLoopDuration: number;
  overlays: OverlayConfig[];
}

export const LongformComposition: React.FC<LongformProps> = ({
  audioUrl,
  imageUrls,
  loopType,
  eqType,
  imageLoopDuration,
  overlays,
}) => {
  const { durationInFrames, width } = useVideoConfig();

  // Equalizer sizing — larger types get more space
  const sizeMap: Record<string, { w: number; h: number; bottom: number }> = {
    glass:     { w: Math.min(width * 0.85, 1600), h: 300, bottom: 30 },
    circle:    { w: 500, h: 500, bottom: 30 },
    pulse:     { w: 550, h: 550, bottom: 10 },
    symmetric: { w: Math.min(width * 0.85, 1600), h: 280, bottom: 30 },
  };
  const defaultSize = { w: Math.min(width * 0.8, 1400), h: 280, bottom: 30 };
  const { w: eqWidth, h: eqHeight, bottom: eqBottom } = sizeMap[eqType] || defaultSize;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Layer 1: Image slideshow background */}
      <ImageSlideshow
        imageUrls={imageUrls}
        loopType={loopType}
        imageLoopDuration={imageLoopDuration}
      />

      {/* Layer 2: Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Layer 3: Equalizer at bottom center */}
      {audioUrl && (
        <div
          style={{
            position: "absolute",
            bottom: eqBottom,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <Equalizer
            audioUrl={audioUrl}
            eqType={eqType}
            width={eqWidth}
            height={eqHeight}
          />
        </div>
      )}

      {/* Layer 4: Overlays (on top of everything) */}
      <OverlayLayer overlays={overlays} totalDurationFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
