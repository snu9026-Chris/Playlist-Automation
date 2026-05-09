"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle, Circle } from "lucide-react";
import SidebarMascot from "@/components/layout/SidebarMascot";
import { projectsApi } from "@/lib/api/projects";

/* ── Gradient SVG Icons (Loopdrop style) ── */
function IconDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-dash" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
      <rect x="2" y="2" width="9" height="9" rx="2" fill="url(#ic-dash)" opacity="0.8" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="url(#ic-dash)" opacity="0.5" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="url(#ic-dash)" opacity="0.5" />
      <rect x="13" y="13" width="9" height="9" rx="2" fill="url(#ic-dash)" opacity="0.3" />
    </svg>
  );
}

function IconExplore({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-exp" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
      <rect x="3" y="14" width="4" height="7" rx="1" fill="url(#ic-exp)" opacity="0.5" />
      <rect x="8.5" y="9" width="4" height="12" rx="1" fill="url(#ic-exp)" opacity="0.7" />
      <rect x="14" y="5" width="4" height="16" rx="1" fill="url(#ic-exp)" opacity="0.85" />
      <circle cx="20" cy="5" r="2" fill="url(#ic-exp)" />
    </svg>
  );
}

function IconNewProject({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-new" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="url(#ic-new)" opacity="0.15" />
      <path d="M12 8v8M8 12h8" stroke="url(#ic-new)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBookmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-bk" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ef4444" /></linearGradient></defs>
      <path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z" fill="url(#ic-bk)" opacity="0.7" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-set" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6b7280" /><stop offset="100%" stopColor="#9ca3af" /></linearGradient></defs>
      <circle cx="12" cy="12" r="3" fill="url(#ic-set)" opacity="0.6" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="url(#ic-set)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function IconProjects({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-proj" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient></defs>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="url(#ic-proj)" opacity="0.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="url(#ic-proj)" opacity="0.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="url(#ic-proj)" opacity="0.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="url(#ic-proj)" opacity="0.3" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-up" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#f97316" /></linearGradient></defs>
      <path d="M12 4v12M8 8l4-4 4 4" stroke="url(#ic-up)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M4 18h16" stroke="url(#ic-up)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

const menu = [
  { label: "대시보드", href: "/", icon: IconDashboard },
  { label: "트렌드 탐색", href: "/explore", icon: IconExplore },
];

function IconShorts({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-sh" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ec4899" /><stop offset="100%" stopColor="#f43f5e" /></linearGradient></defs>
      <rect x="6" y="2" width="12" height="20" rx="3" fill="url(#ic-sh)" opacity="0.7" />
      <path d="M10 9l5 3-5 3z" fill="white" />
    </svg>
  );
}

function IconLongform({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6"}>
      <defs><linearGradient id="ic-lf" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6b7280" /><stop offset="100%" stopColor="#9ca3af" /></linearGradient></defs>
      <rect x="3" y="4" width="18" height="12" rx="2" fill="url(#ic-lf)" opacity="0.5" />
      <path d="M10 8l5 3-5 3z" fill="white" opacity="0.7" />
      <rect x="5" y="18" width="14" height="2" rx="1" fill="url(#ic-lf)" opacity="0.3" />
    </svg>
  );
}

const subMenu = [
  { label: "프로젝트 관리", href: "/projects-manage", icon: IconProjects },
  { label: "숏폼 만들기", href: "/shorts", icon: IconShorts },
  { label: "롱폼 만들기", href: "/longform", icon: IconLongform },
  { label: "업로드 / 예약", href: "/uploads", icon: IconUpload },
];

const bottomMenu = [
  { label: "북마크", href: "/bookmarks", icon: IconBookmark },
  { label: "설정", href: "/settings", icon: IconSettings },
];

interface SidebarProject {
  id: string;
  theme: string;
  status: string;
  shorts_youtube_urls: string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<SidebarProject[]>([]);

  useEffect(() => {
    projectsApi.recent(2).then((data) => setProjects(data as unknown as SidebarProject[]));
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed top-20 left-0 w-72 h-[calc(100vh-5rem)] bg-white border-r border-pearl-200 flex flex-col z-40">
      <nav className="flex-1 px-4 py-5 space-y-1.5">
        {menu.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base font-medium transition-all duration-200 ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:bg-pearl-50 hover:text-gray-700"
              }`}
            >
              {active && (
                <div className="absolute left-0 w-1 h-7 rounded-r bg-gradient-to-b from-indigo-400 to-violet-500" />
              )}
              <Icon className="w-6 h-6" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* 새 프로젝트 CTA */}
        <Link
          href="/new"
          className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base font-semibold transition-all duration-200 mt-2 ${
            isActive("/new")
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md"
              : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600 shadow-sm"
          }`}
        >
          <IconNewProject className="w-6 h-6" />
          <span>새 프로젝트</span>
        </Link>

        {/* 구분선 */}
        <div className="my-3 mx-2 border-t border-pearl-200" />

        {/* 프로젝트 관리 + 업로드/예약 */}
        {subMenu.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                  : "text-gray-500 hover:bg-pearl-50 hover:text-gray-700"
              }`}
            >
              {active && (
                <div className="absolute left-0 w-1 h-5 rounded-r bg-gradient-to-b from-indigo-400 to-violet-500" />
              )}
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* 구분선 */}
        <div className="my-3 mx-2 border-t border-pearl-200" />

        {/* 프로젝트 목록 */}
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          프로젝트
        </p>
        {projects.length === 0 ? (
          <p className="px-4 py-2 text-sm text-gray-400">
            아직 프로젝트가 없습니다
          </p>
        ) : (
          <div className="space-y-0.5">
            {projects.map((p) => {
              const isProjectActive = pathname === `/projects/${p.id}`;
              const done = p.status === "completed";
              const uploaded = p.shorts_youtube_urls?.length ?? 0;

              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isProjectActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                      : "text-gray-500 hover:bg-pearl-50 hover:text-gray-700"
                  }`}
                >
                  {isProjectActive && (
                    <div className="absolute left-0 w-1 h-5 rounded-r bg-gradient-to-b from-indigo-400 to-violet-500" />
                  )}
                  {done ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                  <span className="truncate flex-1">{p.theme}</span>
                  <span className="text-xs tabular-nums text-gray-400 shrink-0">
                    {uploaded}/15
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        {/* 구분선 */}
        <div className="my-3 mx-2 border-t border-pearl-200" />

        {/* 하단 메뉴 (북마크, 설정) */}
        {bottomMenu.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-gray-400 hover:bg-pearl-50 hover:text-gray-600"
              }`}
            >
              {active && (
                <div className="absolute left-0 w-1 h-5 rounded-r bg-gradient-to-b from-indigo-400 to-violet-500" />
              )}
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 마스코트 */}
      <SidebarMascot />
    </aside>
  );
}
