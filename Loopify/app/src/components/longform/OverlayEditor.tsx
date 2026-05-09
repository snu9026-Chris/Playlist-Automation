"use client";

import { Trash2 } from "lucide-react";
import type { OverlayItem, OverlayPosition } from "@/lib/types";
import { LONGFORM_PRESETS, POSITION_LABELS } from "@/lib/types";

export function OverlayEditor({
  overlays, setOverlays,
}: {
  overlays: OverlayItem[];
  setOverlays: React.Dispatch<React.SetStateAction<OverlayItem[]>>;
}) {
  const presetList = LONGFORM_PRESETS;

  const addPreset = (p: typeof presetList[number]) => {
    setOverlays((prev) => [...prev, {
      id: `preset_${Date.now()}`,
      file: null, name: p.label, previewUrl: "",
      position: p.defaultPos, scale: p.defaultScale, opacity: 90,
      timing: p.defaultTiming, timingSeconds: 10, chromakey: "none",
      isPreset: true, preset: p.id, channelName: "",
    }]);
  };

  const updateOverlay = (id: string, updates: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((o) => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-gray-500 uppercase">오버레이 프리셋</label>

      <div className="grid grid-cols-3 gap-2">
        {presetList.map((p) => (
          <button key={p.id} onClick={() => addPreset(p)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-pearl-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
            <span className="text-2xl">{p.icon}</span>
            <span className="text-[11px] font-medium text-gray-700">{p.label}</span>
          </button>
        ))}
      </div>

      {overlays.length > 0 && (
        <div className="space-y-3">
          {overlays.map((o) => (
            <div key={o.id} className="pearl-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-pearl-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {o.isPreset ? (
                    <span className="text-2xl">{presetList.find(p => p.id === o.preset)?.icon || "✨"}</span>
                  ) : (
                    <img src={o.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {o.isPreset && <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded mr-2">프리셋</span>}
                    {o.name}
                  </p>
                  {o.isPreset && (o.preset === "watermark" || o.preset === "end-screen") && (
                    <input type="text" value={o.channelName || ""}
                      onChange={(e) => updateOverlay(o.id, { channelName: e.target.value })}
                      placeholder="채널명 입력"
                      className="mt-1 text-xs px-2 py-1 rounded border border-pearl-200 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  )}
                </div>
                <button onClick={() => removeOverlay(o.id)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">위치</label>
                  <div className="grid grid-cols-3 gap-1 w-24">
                    {(["tl","tc","tr","ml","mc","mr","bl","bc","br"] as OverlayPosition[]).map((pos) => (
                      <button key={pos} onClick={() => updateOverlay(o.id, { position: pos })}
                        className={`w-7 h-7 rounded text-[8px] transition-all ${
                          o.position === pos ? "bg-indigo-500 text-white" : "bg-pearl-100 text-gray-400 hover:bg-pearl-200"
                        }`}>
                        {POSITION_LABELS[pos]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-400">크기 ({Math.round(o.scale * 100)}%)</label>
                    <input type="range" min="20" max="200" value={o.scale * 100}
                      onChange={(e) => updateOverlay(o.id, { scale: Number(e.target.value) / 100 })}
                      className="w-full h-1 accent-indigo-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">투명도 ({o.opacity}%)</label>
                    <input type="range" min="10" max="100" value={o.opacity}
                      onChange={(e) => updateOverlay(o.id, { opacity: Number(e.target.value) })}
                      className="w-full h-1 accent-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400">표시:</label>
                {(["always", "first", "last"] as const).map((t) => (
                  <button key={t} onClick={() => updateOverlay(o.id, { timing: t })}
                    className={`px-2 py-1 rounded text-[10px] transition-all ${
                      o.timing === t ? "bg-indigo-500 text-white" : "bg-pearl-100 text-gray-500"
                    }`}>
                    {t === "always" ? "항상" : t === "first" ? "처음" : "마지막"}
                  </button>
                ))}
                {o.timing !== "always" && (
                  <input type="number" value={o.timingSeconds} min={1} max={60}
                    onChange={(e) => updateOverlay(o.id, { timingSeconds: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded border border-pearl-200 text-[10px] text-center" />
                )}
                {o.timing !== "always" && <span className="text-[10px] text-gray-400">초</span>}
              </div>

              {o.name.match(/\.(mp4|mkv|webm|mov|gif)$/i) && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">배경 제거:</label>
                  {(["none", "black", "green"] as const).map((ck) => (
                    <button key={ck} onClick={() => updateOverlay(o.id, { chromakey: ck })}
                      className={`px-2 py-1 rounded text-[10px] transition-all ${
                        o.chromakey === ck ? "bg-indigo-500 text-white" : "bg-pearl-100 text-gray-500"
                      }`}>
                      {ck === "none" ? "없음" : ck === "black" ? "검정 제거" : "초록 제거"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
