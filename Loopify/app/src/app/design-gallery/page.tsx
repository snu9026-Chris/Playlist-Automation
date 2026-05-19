"use client";

/**
 * 디자인 갤러리 — 이퀄라이저 4종 + 플레이어바 4종 시안을 라이브 미리보기로 보여주고
 * 사용자가 클릭해 선택하면 localStorage에 저장. 숏폼/롱폼에서 자동 반영.
 */
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { drawEqualizer, drawPlayerPill, drawWatermark, simulateFreqData } from "@/lib/canvas-draw";
import { useLocalState } from "@/hooks/useLocalState";
import type { EqualizerType, PlayerBarStyle, WatermarkStyle } from "@/lib/types";
import { EQ_LABELS, PLAYER_BAR_LABELS, WATERMARK_LABELS } from "@/lib/types";
import PageHeader from "@/components/layout/PageHeader";

const EQ_TYPES: EqualizerType[] = ["spike", "neon-dots", "neon-ring", "neon-rotor", "neon-arc"];
const PLAYER_STYLES: PlayerBarStyle[] = ["iconic", "minimal"];
const WATERMARK_STYLES: WatermarkStyle[] = [
  "none", "rotating-circle", "marquee", "minimal-line", "dot-progress",
];

export default function DesignGalleryPage() {
  const [eqType, setEqType] = useLocalState<EqualizerType>("loopify_eq_type", "spike");
  const [playerStyle, setPlayerStyle] = useLocalState<PlayerBarStyle>("loopify_player_bar_style", "iconic");
  const [watermarkStyle, setWatermarkStyle] = useLocalState<WatermarkStyle>("loopify_watermark_style", "none");
  const [watermarkChannel, setWatermarkChannel] = useLocalState<string>("loopify_watermark_channel", "");

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="space-y-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">디자인 갤러리</h1>
          <p className="text-sm text-gray-500">
            이퀄라이저와 플레이어 컨트롤러 디자인을 골라 보세요. 선택한 디자인은 즉시 숏폼/롱폼 작업에 적용됩니다.
          </p>
        </header>

        {/* 이퀄라이저 갤러리 */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-gray-900">이퀄라이저</h2>
            <p className="text-xs text-gray-400">현재 선택: <span className="font-semibold text-indigo-600">{EQ_LABELS[eqType]}</span></p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {EQ_TYPES.map((t) => (
              <EqCard
                key={t}
                type={t}
                label={EQ_LABELS[t]}
                selected={eqType === t}
                onSelect={() => setEqType(t)}
              />
            ))}
          </div>
        </section>

        {/* 플레이어바 갤러리 */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-gray-900">플레이어 컨트롤러</h2>
            <p className="text-xs text-gray-400">현재 선택: <span className="font-semibold text-indigo-600">{PLAYER_BAR_LABELS[playerStyle]}</span></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLAYER_STYLES.map((s) => (
              <PlayerCard
                key={s}
                style={s}
                label={PLAYER_BAR_LABELS[s]}
                selected={playerStyle === s}
                onSelect={() => setPlayerStyle(s)}
              />
            ))}
          </div>
        </section>

        {/* 워터마크 갤러리 */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-gray-900">워터마크</h2>
            <p className="text-xs text-gray-400">현재 선택: <span className="font-semibold text-indigo-600">{WATERMARK_LABELS[watermarkStyle]}</span></p>
          </div>
          {/* 채널명 입력 */}
          <div className="bg-pearl-50 rounded-lg px-4 py-3 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">채널명 / 텍스트</label>
            <input
              type="text"
              value={watermarkChannel}
              onChange={(e) => setWatermarkChannel(e.target.value)}
              placeholder="예: Mocca's playlist, Music for Every Moment"
              className="flex-1 px-3 py-1.5 rounded-md border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-gray-400">비워두면 시안 기본값 사용</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {WATERMARK_STYLES.map((s) => (
              <WatermarkCard
                key={s}
                style={s}
                label={WATERMARK_LABELS[s]}
                channelName={watermarkChannel}
                selected={watermarkStyle === s}
                onSelect={() => setWatermarkStyle(s)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── 이퀄라이저 카드 — 작은 캔버스로 라이브 simulation ── */
function EqCard({ type, label, selected, onSelect }: { type: EqualizerType; label: string; selected: boolean; onSelect: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 180; // 그리기 좌표계
  const H = 280;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const startTime = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      // 어두운 배경 (커버 이미지 흉내)
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(99,102,241,0.06)";
      ctx.fillRect(0, 0, W, H);

      const freqData = simulateFreqData(32, elapsed);
      drawEqualizer(ctx, type, freqData, W, H);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [type]);

  return (
    <button
      onClick={onSelect}
      className={`relative rounded-xl p-2 border transition-all text-left bg-white ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-200 shadow-md"
          : "border-pearl-200 hover:border-indigo-300 hover:shadow-sm"
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="rounded-lg overflow-hidden bg-black mb-1.5">
        <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `${W}/${H}`, display: "block" }} />
      </div>
      <p className="text-xs font-medium text-gray-700 px-0.5 truncate">{label}</p>
    </button>
  );
}

/* ── 플레이어바 카드 — 작은 캔버스로 라이브 simulation ── */
function PlayerCard({ style, label, selected, onSelect }: { style: PlayerBarStyle; label: string; selected: boolean; onSelect: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 440;
  const H = 160;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const startTime = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      // 배경 — 부드러운 그라데이션 (커버 이미지 흉내)
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#312e81");
      grad.addColorStop(0.5, "#5b21b6");
      grad.addColorStop(1, "#7c3aed");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // 미세한 노이즈/패턴 흉내 (어두운 도트)
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let i = 0; i < 30; i++) {
        const dx = ((i * 73) % W);
        const dy = ((i * 113) % H);
        ctx.beginPath(); ctx.arc(dx, dy, 1.2, 0, Math.PI * 2); ctx.fill();
      }

      // 플레이어바 가운데 정렬
      const barW = W * 0.62;
      const barH = H * 0.62;
      const x = (W - barW) / 2;
      const y = (H - barH) / 2;
      drawPlayerPill(ctx, x, y, barW, barH, elapsed, style);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [style]);

  return (
    <button
      onClick={onSelect}
      className={`relative rounded-2xl p-3 border transition-all text-left bg-white ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-200 shadow-md"
          : "border-pearl-200 hover:border-indigo-300 hover:shadow-sm"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className="rounded-xl overflow-hidden bg-black mb-2">
        <canvas ref={canvasRef} style={{ width: W, height: H, display: "block" }} />
      </div>
      <p className="text-sm font-semibold text-gray-800 px-1">{label}</p>
    </button>
  );
}

/* ── 워터마크 카드 — 9:16 미니 캔버스에 라이브 simulation ── */
function WatermarkCard({ style, label, channelName, selected, onSelect }: {
  style: WatermarkStyle; label: string; channelName: string;
  selected: boolean; onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 200;
  const H = 320;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const startTime = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      // 따뜻한 톤 배경 (커버 이미지 흉내)
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#f97316");
      grad.addColorStop(0.5, "#ea580c");
      grad.addColorStop(1, "#7c2d12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // 옅은 그라데이션 오버레이
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, W, H);

      // 워터마크
      drawWatermark(ctx, W, H, elapsed, style, {
        channelName: channelName || undefined,
        trackTitle: "Sunshine Paradise",
        trackList: ["Sunshine Paradise", "Fool Me Once", "The Middle", "Catch Me"],
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [style, channelName]);

  return (
    <button
      onClick={onSelect}
      className={`relative rounded-xl p-2 border transition-all text-left bg-white ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-200 shadow-md"
          : "border-pearl-200 hover:border-indigo-300 hover:shadow-sm"
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="rounded-lg overflow-hidden bg-black mb-1.5">
        <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `${W}/${H}`, display: "block" }} />
      </div>
      <p className="text-xs font-medium text-gray-700 px-0.5 truncate">{label}</p>
    </button>
  );
}
