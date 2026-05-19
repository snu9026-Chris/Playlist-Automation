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
import { ShortsPreview } from "@/components/shorts/ShortsPreview";
import { projectsApi } from "@/lib/api/projects";
import { imagesApi } from "@/lib/api/images";
import { useShorts } from "@/hooks/useShorts";
import { useToggleSet } from "@/hooks/useToggleSet";
import { useLocalState } from "@/hooks/useLocalState";
import { renderShortsFrames } from "@/lib/shorts-frame-renderer";
import { encodeShortsMp4, warmupFFmpeg } from "@/lib/ffmpeg-shorts";
import { createBrowserClient } from "@/lib/supabase";

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
    extractingLyrics, extractingAllLyrics,
    filledCount, analyzedCount, imagesReady,
    selectProject, reset, setFiles: handleFiles, reorderFilled,
    updateSlotById, analyzeAll, setActiveStep,
    extractLyricsForSlot, extractAllLyrics,
  } = shorts;

  // 프리셋 설정 — eq 스타일은 로컬 영속화, 활성 프리셋은 toggle Set
  const [shortsEqType, setShortsEqType] = useLocalState<ShortsEqType>("loopify_eq_type", "white");
  // 2026-05 EQ 리뉴얼 — 옛 값(glass/circle/pulse/symmetric)이 localStorage에 남아있으면 "white"로 마이그레이션
  useEffect(() => {
    if (shortsEqType !== "white" && shortsEqType !== "neon" && shortsEqType !== "color") {
      setShortsEqType("white");
    }
  }, [shortsEqType, setShortsEqType]);
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
                    {(["white", "neon", "color"] as ShortsEqType[]).map(t => {
                      const labels: Record<ShortsEqType, string> = { white: "화이트 글래스", neon: "네온 글로우", color: "컬러 그라데이션" };
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-500">가사 입력 (곡별)</p>
                      {/* 일괄 자동 추출 — 클립이 준비된 슬롯들만 대상 */}
                      <button
                        type="button"
                        disabled={extractingAllLyrics || slots.filter(s => s.clipBlob).length === 0}
                        onClick={async () => {
                          const hasAny = slots.some(s => s.clipBlob && (shortsLyrics[s.id] || "").trim());
                          if (hasAny) {
                            const ok = window.confirm("이미 입력된 가사가 있습니다. 자동 추출 결과로 덮어쓸까요?");
                            if (!ok) return;
                          }
                          await extractAllLyrics();
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="Gemini 멀티모달로 mp3 클립에서 가사 받아쓰기"
                      >
                        {extractingAllLyrics ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            추출 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            모든 곡 가사 자동 추출
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {slots.filter(s => s.imageUrl).map(s => {
                        const isExtracting = extractingLyrics.has(s.id);
                        const canExtract = !!s.clipBlob;
                        return (
                          <div key={s.id} className="flex items-start gap-2">
                            <span className="text-[10px] font-bold tabular-nums text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded mt-1">#{s.slotIndex + 1}</span>
                            <textarea
                              value={shortsLyrics[s.id] || ""}
                              onChange={(e) => setShortsLyrics(prev => ({ ...prev, [s.id]: e.target.value }))}
                              placeholder="가사를 입력하세요 (줄바꿈으로 구분)"
                              rows={2}
                              className="flex-1 px-3 py-2 rounded-lg border border-pearl-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                            />
                            <button
                              type="button"
                              disabled={!canExtract || isExtracting || extractingAllLyrics}
                              onClick={async () => {
                                const existing = (shortsLyrics[s.id] || "").trim();
                                if (existing) {
                                  const ok = window.confirm("이 곡의 기존 가사를 자동 추출 결과로 덮어쓸까요?");
                                  if (!ok) return;
                                }
                                await extractLyricsForSlot(s.id);
                              }}
                              title={canExtract ? "이 곡 가사 자동 추출" : "클립 분석이 먼저 필요합니다"}
                              className="p-1.5 rounded-md hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mt-0.5"
                            >
                              {isExtracting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                              )}
                            </button>
                          </div>
                        );
                      })}
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
  // 직접 업로드 — AI 생성 대신 파일을 9:16 중앙 크롭해서 슬롯에 매핑
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const slotsWithFiles = slots.filter((s) => s.file);
  const totalSlots = slotsWithFiles.length;
  const promptedCount = slotsWithFiles.filter((s) => (prompts[s.id] || "").trim()).length;
  const imgReady = slots.filter((s) => s.imageUrl).length;
  const canGenerate = promptedCount > 0;

  // 업로드 이미지를 1080×1920 9:16으로 중앙 크롭. 가로/세로/정사각 모두 받아 일그러짐 없이 변환.
  const cropTo9x16 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("이미지 디코드 실패"));
        img.onload = () => {
          const TW = 1080, TH = 1920;
          const targetRatio = TW / TH;
          const srcRatio = img.width / img.height;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (srcRatio > targetRatio) {
            sw = img.height * targetRatio;
            sx = (img.width - sw) / 2;
          } else if (srcRatio < targetRatio) {
            sh = img.width / targetRatio;
            sy = (img.height - sh) / 2;
          }
          const canvas = document.createElement("canvas");
          canvas.width = TW;
          canvas.height = TH;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas 2D context 사용 불가"));
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TW, TH);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  // 선택된 파일들을 슬롯 순서대로 매핑. 슬롯 수 초과분은 무시.
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, slotsWithFiles.length);
    setUploading(true);
    setUploadedCount(0);
    setErrors({});
    for (let i = 0; i < files.length; i++) {
      const slot = slotsWithFiles[i];
      try {
        const dataUrl = await cropTo9x16(files[i]);
        onImageGenerated(slot.id, dataUrl);
      } catch (e: any) {
        setErrors((prev) => ({ ...prev, [slot.id]: e?.message || "업로드 실패" }));
      }
      setUploadedCount(i + 1);
    }
    setUploading(false);
    // 같은 파일 다시 선택할 수 있도록 input 초기화
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

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

            {/* AI 생성 대신 직접 업로드 — 곡 순서대로 슬롯에 자동 매핑되고 9:16 중앙 크롭됨 */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading || totalSlots === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-pearl-200 text-gray-700 text-sm font-semibold hover:bg-pearl-50 disabled:opacity-50 shadow-sm"
              title="가지고 있는 이미지를 직접 올려서 슬롯에 매핑 (9:16 중앙 크롭)"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> 업로드 중... ({uploadedCount}/{totalSlots})</>
              ) : (
                <><Upload className="w-4 h-4 text-emerald-500" /> 이미지 업로드</>
              )}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />

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

/* ─── Step 4: 브라우저 wasm 렌더링 ───
 * 사용자 PC에서 직접 ffmpeg.wasm으로 인코딩 (서버 비용 0, Vercel 호환).
 * 결과 mp4는 메모리 Blob — "저장"으로 PC 다운로드, "예약 발행"으로 Supabase Storage 업로드 + cron 큐.
 */
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
  type SlotPhase = "frames" | "encoding";
  const [rendering, setRendering] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<{ slotIndex: number; phase: SlotPhase; ratio: number } | null>(null);
  // slotIndex → mp4 Blob (메모리에 저장. 페이지 떠나면 휘발.)
  const [videos, setVideos] = useState<Record<number, Blob>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  // 메타데이터 — generateMetadata 호출 후 채워짐 (예약 발행 시 title/desc/tags 소스)
  const [tracksMeta, setTracksMeta] = useState<Record<number, { title?: string; description?: string; tags?: string[] }>>({});
  // 예약 발행 UI 상태
  const [scheduleUiSlot, setScheduleUiSlot] = useState<number | null>(null);
  const [scheduleAtBySlot, setScheduleAtBySlot] = useState<Record<number, string>>({});
  const [scheduledMark, setScheduledMark] = useState<Record<number, string>>({}); // slotIndex → ISO 시각

  const readySlots = slots.filter((s) => s.clipBlob && s.imageUrl);
  const doneCount = Object.keys(videos).length;

  // 페이지 진입 시 wasm core 미리 받기 (UI 안 막음)
  useEffect(() => {
    if (!enabled) return;
    warmupFFmpeg().catch((e) => console.error("ffmpeg warmup failed:", e));
  }, [enabled]);

  const renderAll = async () => {
    setRendering(true);
    setErrors({});

    for (const slot of readySlots) {
      try {
        // 1) 프레임 추출 (실시간 20초 — 음소거 재생 + RAF)
        setCurrentPhase({ slotIndex: slot.slotIndex, phase: "frames", ratio: 0 });
        const frames = await renderShortsFrames({
          audioBlob: slot.clipBlob!,
          imageUrl: slot.imageUrl!,
          eqType: presets.has("eq") ? eqType : "none",
          presets: presets as Set<string>,
          lyrics: presets.has("lyrics") ? (lyrics[slot.id] || "") : "",
          onProgress: (r) => setCurrentPhase({ slotIndex: slot.slotIndex, phase: "frames", ratio: r }),
        });

        // 2) wasm 인코딩
        setCurrentPhase({ slotIndex: slot.slotIndex, phase: "encoding", ratio: 0 });
        const mp4 = await encodeShortsMp4({
          frames,
          audio: slot.clipBlob!,
          onProgress: (r) => setCurrentPhase({ slotIndex: slot.slotIndex, phase: "encoding", ratio: r }),
        });

        setVideos((prev) => ({ ...prev, [slot.slotIndex]: mp4 }));
      } catch (e) {
        console.error(`render failed slot ${slot.slotIndex}:`, e);
        setErrors((prev) => ({ ...prev, [slot.slotIndex]: e instanceof Error ? e.message : String(e) }));
      }
    }

    // 메타데이터 자동 생성 + 캐시
    try {
      await projectsApi.generateMetadata(projectId);
      const tracks = await projectsApi.tracks(projectId);
      const map: Record<number, { title?: string; description?: string; tags?: string[] }> = {};
      for (const t of tracks ?? []) {
        if (typeof t.slot_index === "number") {
          map[t.slot_index] = { title: t.title, description: t.description, tags: t.tags };
        }
      }
      setTracksMeta(map);
    } catch (e) {
      console.error("metadata fetch failed:", e);
    }

    setCurrentPhase(null);
    setRendering(false);
  };

  // PC 저장 — Blob을 즉시 다운로드
  const saveToPc = (slotIndex: number) => {
    const blob = videos[slotIndex];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shorts_${slotIndex + 1}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 예약 발행 — Storage 업로드 + scheduled_uploads INSERT
  const schedulePublish = async (slotIndex: number) => {
    const blob = videos[slotIndex];
    const scheduledAtLocal = scheduleAtBySlot[slotIndex];
    if (!blob || !scheduledAtLocal) return;

    const meta = tracksMeta[slotIndex] ?? {};
    if (!meta.title) {
      setErrors((prev) => ({ ...prev, [slotIndex]: "메타데이터 없음 — 잠시 후 다시 시도" }));
      return;
    }

    try {
      // Storage 업로드 — anon key + media bucket RLS는 마이그레이션 #3에서 anon 자유 허용
      const supabase = createBrowserClient();
      const uuid = crypto.randomUUID();
      const videoPath = `scheduled/${uuid}.mp4`;

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(videoPath, blob, { contentType: "video/mp4", upsert: false });
      if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

      // scheduled_uploads INSERT (기존 API 재사용)
      const res = await fetch(`/api/uploads/scheduled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath,
          title: meta.title,
          description: meta.description ?? "",
          tags: meta.tags ?? [],
          scheduledAt: new Date(scheduledAtLocal).toISOString(),
          projectId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(`Schedule API: ${d.error ?? res.statusText}`);
      }

      setScheduledMark((prev) => ({ ...prev, [slotIndex]: scheduledAtLocal }));
      setScheduleUiSlot(null);
      // 메모리 절약: 예약 완료 시 Blob 해제 (Storage에 이미 있음)
      setVideos((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
    } catch (e) {
      console.error(`schedule failed slot ${slotIndex}:`, e);
      setErrors((prev) => ({ ...prev, [slotIndex]: e instanceof Error ? e.message : String(e) }));
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
          <p className="text-xs text-gray-400">브라우저에서 직접 인코딩 (1080×1920, 20초). 서버 안 거침.</p>
        </div>
        {readySlots.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-gray-400">{doneCount}/{readySlots.length}</span>
        )}
      </div>

      {enabled && (
        <>
          <p className="text-[11px] text-amber-600 leading-relaxed">
            ⚠️ 렌더링 중에는 <span className="font-mono">이 탭을 활성 상태로</span> 두세요 (백그라운드 시 오디오 분석이 느려져 결과가 깨질 수 있습니다)
          </p>

          <button
            onClick={renderAll}
            disabled={rendering || readySlots.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm"
          >
            {rendering ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 렌더링 중...</>
            ) : (
              <><Film className="w-4 h-4" /> {readySlots.length}개 영상 렌더링</>
            )}
          </button>

          {/* 현재 진행 중인 슬롯 표시 */}
          {currentPhase && (
            <div className="px-3 py-2 bg-indigo-50 rounded-lg space-y-1.5">
              <p className="text-xs text-indigo-700 font-medium">
                #{currentPhase.slotIndex + 1} —{" "}
                {currentPhase.phase === "frames" ? "프레임 추출 중 (실시간 20초)" : "wasm 인코딩 중"}
              </p>
              <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                  style={{ width: `${Math.round(currentPhase.ratio * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* 슬롯별 결과 */}
          {(doneCount > 0 || Object.keys(errors).length > 0 || Object.keys(scheduledMark).length > 0) && (
            <div className="space-y-1.5">
              {readySlots.map((s) => {
                const idx = s.slotIndex;
                const blob = videos[idx];
                const scheduled = scheduledMark[idx];
                const err = errors[idx];
                if (!blob && !scheduled && !err) return null;

                return (
                  <div key={s.id} className="px-3 py-2.5 bg-pearl-50 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-2">
                      {scheduled ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : err ? (
                        <span className="text-red-500 text-xs">⚠</span>
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">#{idx + 1}</span>
                      <span className="text-sm text-gray-700 truncate flex-1">{s.fileName}</span>

                      {scheduled ? (
                        <span className="text-[11px] text-emerald-600 font-medium">
                          예약됨 · {formatScheduledTime(scheduled)}
                        </span>
                      ) : blob ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveToPc(idx)}
                            className="text-xs px-3 py-1 rounded-lg bg-pearl-200 text-gray-700 hover:bg-pearl-300 transition-colors font-medium"
                            title="PC에 저장"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setScheduleUiSlot(scheduleUiSlot === idx ? null : idx)}
                            className="text-xs px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-medium"
                          >
                            예약 발행
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* 예약 입력 인라인 패널 */}
                    {scheduleUiSlot === idx && blob && (
                      <div className="flex items-center gap-2 pl-6">
                        <input
                          type="datetime-local"
                          value={scheduleAtBySlot[idx] ?? defaultScheduleTime()}
                          onChange={(e) => setScheduleAtBySlot((prev) => ({ ...prev, [idx]: e.target.value }))}
                          className="text-xs px-2 py-1 rounded border border-pearl-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => schedulePublish(idx)}
                          className="text-xs px-3 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
                        >
                          확정
                        </button>
                        <button
                          onClick={() => setScheduleUiSlot(null)}
                          className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    )}

                    {err && <p className="text-[11px] text-red-500 pl-6">{err}</p>}
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

/** datetime-local input의 기본값 — 현재 + 1시간을 "YYYY-MM-DDTHH:MM" 포맷으로 */
function defaultScheduleTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduledTime(localStr: string): string {
  const d = new Date(localStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


