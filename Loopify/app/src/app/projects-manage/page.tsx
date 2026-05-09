"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Clock,
  Upload,
  AlertCircle,
  Trash2,
  Undo2,
  Music,
} from "lucide-react";
import { projectsApi } from "@/lib/api/projects";

const RESTORE_WINDOW_MS = 30 * 60 * 1000;

interface Project {
  id: string;
  theme: string;
  status: string;
  shorts_youtube_urls: string[];
  // 소프트 삭제된 프로젝트는 ISO 타임스탬프, 살아있으면 null
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Track {
  id: string;
  slot_index: number;
  title: string | null;
  upload_status: string;
  short_youtube_url: string | null;
  mp3_url: string | null;
  short_mp4_url: string | null;
}

export default function ProjectsManagePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // 카운트다운 표시용 1초 tick. 진실은 서버의 deleted_at 컬럼이며 여기서는 표시만 갱신한다.
  const [now, setNow] = useState(() => Date.now());

  // 화면에 표시할 삭제된 프로젝트 존재 여부에 따라 1초 setInterval만 켜고 끈다.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasDeleted = projects.some((p) => p.deleted_at);
    if (!hasDeleted) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [projects]);

  const reloadProjects = async () => {
    const data = await projectsApi.recent(20, { includeDeleted: true });
    setProjects(data as unknown as Project[]);
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(null);
    await projectsApi.softDelete(id);
    // 서버의 deleted_at 값을 그대로 받아 화면 갱신.
    // 30분 후 영구 삭제는 다음에 누군가 /api/projects/recent 를 호출하는 시점에 서버가 자동 청소.
    await reloadProjects();
  };

  const handleRestore = async (id: string) => {
    await projectsApi.restore(id);
    await reloadProjects();
  };

  useEffect(() => {
    projectsApi
      .recent(20, { includeDeleted: true })
      .then((data) => setProjects(data as unknown as Project[]))
      .finally(() => setLoading(false));
  }, []);

  const selectProject = async (id: string) => {
    setSelectedId(id);
    const data = await projectsApi.tracks(id);
    setTracks(data as Track[]);
  };

  const uploaded = (p: Project) => p.shorts_youtube_urls?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">프로젝트 관리</h1>
      </div>

      <div className="flex gap-6">
        {/* 왼쪽: 프로젝트 리스트 */}
        <div className="w-80 shrink-0 space-y-2">
          {loading ? (
            <div className="animate-pulse pearl-card h-20" />
          ) : projects.length === 0 ? (
            <div className="pearl-card p-8 text-center">
              <Music className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">프로젝트가 없습니다</p>
            </div>
          ) : (
            projects
              // 카운트다운 표시 중에 만료(0초 이하)에 도달한 row는 즉시 숨김. 다음 reload 때 서버가 실제로 청소.
              .filter((p) => {
                if (!p.deleted_at) return true;
                const purgeAt = new Date(p.deleted_at).getTime() + RESTORE_WINDOW_MS;
                return purgeAt > now;
              })
              .map((p) => {
                const count = uploaded(p);
                const isSelected = selectedId === p.id;
                const isDeleted = !!p.deleted_at;
                const purgeAt = p.deleted_at
                  ? new Date(p.deleted_at).getTime() + RESTORE_WINDOW_MS
                  : 0;

                if (isDeleted) {
                  const cd = Math.max(0, Math.ceil((purgeAt - now) / 1000));
                  const min = Math.floor(cd / 60);
                  const sec = cd % 60;
                  return (
                    <div key={p.id} className="pearl-card p-4 opacity-60">
                      <p className="text-sm text-gray-500 truncate">"{p.theme}" 삭제됨</p>
                      <p className="text-xs text-gray-400 mt-1 tabular-nums">{min}:{String(sec).padStart(2, "0")} 후 영구 삭제</p>
                      <button onClick={() => handleRestore(p.id)} className="flex items-center gap-1 mt-2 text-xs text-indigo-500 hover:underline">
                        <Undo2 className="w-3 h-3" /> 되돌리기
                      </button>
                    </div>
                  );
                }

              return (
                <div
                  key={p.id}
                  className={`pearl-card w-full p-4 text-left transition-all relative group ${
                    isSelected ? "ring-2 ring-indigo-500" : "hover:shadow-md"
                  }`}
                >
                  <button onClick={() => selectProject(p.id)} className="w-full text-left">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate flex-1">{p.theme}</h3>
                      <StatusPill status={p.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Upload className="w-3 h-3" />
                        <span className="tabular-nums">{count}/15</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </button>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    className="absolute top-3 right-3 p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 확인 팝업 */}
                  {confirmDelete === p.id && (
                    <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center p-3 z-10">
                      <p className="text-xs text-gray-900 text-center font-medium">삭제하시겠습니까?</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">30분 내 복구 가능</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded text-xs bg-pearl-100 text-gray-600">취소</button>
                        <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 rounded text-xs bg-red-500 text-white">삭제</button>
                      </div>
                    </div>
                  )}
                  {/* Mini progress */}
                  <div className="h-1 bg-pearl-200 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: `${(count / 15) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 오른쪽: 선택된 프로젝트의 트랙 상태 */}
        <div className="flex-1 min-w-0">
          {!selectedId ? (
            <div className="pearl-card p-12 text-center">
              <p className="text-gray-400">왼쪽에서 프로젝트를 선택하세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  트랙 현황 ({tracks.filter((t) => t.upload_status === "completed").length}/15 업로드)
                </h2>
                <Link
                  href={`/projects/${selectedId}`}
                  className="flex items-center gap-1 text-sm text-indigo-500 hover:underline"
                >
                  파이프라인 열기 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="pearl-card divide-y divide-pearl-200">
                {tracks.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-pearl-50 transition-colors">
                    {/* 번호 */}
                    <span className="text-xs font-bold tabular-nums text-gray-400 w-6">#{t.slot_index + 1}</span>

                    {/* 제목 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {t.title ?? `트랙 ${t.slot_index + 1}`}
                      </p>
                    </div>

                    {/* 파일 상태 아이콘들 */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className={t.mp3_url ? "text-emerald-500" : ""} title="MP3">
                        {t.mp3_url ? "♪" : "—"} mp3
                      </span>
                      <span className={t.short_mp4_url ? "text-emerald-500" : ""} title="MP4">
                        {t.short_mp4_url ? "▶" : "—"} mp4
                      </span>
                    </div>

                    {/* 업로드 상태 */}
                    <UploadBadge status={t.upload_status} />

                    {/* YouTube 링크 */}
                    {t.short_youtube_url && (
                      <a
                        href={t.short_youtube_url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        YouTube
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* 요약 */}
              <div className="pearl-card p-4">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">
                      {tracks.filter((t) => t.mp3_url).length}
                    </p>
                    <p className="text-xs text-gray-400">MP3 준비</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">
                      {tracks.filter((t) => t.short_mp4_url).length}
                    </p>
                    <p className="text-xs text-gray-400">렌더링 완료</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-emerald-500">
                      {tracks.filter((t) => t.upload_status === "completed").length}
                    </p>
                    <p className="text-xs text-gray-400">업로드 완료</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-amber-500">
                      {tracks.filter((t) => t.upload_status === "pending").length}
                    </p>
                    <p className="text-xs text-gray-400">대기 중</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "bg-gray-50", text: "text-gray-500", label: "초안" },
    in_progress: { bg: "bg-indigo-50", text: "text-indigo-600", label: "진행 중" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-600", label: "완료" },
    failed: { bg: "bg-red-50", text: "text-red-600", label: "실패" },
  };
  const m = map[status] ?? map.draft;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function UploadBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-gray-400", label: "대기" },
    uploading: { icon: Upload, color: "text-indigo-500", label: "업로드 중" },
    completed: { icon: Check, color: "text-emerald-500", label: "완료" },
    failed: { icon: AlertCircle, color: "text-red-500", label: "실패" },
  };
  const m = map[status] ?? map.pending;
  const Icon = m.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${m.color}`}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}
