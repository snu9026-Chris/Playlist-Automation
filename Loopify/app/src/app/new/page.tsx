"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  Copy,
  RefreshCw,
  Loader2,
  Sparkles,
  ArrowLeft,
  Music,
} from "lucide-react";
import { bookmarksApi } from "@/lib/api/bookmarks";
import { projectsApi } from "@/lib/api/projects";
import { apiFetch } from "@/lib/api/client";

export default function NewProjectPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>}>
      <NewProjectPage />
    </Suspense>
  );
}

interface BookmarkItem {
  id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  image_url: string | null;
  audio_features: any;
}

interface TrackAnalysis {
  title: string;
  artist: string;
  analysis: string;
  themes: string[];
}

interface PromptItem {
  index: number;
  style: string;
  lyrics: string;
  genre: string;
  mood: string;
  source_track: string;
}

function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBookmarks = searchParams.get("from") === "bookmarks";

  const [step, setStep] = useState(1);

  // Step 1: References (테마 키워드 제거)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selected, setSelected] = useState<BookmarkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2: Per-track analysis + slide
  const [trackAnalyses, setTrackAnalyses] = useState<TrackAnalysis[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedThemes, setSelectedThemes] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState(false);

  // Step 3: Prompts (곡당 N개씩 = 총 15개)
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load bookmarks
  useEffect(() => {
    bookmarksApi.list().then((data) => {
      // BookmarkItem과 BookmarkRow는 호환됨 (audio_features, image_url 등)
      setBookmarks(data as unknown as BookmarkItem[]);
      if (fromBookmarks) setSelected(data as unknown as BookmarkItem[]);
    });
  }, [fromBookmarks]);

  const toggleSelect = (b: BookmarkItem) => {
    setSelected((prev) =>
      prev.some((s) => s.id === b.id)
        ? prev.filter((s) => s.id !== b.id)
        : prev.length < 15
        ? [...prev, b]
        : prev
    );
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // 곡당 프롬프트 수 계산
  const promptsPerTrack = selected.length > 0 ? Math.max(1, Math.round(15 / selected.length)) : 3;
  const totalPrompts = Math.min(15, selected.length * promptsPerTrack);

  // Step 1 → Step 2: GPT 곡별 분석
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const data = await apiFetch<{ tracks?: TrackAnalysis[] }>("/api/gpt/analyze", {
        method: "POST",
        json: {
          tracks: selected.map((s) => ({
            title: s.title,
            artist: s.artist,
            audio_features: s.audio_features,
          })),
        },
      });
      const analyses = data.tracks ?? [];
      setTrackAnalyses(analyses);
      setSlideIndex(0);
      // 각 곡의 첫 번째 테마를 기본 선택
      const defaults: Record<number, string> = {};
      analyses.forEach((a: TrackAnalysis, i: number) => {
        if (a.themes?.[0]) defaults[i] = a.themes[0];
      });
      setSelectedThemes(defaults);
      setStep(2);
      scrollToTop();
    } catch {
      alert("분석에 실패했습니다. OpenAI API 키를 확인해 주세요.");
    } finally {
      setAnalyzing(false);
    }
  };

  // 전체 선택된 테마 문자열
  const combinedTheme = Object.values(selectedThemes).filter(Boolean).join(", ");

  // Step 2 → Step 3: 프롬프트 생성 (곡당 N개)
  const generatePrompts = async () => {
    setGenerating(true);
    try {
      const tracksWithThemes = selected.map((s, i) => ({
        title: s.title,
        artist: s.artist,
        audio_features: s.audio_features,
        theme: selectedThemes[i] ?? "",
        analysis: trackAnalyses[i]?.analysis ?? "",
      }));

      const data = await apiFetch<{ prompts?: PromptItem[] }>("/api/gpt/prompts", {
        method: "POST",
        json: {
          tracks: tracksWithThemes,
          theme: combinedTheme,
          promptsPerTrack,
        },
      });
      setPrompts(data.prompts ?? []);
      setStep(3);
      scrollToTop();
    } catch {
      alert("프롬프트 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  // 프로젝트 생성
  const createProject = async () => {
    setCreating(true);
    try {
      const data = await projectsApi.create({
        theme: combinedTheme,
        reference_tracks: selected.map((s) => ({
          spotify_track_id: s.spotify_track_id,
          title: s.title,
          artist: s.artist,
          image_url: s.image_url,
          audio_features: s.audio_features,
        })),
        prompts,
      });
      router.push(`/projects/${data.id}`);
    } catch {
      alert("프로젝트 생성에 실패했습니다");
    } finally {
      setCreating(false);
    }
  };

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드
        </button>
        <h1 className="text-xl font-bold text-gray-900">새 프로젝트</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4">
        {[
          { n: 1, label: "레퍼런스 선정" },
          { n: 2, label: "분석 + 테마" },
          { n: 3, label: "프롬프트 생성" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step > n
                  ? "bg-emerald-500 text-white"
                  : step === n
                  ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                  : "bg-pearl-200 text-gray-400"
              }`}
            >
              {step > n ? <Check className="w-4 h-4" /> : n}
            </div>
            <span className={`text-sm font-medium ${step >= n ? "text-gray-900" : "text-gray-400"}`}>
              {label}
            </span>
            {n < 3 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ───── Step 1: 레퍼런스 선정 ───── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-900">
                레퍼런스 선정 ({selected.length}곡)
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                3곡 이상 선택 · 곡당 {promptsPerTrack}개 프롬프트 = 총 {totalPrompts}개
              </p>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="px-3 py-1.5 rounded-lg border border-pearl-200 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-[480px] overflow-y-auto">
            {filteredBookmarks.map((b) => {
              const isSelected = selected.some((s) => s.id === b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleSelect(b)}
                  className={`pearl-card flex items-center gap-3 p-3 text-left transition-all ${
                    isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50" : "hover:shadow-md"
                  }`}
                >
                  {b.image_url && (
                    <img src={b.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.title}</p>
                    <p className="text-xs text-gray-400 truncate">{b.artist}</p>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {bookmarks.length === 0 && (
            <div className="pearl-card p-8 text-center">
              <Music className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">북마크가 없습니다</p>
              <button
                onClick={() => router.push("/explore")}
                className="mt-3 text-sm text-indigo-500 hover:underline"
              >
                트렌드 탐색에서 곡을 담아주세요
              </button>
            </div>
          )}

          {/* 안내 */}
          {selected.length > 0 && selected.length < 3 && (
            <p className="text-xs text-gray-400">
              {3 - selected.length}곡 더 선택해 주세요
            </p>
          )}

          <button
            onClick={runAnalysis}
            disabled={selected.length < 3 || analyzing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {selected.length}곡 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {selected.length}곡 분석하기
              </>
            )}
          </button>
        </div>
      )}

      {/* ───── Step 2: 곡별 분석 슬라이드 ───── */}
      {step === 2 && trackAnalyses.length > 0 && (
        <div className="space-y-6">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            곡 다시 선택
          </button>

          {/* 슬라이드 인디케이터 */}
          <div className="flex items-center gap-2">
            {trackAnalyses.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === slideIndex ? "w-8 bg-indigo-500" : "w-2 bg-pearl-300 hover:bg-pearl-200"
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-gray-400 tabular-nums">
              {slideIndex + 1} / {trackAnalyses.length}
            </span>
          </div>

          {/* 슬라이드 카드 */}
          {(() => {
            const ta = trackAnalyses[slideIndex];
            const sel = selected[slideIndex];
            if (!ta) return null;
            return (
              <div className="pearl-card p-6 space-y-4">
                {/* 곡 정보 헤더 */}
                <div className="flex items-center gap-4">
                  {sel?.image_url && (
                    <img src={sel.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{ta.title}</h3>
                    <p className="text-sm text-gray-500">{ta.artist}</p>
                  </div>
                  <span className="ml-auto text-xs font-semibold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                    #{slideIndex + 1}
                  </span>
                </div>

                {/* 인기 구조 분석 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    인기 구조
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{ta.analysis}</p>
                </div>

                {/* 테마 선택 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">테마 방향</h4>
                  <div className="flex flex-wrap gap-2">
                    {ta.themes.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedThemes((prev) => ({ ...prev, [slideIndex]: t }))}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedThemes[slideIndex] === t
                            ? "bg-indigo-500 text-white shadow-sm"
                            : "bg-pearl-100 text-gray-600 hover:bg-pearl-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 슬라이드 네비게이션 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              disabled={slideIndex === 0}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              이전 곡
            </button>
            {slideIndex < trackAnalyses.length - 1 ? (
              <button
                onClick={() => setSlideIndex((i) => i + 1)}
                className="flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-700 font-medium"
              >
                다음 곡
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-xs text-emerald-500 font-medium">전체 분석 완료</span>
            )}
          </div>

          {/* 선택 요약 + 생성 버튼 */}
          <div className="pearl-card p-4 space-y-3">
            <p className="text-xs text-gray-400">
              {selected.length}곡 × {promptsPerTrack}개 = 총 {totalPrompts}개 프롬프트
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((s, i) => (
                <span
                  key={s.id}
                  onClick={() => setSlideIndex(i)}
                  className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                    i === slideIndex
                      ? "bg-indigo-500 text-white"
                      : selectedThemes[i]
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-pearl-100 text-gray-500"
                  }`}
                >
                  {selectedThemes[i] ? "✓ " : ""}{s.title}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={generatePrompts}
            disabled={Object.keys(selectedThemes).length < selected.length || generating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                프롬프트 생성 중...
              </>
            ) : (
              <>
                프롬프트 {totalPrompts}개 생성
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ───── Step 3: 프롬프트 15개 ───── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              테마 수정
            </button>
            <button
              onClick={generatePrompts}
              disabled={generating}
              className="flex items-center gap-1 text-sm text-indigo-500 hover:underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              전체 재생성
            </button>
          </div>

          <h3 className="font-semibold text-gray-900">
            Suno 프롬프트 ({prompts.length}개)
            <span className="text-sm font-normal text-gray-400 ml-2">테마: {combinedTheme}</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {prompts.map((p, i) => (
              <PromptCard
                key={i}
                prompt={p}
                onChange={(updated) => {
                  setPrompts((prev) => prev.map((pp, j) => (j === i ? updated : pp)));
                }}
              />
            ))}
          </div>

          <button
            onClick={createProject}
            disabled={prompts.length === 0 || creating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              "프로젝트 생성"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  onChange,
}: {
  prompt: PromptItem;
  onChange: (p: PromptItem) => void;
}) {
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [styleText, setStyleText] = useState(prompt.style);
  const [lyricsText, setLyricsText] = useState(prompt.lyrics);
  const [expanded, setExpanded] = useState(false);

  const copyAll = () => {
    const full = `Style: ${prompt.style}\n\n${prompt.lyrics}`;
    navigator.clipboard.writeText(full);
  };

  const copyStyle = () => navigator.clipboard.writeText(prompt.style);
  const copyLyrics = () => navigator.clipboard.writeText(prompt.lyrics);

  return (
    <div className="pearl-card p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white bg-indigo-500 w-6 h-6 rounded-full flex items-center justify-center">
            {prompt.index + 1}
          </span>
          {prompt.source_track && (
            <span className="text-xs text-indigo-500 truncate max-w-[150px]">
              ← {prompt.source_track}
            </span>
          )}
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 px-2 py-1 rounded hover:bg-pearl-100"
          title="전체 복사"
        >
          <Copy className="w-3 h-3" />
          전체
        </button>
      </div>

      {/* 태그 */}
      <div className="flex flex-wrap gap-1">
        <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{prompt.genre}</span>
        <span className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">{prompt.mood}</span>
      </div>

      {/* Style */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Style</span>
          <button onClick={copyStyle} className="text-[10px] text-gray-400 hover:text-indigo-500">복사</button>
        </div>
        {editingStyle ? (
          <textarea
            value={styleText}
            onChange={(e) => setStyleText(e.target.value)}
            onBlur={() => {
              setEditingStyle(false);
              onChange({ ...prompt, style: styleText });
            }}
            className="w-full text-xs border border-pearl-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={2}
            autoFocus
          />
        ) : (
          <p
            onClick={() => setEditingStyle(true)}
            className="text-xs text-gray-600 bg-pearl-50 rounded-lg px-3 py-2 cursor-text hover:bg-pearl-100 leading-relaxed"
          >
            {prompt.style}
          </p>
        )}
      </div>

      {/* Lyrics */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lyrics</span>
          <div className="flex items-center gap-2">
            <button onClick={copyLyrics} className="text-[10px] text-gray-400 hover:text-indigo-500">복사</button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-indigo-500"
            >
              {expanded ? "접기" : "펼치기"}
            </button>
          </div>
        </div>
        {editingLyrics ? (
          <textarea
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            onBlur={() => {
              setEditingLyrics(false);
              onChange({ ...prompt, lyrics: lyricsText });
            }}
            className="w-full text-xs border border-pearl-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            rows={12}
            autoFocus
          />
        ) : (
          <pre
            onClick={() => setEditingLyrics(true)}
            className={`text-xs text-gray-600 bg-pearl-50 rounded-lg px-3 py-2 cursor-text hover:bg-pearl-100 whitespace-pre-wrap font-sans leading-relaxed ${
              expanded ? "" : "max-h-32 overflow-hidden"
            }`}
          >
            {prompt.lyrics}
          </pre>
        )}
      </div>
    </div>
  );
}
