"use client";

import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import type { TrackSlot, ShortsPreset } from "@/lib/types";
import { drawEqualizer, drawShortsPlayerBar, drawShortsLyrics, drawWatermark } from "@/lib/canvas-draw";
import { useAudioVisualizer } from "@/hooks/useAudioVisualizer";

const W = 270;
const H = 480;

export function ShortsPreview({
  slot, eqType, playerBarStyle = "iconic", watermarkStyle = "none", watermarkChannel, presets, lyrics,
}: {
  slot: TrackSlot | null;
  eqType: string;
  playerBarStyle?: string;
  watermarkStyle?: string;
  watermarkChannel?: string;
  presets: Set<ShortsPreset>;
  lyrics: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (slot?.imageUrl) {
      const img = new window.Image();
      img.src = slot.imageUrl;
      imgRef.current = img;
    } else {
      imgRef.current = null;
    }
  }, [slot?.imageUrl]);

  const { canvasRef, playing, start, stop } = useAudioVisualizer({
    width: W,
    height: H,
    drawFrame: ({ ctx, elapsed, freqData }) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const img = imgRef.current;
      if (img?.complete) ctx.drawImage(img, 0, 0, W, H);

      if (presets.has("eq")) drawEqualizer(ctx, eqType, freqData, W, H);
      if (presets.has("lyrics") && lyrics) drawShortsLyrics(ctx, lyrics, W, H, elapsed);
      if (presets.has("player-bar")) drawShortsPlayerBar(ctx, W, H, elapsed, playerBarStyle);
      if (watermarkStyle && watermarkStyle !== "none") {
        drawWatermark(ctx, W, H, elapsed, watermarkStyle, {
          channelName: watermarkChannel,
          trackTitle: slot?.fileName?.replace(/\.mp3$/i, ""),
        });
      }
    },
    deps: [slot?.imageUrl, eqType, playerBarStyle, watermarkStyle, watermarkChannel, presets, lyrics],
  });

  if (!slot?.imageUrl) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase">미리보기 (10초)</label>
        <button
          onClick={playing ? stop : () => start(slot.clipBlob ?? null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-500 bg-indigo-50 hover:bg-indigo-100"
        >
          {playing ? <><Pause className="w-3 h-3" /> 정지</> : <><Play className="w-3 h-3" /> 미리보기</>}
        </button>
      </div>
      <div className="flex justify-center">
        <canvas ref={canvasRef} className="rounded-xl bg-black" style={{ width: W, height: H }} />
      </div>
    </div>
  );
}
