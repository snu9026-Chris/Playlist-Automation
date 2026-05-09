"use client";

import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import type { OverlayItem } from "@/lib/types";
import { drawPresetOverlay, drawEqualizer } from "@/lib/canvas-draw";
import { useAudioVisualizer } from "@/hooks/useAudioVisualizer";

const W = 640;
const H = 360;

export function PreviewCanvas({
  images, overlays, audioFile, eqType,
}: {
  images: string[];
  overlays: OverlayItem[];
  audioFile?: File;
  eqType: string;
}) {
  const loadedImgs = useRef<HTMLImageElement[]>([]);
  const overlayImgs = useRef<Map<string, HTMLImageElement>>(new Map());

  // 이미지 사전 로드
  useEffect(() => {
    loadedImgs.current = images.map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
  }, [images]);

  // 오버레이 PNG 사전 로드 — 매 프레임에서 new Image() 만들던 거 제거
  useEffect(() => {
    const cache = overlayImgs.current;
    for (const ov of overlays) {
      if (ov.isPreset || !ov.previewUrl) continue;
      if (!cache.has(ov.id)) {
        const img = new window.Image();
        img.src = ov.previewUrl;
        cache.set(ov.id, img);
      }
    }
    // 더 이상 없는 오버레이는 제거
    const ids = new Set(overlays.map((o) => o.id));
    for (const key of cache.keys()) {
      if (!ids.has(key)) cache.delete(key);
    }
  }, [overlays]);

  const { canvasRef, playing, start, stop } = useAudioVisualizer({
    width: W,
    height: H,
    drawFrame: ({ ctx, elapsed, freqData }) => {
      const imgDuration = 3;
      const imgs = loadedImgs.current;
      const totalLoop = Math.max(1, imgs.length) * imgDuration;
      const t = elapsed % totalLoop;
      const imgIdx = imgs.length > 0 ? Math.floor(t / imgDuration) % imgs.length : 0;
      const nextIdx = imgs.length > 0 ? (imgIdx + 1) % imgs.length : 0;
      const progress = (t % imgDuration) / imgDuration;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const img1 = imgs[imgIdx];
      const img2 = imgs[nextIdx];
      if (img1?.complete) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img1, 0, 0, W, H);
        if (progress > 0.7 && img2?.complete) {
          ctx.globalAlpha = (progress - 0.7) / 0.3;
          ctx.drawImage(img2, 0, 0, W, H);
        }
      }
      ctx.globalAlpha = 1;

      drawEqualizer(ctx, eqType, freqData, W, H);

      const m = 15;
      for (const ov of overlays) {
        ctx.globalAlpha = ov.opacity / 100;

        if (ov.isPreset) {
          drawPresetOverlay(ctx, ov, W, H, m, elapsed);
          ctx.globalAlpha = 1;
          continue;
        }

        if (!ov.previewUrl || ov.name.match(/\.(mp4|mkv|webm|mov)$/i)) continue;
        const ovImg = overlayImgs.current.get(ov.id);
        if (!ovImg?.complete) continue;

        const baseW = W * 0.3 * ov.scale;
        const ratio = ovImg.naturalHeight / ovImg.naturalWidth;
        const targetW = Math.min(baseW, W * 0.8);
        const targetH = targetW * ratio;

        let ox = 0, oy = 0;
        if (ov.position.includes("l")) ox = m;
        else if (ov.position.includes("r")) ox = W - targetW - m;
        else ox = (W - targetW) / 2;
        if (ov.position.startsWith("t")) oy = m;
        else if (ov.position.startsWith("b")) oy = H - targetH - m;
        else oy = (H - targetH) / 2;

        ctx.drawImage(ovImg, ox, oy, targetW, targetH);
        ctx.globalAlpha = 1;
      }
    },
    deps: [images, overlays, eqType],
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase">미리보기 (10초)</label>
        <button
          onClick={playing ? stop : () => start(audioFile)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-500 bg-indigo-50 hover:bg-indigo-100"
        >
          {playing ? <><Pause className="w-3 h-3" /> 정지</> : <><Play className="w-3 h-3" /> 미리보기</>}
        </button>
      </div>
      <canvas ref={canvasRef} className="w-full aspect-video rounded-xl bg-black" />
    </div>
  );
}
