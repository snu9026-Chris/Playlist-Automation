import { useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

interface WaveformProps {
  audioUrl: string;
  width?: number;
  height?: number;
  color?: string;
  mirrorColor?: string;
}

export const Waveform: React.FC<WaveformProps> = ({
  audioUrl,
  width = 400,
  height = 60,
  color = "rgba(255,255,255,0.8)",
  mirrorColor = "rgba(255,255,255,0.3)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioUrl);

  if (!audioData) return null;

  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 64,
  });

  const barWidth = width / visualization.length;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: "visible" }}
    >
      {visualization.map((amp, i) => {
        const barH = amp * height * 0.8;
        const x = i * barWidth;
        return (
          <g key={i}>
            {/* Top waveform */}
            <rect
              x={x}
              y={height / 2 - barH}
              width={Math.max(barWidth - 1, 1)}
              height={barH}
              fill={color}
              rx={1}
            />
            {/* Mirror (bottom) */}
            <rect
              x={x}
              y={height / 2}
              width={Math.max(barWidth - 1, 1)}
              height={barH * 0.5}
              fill={mirrorColor}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
};
