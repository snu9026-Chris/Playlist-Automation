"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, Trash2, Undo2 } from "lucide-react";

interface PlaylistProject {
  id: string;
  theme: string;
  status: string;
  shorts_youtube_urls: string[];
  created_at: string;
}

export default function ProjectCard({ project }: { project: PlaylistProject }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [restoreTimer, setRestoreTimer] = useState<number | null>(null);
  const [restoreCountdown, setRestoreCountdown] = useState(0);

  const uploadedCount = project.shorts_youtube_urls?.length ?? 0;
  const pct = Math.round((uploadedCount / 15) * 100);

  const handleDelete = async () => {
    setShowConfirm(false);
    await fetch(`/api/projects/${project.id}/delete`, { method: "POST" });
    setDeleted(true);

    // 30분 카운트다운
    let remaining = 30 * 60;
    setRestoreCountdown(remaining);

    const interval = window.setInterval(() => {
      remaining--;
      setRestoreCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // 영구 삭제
        fetch(`/api/projects/${project.id}/delete`, { method: "DELETE" });
      }
    }, 1000);

    setRestoreTimer(interval);
  };

  const handleRestore = async () => {
    if (restoreTimer) clearInterval(restoreTimer);
    await fetch(`/api/projects/${project.id}/delete`, { method: "PATCH" });
    setDeleted(false);
    setRestoreTimer(null);
  };

  if (deleted) {
    const min = Math.floor(restoreCountdown / 60);
    const sec = restoreCountdown % 60;
    return (
      <div className="pearl-card p-5 opacity-60">
        <p className="text-sm text-gray-500">"{project.theme}" 삭제됨</p>
        <p className="text-xs text-gray-400 mt-1 tabular-nums">
          {min}:{String(sec).padStart(2, "0")} 후 영구 삭제
        </p>
        <button
          onClick={handleRestore}
          className="flex items-center gap-1 mt-3 text-xs font-medium text-indigo-500 hover:underline"
        >
          <Undo2 className="w-3 h-3" /> 되돌리기
        </button>
      </div>
    );
  }

  return (
    <div className="pearl-card p-5 hover:shadow-md transition-all duration-200 group relative">
      <Link href={`/projects/${project.id}`} className="block">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {project.theme}
          </h3>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Upload className="w-3.5 h-3.5" />
          <span className="tabular-nums">{uploadedCount}/15 업로드</span>
        </div>
        <div className="h-1.5 bg-pearl-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {new Date(project.created_at).toLocaleDateString("ko-KR")}
        </p>
      </Link>

      {/* 삭제 버튼 */}
      <button
        onClick={(e) => { e.preventDefault(); setShowConfirm(true); }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
        title="프로젝트 삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* 확인 팝업 */}
      {showConfirm && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur rounded-xl flex flex-col items-center justify-center p-4 z-10">
          <p className="text-sm font-medium text-gray-900 text-center">
            "{project.theme}"를<br />삭제하시겠습니까?
          </p>
          <p className="text-xs text-gray-400 mt-1">30분 내 복구 가능</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 bg-pearl-100 hover:bg-pearl-200"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    draft: { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-400", label: "초안" },
    in_progress: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500", label: "진행 중" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "완료" },
    failed: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "실패" },
  };
  const c = config[status] ?? config.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
