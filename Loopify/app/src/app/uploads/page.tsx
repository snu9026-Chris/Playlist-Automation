"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Clock,
  Check,
  Calendar,
  Send,
  Film,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { useYouTubeAuth } from "@/hooks/useYouTubeAuth";
import { youtubeApi } from "@/lib/api/youtube";
import { apiFetchSafe } from "@/lib/api/client";

interface UploadedFile {
  file: File;
  name: string;
  status: "ready" | "uploading" | "done" | "failed";
  youtubeUrl?: string;
  // 메타데이터 (Supabase 매칭 or 수동 입력)
  title: string;
  description: string;
  tags: string[];
  firstComment: string;
  matched: boolean;
  expanded: boolean;
  aiLoading: boolean;
}

export default function UploadsPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [mode, setMode] = useState<"instant" | "scheduled">("instant");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleInterval, setScheduleInterval] = useState("daily1");
  const [publishing, setPublishing] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const { connected: ytConnected } = useYouTubeAuth();

  // 파일 추가 + 자동 매칭
  const handleFiles = async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      newFiles.push({
        file: f,
        name: f.name,
        status: "ready",
        title: f.name.replace(/_highlight\.mp4$/i, "").replace(/\.mp4$/i, "").replace(/_/g, " "),
        description: "",
        tags: [],
        firstComment: "",
        matched: false,
        expanded: false,
        aiLoading: false,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);

    // 파일명으로 Supabase 매칭
    for (const uf of newFiles) {
      const data = await apiFetchSafe<{ matched?: boolean; title?: string; description?: string; tags?: string[] }>(
        "/api/uploads/match",
        { matched: false },
        { method: "POST", json: { fileName: uf.name } }
      );
      if (data.matched) {
        setFiles((prev) => prev.map((f) =>
          f.name === uf.name
            ? { ...f, title: data.title ?? f.title, description: data.description ?? "", tags: data.tags ?? [], matched: true }
            : f
        ));
      }
    }
  };

  const updateFile = (name: string, updates: Partial<UploadedFile>) => {
    setFiles((prev) => prev.map((f) => f.name === name ? { ...f, ...updates } : f));
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  // AI 추천 (곡별)
  const aiRecommend = async (uf: UploadedFile) => {
    updateFile(uf.name, { aiLoading: true });
    const data = await apiFetchSafe<{ title?: string; description?: string; tags?: string[]; firstComment?: string }>(
      "/api/uploads/ai-recommend",
      {},
      { method: "POST", json: { title: uf.title, description: uf.description, tags: uf.tags } }
    );
    updateFile(uf.name, {
      title: data.title ?? uf.title,
      description: data.description ?? uf.description,
      tags: data.tags ?? uf.tags,
      firstComment: data.firstComment ?? uf.firstComment,
      aiLoading: false,
      expanded: true,
    });
  };

  const readyCount = files.filter((f) => f.status === "ready").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  // 발행 — 서버에서 resumable session URL만 받아 브라우저는 PUT만 수행 (access_token 노출 없음)
  const publish = async () => {
    if (!ytConnected) { alert("YouTube 연결이 필요합니다"); return; }
    setPublishing(true);
    setPublishedCount(0);

    for (const uf of files.filter((f) => f.status === "ready")) {
      updateFile(uf.name, { status: "uploading" });

      try {
        // 1. 서버에서 resumable session URL 발급 (access_token은 서버에만)
        const { uploadSessionUrl } = await youtubeApi.initUpload({
          title: uf.title,
          description: uf.description,
          tags: uf.tags,
          fileSize: uf.file.size,
        });

        if (!uploadSessionUrl) {
          updateFile(uf.name, { status: "failed" });
          setPublishedCount((c) => c + 1);
          continue;
        }

        // 2. 파일 업로드 (브라우저 → resumable session URL, Authorization 헤더 불필요)
        const uploadRes = await fetch(uploadSessionUrl, {
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          body: uf.file,
        });

        if (!uploadRes.ok) {
          console.error("YouTube upload failed:", await uploadRes.text());
          updateFile(uf.name, { status: "failed" });
          setPublishedCount((c) => c + 1);
          continue;
        }

        const uploadData = await uploadRes.json();
        const videoId = uploadData.id;

        // 3. 첫 댓글 (서버 경유 — 토큰은 서버에만)
        if (uf.firstComment && videoId) {
          await youtubeApi.comment(videoId, uf.firstComment).catch((e) => {
            console.error("YouTube comment error:", e);
          });
        }

        updateFile(uf.name, {
          status: "done",
          youtubeUrl: `https://youtube.com/shorts/${videoId}`,
        });
      } catch (e) {
        console.error("Upload error:", e);
        updateFile(uf.name, { status: "failed" });
      }
      setPublishedCount((c) => c + 1);
    }

    setPublishing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">업로드 / 예약</h1>
      </div>

      <div className="flex gap-6">
        {/* ── 왼쪽: 영상 파일 + 메타데이터 편집 ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 드롭존 */}
          <label
            className="pearl-card p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all border-2 border-dashed border-pearl-300 hover:border-indigo-300"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          >
            <input type="file" accept=".mp4,video/mp4" multiple className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            <Upload className="w-6 h-6 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">렌더링된 mp4 파일 추가</p>
              <p className="text-xs text-gray-400">파일명으로 곡 정보 자동 매칭</p>
            </div>
          </label>

          {/* 파일별 카드 */}
          {files.length === 0 ? (
            <div className="pearl-card p-12 text-center">
              <Film className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="mt-3 font-medium text-gray-700">영상 파일이 없습니다</p>
              <p className="mt-1 text-sm text-gray-400">숏폼 만들기에서 렌더링한 mp4를 업로드하세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((uf) => (
                <div key={uf.name} className="pearl-card overflow-hidden">
                  {/* 헤더 */}
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <Film className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{uf.name}</p>
                      {uf.matched && <p className="text-[10px] text-emerald-500">✓ 곡 정보 매칭됨</p>}
                    </div>

                    {/* AI 추천 */}
                    <button
                      onClick={() => aiRecommend(uf)}
                      disabled={uf.aiLoading}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                    >
                      {uf.aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI 추천
                    </button>

                    {/* 펼치기/접기 */}
                    <button
                      onClick={() => updateFile(uf.name, { expanded: !uf.expanded })}
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      {uf.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <StatusIcon status={uf.status} />

                    {uf.status === "failed" && (
                      <button
                        onClick={() => updateFile(uf.name, { status: "ready" })}
                        className="text-[10px] text-indigo-500 hover:underline"
                      >
                        재시도
                      </button>
                    )}
                    {(uf.status === "ready" || uf.status === "failed") && (
                      <button onClick={() => removeFile(uf.name)} className="text-[10px] text-gray-400 hover:text-red-500">제거</button>
                    )}
                  </div>

                  {/* 편집 영역 */}
                  {uf.expanded && (
                    <div className="px-5 pb-4 space-y-3 border-t border-pearl-200 pt-3">
                      {/* 제목 */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">YouTube 제목</label>
                        <input
                          type="text"
                          value={uf.title}
                          onChange={(e) => updateFile(uf.name, { title: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 설명 */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">설명</label>
                        <textarea
                          value={uf.description}
                          onChange={(e) => updateFile(uf.name, { description: e.target.value })}
                          rows={3}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                        />
                      </div>

                      {/* 태그 */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">태그</label>
                        <input
                          type="text"
                          value={uf.tags.join(", ")}
                          onChange={(e) => updateFile(uf.name, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                          placeholder="쉼표로 구분"
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        {uf.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {uf.tags.map((tag, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-pearl-100 text-gray-500 rounded">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 첫 댓글 */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">첫 댓글</label>
                        <textarea
                          value={uf.firstComment}
                          onChange={(e) => updateFile(uf.name, { firstComment: e.target.value })}
                          rows={2}
                          placeholder="업로드 후 자동으로 달릴 첫 댓글"
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽: 발행/예약 패널 ── */}
        <div className="w-72 shrink-0 space-y-4">
          {/* YouTube 연결 상태 */}
          {ytConnected === false && (
            <div className="pearl-card p-4 border-l-4 border-amber-400">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">YouTube 미연결</p>
                  <p className="text-xs text-gray-500 mt-1">YouTube 계정을 연결해야 발행할 수 있습니다</p>
                  <a href="/api/auth/youtube" className="inline-block mt-2 text-xs font-medium text-indigo-500 hover:underline">
                    YouTube 연결하기 →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 발행 설정 */}
          <div className="pearl-card p-5 space-y-4 sticky top-8">
            <h3 className="font-semibold text-gray-900">발행 설정</h3>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-pearl-50 rounded-lg">
                <p className="text-xl font-bold tabular-nums text-gray-900">{readyCount}</p>
                <p className="text-[10px] text-gray-400">대기</p>
              </div>
              <div className="p-3 bg-pearl-50 rounded-lg">
                <p className="text-xl font-bold tabular-nums text-emerald-500">{doneCount}</p>
                <p className="text-[10px] text-gray-400">완료</p>
              </div>
            </div>

            {/* 모드 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode("instant")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  mode === "instant" ? "bg-indigo-500 text-white" : "bg-pearl-100 text-gray-500"
                }`}
              >
                <Send className="w-3.5 h-3.5 mx-auto mb-1" />
                즉시 발행
              </button>
              <button
                onClick={() => setMode("scheduled")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  mode === "scheduled" ? "bg-indigo-500 text-white" : "bg-pearl-100 text-gray-500"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 mx-auto mb-1" />
                예약 발행
              </button>
            </div>

            {mode === "scheduled" && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">시작일</label>
                  <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">주기</label>
                  <select value={scheduleInterval} onChange={(e) => setScheduleInterval(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm">
                    <option value="daily1">하루 1개</option>
                    <option value="daily2">하루 2개</option>
                    <option value="hourly">매시간</option>
                  </select>
                </div>
              </div>
            )}

            {/* 발행 버튼 */}
            <button
              onClick={publish}
              disabled={readyCount === 0 || publishing || !ytConnected}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {!ytConnected ? (
                <>YouTube 연결 필요</>
              ) : publishing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 발행 중... ({publishedCount}/{readyCount})</>
              ) : (
                <><Send className="w-4 h-4" /> {readyCount}개 {mode === "instant" ? "즉시 발행" : "예약 등록"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "uploading") return <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />;
  if (status === "done") return <Check className="w-4 h-4 text-emerald-500" />;
  if (status === "failed") return <span className="text-xs text-red-500">실패</span>;
  return <Clock className="w-4 h-4 text-gray-300" />;
}
