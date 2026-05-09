import { AbsoluteFill, Audio, Img, Sequence } from "remotion";
import { Equalizer, type EqualizerType } from "../components/Equalizer";
import { PresetOverlay } from "../components/BuiltInOverlays";

/**
 * 숏폼 컴포지션 — 1080×1920 세로 영상.
 * 클라이언트 프리셋(eq / lyrics / player-bar)이 그대로 반영된다.
 */

export interface SubtitleLine {
  text: string;
  startFrame: number;
  endFrame: number;
}

// 클라이언트는 eq 프리셋이 꺼져있을 때 "none"을 보낸다 → 이때 EQ 미렌더
export type ShortsEqType = EqualizerType | "none";

export interface ShortsProps {
  audioUrl: string;
  imageUrl: string;
  subtitleLines: SubtitleLine[];
  eqType: ShortsEqType;
  showPlayerBar: boolean;
}

// EQ 프리셋별 크기 — 세로 1080×1920에 맞춰 조정.
// 클라이언트(shorts/page.tsx)에서 노출하는 4종만 매핑하고, 나머지는 글래스 사이즈로 폴백.
const SHORTS_EQ_SIZE: Partial<Record<EqualizerType, { w: number; h: number }>> = {
  glass:     { w: 880, h: 280 },
  symmetric: { w: 880, h: 280 },
  circle:    { w: 500, h: 500 },
  pulse:     { w: 550, h: 550 },
};
const DEFAULT_EQ_SIZE = { w: 880, h: 280 };

export const ShortsComposition: React.FC<ShortsProps> = ({
  audioUrl,
  imageUrl,
  subtitleLines,
  eqType,
  showPlayerBar,
}) => {
  const eqEnabled = eqType !== "none";
  const eqSize = eqEnabled
    ? (SHORTS_EQ_SIZE[eqType as EqualizerType] ?? DEFAULT_EQ_SIZE)
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 1. 배경 이미지 */}
      {imageUrl && (
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      )}

      {/* 2. 오디오 */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* 3. 이퀄라이저 — 화면 하단, 플레이어바 위 */}
      {audioUrl && eqEnabled && eqSize && (
        <div
          style={{
            position: "absolute",
            bottom: 200,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <Equalizer
            audioUrl={audioUrl}
            eqType={eqType as EqualizerType}
            width={eqSize.w}
            height={eqSize.h}
          />
        </div>
      )}

      {/* 4. 자막(가사) — EQ 위쪽 */}
      {subtitleLines.map((line, i) => (
        <Sequence
          key={i}
          from={line.startFrame}
          durationInFrames={line.endFrame - line.startFrame}
        >
          <div
            style={{
              position: "absolute",
              bottom: 720,
              left: 0,
              right: 0,
              textAlign: "center",
              padding: "0 60px",
            }}
          >
            <span
              style={{
                fontSize: 56,
                color: "white",
                fontFamily: "Pretendard, sans-serif",
                fontWeight: 700,
                textShadow:
                  "2px 2px 8px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.7)",
                lineHeight: 1.4,
                letterSpacing: -0.5,
              }}
            >
              {line.text}
            </span>
          </div>
        </Sequence>
      ))}

      {/* 5. 플레이어바 — 가장 하단 (PresetOverlay 재사용) */}
      {showPlayerBar && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <PresetOverlay preset="player-bar-minimal" />
        </div>
      )}
    </AbsoluteFill>
  );
};
