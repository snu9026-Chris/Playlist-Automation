import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

export type EqualizerType =
  | "freqbar" | "neon" | "circle"
  | "glass" | "aurora" | "prism" | "pulse" | "flame"
  | "symmetric";

interface EqualizerProps {
  audioUrl: string;
  eqType: EqualizerType;
  width?: number;
  height?: number;
}

export const Equalizer: React.FC<EqualizerProps> = ({
  audioUrl,
  eqType,
  width = 800,
  height = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioUrl);

  if (!audioData) return null;

  const numberOfSamples = (eqType === "circle" || eqType === "pulse") ? 32 : 64;
  const rawVis = visualizeAudio({ fps, frame, audioData, numberOfSamples });
  // 파동 증폭 — 원본이 너무 작아서 2.5배 부스트 (최대 1.0 클램프)
  const vis = rawVis.map(v => Math.min(v * 2.5, 1));

  const renderers: Record<EqualizerType, React.FC<VisProps>> = {
    freqbar: FreqBar, neon: NeonBars, circle: CircleEq,
    glass: GlassBars, aurora: Aurora, prism: PrismBars, pulse: PulseRings, flame: Flame,
    symmetric: SymmetricSpectrum,
  };

  const Renderer = renderers[eqType] || FreqBar;
  return <Renderer vis={vis} width={width} height={height} frame={frame} />;
};

interface VisProps {
  vis: number[];
  width: number;
  height: number;
  frame: number;
}

/* ═══════════════════════════════════════════════
   KEPT + UPGRADED
   ═══════════════════════════════════════════════ */

/* ─── freqbar: 3D gradient bars + reflection + peak dots ─── */
const FreqBar: React.FC<VisProps> = ({ vis, width, height }) => {
  const barW = width / vis.length;
  const gap = Math.max(1.5, barW * 0.2);
  const mainH = height * 0.72;
  const reflH = height * 0.28;

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id="fb-g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="40%" stopColor="#818cf8" />
          <stop offset="80%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#ede9fe" />
        </linearGradient>
        <linearGradient id="fb-r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,0.25)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0)" />
        </linearGradient>
        <filter id="fb-sh">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(99,102,241,0.4)" />
        </filter>
      </defs>
      {vis.map((v, i) => {
        const bH = v * mainH * 0.92;
        const rH = v * reflH * 0.5;
        const x = i * barW + gap / 2;
        const w = Math.max(barW - gap, 2);
        return (
          <g key={i}>
            <rect x={x} y={mainH - bH} width={w} height={bH} fill="url(#fb-g)" rx={w / 2} filter="url(#fb-sh)" />
            {/* Top highlight */}
            <rect x={x + 1} y={mainH - bH} width={w - 2} height={Math.min(bH, 6)} fill="rgba(255,255,255,0.5)" rx={w / 2} />
            {/* Peak dot */}
            {v > 0.25 && <circle cx={x + w / 2} cy={mainH - bH - 5} r={2.5} fill="#e0e7ff" opacity={0.9} />}
            {/* Reflection */}
            <rect x={x} y={mainH + 3} width={w} height={rH} fill="url(#fb-r)" rx={1} />
          </g>
        );
      })}
      <line x1={0} y1={mainH + 1.5} x2={width} y2={mainH + 1.5} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
    </svg>
  );
};

/* ─── neon: glowing neon bars with bloom ─── */
const NeonBars: React.FC<VisProps> = ({ vis, width, height, frame }) => {
  const barW = width / vis.length;
  const gap = barW * 0.25;

  return (
    <svg width={width} height={height}>
      <defs>
        <filter id="n-bloom">
          <feGaussianBlur stdDeviation="6" result="b1" />
          <feGaussianBlur stdDeviation="12" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0.25)" rx={10} />
      {vis.map((v, i) => {
        const bH = v * height * 0.82;
        const x = i * barW + gap / 2;
        const w = Math.max(barW - gap, 2);
        const hue = (i / vis.length) * 80 + 220 + Math.sin(frame * 0.03 + i * 0.2) * 15;
        const color = `hsl(${hue}, 100%, 68%)`;
        const colorBright = `hsl(${hue}, 100%, 85%)`;
        return (
          <g key={i}>
            <rect x={x} y={height - bH} width={w} height={bH}
              fill={color} rx={w / 2} filter="url(#n-bloom)" />
            {/* Inner bright core */}
            <rect x={x + w * 0.2} y={height - bH} width={w * 0.6} height={bH}
              fill={colorBright} rx={w * 0.3} opacity={0.5} />
          </g>
        );
      })}
    </svg>
  );
};

