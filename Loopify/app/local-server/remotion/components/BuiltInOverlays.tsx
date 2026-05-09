import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export type PresetType =
  | "youtube-set" | "watermark" | "end-screen"
  | "player-bar" | "player-bar-minimal"
  | "subscribe" | "like-comment-share" | "youtube-logo" | "subscribe-bell";

interface PresetOverlayProps {
  preset: PresetType;
  channelName?: string;
}

export const PresetOverlay: React.FC<PresetOverlayProps> = ({ preset, channelName = "" }) => {
  switch (preset) {
    case "youtube-set": case "subscribe": case "like-comment-share":
    case "youtube-logo": case "subscribe-bell":
      return <YouTubeSet />;
    case "watermark": return <Watermark text={channelName} />;
    case "end-screen": return <EndScreen channelName={channelName} />;
    case "player-bar": return <PlayerBar />;
    case "player-bar-minimal": return <PlayerBarMinimal />;
    default: return null;
  }
};

/* ── 버튼 눌림 이펙트 ── */
function usePressEffect(frame: number, fps: number, triggerFrame: number) {
  const t = frame - triggerFrame;
  if (t < 0) return { scale: 0, opacity: 0 };
  const enterScale = spring({ frame: t, fps, config: { damping: 14, stiffness: 90 } });
  const pressDepth = t >= 8 && t < 12 ? interpolate(t, [8, 10, 12], [1, 0.88, 1], { extrapolateRight: "clamp" }) : 1;
  const bounceBack = t >= 12 ? spring({ frame: t - 12, fps, config: { damping: 8, stiffness: 200 } }) : 0;
  const scale = interpolate(enterScale, [0, 1], [0.5, 1]) * pressDepth * (1 + bounceBack * 0.04);
  return { scale, opacity: enterScale };
}

/* ═══════════════════════════════════════════
   YouTube Set — 프리미엄 HTML/CSS
   ═══════════════════════════════════════════ */
