"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Loader2, Lock, Film } from "lucide-react";
import type { ReferenceTrack, SunoPrompt } from "@/lib/database.types";
import { projectsApi } from "@/lib/api/projects";

interface PlaylistProject {
  id: string;
  theme: string;
  status: string;
  reference_tracks: ReferenceTrack[];
  prompts: SunoPrompt[];
  shorts_status: string;
  shorts_youtube_urls: string[];
  created_at: string;
}

interface PlaylistTrack {
  id: string;
  project_id: string;
  slot_index: number;
  upload_status: string;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<PlaylistProject | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pData, tData] = await Promise.all([
        projectsApi.get(id),
        projectsApi.tracks(id),
      ]);
      setProject(pData as PlaylistProject);
      setTracks(tData as PlaylistTrack[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 진행 중인 업로드가 있으면 5초마다 폴링
  useEffect(() => {
    const hasProcessing = tracks.some((t) => t.upload_status === "uploading");
    if (!hasProcessing) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [tracks, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-16 text-gray-400">프로젝트를 찾을 수 없습니다</div>;
  }

  const totalProgress = tracks.length > 0
    ? Math.round((tracks.filter((t) => t.upload_status === "completed").length / tracks.length) * 100)
    : 0;

  return (
    <div className="flex gap-8">
      {/* 좌측 단계 네비게이터 */}
      <nav className="w-48 shrink-0 sticky top-0 self-start space-y-1">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-pearl-50 transition-colors"
        >
          <span>&larr;</span> 대시보드
        </a>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-indigo-50 text-indigo-700 font-semibold">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Copy className="w-3 h-3" />
          </div>
          프롬프트
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-pearl-100">
            <Lock className="w-3 h-3" />
          </div>
          이후 단계는 숏폼/업로드 페이지
        </div>
      </nav>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 space-y-8 min-w-0">
        {/* 상단 헤더 */}
        <div className="p-6 rounded-xl bg-white border border-pearl-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{project.theme}</h1>
              <p className="text-sm text-gray-400 mt-1">
                {new Date(project.created_at).toLocaleDateString("ko-KR")} 생성
              </p>
            </div>
            <span className="text-2xl font-bold tabular-nums gradient-text">{totalProgress}%</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.reference_tracks?.map((r, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-pearl-50 rounded-full text-gray-500">
                {r.title} — {r.artist}
              </span>
            ))}
          </div>
          <div className="h-2 bg-pearl-100 rounded-full overflow-hidden mt-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        {/* 프롬프트 카드 */}
        <div id="step-prompts" className="p-6 rounded-xl border border-pearl-200 bg-white">
          <h2 className="font-semibold mb-1">① 프롬프트</h2>
          <p className="text-sm text-gray-400 mb-4">
            Style과 Lyrics를 각각 복사해서 Suno에 붙여넣고, 생성된 음원을 다운로드하세요.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {(project.prompts ?? []).map((p, i) => (
              <PromptCard key={i} prompt={p} index={i} />
            ))}
          </div>
        </div>

        {/* 다음 단계 안내 */}
        <div className="pearl-card p-6 text-center space-y-3">
          <p className="text-sm text-gray-500">
            프롬프트를 Suno에서 생성한 후, 숏폼 만들기에서 이어서 진행하세요
          </p>
          <Link
            href="/shorts"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 transition-all shadow-sm"
          >
            <Film className="w-4 h-4" />
            숏폼 만들기로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}

function PromptCard({ prompt, index }: { prompt: SunoPrompt; index: number }) {
  const style = (prompt as any).style ?? (prompt as any).prompt ?? "";
  const lyrics = (prompt as any).lyrics ?? "";
  const sourceTrack = (prompt as any).source_track;
  const genre = (prompt as any).genre;
  const mood = (prompt as any).mood;

  return (
    <div className="pearl-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white bg-indigo-500 w-6 h-6 rounded-full flex items-center justify-center">
            {index + 1}
          </span>
          {sourceTrack && (
            <span className="text-xs text-indigo-500 truncate max-w-[150px]">← {sourceTrack}</span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => navigator.clipboard.writeText(`${style}\n\n${lyrics}`)}
            className="text-[10px] text-gray-400 hover:text-indigo-500 px-2 py-1 rounded hover:bg-pearl-100"
          >
            전체 복사
          </button>
          <a
            href="https://suno.com/create"
            target="_blank"
            rel="noopener"
            className="text-[10px] text-gray-400 hover:text-indigo-500 px-2 py-1 rounded hover:bg-pearl-100"
          >
            Suno
          </a>
        </div>
      </div>
      {(genre || mood) && (
        <div className="flex flex-wrap gap-1">
          {genre && <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{genre}</span>}
          {mood && <span className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">{mood}</span>}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase">Style</span>
          <button
            onClick={() => navigator.clipboard.writeText(style)}
            className="text-[10px] text-gray-400 hover:text-indigo-500"
          >
            복사
          </button>
        </div>
        <p className="text-xs text-gray-600 bg-pearl-50 rounded-lg px-3 py-2 leading-relaxed">{style}</p>
      </div>
      {lyrics && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">Lyrics</span>
            <button
              onClick={() => navigator.clipboard.writeText(lyrics)}
              className="text-[10px] text-gray-400 hover:text-indigo-500"
            >
              복사
            </button>
          </div>
          <pre className="text-xs text-gray-600 bg-pearl-50 rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-hidden">
            {lyrics}
          </pre>
        </div>
      )}
    </div>
  );
}
