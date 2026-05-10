"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Wand2,
  Image as ImageIcon,
  Film,
  Music,
  Loader2,
  Check,
  Lock,
  GripVertical,
  RefreshCw,
  Download,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import type { Project, TrackSlot, EqualizerType, ShortsPreset } from "@/lib/types";
import { blobToBase64, compressImage } from "@/lib/image-utils";
import { ShortsPreview } from "@/components/shorts/ShortsPreview";
import { projectsApi } from "@/lib/api/projects";
import { imagesApi } from "@/lib/api/images";
import { useShorts } from "@/hooks/useShorts";
import { useToggleSet } from "@/hooks/useToggleSet";
import { useLocalState } from "@/hooks/useLocalState";

type ShortsEqType = EqualizerType;

export default function ShortsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const shorts = useShorts();
  const {
    selectedId, selectedTheme, slots, activeStep,
    analyzingAll, lyrics: shortsLyrics, setLyrics: setShortsLyrics,
    filledCount, analyzedCount, imagesReady,
    selectProject, reset, setFiles: handleFiles, reorderFilled,
    updateSlotById, analyzeAll, setActiveStep,
  } = shorts;

  // 프리셋 설정 — eq 스타일은 로컬 영속화, 활성 프리셋은 toggle Set
  const [shortsEqType, setShortsEqType] = useLocalState<ShortsEqType>("loopify_eq_type", "glass");
  const presetSet = useToggleSet<ShortsPreset>(["eq"]);
  const shortsPresets = presetSet.set;
  const togglePreset = presetSet.toggle;

  useEffect(() => {
    projectsApi.recent(20).then(setProjects).finally(() => setLoading(false));
  }, []);

  // 클립 다운로드
  const downloadClip = (slot: TrackSlot) => {
    if (!slot.clipBlob) return;
    const url = URL.createObjectURL(slot.clipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clip_${slot.slotIndex + 1}_${slot.fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 클립 재생
  const playClip = (slot: TrackSlot) => {
    if (!slot.clipBlob) return;

    if (playingIndex === slot.slotIndex) {
      audioRef.current?.pause();
      setPlayingIndex(null);
      return;
    }

    if (audioRef.current) audioRef.current.pause();
    const url = URL.createObjectURL(slot.clipBlob);
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.play();
    audio.onended = () => setPlayingIndex(null);
    audioRef.current = audio;
    setPlayingIndex(slot.slotIndex);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">숏폼 만들기</h1>
      </div>

      {/* 프로젝트 미선택 */}
      {!selectedId ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">프롬프트가 생성된 프로젝트를 선택하세요</p>
          {loading ? (
            <div className="animate-pulse pearl-card h-20" />
          ) : projects.length === 0 ? (
            <div className="pearl-card p-8 text-center">
              <Music className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">프로젝트가 없습니다</p>
              <Link href="/new" className="mt-3 inline-block text-sm text-indigo-500 hover:underline">
                새 프로젝트 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className="pearl-card p-5 text-left hover:shadow-md transition-all"
                >
                  <h3 className="font-semibold text-gray-900 truncate">{p.theme}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={reset}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> 프로젝트 다시 선택
            </button>
            <span className="text-sm font-medium text-gray-500">{selectedTheme}</span>
          </div>

          {/* ───── Step 1: Suno MP3 업로드 (브라우저 로컬) ───── */}
          <div className="pearl-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                filledCount === 15 ? "bg-emerald-500 text-white" : "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
              }`}>
                {filledCount === 15 ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Suno 음원 로드</h3>
                <p className="text-xs text-gray-400">mp3 파일을 선택하세요 (서버에 업로드되지 않음, 브라우저에서만 처리)</p>
              </div>
              <span className="ml-auto text-xs tabular-nums text-gray-400">{filledCount}/15</span>
            </div>

            {/* 파일 리스트 (드래그 정렬 가능) */}
            <SortableFileList
              slots={slots}
              onFilesAdded={handleFiles}
              onReorder={reorderFilled}
            />
          </div>

          {/* ───── Step 2: 클라이맥스 분석 + 추출 ───── */}
          <div className={`pearl-card p-5 space-y-4 ${filledCount === 0 ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                analyzedCount === filledCount && filledCount > 0
                  ? "bg-emerald-500 text-white"
                  : filledCount > 0
                  ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                  : "bg-pearl-200 text-gray-400"
              }`}>
                {analyzedCount === filledCount && filledCount > 0 ? <Check className="w-4 h-4" /> : filledCount === 0 ? <Lock className="w-3 h-3" /> : "2"}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">클라이맥스 추출</h3>
                <p className="text-xs text-gray-400">각 곡에서 에너지 가장 높은 20초를 브라우저에서 분석·추출합니다</p>
              </div>
              <span className="ml-auto text-xs tabular-nums text-gray-400">{analyzedCount}/{filledCount}</span>
            </div>

            {filledCount > 0 && (
              <button
                onClick={analyzeAll}
                disabled={filledCount === 0 || analyzingAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
              >
                {analyzingAll ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중... ({analyzedCount}/{filledCount})</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> {filledCount}곡 분석 + 추출</>
                )}
              </button>
            )}

            {/* 분석 결과 리스트 */}
            {analyzedCount > 0 && (
              <div className="space-y-2">
                {slots.filter((s) => s.clip).map((s) => (
                  <div key={s.slotIndex} className="flex items-center gap-3 px-4 py-3 bg-pearl-50 rounded-lg">
                    <span className="text-xs font-bold tabular-nums text-gray-400 w-6">#{s.slotIndex + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.fileName}</p>
                      <p className="text-xs text-gray-400 tabular-nums">
                        {s.clip!.clipStart.toFixed(1)}s ~ {s.clip!.clipEnd.toFixed(1)}s
                        <span className="ml-2 text-gray-300">({s.clip!.duration.toFixed(0)}초 원곡)</span>
                      </p>
                    </div>

                    {/* 재생 */}
                    <button
                      onClick={() => playClip(s)}
                      className="p-2 rounded-lg hover:bg-pearl-200 transition-colors"
                    >
                      {playingIndex === s.slotIndex ? (
                        <Pause className="w-4 h-4 text-indigo-500" />
                      ) : (
                        <Play className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* 다운로드 */}
                    <button
                      onClick={() => downloadClip(s)}
                      className="p-2 rounded-lg hover:bg-pearl-200 transition-colors"
                      title="클립 다운로드"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 분석 중 개별 상태 */}
            {analyzingAll && (
              <div className="space-y-1">
                {slots.filter((s) => s.file && !s.clip).map((s) => (
                  <div key={s.slotIndex} className="flex items-center gap-2 text-xs text-gray-400">
                    {s.analyzing ? (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-pearl-200" />
                    )}
                    #{s.slotIndex + 1} {s.fileName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ───── Step 3: 이미지 생성 (Gemini) ───── */}
          <ImageGenStep
            enabled={analyzedCount > 0}
            projectId={selectedId}
            theme={selectedTheme}
            slots={slots}
            onImageGenerated={(slotId, url) => {
              updateSlotById(slotId, { imageUrl: url });
            }}
          />

          {/* ───── Step 3.5: 프리셋 설정 + 미리보기 ───── */}
          <div className={`pearl-card p-5 space-y-4 ${imagesReady === 0 ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                imagesReady > 0 ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white" : "bg-pearl-200 text-gray-400"
              }`}>
                {imagesReady === 0 ? <Lock className="w-3 h-3" /> : "⚙️"}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">효과 설정 + 미리보기</h3>
                <p className="text-xs text-gray-400">이퀄라이저, 가사, 컨트롤바를 설정하고 미리보기를 확인하세요</p>
              </div>
            </div>

            {imagesReady > 0 && (
              <>
                {/* 이퀄라이저 스타일 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">이퀄라이저 스타일</p>
                  <div className="flex gap-2">
                    {(["glass", "symmetric", "circle", "pulse"] as ShortsEqType[]).map(t => {
                      const labels: Record<ShortsEqType, string> = { glass: "글래스", symmetric: "대칭", circle: "원형", pulse: "펄스" };
                      return (
                        <button key={t} onClick={() => setShortsEqType(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            shortsEqType === t
                              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                              : "bg-pearl-100 text-gray-500 hover:bg-pearl-200"
                          }`}>
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 프리셋 토글 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">오버레이 프리셋</p>
                  <div className="flex gap-2">
                    {([
                      { id: "eq" as ShortsPreset, label: "이퀄라이저", icon: "🎵" },
                      { id: "player-bar" as ShortsPreset, label: "재생 컨트롤러", icon: "🎛️" },
                      { id: "lyrics" as ShortsPreset, label: "가사", icon: "📝" },
                    ]).map(p => (
                      <button key={p.id} onClick={() => togglePreset(p.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          shortsPresets.has(p.id)
                            ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                            : "bg-pearl-100 text-gray-500 hover:bg-pearl-200"
                        }`}>
                        <span>{p.icon}</span> {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 가사 입력 (가사 프리셋 활성 시) — 안정 id 기준 매핑 */}
                {shortsPresets.has("lyrics") && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">가사 입력 (곡별)</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {slots.filter(s => s.imageUrl).map(s => (
                        <div key={s.id} className="flex items-start gap-2">
                          <span className="text-[10px] font-bold tabular-nums text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded mt-1">#{s.slotIndex + 1}</span>
                          <textarea
                            value={shortsLyrics[s.id] || ""}
                            onChange={(e) => setShortsLyrics(prev => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="가사를 입력하세요 (줄바꿈으로 구분)"
                            rows={2}
                            className="flex-1 px-3 py-2 rounded-lg border border-pearl-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 미리보기 (첫 번째 이미지 준비된 슬롯) */}
                {(() => {
                  const previewSlot = slots.find(s => s.imageUrl) ?? null;
                  return (
                    <ShortsPreview
                      slot={previewSlot}
                      eqType={shortsEqType}
                      presets={shortsPresets}
                      lyrics={previewSlot ? (shortsLyrics[previewSlot.id] || "") : ""}
                    />
                  );
                })()}
              </>
            )}
          </div>

          {/* ───── Step 4: 영상 렌더링 (로컬 서버) ───── */}
          <RenderStep
            enabled={imagesReady > 0}
            slots={slots}
            projectId={selectedId}
            eqType={shortsEqType}
            presets={shortsPresets}
            lyrics={shortsLyrics}
          />

          {/* 메타데이터는 렌더링 시 자동 생성됨 */}
        </div>
      )}
    </div>
  );
}

/* ─── 드래그 정렬 파일 리스트 ─── */
function SortableFileList({
  slots,
  onFilesAdded,
  onReorder,
}: {
  slots: TrackSlot[];
  onFilesAdded: (files: FileList) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const filled = slots.filter((s) => s.file);

  return (
    <div className="space-y-1 min-h-[60px]">
      {filled.length === 0 ? (
        <label
          className="cursor-pointer flex items-center gap-3 px-4 py-6 border-2 border-dashed border-pearl-300 rounded-lg hover:border-indigo-300 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onFilesAdded(e.dataTransfer.files); }}
        >
          <input type="file" accept=".mp3,audio/mpeg" multiple className="hidden"
            onChange={(e) => e.target.files && onFilesAdded(e.target.files)} />
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">mp3 파일을 드래그하거나 클릭해서 선택</span>
        </label>
      ) : (
        <>
          <p className="text-[10px] text-gray-400 mb-1">드래그로 순서 변경 → 프롬프트 번호와 매칭됩니다</p>
          {filled.map((s, listIdx) => (
            <div
              key={`${s.slotIndex}-${s.fileName}`}
              draggable
              onDragStart={() => setDragIdx(listIdx)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(listIdx); }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== listIdx) onReorder(dragIdx, listIdx);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                overIdx === listIdx ? "bg-indigo-50 ring-2 ring-indigo-300" :
                dragIdx === listIdx ? "opacity-40 bg-pearl-100" : "bg-pearl-50 hover:bg-pearl-100"
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0">
                <Music className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                #{listIdx + 1}
              </span>
              <span className="text-sm text-gray-700 truncate flex-1">{s.fileName}</span>
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
          ))}
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-indigo-500 transition-colors mt-1">
            <input type="file" accept=".mp3,audio/mpeg" multiple className="hidden"
              onChange={(e) => e.target.files && onFilesAdded(e.target.files)} />
            <Upload className="w-3 h-3" /> 더 추가
          </label>
        </>
      )}
    </div>
  );
}

/* ─── Step 3: 프롬프트 추천 → (편집) → 이미지 생성 ───
 * 이 컴포넌트는 두 단계로 동작한다.
 *  1) "프롬프트 추천 받기": 슬롯별 가사·스타일을 Gemini에 보내 한국어 프롬프트를 채운다 (이미지는 아직 안 만듦)
 *  2) "이미지 생성": 사용자가 textarea에서 편집한 프롬프트를 영문 변환 후 Imagen으로 9:16 생성
 * 슬롯별 "재추천" 버튼은 1)만, "재생성" 버튼은 2)만 다시 호출한다.
 */
function ImageGenStep({
  enabled,
  projectId,
  theme: _theme,
  slots,
  onImageGenerated,
}: {
  enabled: boolean;
  projectId: string;
  theme: string;
  slots: TrackSlot[];
  onImageGenerated: (slotId: string, url: string) => void;
}) {
  // 슬롯별 한국어 프롬프트 (안정 키 slot.id 기준)
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [recommending, setRecommending] = useState(false);
  const [recommendingSlotId, setRecommendingSlotId] = useState<string | null>(null);
  const [recommendCount, setRecommendCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generatingSlotId, setGeneratingSlotId] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slotsWithFiles = slots.filter((s) => s.file);
  const totalSlots = slotsWithFiles.length;
  const promptedCount = slotsWithFiles.filter((s) => (prompts[s.id] || "").trim()).length;
  const imgReady = slots.filter((s) => s.imageUrl).length;
  const canGenerate = promptedCount > 0;

  const setPrompt = (slotId: string, value: string) => {
    setPrompts((prev) => ({ ...prev, [slotId]: value }));
  };

  // 슬롯 1개 추천. 성공 시 prompts state에 채움.
  const recommendOne = async (slot: TrackSlot) => {
    setRecommendingSlotId(slot.id);
    try {
      const data = await imagesApi.recommendPrompt({
        projectId,
        slotIndex: slot.slotIndex,
        trackName: slot.fileName.replace(/\.mp3$/i, ""),
      });
      if (data.prompt) {
        setPrompt(slot.id, data.prompt);
        setErrors((prev) => {
          const { [slot.id]: _, ...rest } = prev;
          return rest;
        });
      } else if (data.error) {
        setErrors((prev) => ({ ...prev, [slot.id]: data.error! }));
      }
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [slot.id]: e.message }));
    } finally {
      setRecommendingSlotId(null);
    }
  };

  // 모든 슬롯에 대해 추천
  const recommendAll = async () => {
    setRecommending(true);
    setRecommendCount(0);
    setErrors({});
    for (const slot of slotsWithFiles) {
      await recommendOne(slot);
      setRecommendCount((c) => c + 1);
    }
    setRecommending(false);
  };

  // 슬롯 1개 이미지 생성. 슬롯의 현재 prompts[slot.id] 값을 사용.
  const generateOne = async (slot: TrackSlot) => {
    const promptText = (prompts[slot.id] || "").trim();
    if (!promptText) return;
    setGeneratingSlotId(slot.id);
    try {
      const data = await imagesApi.generate({
        projectId,
        slotIndex: slot.slotIndex,
        prompt: promptText,
      });
      if (data.imageUrl) {
        onImageGenerated(slot.id, data.imageUrl);
        setErrors((prev) => {
          const { [slot.id]: _, ...rest } = prev;
          return rest;
        });
      } else if (data.error) {
        setErrors((prev) => ({ ...prev, [slot.id]: data.error! }));
      }
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [slot.id]: e.message }));
    } finally {
      setGeneratingSlotId(null);
    }
  };

  // 프롬프트가 채워진 슬롯 전체 이미지 생성
  const generateAll = async () => {
    setGenerating(true);
    setGeneratedCount(0);
    const targets = slotsWithFiles.filter((s) => (prompts[s.id] || "").trim());
    for (const slot of targets) {
      await generateOne(slot);
      setGeneratedCount((c) => c + 1);
    }
    setGenerating(false);
  };

  return (
    <div className={`pearl-card p-5 space-y-4 ${!enabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          imgReady === totalSlots && totalSlots > 0
            ? "bg-emerald-500 text-white"
            : !enabled
            ? "bg-pearl-200 text-gray-400"
            : "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
        }`}>
          {imgReady === totalSlots && totalSlots > 0 ? <Check className="w-4 h-4" /> : !enabled ? <Lock className="w-3 h-3" /> : "3"}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">이미지 생성</h3>
          <p className="text-xs text-gray-400">프롬프트 추천 받기 → 검토·편집 → 이미지 생성</p>
        </div>
        {totalSlots > 0 && (
          <span className="ml-auto text-xs tabular-nums text-gray-400">{imgReady}/{totalSlots}</span>
        )}
      </div>

      {enabled && (
        <>
          {/* 단계 A: 프롬프트 추천 / 단계 B: 이미지 생성 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={recommendAll}
              disabled={recommending || totalSlots === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
            >
              {recommending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 추천 중... ({recommendCount}/{totalSlots})</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {totalSlots}곡 프롬프트 추천 받기</>
              )}
            </button>

            <button
              onClick={generateAll}
              disabled={generating || !canGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
              title={!canGenerate ? "먼저 프롬프트를 추천받거나 직접 입력하세요" : ""}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중... ({generatedCount}/{promptedCount})</>
              ) : (
                <><ImageIcon className="w-4 h-4" /> {promptedCount}장 이미지 생성</>
              )}
            </button>

            {!canGenerate && totalSlots > 0 && (
              <span className="text-[11px] text-gray-400">먼저 프롬프트 추천을 받으세요</span>
            )}
          </div>

          {/* 슬롯별 프롬프트 + 결과 카드 */}
          {totalSlots > 0 && (
            <div className="space-y-2">
              {slotsWithFiles.map((s) => {
                const promptText = prompts[s.id] || "";
                const isRecommendingThis = recommendingSlotId === s.id;
                const isGeneratingThis = generatingSlotId === s.id;
                const err = errors[s.id];
                return (
                  <div key={s.id} className="flex gap-3 items-start px-3 py-3 bg-pearl-50 rounded-lg">
                    {/* 좌: 미리보기 (이미지 있으면) */}
                    <div className="w-20 shrink-0">
                      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-pearl-200 border border-pearl-200">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-pearl-300" />
                          </div>
                        )}
                        <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                          #{s.slotIndex + 1}
                        </span>
                      </div>
                    </div>

                    {/* 우: 트랙명 + 프롬프트 textarea + 액션 */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-xs font-medium text-gray-700 truncate">{s.fileName}</p>
                      <textarea
                        value={promptText}
                        onChange={(e) => setPrompt(s.id, e.target.value)}
                        placeholder="프롬프트를 추천받거나 직접 입력하세요 (한국어)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-pearl-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none bg-white"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => recommendOne(s)}
                          disabled={isRecommendingThis || recommending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                          title="이 슬롯 프롬프트 다시 추천"
                        >
                          {isRecommendingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {promptText ? "재추천" : "추천 받기"}
                        </button>
                        <button
                          onClick={() => generateOne(s)}
                          disabled={isGeneratingThis || generating || !promptText.trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                          title="현재 프롬프트로 이미지 생성"
                        >
                          {isGeneratingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : s.imageUrl ? <RefreshCw className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                          {s.imageUrl ? "다시 그리기" : "이미지 생성"}
                        </button>
                        {err && (
                          <span className="text-[10px] text-red-500 truncate max-w-[300px]" title={err}>
                            ⚠ {err}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Step 4: Vercel 서버 렌더링 ─── */
function RenderStep({
  enabled,
  slots,
  projectId,
  eqType,
  presets,
  lyrics,
}: {
  enabled: boolean;
  slots: TrackSlot[];
  projectId: string;
  eqType: string;
  presets: Set<ShortsPreset>;
  /** key는 TrackSlot.id (안정 키). slotIndex 사용 금지. */
  lyrics: Record<string, string>;
}) {
  const [renderUrl, setRenderUrl] = useLocalState("loopify_render_url", "http://localhost:4100");
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderedCount, setRenderedCount] = useState(0);
  const [videos, setVideos] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const readySlots = slots.filter((s) => s.clipBlob && s.imageUrl);
  const doneCount = Object.keys(videos).length;

  // Cloudflare Tunnel URL 우선 — start.bat → start-with-tunnel.mjs가 Supabase에 push한 값을 사용.
  // 못 받으면 localStorage에 저장된 기본값(localhost:4100)으로 폴백 (로컬 dev 환경 대응).
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/render-url")
      .then((r) => r.json())
      .then((d) => { if (d.url) setRenderUrl(d.url); })
      .catch(() => { /* 폴백: 기존 renderUrl 유지 */ });
  }, [enabled, setRenderUrl]);

  // 렌더 서버 상태 3초 폴링. start.bat 켜지면 곧 ✓ 표시.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${renderUrl}/health`);
        const data = await res.json();
        setServerOk(data.status === "ok");
      } catch {
        setServerOk(false);
      }
    };
    ping();
    const id = setInterval(ping, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled, renderUrl]);

  const compressShortsImage = (dataUrl: string) => compressImage(dataUrl, 540, 960, 0.8);

  const renderAll = async () => {
    // 클릭 시점에도 한 번 더 확인 (폴링과 클릭 사이 race 방지)
    try {
      const h = await fetch(`${renderUrl}/health`);
      const hd = await h.json();
      if (hd.status !== "ok") throw new Error();
      setServerOk(true);
    } catch {
      setServerOk(false);
      // 자동 폴링이 곧 다시 감지하므로 alert 대신 차분한 인라인 메시지로 처리
      return;
    }

    setRendering(true);
    setRenderedCount(0);
    setErrors({});

    for (const slot of readySlots) {
      try {
        const audioBase64 = await blobToBase64(slot.clipBlob!);
        const imageBase64 = await compressShortsImage(slot.imageUrl!);

        const res = await fetch(`${renderUrl}/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            imageBase64,
            slotIndex: slot.slotIndex,
            trackTitle: slot.fileName,
            subtitle: presets.has("lyrics") ? (lyrics[slot.id] || "") : "",
            eqType: presets.has("eq") ? eqType : "none",
            showPlayerBar: presets.has("player-bar"),
          }),
        });

        const data = await res.json();
        if (data.success) {
          setVideos((prev) => ({ ...prev, [slot.slotIndex]: data.fileName ?? "done" }));
        } else {
          setErrors((prev) => ({ ...prev, [slot.slotIndex]: data.error ?? "렌더링 실패" }));
        }
      } catch (e: any) {
        setErrors((prev) => ({ ...prev, [slot.slotIndex]: e.message }));
      }
      setRenderedCount((c) => c + 1);
    }

    // 렌더링 완료 후 메타데이터 자동 생성
    try {
      await fetch(`/api/projects/${projectId}/metadata`, { method: "POST" });
    } catch {}

    setRendering(false);
  };

  /**
   * 렌더 결과를 사용자 PC로 받고 → 받은 직후 서버 측 파일 삭제 (디스크 누적 방지).
   * Why: window.open 방식은 다운로드 완료 시점을 알 수 없어 삭제 타이밍을 못 잡았음.
   *      fetch→blob→a.click 패턴으로 바꿔 다운로드 트리거 직후 DELETE 호출.
   */
  const downloadVideo = async (slotIndex: number) => {
    const fileName = videos[slotIndex];
    if (!fileName) return;

    if (fileName.startsWith("data:")) {
      // data URL — 서버 파일 없음, 삭제 단계 생략
      const a = document.createElement("a");
      a.href = fileName;
      a.download = `shorts_${slotIndex + 1}.mp4`;
      a.click();
      return;
    }

    try {
      const res = await fetch(`${renderUrl}/download/${fileName}`);
      if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      // 다운로드 성공 → 서버 파일 정리 (실패해도 무시 — 사용자에겐 이미 받았음)
      fetch(`${renderUrl}/download/${fileName}`, { method: "DELETE" }).catch(() => {});

      // 로컬 state에서도 슬롯의 파일명 제거 — 같은 영상 두 번 받으려는 시도 방지
      setVideos((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
    } catch (e) {
      console.error("Download failed:", e);
      // fallback — 새 창에서 시도
      window.open(`${renderUrl}/download/${fileName}`, "_blank");
    }
  };

  return (
    <div className={`pearl-card p-5 space-y-4 ${!enabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          doneCount === readySlots.length && readySlots.length > 0
            ? "bg-emerald-500 text-white"
            : !enabled
            ? "bg-pearl-200 text-gray-400"
            : "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
        }`}>
          {doneCount === readySlots.length && readySlots.length > 0
            ? <Check className="w-4 h-4" />
            : !enabled ? <Lock className="w-3 h-3" /> : "4"}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">영상 렌더링</h3>
          <p className="text-xs text-gray-400">이미지 + 클립 + 이퀄라이저 → Remotion 렌더링 (1080x1920, 20초)</p>
        </div>
        {readySlots.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-gray-400">{doneCount}/{readySlots.length}</span>
        )}
      </div>

      {enabled && (
        <>
          {/* 서버 상태 자동 표시 — 3초마다 polling */}
          <div className="flex items-center gap-2 text-xs">
            {serverOk === true ? (
              <span className="text-emerald-500 font-medium">✓ 로컬 렌더 서버 연결됨</span>
            ) : serverOk === false ? (
              <span className="text-amber-600">
                ⏳ 로컬 렌더 서버 대기 중 — <span className="font-mono">start.bat</span> 실행하면 자동 감지됩니다
              </span>
            ) : (
              <span className="text-gray-400">서버 상태 확인 중…</span>
            )}
            <button
              onClick={() => setShowUrlInput((v) => !v)}
              className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 underline"
            >
              {showUrlInput ? "URL 숨기기" : "URL 변경"}
            </button>
          </div>

          {showUrlInput && (
            <input
              type="text"
              value={renderUrl}
              onChange={(e) => setRenderUrl(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-pearl-200 w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          )}

          <button
            onClick={renderAll}
            disabled={rendering || readySlots.length === 0 || !serverOk}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
          >
            {rendering ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 렌더링 중... ({renderedCount}/{readySlots.length})</>
            ) : (
              <><Film className="w-4 h-4" /> {readySlots.length}개 영상 렌더링</>
            )}
          </button>

          {/* 결과 */}
          {(doneCount > 0 || Object.keys(errors).length > 0) && (
            <div className="space-y-1">
              {Object.entries(videos).map(([idx, fileName]) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-pearl-50 rounded-lg">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-sm text-gray-700 flex-1">#{Number(idx) + 1} 렌더링 완료</span>
                  <span className="text-[10px] font-mono text-gray-400 truncate max-w-[180px]">{fileName}</span>
                  <button
                    onClick={() => downloadVideo(Number(idx))}
                    className="text-xs px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-medium"
                  >
                    다운로드
                  </button>
                </div>
              ))}
              {Object.entries(errors).map(([idx, err]) => (
                <div key={`e-${idx}`} className="flex items-center gap-3 px-3 py-2 bg-red-50 rounded-lg">
                  <span className="text-xs text-red-500">#{Number(idx) + 1} 실패: {err}</span>
                </div>
              ))}
              {doneCount > 0 && (
                <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600">다운로드 완료 시 서버에서 자동 정리됩니다.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