/* ─── circle: radial with glow + rotating ring ─── */
const CircleEq: React.FC<VisProps> = ({ vis, width, height, frame }) => {
  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(cx, cy) * 0.28;
  const maxBarLen = Math.min(cx, cy) * 0.62;
  const rotation = frame * 0.25;
  const avgAmp = vis.reduce((a, b) => a + b, 0) / vis.length;

  return (
    <svg width={width} height={height}>
      <defs>
        <filter id="c-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="c-center">
          <stop offset="0%" stopColor="rgba(167,139,250,0.15)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0)" />
        </radialGradient>
      </defs>
      {/* Ambient glow */}
      <circle cx={cx} cy={cy} r={baseR + avgAmp * 40} fill="url(#c-center)" />
      <g transform={`rotate(${rotation}, ${cx}, ${cy})`}>
        <circle cx={cx} cy={cy} r={baseR} fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth={1.5} />
        {vis.map((v, i) => {
          const angle = (i / vis.length) * Math.PI * 2 - Math.PI / 2;
          const barLen = v * maxBarLen;
          const x1 = cx + Math.cos(angle) * baseR;
          const y1 = cy + Math.sin(angle) * baseR;
          const x2 = cx + Math.cos(angle) * (baseR + barLen);
          const y2 = cy + Math.sin(angle) * (baseR + barLen);
          const hue = 250 + (i / vis.length) * 70;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`hsla(${hue}, 80%, 72%, ${0.4 + v * 0.6})`}
              strokeWidth={3.5} strokeLinecap="round" filter="url(#c-glow)" />
          );
        })}
      </g>
    </svg>
  );
};

/* ═══════════════════════════════════════════════
   NEW PREMIUM STYLES
   ═══════════════════════════════════════════════ */

/* ─── glass: frosted glass bars with depth ─── */
const GlassBars: React.FC<VisProps> = ({ vis, width, height }) => {
  const barW = width / vis.length;
  const gap = Math.max(2, barW * 0.18);

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id="gl-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>
        <linearGradient id="gl-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="gl-refl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(167,139,250,0.15)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0)" />
        </linearGradient>
        <filter id="gl-blur">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <filter id="gl-shadow">
          <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
        </filter>
      </defs>
      {/* Subtle base line */}
      <rect x={0} y={height * 0.78} width={width} height={1} fill="rgba(255,255,255,0.08)" />
      {vis.map((v, i) => {
        const bH = v * height * 0.92;
        const x = i * barW + gap / 2;
        const w = Math.max(barW - gap, 3);
        const baseY = height * 0.78 - bH;
        return (
          <g key={i}>
            {/* Shadow */}
            <rect x={x + 2} y={baseY + 3} width={w} height={bH} fill="rgba(0,0,0,0.15)" rx={3} filter="url(#gl-blur)" />
            {/* Main glass body */}
            <rect x={x} y={baseY} width={w} height={bH} fill="url(#gl-face)" rx={3}
              stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} filter="url(#gl-shadow)" />
            {/* Left edge highlight (3D) */}
            <rect x={x} y={baseY} width={Math.max(w * 0.15, 1.5)} height={bH} fill="url(#gl-edge)" rx={2} />
            {/* Top shine */}
            <rect x={x + 1} y={baseY + 1} width={w - 2} height={Math.min(bH * 0.2, 8)}
              fill="rgba(255,255,255,0.4)" rx={2} />
            {/* Color tint at bottom */}
            <rect x={x} y={baseY + bH * 0.6} width={w} height={bH * 0.4}
              fill={`rgba(129,140,248,${v * 0.3})`} rx={2} />
            {/* Reflection below */}
            <rect x={x} y={height * 0.8} width={w} height={v * height * 0.15} fill="url(#gl-refl)" rx={1} />
          </g>
        );
      })}
    </svg>
  );
};