function YouTubeSet() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const e1 = spring({ frame, fps, config: { damping: 16, stiffness: 80 } });
  const subPress = usePressEffect(frame, fps, 8);
  const bellPress = usePressEffect(frame, fps, 18);
  const likePress = usePressEffect(frame, fps, 28);
  const cmtPress = usePressEffect(frame, fps, 36);
  const sharePress = usePressEffect(frame, fps, 44);

  const bellFrame2 = Math.max(0, frame - 22);
  const bellShake = bellFrame2 > 0 && bellFrame2 < 30
    ? Math.sin(bellFrame2 * 1.3) * interpolate(bellFrame2, [0, 30], [12, 0], { extrapolateRight: "clamp" })
    : 0;

  const glassCard: React.CSSProperties = {
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-end" }}>
      {/* YouTube 로고 — 정확한 YouTube 브랜딩 */}
      <div style={{
        opacity: e1,
        transform: `translateX(${interpolate(e1, [0, 1], [40, 0])}px)`,
      }}>
        <div style={{
          width: 68, height: 48, borderRadius: 12,
          background: "linear-gradient(180deg, #FF1A1A 0%, #CC0000 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 12px rgba(200,0,0,0.5)",
          position: "relative" as const, overflow: "hidden",
        }}>
          {/* 글로시 */}
          <div style={{
            position: "absolute" as const, top: 0, left: 0, right: 0, height: "45%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
            borderRadius: "12px 12px 0 0",
          }} />
          {/* ▶ 삼각형 */}
          <div style={{
            width: 0, height: 0,
            borderLeft: "22px solid white",
            borderTop: "14px solid transparent",
            borderBottom: "14px solid transparent",
            marginLeft: 5,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
          }} />
        </div>
      </div>

      {/* 구독 + 벨 — 글래스 카드 */}
      <div style={{
        opacity: subPress.opacity,
        transform: `translateX(${interpolate(subPress.opacity, [0, 1], [40, 0])}px)`,
        display: "flex", alignItems: "center", gap: 0,
        ...glassCard,
        borderRadius: 28, padding: "3px",
      }}>
        {/* 구독 버튼 */}
        <div style={{
          transform: `scale(${subPress.scale})`,
          transformOrigin: "center",
        }}>
          <div style={{
            padding: "10px 32px",
            borderRadius: 24,
            background: "linear-gradient(180deg, #FF2020 0%, #CC0000 100%)",
            boxShadow: "0 2px 8px rgba(200,0,0,0.4)",
            position: "relative" as const, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute" as const, top: 0, left: 0, right: 0, height: "50%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)",
              borderRadius: "24px 24px 0 0",
            }} />
            <span style={{
              fontFamily: "'Inter','Pretendard',sans-serif",
              fontWeight: 800, fontSize: 18, color: "white",
              letterSpacing: 0.5, position: "relative" as const,
            }}>구독</span>
          </div>
        </div>

        {/* 벨 */}
        <div style={{
          transform: `rotate(${bellShake}deg) scale(${bellPress.scale})`,
          opacity: bellPress.opacity,
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: 4, marginRight: 2,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 28" fill="white">
            <path d="M12 28c1.5 0 2.7-1.2 2.7-2.7H9.3c0 1.5 1.2 2.7 2.7 2.7zm8.5-7.5V14c0-4.3-2.3-7.9-6.2-8.8V4c0-1.3-1-2.3-2.3-2.3S9.7 2.7 9.7 4v1.2C5.8 6.1 3.5 9.7 3.5 14v6.5L1 23v1.5h22V23l-2.5-2.5z" />
          </svg>
        </div>
      </div>

      {/* 좋아요 / 댓글 / 공유 — 글래스 카드 */}
      <div style={{
        opacity: likePress.opacity,
        transform: `translateX(${interpolate(likePress.opacity, [0, 1], [40, 0])}px)`,
        display: "flex", gap: 0, alignItems: "center",
        ...glassCard,
        borderRadius: 28, padding: "6px 8px",
      }}>
        {([
          { label: "좋아요", icon: "M2 20h4v-8H2v8zm22-7c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L15.17 4 8.59 10.59C8.22 10.95 8 11.45 8 12v8c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z", press: likePress },
          { label: "댓글", icon: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z", press: cmtPress },
          { label: "공유", icon: "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z", press: sharePress },
        ] as const).map(({ label, icon, press }, idx) => (
          <div key={idx} style={{
            display: "flex", alignItems: "center", gap: 0,
          }}>
            <div style={{
              opacity: press.opacity, transform: `scale(${press.scale})`,
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d={icon} /></svg>
              <span style={{
                fontFamily: "'Inter','Pretendard',sans-serif",
                fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.9)",
              }}>{label}</span>
            </div>
            {idx < 2 && (
              <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Watermark — 기획사 스타일
   ═══════════════════════════════════════════ */
function Watermark({ text }: { text: string }) {
  const name = text || "LOOPIFY";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      opacity: 0.4,
    }}>
      {/* 캡슐형 로고 배지 */}
      <div style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 20,
        padding: "7px 24px",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>
        <span style={{
          fontFamily: "'Inter','Pretendard',sans-serif",
          fontWeight: 700, fontSize: 14, color: "white",
          letterSpacing: 3, textTransform: "uppercase" as const,
        }}>{name}</span>
      </div>
      {/* 영문 문구 — 기획사 느낌 */}
      <div style={{
        fontFamily: "'Georgia','Times New Roman',serif",
        fontSize: 13, fontStyle: "italic" as const,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: 0.5, textAlign: "center" as const,
        lineHeight: 1.6, maxWidth: 500,
      }}>
        Some songs, the moment you hear them, bring back the space,
        <br />the warmth, the feeling — even the scent — of that time.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   End Screen
   ═══════════════════════════════════════════ */
function EndScreen({ channelName }: { channelName: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 60 } });
  const textEnter = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 60 } });

  return (
    <div style={{
      opacity: interpolate(enter, [0, 1], [0, 1]),
      transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
    }}>
      <div style={{
        width: 560, padding: "44px 50px",
        background: "rgba(10,10,25,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
      }}>
        {/* 악센트 라인 */}
        <div style={{
          width: 160, height: 3, borderRadius: 2,
          background: "linear-gradient(90deg, #818cf8, #c084fc)",
          marginTop: -24,
        }} />

        {/* YouTube 로고 */}
        <div style={{
          width: 60, height: 42, borderRadius: 10,
          background: "linear-gradient(180deg, #FF1A1A 0%, #CC0000 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(200,0,0,0.4)",
          position: "relative" as const, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute" as const, top: 0, left: 0, right: 0, height: "45%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)",
          }} />
          <div style={{
            width: 0, height: 0,
            borderLeft: "18px solid white",
            borderTop: "11px solid transparent",
            borderBottom: "11px solid transparent",
            marginLeft: 4,
          }} />
        </div>

        {/* 채널명 */}
        <div style={{
          fontFamily: "'Inter','Pretendard',sans-serif",
          fontWeight: 800, fontSize: 26, color: "white",
          letterSpacing: 1.5,
        }}>
          {channelName || "MY CHANNEL"}
        </div>

        {/* 구분선 */}
        <div style={{ width: 200, height: 1, background: "rgba(255,255,255,0.1)" }} />

        {/* 감성 문구 */}
        <div style={{
          opacity: interpolate(textEnter, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(textEnter, [0, 1], [8, 0])}px)`,
          fontFamily: "'Georgia','Pretendard',serif",
          fontSize: 15, fontStyle: "italic" as const,
          color: "rgba(255,255,255,0.6)",
          textAlign: "center" as const,
          lineHeight: 1.8, maxWidth: 420,
          letterSpacing: 0.3,
        }}>
          그냥 보통의 날들이 가득하기를,
          <br />그 나날들 속에 나와 함께하기만을 바란다.
        </div>

        {/* 하단 */}
        <div style={{
          fontFamily: "'Inter','Pretendard',sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.3)",
          marginTop: 4,
        }}>
          좋아요와 구독 부탁드립니다
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Player Bar — 입체 글래스박스
   ═══════════════════════════════════════════ */
function PlayerBar() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const totalSec = durationInFrames / fps;
  const currentSec = frame / fps;
  const progress = frame / durationInFrames;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 70 } });
  const translateY = interpolate(entrance, [0, 1], [25, 0]);

  const GlassBtn = ({ children, size = 40, round = 12 }: { children: React.ReactNode; size?: number; round?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: round,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</div>
  );

  return (
    <div style={{ transform: `translateY(${translateY}px)`, opacity: entrance, width: 680 }}>
      <div style={{
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 6px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
        padding: "16px 28px 18px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* 프로그레스 바 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontFamily: "'SF Mono','JetBrains Mono',monospace",
            fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.6)",
            fontVariantNumeric: "tabular-nums", minWidth: 36,
          }}>{fmt(currentSec)}</span>
          <div style={{
            flex: 1, height: 6, borderRadius: 3,
            background: "rgba(255,255,255,0.12)",
            position: "relative" as const,
          }}>
            <div style={{
              width: `${progress * 100}%`, height: "100%", borderRadius: 3,
              background: "linear-gradient(90deg, #818cf8, #a78bfa, #c084fc)",
              boxShadow: "0 0 8px rgba(129,140,248,0.4)",
            }} />
            <div style={{
              position: "absolute" as const, left: `${progress * 100}%`, top: "50%",
              transform: "translate(-50%, -50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: "white", border: "2.5px solid #a78bfa",
              boxShadow: "0 0 10px rgba(167,139,250,0.5), 0 2px 4px rgba(0,0,0,0.3)",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", margin: "auto", marginTop: 2.5 }} />
            </div>
          </div>
          <span style={{
            fontFamily: "'SF Mono','JetBrains Mono',monospace",
            fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)",
            fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" as const,
          }}>{fmt(totalSec)}</span>
        </div>

        {/* 컨트롤 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.45)">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zM14 3.23v2.06a7.007 7.007 0 0 1 0 13.42v2.06A9.007 9.007 0 0 0 14 3.23z" />
            </svg>
            <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }}>
              <div style={{ width: "70%", height: "100%", borderRadius: 2, background: "rgba(255,255,255,0.4)" }} />
            </div>
          </div>
          <GlassBtn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
            </svg>
          </GlassBtn>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border: "1.5px solid rgba(255,255,255,0.2)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </div>
          <GlassBtn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
            </svg>
          </GlassBtn>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Player Bar Minimal
   ═══════════════════════════════════════════ */
function PlayerBarMinimal() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;
  const currentSec = frame / fps;
  const totalSec = durationInFrames / fps;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  const entrance = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <div style={{
      opacity: entrance,
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(0,0,0,0.45)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRadius: 30, padding: "8px 20px 8px 8px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      width: 480,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </div>
      <div style={{
        flex: 1, height: 5, borderRadius: 3,
        background: "rgba(255,255,255,0.1)", position: "relative" as const,
      }}>
        <div style={{
          width: `${progress * 100}%`, height: "100%", borderRadius: 3,
          background: "linear-gradient(90deg, #6366f1, #818cf8, #c084fc)",
        }} />
        <div style={{
          position: "absolute" as const, left: `${progress * 100}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: "white", border: "2px solid #818cf8",
          boxShadow: "0 0 8px rgba(99,102,241,0.4)",
        }} />
      </div>
      <span style={{
        fontFamily: "'SF Mono','JetBrains Mono',monospace",
        fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)",
        fontVariantNumeric: "tabular-nums", flexShrink: 0,
      }}>{fmt(currentSec)} / {fmt(totalSec)}</span>
    </div>
  );
}
