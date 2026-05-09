"use client";

import { CheckCircle, AlertCircle } from "lucide-react";
import { useYouTubeAuth } from "@/hooks/useYouTubeAuth";

/* ── Platform SVG Icons ── */
function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SunoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7">
      <defs>
        <linearGradient id="suno-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#suno-grad)" />
      <path d="M8 7.5v9l2-1v-3l4 2.5v-9l-4 2.5v-3z" fill="white" opacity="0.9" />
    </svg>
  );
}

function GeminiIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7">
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 2.69 3 6s-1.34 6-3 6-3-2.69-3-6 1.34-6 3-6zm-7 7c0-1.66 2.69-3 6-3s6 1.34 6 3-2.69 3-6 3-6-1.34-6-3z" fill="url(#gemini-grad)" />
    </svg>
  );
}

function OpenAIIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000000">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

const marqueeItems = [
  { icon: SpotifyIcon, name: "SPOTIFY" },
  { icon: YouTubeIcon, name: "YOUTUBE" },
  { icon: SunoIcon, name: "SUNO AI" },
  { icon: GeminiIcon, name: "GEMINI" },
  { icon: OpenAIIcon, name: "GPT" },
];

export default function Header() {
  const { connected: ytConnected, disconnect } = useYouTubeAuth();

  const repeatedItems = [...marqueeItems, ...marqueeItems, ...marqueeItems];

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-white z-50 flex items-center justify-between px-8 header-pearl-border">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-from to-primary-to flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <span className="text-2xl font-bold tracking-tight gradient-text">
          Loopify
        </span>
      </div>

      {/* 전광판 마키 — Spotify · YouTube · Suno · Gemini · GPT */}
      <div className="relative overflow-hidden h-12" style={{ width: "calc((100vw - 240px) / 3)" }}>
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div
          className="flex items-center gap-10 h-full"
          style={{
            width: "max-content",
            animation: "marquee-scroll 15s linear infinite",
          }}
        >
          {repeatedItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={`${item.name}-${i}`} className="flex items-center gap-2.5 shrink-0">
                <Icon />
                <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase whitespace-nowrap">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* YouTube 연결 상태 */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-pearl-200 text-sm">
          <YouTubeIcon />
          {ytConnected === null ? (
            <span className="text-gray-400">확인 중...</span>
          ) : ytConnected ? (
            <>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                연결됨
              </span>
              <a href="/api/auth/youtube" className="text-[10px] text-indigo-500 hover:underline ml-1">재연결</a>
              <button
                onClick={async () => {
                  if (!confirm("YouTube 연결을 해제하시겠습니까?")) return;
                  await disconnect();
                }}
                className="text-[10px] text-gray-400 hover:text-red-500 ml-1"
              >
                해제
              </button>
            </>
          ) : (
            <a href="/api/auth/youtube" className="flex items-center gap-1 text-rose-500 font-medium hover:underline">
              <AlertCircle className="w-3.5 h-3.5" />
              미연결 — 연결하기
            </a>
          )}
        </div>
      </div>

      {/* Marquee keyframes — CSS module 대신 인라인으로 확실히 */}
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </header>
  );
}