/* ─── aurora: layered flowing gradient waves ─── */
const Aurora: React.FC<VisProps> = ({ vis, width, height, frame }) => {
  const layers = [
    { color1: "rgba(129,140,248,0.6)", color2: "rgba(129,140,248,0)", yOffset: 0, speed: 1 },
    { color1: "rgba(196,132,252,0.45)", color2: "rgba(196,132,252,0)", yOffset: 0.1, speed: 1.3 },
    { color1: "rgba(244,114,182,0.35)", color2: "rgba(244,114,182,0)", yOffset: 0.2, speed: 0.8 },
    { color1: "rgba(99,102,241,0.5)", color2: "rgba(99,102,241,0)", yOffset: 0.05, speed: 1.1 },
  ];

  const buildPath = (layerIdx: number, yOff: number, speed: number) => {
    const step = width / (vis.length - 1);
    const midY = height * (0.55 + yOff);
    const phase = frame * 0.02 * speed + layerIdx * 1.5;

    const points: string[] = [];
    for (let i = 0; i < vis.length; i++) {
      const x = i * step;
      const wave = Math.sin(phase + i * 0.15) * 8;
      const amp = vis[i] * height * 0.45;
      const y = midY - amp + wave;
      if (i === 0) points.push(`M ${x},${y}`);
      else {
        const prevX = (i - 1) * step;
        const cpx = (prevX + x) / 2;
        const prevV = vis[i - 1];
        const prevWave = Math.sin(phase + (i - 1) * 0.15) * 8;
        const prevY = midY - prevV * height * 0.45 + prevWave;
        points.push(`C ${cpx},${prevY} ${cpx},${y} ${x},${y}`);
      }
    }
    points.push(`L ${width},${height} L 0,${height} Z`);
    return points.join(" ");
  };

  return (
    <svg width={width} height={height}>
      <defs>
        {layers.map((l, i) => (
          <linearGradient key={i} id={`au-g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={l.color1} />
            <stop offset="100%" stopColor={l.color2} />
          </linearGradient>
        ))}
        <filter id="au-soft">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {layers.map((l, i) => (
        <g key={i}>
          {/* Soft glow layer */}
          <path d={buildPath(i, l.yOffset, l.speed)} fill={`url(#au-g${i})`} filter="url(#au-soft)" opacity={0.6} />
          {/* Crisp layer */}
          <path d={buildPath(i, l.yOffset, l.speed)} fill={`url(#au-g${i})`} />
        </g>
      ))}
    </svg>
  );
};

/* ─── prism: 3D bars with top face + side face ─── */
const PrismBars: React.FC<VisProps> = ({ vis, width, height }) => {
  const barW = width / vis.length;
  const gap = Math.max(1, barW * 0.12);
  const depth = 6; // 3D depth offset

  return (
    <svg width={width} height={height}>
      <defs>
        <filter id="pr-sh">
          <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.25)" />
        </filter>
      </defs>
      {vis.map((v, i) => {
        const bH = v * height * 0.85;
        const x = i * barW + gap / 2;
        const w = Math.max(barW - gap, 3);
        const baseY = height - bH;
        const hue = (i / vis.length) * 300;
        const faceColor = `hsl(${hue}, 75%, 60%)`;
        const topColor = `hsl(${hue}, 75%, 78%)`;
        const sideColor = `hsl(${hue}, 75%, 42%)`;

        // Side face (right)
        const sidePoints = `${x + w},${baseY} ${x + w + depth},${baseY - depth} ${x + w + depth},${height - depth} ${x + w},${height}`;
        // Top face
        const topPoints = `${x},${baseY} ${x + depth},${baseY - depth} ${x + w + depth},${baseY - depth} ${x + w},${baseY}`;

        return (
          <g key={i} filter="url(#pr-sh)">
            {/* Front face */}
            <rect x={x} y={baseY} width={w} height={bH} fill={faceColor} />
            {/* Top face */}
            <polygon points={topPoints} fill={topColor} />
            {/* Right side */}
            <polygon points={sidePoints} fill={sideColor} />
            {/* Front highlight */}
            <rect x={x + 1} y={baseY + 1} width={w * 0.3} height={bH - 2}
              fill="rgba(255,255,255,0.15)" />
            {/* Top shine */}
            <polygon points={topPoints} fill="rgba(255,255,255,0.2)" />
          </g>
        );
      })}
    </svg>
  );
};

/* ─── pulse: concentric rings expanding from center ─── */
const PulseRings: React.FC<VisProps> = ({ vis, width, height, frame }) => {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy) * 0.95;
  const ringCount = 8;
  const avgAmp = vis.reduce((a, b) => a + b, 0) / vis.length;

  // Sample vis at different frequency bands for each ring
  const getRingAmp = (ringIdx: number) => {
    const bandStart = Math.floor((ringIdx / ringCount) * vis.length);
    const bandEnd = Math.floor(((ringIdx + 1) / ringCount) * vis.length);
    let sum = 0;
    for (let i = bandStart; i < bandEnd; i++) sum += vis[i];
    return sum / Math.max(bandEnd - bandStart, 1);
  };

  return (
    <svg width={width} height={height}>
      <defs>
        <radialGradient id="pu-bg">
          <stop offset="0%" stopColor="rgba(129,140,248,0.08)" />
          <stop offset="100%" stopColor="rgba(129,140,248,0)" />
        </radialGradient>
        <filter id="pu-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Background glow */}
      <circle cx={cx} cy={cy} r={maxR * (0.5 + avgAmp * 0.5)} fill="url(#pu-bg)" />
      {/* Rings */}
      {Array.from({ length: ringCount }).map((_, i) => {
        const amp = getRingAmp(i);
        const baseR = ((i + 1) / ringCount) * maxR;
        const expandPhase = frame * 0.04 + i * 0.5;
        const breathe = Math.sin(expandPhase) * amp * 8;
        const r = baseR + breathe;
        const hue = 240 + (i / ringCount) * 50;
        const thickness = 1.5 + amp * 3;
        const opacity = 0.15 + amp * 0.6;
        // Dash pattern that varies with amplitude
        const dashLen = 8 + amp * 20;
        const gapLen = 4 + (1 - amp) * 15;
        return (
          <circle key={i} cx={cx} cy={cy} r={Math.max(r, 5)}
            fill="none"
            stroke={`hsla(${hue}, 75%, 72%, ${opacity})`}
            strokeWidth={thickness}
            strokeDasharray={`${dashLen} ${gapLen}`}
            strokeDashoffset={frame * 0.5 + i * 20}
            strokeLinecap="round"
            filter="url(#pu-glow)"
          />
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4 + avgAmp * 8} fill="rgba(196,132,252,0.6)" filter="url(#pu-glow)" />
      <circle cx={cx} cy={cy} r={3 + avgAmp * 4} fill="rgba(255,255,255,0.8)" />
    </svg>
  );
};

/* ─── flame: fire columns rising from bottom ─── */
const Flame: React.FC<VisProps> = ({ vis, width, height, frame }) => {
  const barW = width / vis.length;

  const buildFlame = (i: number, v: number) => {
    const x = i * barW + barW / 2;
    const baseY = height;
    const flameH = v * height * 0.88;
    const w = barW * 0.7;
    const flicker = Math.sin(frame * 0.15 + i * 2) * 3 + Math.sin(frame * 0.23 + i * 3.7) * 2;
    const tipX = x + flicker;
    const tipY = baseY - flameH;

    return `M ${x - w / 2},${baseY}
      Q ${x - w * 0.3},${baseY - flameH * 0.4} ${tipX - w * 0.1},${tipY + flameH * 0.15}
      Q ${tipX},${tipY - 5} ${tipX + w * 0.1},${tipY + flameH * 0.15}
      Q ${x + w * 0.3},${baseY - flameH * 0.4} ${x + w / 2},${baseY} Z`;
  };

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id="fl-core" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="30%" stopColor="#f97316" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="90%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="white" />
        </linearGradient>
        <linearGradient id="fl-outer" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(220,38,38,0.6)" />
          <stop offset="50%" stopColor="rgba(249,115,22,0.3)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0)" />
        </linearGradient>
        <filter id="fl-glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="fl-soft">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {vis.map((v, i) => {
        if (v < 0.05) return null;
        return (
          <g key={i}>
            {/* Outer glow */}
            <path d={buildFlame(i, v * 1.15)} fill="url(#fl-outer)" filter="url(#fl-soft)" />
            {/* Main flame */}
            <path d={buildFlame(i, v)} fill="url(#fl-core)" filter="url(#fl-glow)" />
          </g>
        );
      })}
      {/* Base glow */}
      <rect x={0} y={height - 3} width={width} height={3}
        fill="rgba(249,115,22,0.3)" filter="url(#fl-soft)" />
    </svg>
  );
};

