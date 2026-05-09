import {
  AbsoluteFill,
  Img,
  Video,
  Sequence,
  useVideoConfig,
} from "remotion";
import { getOverlayStyle, type OverlayPosition } from "../utils/positions";
import { PresetOverlay, type PresetType } from "./BuiltInOverlays";

export interface OverlayConfig {
  url: string;
  type: "image" | "video" | "preset";
  preset?: PresetType;
  channelName?: string;
  position: OverlayPosition;
  scale: number;
  opacity: number;
  timing: "always" | "first" | "last";
  timingSeconds: number;
  chromakey: "none" | "black" | "green";
}

interface OverlayLayerProps {
  overlays: OverlayConfig[];
  totalDurationFrames: number;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  overlays,
  totalDurationFrames,
}) => {
  const { fps, width, height } = useVideoConfig();

  return (
    <>
      {overlays.map((ov, i) => {
        let from = 0;
        let duration = totalDurationFrames;

        if (ov.timing === "first") {
          duration = Math.min(ov.timingSeconds * fps, totalDurationFrames);
        } else if (ov.timing === "last") {
          from = Math.max(0, totalDurationFrames - ov.timingSeconds * fps);
          duration = totalDurationFrames - from;
        }

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <SingleOverlay overlay={ov} containerWidth={width} containerHeight={height} />
          </Sequence>
        );
      })}
    </>
  );
};

const SingleOverlay: React.FC<{
  overlay: OverlayConfig;
  containerWidth: number;
  containerHeight: number;
}> = ({ overlay, containerWidth, containerHeight }) => {
  const posStyle = getOverlayStyle(overlay.position, containerWidth, containerHeight);

  const chromakeyStyle: React.CSSProperties = {};
  if (overlay.chromakey === "black") {
    chromakeyStyle.mixBlendMode = "screen";
  }

  const wrapperStyle: React.CSSProperties = {
    ...posStyle,
    opacity: overlay.opacity,
    ...chromakeyStyle,
  };

  // Preset overlays — rendered as React components, no file needed
  if (overlay.type === "preset" && overlay.preset) {
    return (
      <div style={{ ...wrapperStyle, transform: `${wrapperStyle.transform || ""} scale(${overlay.scale})`.trim() }}>
        <PresetOverlay preset={overlay.preset} channelName={overlay.channelName} />
      </div>
    );
  }

  // File-based overlays — constrain size to prevent full-screen coverage
  const baseSize = containerWidth * 0.3;
  const finalSize = baseSize * overlay.scale;

  const fileWrapperStyle: React.CSSProperties = {
    ...wrapperStyle,
    width: finalSize,
    height: "auto",
    maxWidth: containerWidth * 0.8,
    maxHeight: containerHeight * 0.8,
    overflow: "hidden",
  };

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  if (overlay.type === "video") {
    return (
      <div style={fileWrapperStyle}>
        <Video src={overlay.url} loop style={{ ...mediaStyle, objectFit: "contain" }} muted />
      </div>
    );
  }

  return (
    <div style={fileWrapperStyle}>
      <Img src={overlay.url} style={mediaStyle} />
    </div>
  );
};
