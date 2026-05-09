import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type LoopType = "crossfade" | "zoom" | "slide";

interface ImageSlideshowProps {
  imageUrls: string[];
  loopType: LoopType;
  imageLoopDuration: number; // seconds per image
}

export const ImageSlideshow: React.FC<ImageSlideshowProps> = ({
  imageUrls,
  loopType,
  imageLoopDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (imageUrls.length === 0) return <AbsoluteFill style={{ backgroundColor: "black" }} />;
  if (imageUrls.length === 1) {
    return (
      <AbsoluteFill>
        <Img src={imageUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }

  const framesPerImage = imageLoopDuration * fps;
  const transitionFrames = Math.min(fps, Math.floor(framesPerImage * 0.15)); // 1s or 15% max
  const totalCycleFrames = imageUrls.length * framesPerImage;

  const cycleFrame = frame % totalCycleFrames;
  const currentIndex = Math.floor(cycleFrame / framesPerImage) % imageUrls.length;
  const nextIndex = (currentIndex + 1) % imageUrls.length;
  const frameInSlide = cycleFrame % framesPerImage;

  const isTransitioning = frameInSlide >= framesPerImage - transitionFrames;
  const transitionProgress = isTransitioning
    ? (frameInSlide - (framesPerImage - transitionFrames)) / transitionFrames
    : 0;

  if (loopType === "crossfade") {
    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        {/* Current image */}
        <AbsoluteFill style={{ opacity: isTransitioning ? 1 - transitionProgress : 1 }}>
          <Img
            src={imageUrls[currentIndex]}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
        {/* Next image (during transition) */}
        {isTransitioning && (
          <AbsoluteFill style={{ opacity: transitionProgress }}>
            <Img
              src={imageUrls[nextIndex]}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }

  if (loopType === "zoom") {
    // Ken Burns: slow zoom 1.0 → 1.15 over the slide duration
    const scale = interpolate(frameInSlide, [0, framesPerImage], [1, 1.15], {
      extrapolateRight: "clamp",
    });
    const nextScale = isTransitioning ? 1.0 : 1;

    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        <AbsoluteFill
          style={{
            opacity: isTransitioning ? 1 - transitionProgress : 1,
            transform: `scale(${scale})`,
          }}
        >
          <Img
            src={imageUrls[currentIndex]}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
        {isTransitioning && (
          <AbsoluteFill
            style={{
              opacity: transitionProgress,
              transform: `scale(${nextScale})`,
            }}
          >
            <Img
              src={imageUrls[nextIndex]}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }

  // slide
  const slideOffset = isTransitioning
    ? interpolate(transitionProgress, [0, 1], [0, -width], { extrapolateRight: "clamp" })
    : 0;
  const nextSlideOffset = isTransitioning ? slideOffset + width : width;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${slideOffset}px)` }}>
        <Img
          src={imageUrls[currentIndex]}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {isTransitioning && (
        <AbsoluteFill style={{ transform: `translateX(${nextSlideOffset}px)` }}>
          <Img
            src={imageUrls[nextIndex]}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