/* ─── symmetric: 대칭형 오디오 스펙트럼 — 가운데 줄 + 위아래 파동 ─── */
const SymmetricSpectrum: React.FC<VisProps> = ({ vis, width, height }) => {
  const midY = height / 2;
  const barW = width / vis.length;
  const gap = Math.max(2, barW * 0.15);
  const maxBarH = midY * 0.88;

  return (
    <svg width={width} height={height}>
      <defs>
        {/* 위쪽 바 그라디언트 */}
        <linearGradient id="sym-up" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(129,140,248,0.15)" />
          <stop offset="40%" stopColor="rgba(129,140,248,0.4)" />
          <stop offset="100%" stopColor="rgba(196,132,252,0.7)" />
        </linearGradient>
        {/* 아래쪽 바 그라디언트 */}
        <linearGradient id="sym-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(129,140,248,0.15)" />
          <stop offset="40%" stopColor="rgba(99,102,241,0.35)" />
          <stop offset="100%" stopColor="rgba(79,70,229,0.6)" />
        </linearGradient>
        {/* 글래스 배경 */}
        <linearGradient id="sym-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.01)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
        <filter id="sym-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sym-shadow">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(129,140,248,0.3)" />
        </filter>
      </defs>

      {/* 글래스 배경 박스 */}
      <rect x={0} y={0} width={width} height={height} rx={16} fill="url(#sym-bg)"
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />

      {/* 바들 */}
      {vis.map((v, i) => {
        const bH = v * maxBarH;
        const x = i * barW + gap / 2;
        const w = Math.max(barW - gap, 2);

        return (
          <g key={i}>
            {/* 위쪽 바 */}
            <rect x={x} y={midY - bH} width={w} height={bH}
              fill="url(#sym-up)" rx={w / 2} filter="url(#sym-shadow)" />
            {/* 위쪽 하이라이트 (상단) */}
            <rect x={x + 0.5} y={midY - bH} width={w - 1} height={Math.min(bH, 4)}
              fill="rgba(255,255,255,0.35)" rx={w / 2} />

            {/* 아래쪽 바 (미러) */}
            <rect x={x} y={midY} width={w} height={bH}
              fill="url(#sym-down)" rx={w / 2} filter="url(#sym-shadow)" />
            {/* 아래쪽 하이라이트 (하단) */}
            <rect x={x + 0.5} y={midY + bH - Math.min(bH, 4)} width={w - 1} height={Math.min(bH, 4)}
              fill="rgba(255,255,255,0.2)" rx={w / 2} />
          </g>
        );
      })}

      {/* 가운데 줄 — 글로우 */}
      <line x1={0} y1={midY} x2={width} y2={midY}
        stroke="rgba(167,139,250,0.5)" strokeWidth={1.5} filter="url(#sym-glow)" />
      {/* 가운데 줄 — 선명한 */}
      <line x1={0} y1={midY} x2={width} y2={midY}
        stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
    </svg>
  );
};
