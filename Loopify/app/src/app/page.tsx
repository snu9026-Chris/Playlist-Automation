import Link from "next/link";
import {
  Compass,
  FolderPlus,
  ArrowRight,
  Music,
  Upload,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase";
import ProjectCard from "@/components/ProjectCard";
import PageHeader from "@/components/layout/PageHeader";

interface PlaylistProject {
  id: string;
  theme: string;
  status: string;
  shorts_youtube_urls: string[];
  created_at: string;
}

export const dynamic = "force-dynamic";

async function getProjects(): Promise<PlaylistProject[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("playlist_projects")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as PlaylistProject[];
  } catch {
    return [];
  }
}

async function getTodayScheduled(): Promise<any[]> {
  try {
    const supabase = createServerClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("scheduled_uploads")
      .select("*, playlist_tracks(title, slot_index)")
      .gte("scheduled_at", `${today}T00:00:00`)
      .lte("scheduled_at", `${today}T23:59:59`)
      .order("scheduled_at", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const projects = await getProjects();
  const todayScheduled = await getTodayScheduled();

  const inProgress = projects.filter((p) => p.status !== "completed" && p.status !== "deleted");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <PageHeader>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
      </PageHeader>

      {/* 빠른 액션 카드 2개 */}
      <div className="grid grid-cols-2 gap-5">
        <Link
          href="/explore"
          className="pearl-card group p-6 hover:shadow-lg transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-sm">
              <Compass className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">트렌드 탐색</h3>
              <p className="text-sm text-gray-500 mt-0.5">Spotify 차트에서 영감 찾기</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">Global</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">한국</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">미국</span>
            <span className="text-xs text-gray-400">+3개국</span>
          </div>
        </Link>

        <Link
          href="/new"
          className="pearl-card group p-6 hover:shadow-lg transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">새 프로젝트 시작</h3>
              <p className="text-sm text-gray-500 mt-0.5">트렌드 분석부터 쇼츠 업로드까지</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> GPT 분석</span>
            <span>→</span>
            <span>Suno 프롬프트 15개</span>
            <span>→</span>
            <span>자동 업로드</span>
          </div>
        </Link>
      </div>

      {/* 오늘 예약 업로드 */}
      {todayScheduled.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">오늘 예약 업로드</h2>
          </div>
          <div className="pearl-card divide-y divide-pearl-200">
            {todayScheduled.map((s: any) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="text-sm text-gray-400 tabular-nums w-14">
                  {new Date(s.scheduled_at).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-sm font-medium text-gray-700 flex-1">
                  {s.playlist_tracks?.title ?? `트랙 #${s.playlist_tracks?.slot_index}`}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pearl-100 text-gray-500">{s.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 진행 중 프로젝트 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">진행 중</h2>
        {inProgress.length === 0 ? (
          <div className="pearl-card p-12 text-center">
            <Music className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 font-medium text-gray-700">진행 중인 프로젝트가 없습니다</p>
            <p className="mt-1 text-sm text-gray-400">트렌드를 탐색하고 새 프로젝트를 시작해 보세요</p>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 transition-all shadow-sm"
            >
              <Compass className="w-4 h-4" />
              트렌드 탐색하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {inProgress.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      {/* 완료 프로젝트 */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">완료</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {completed.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ProjectCard and StatusBadge are now in @/components/ProjectCard.tsx */
