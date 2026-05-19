/* ─── 공통 타입 정의 ─── */

// 이퀄라이저 — 5종 (사용자 확정)
export type EqualizerType = "spike" | "neon-dots" | "neon-ring" | "neon-rotor" | "neon-arc";

// 플레이어바 스타일 — 2종 (사용자 확정)
export type PlayerBarStyle = "iconic" | "minimal";

// 워터마크 스타일 — 4종 (사용자 확정) + none
export type WatermarkStyle =
  | "none"
  | "rotating-circle"  // 원형 회전 텍스트
  | "marquee"          // 가로 흐르는 곡 목록
  | "minimal-line"     // 좌하단 옅은 한 줄
  | "dot-progress";    // 도트 패턴 진행률

// 이미지 전환
export type LoopType = "crossfade" | "zoom" | "slide";

// 오버레이 위치 (9칸 그리드)
export type OverlayPosition = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

// 프리셋 타입
export type PresetType =
  | "youtube-set" | "watermark" | "end-screen"
  | "player-bar" | "player-bar-minimal"
  | "subscribe" | "like-comment-share" | "youtube-logo" | "subscribe-bell";

// 숏폼 프리셋
export type ShortsPreset = "player-bar" | "lyrics" | "eq";

// ─── 데이터 인터페이스 ───

export interface Mp3File {
  file: File;
  name: string;
  duration: number;
}

export interface GeneratedImage {
  url: string;
  selected: boolean;
}

export interface OverlayItem {
  id: string;
  file: File | null;
  name: string;
  previewUrl: string;
  position: OverlayPosition;
  scale: number;
  opacity: number;
  timing: "always" | "first" | "last";
  timingSeconds: number;
  chromakey: "none" | "black" | "green";
  isPreset?: boolean;
  preset?: PresetType;
  channelName?: string;
}

export interface TrackSlot {
  /** 재정렬에도 안정적인 고유 키. 가사·이미지 매핑은 이걸로 한다. */
  id: string;
  slotIndex: number;
  file: File | null;
  fileName: string;
  clip: ClipResult | null;
  clipBlob: Blob | null;
  analyzing: boolean;
  imageUrl: string | null;
}

export interface ClipResult {
  clipStart: number;
  clipEnd: number;
  duration: number;
  peakEnergy: number;
}

export interface Project {
  id: string;
  theme: string;
  status: string;
  created_at: string;
}

// 프리셋 정의 아이템
export interface PresetDefinition {
  id: PresetType;
  label: string;
  icon: string;
  defaultPos: OverlayPosition;
  defaultScale: number;
  defaultTiming: "always" | "first" | "last";
}

// 롱폼 프리셋 목록
export const LONGFORM_PRESETS: PresetDefinition[] = [
  { id: "youtube-set", label: "YouTube 세트", icon: "🎬", defaultPos: "br", defaultScale: 1, defaultTiming: "always" },
  { id: "watermark", label: "워터마크", icon: "💧", defaultPos: "bc", defaultScale: 1, defaultTiming: "always" },
  { id: "end-screen", label: "엔드 스크린", icon: "🏁", defaultPos: "mc", defaultScale: 1, defaultTiming: "last" },
  { id: "player-bar", label: "컨트롤바", icon: "🎛️", defaultPos: "bc", defaultScale: 1, defaultTiming: "always" },
  { id: "player-bar-minimal", label: "미니 컨트롤바", icon: "⏯️", defaultPos: "bc", defaultScale: 1, defaultTiming: "always" },
];

// 이퀄라이저 라벨
export const EQ_LABELS: Record<EqualizerType, string> = {
  "spike": "스파이크",
  "neon-dots": "방사형 도트",
  "neon-ring": "펄스 링",
  "neon-rotor": "회전 로터",
  "neon-arc": "좌우 호",
};

// 플레이어바 스타일 라벨
export const PLAYER_BAR_LABELS: Record<PlayerBarStyle, string> = {
  iconic: "아이코닉 컴팩트",
  minimal: "미니멀 라인",
};

// 워터마크 라벨
export const WATERMARK_LABELS: Record<WatermarkStyle, string> = {
  "none": "사용 안함",
  "rotating-circle": "회전 원형 텍스트",
  "marquee": "흐르는 곡 목록",
  "minimal-line": "좌하단 라인",
  "dot-progress": "도트 진행률",
};

// 오버레이 위치 라벨
export const POSITION_LABELS: Record<OverlayPosition, string> = {
  tl: "좌상", tc: "중상", tr: "우상",
  ml: "좌중", mc: "중앙", mr: "우중",
  bl: "좌하", bc: "중하", br: "우하",
};
