"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const PAGE_CONFIG: Record<string, { tips: string[]; character: "girl1" | "guy1" | "girl2" }> = {
  "/": {
    character: "girl2",
    tips: [
      "여기서 프로젝트 현황을 한눈에 확인하세요!",
      "트렌드 탐색으로 영감을 모아보세요",
      "예약 업로드 현황도 바로 볼 수 있어요",
      "진행 중인 파이프라인을 클릭해서 이어가세요",
    ],
  },
  "/explore": {
    character: "girl1",
    tips: [
      "Spotify에서 지금 뜨는 곡을 탐색하세요!",
      "국가별 차트를 비교해서 트렌드를 찾아보세요",
      "마음에 드는 곡은 담기 버튼으로 저장!",
      "3곡 이상 담으면 프로젝트를 시작할 수 있어요",
    ],
  },
  "/new": {
    character: "guy1",
    tips: [
      "레퍼런스 곡을 3곡 이상 선택하세요!",
      "GPT가 인기 패턴을 분석해줄 거예요",
      "Suno 프롬프트 15개가 자동 생성됩니다",
      "프롬프트는 개별 수정할 수 있어요",
    ],
  },
  "/projects": {
    character: "girl1",
    tips: [
      "프롬프트를 복사해서 Suno에 붙여넣으세요!",
      "mp3 15개를 한번에 드래그&드롭 가능해요",
      "각 단계는 이전 단계 완료 시 자동 열려요",
      "발행 버튼 한 번으로 15개 쇼츠 업로드!",
    ],
  },
  "/bookmarks": {
    character: "girl2",
    tips: [
      "담아둔 레퍼런스 곡을 관리하세요!",
      "여기서 바로 프로젝트를 시작할 수 있어요",
      "필요없는 곡은 해제 버튼으로 제거하세요",
    ],
  },
};

const DEFAULT_CONFIG = {
  character: "girl1" as const,
  tips: ["Loopify와 함께 쇼츠를 만들어요!", "15곡 자동 파이프라인!", "AI가 다 해드릴게요"],
};

function CharGirl1({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none">
      <path d="M30 24 Q28 8 50 4 Q72 8 70 24 Q74 40 72 55 L28 55 Q26 40 30 24Z" fill="#F59E0B"/>
      <ellipse cx="50" cy="30" rx="18" ry="19" fill="#FFE0C2"/>
      <circle cx="42" cy="34" r="3" fill="#FFB3B3" opacity="0.3"/>
      <circle cx="58" cy="34" r="3" fill="#FFB3B3" opacity="0.3"/>
      <ellipse cx="44" cy="28" rx="2.5" ry="3" fill="#2D1B12"/>
      <ellipse cx="56" cy="28" rx="2.5" ry="3" fill="#2D1B12"/>
      <circle cx="45" cy="27" r="1" fill="white"/>
      <circle cx="57" cy="27" r="1" fill="white"/>
      <path d="M46 36 Q50 39 54 36" stroke="#E8847C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M30 24 Q34 12 50 8 Q66 12 70 24 Q65 20 55 22 Q50 16 45 22 Q35 20 30 24Z" fill="#F59E0B"/>
      <path d="M34 48 Q30 54 28 72 L40 72 L42 58 L50 56 L58 58 L60 72 L72 72 Q70 54 66 48Z" fill="url(#mc1)"/>
      <path d="M28 56 Q22 62 20 70" stroke="#FFE0C2" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M72 56 Q76 60 74 70" stroke="#FFE0C2" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <rect x="70" y="64" width="12" height="18" rx="3" fill="#1F1F2E"/>
      <rect x="72" y="67" width="8" height="12" rx="1.5" fill="#C4B5FD"/>
      <path d="M28 72 Q26 88 24 100 L76 100 Q74 88 72 72Z" fill="#374151"/>
      <path d="M36 100 L34 115" stroke="#FFE0C2" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <path d="M64 100 L66 115" stroke="#FFE0C2" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <defs><linearGradient id="mc1" x1="30" y1="48" x2="70" y2="72"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/></linearGradient></defs>
    </svg>
  );
}

function CharGuy1({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none">
      <path d="M30 28 Q28 10 50 6 Q72 10 70 28 Q68 22 50 18 Q32 22 30 28Z" fill="#1A1A2E"/>
      <path d="M28 26 Q30 14 50 10 Q70 14 72 26 Q70 32 68 26 Q64 18 50 16 Q36 18 32 26 Q30 32 28 26Z" fill="#2D2D4E"/>
      <ellipse cx="50" cy="32" rx="20" ry="20" fill="#F0C8A0"/>
      <ellipse cx="43" cy="30" rx="2.5" ry="3" fill="#1A1A2E"/>
      <ellipse cx="57" cy="30" rx="2.5" ry="3" fill="#1A1A2E"/>
      <circle cx="44.5" cy="29" r="1" fill="white"/>
      <circle cx="58.5" cy="29" r="1" fill="white"/>
      <path d="M38 27 Q43 24 48 27" stroke="#1A1A2E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M52 27 Q57 24 62 27" stroke="#1A1A2E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M45 38 Q50 42 55 38" stroke="#B8916B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M32 50 Q26 56 24 78 L38 78 L40 60 L50 58 L60 60 L62 78 L76 78 Q74 56 68 50Z" fill="url(#mc2)"/>
      <rect x="40" y="52" width="20" height="8" rx="4" fill="#2563EB" opacity="0.2"/>
      <path d="M24 58 Q18 66 16 74" stroke="#F0C8A0" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M76 58 Q80 64 78 74" stroke="#F0C8A0" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <rect x="12" y="68" width="12" height="20" rx="3" fill="#1F1F2E"/>
      <rect x="14" y="71" width="8" height="14" rx="1.5" fill="#FCA5A5"/>
      <rect x="34" y="78" width="12" height="35" rx="6" fill="#374151"/>
      <rect x="54" y="78" width="12" height="35" rx="6" fill="#374151"/>
      <ellipse cx="40" cy="115" rx="10" ry="4" fill="#1F1F2E"/>
      <ellipse cx="60" cy="115" rx="10" ry="4" fill="#1F1F2E"/>
      <defs><linearGradient id="mc2" x1="28" y1="50" x2="72" y2="78"><stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#2563EB"/></linearGradient></defs>
    </svg>
  );
}

function CharGirl2({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none">
      <path d="M28 26 Q26 6 50 2 Q74 6 72 26 Q76 42 74 60 L26 60 Q24 42 28 26Z" fill="url(#mh2)"/>
      <ellipse cx="50" cy="32" rx="18" ry="20" fill="#FFE0C2"/>
      <circle cx="40" cy="38" r="3.5" fill="#FFB3B3" opacity="0.3"/>
      <circle cx="60" cy="38" r="3.5" fill="#FFB3B3" opacity="0.3"/>
      <ellipse cx="43" cy="30" rx="3" ry="3.5" fill="#2D1B12"/>
      <ellipse cx="57" cy="30" rx="3" ry="3.5" fill="#2D1B12"/>
      <circle cx="44.5" cy="28.5" r="1.5" fill="white"/>
      <circle cx="58.5" cy="28.5" r="1.5" fill="white"/>
      <path d="M46 40 Q50 44 54 40" stroke="#E57373" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M28 26 Q32 12 50 6 Q68 12 72 26 Q66 20 56 22 Q50 14 44 22 Q34 20 28 26Z" fill="url(#mh2)"/>
      <path d="M34 52 Q30 58 28 74 L40 74 L42 62 L50 60 L58 62 L60 74 L72 74 Q70 58 66 52Z" fill="url(#mc3)"/>
      <path d="M28 58 Q22 64 20 72" stroke="#FFE0C2" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M72 58 Q78 62 76 72" stroke="#FFE0C2" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <rect x="72" y="66" width="14" height="12" rx="3" fill="#374151"/>
      <circle cx="79" cy="72" r="3" fill="#1F1F2E" stroke="#6B7280" strokeWidth="0.5"/>
      <circle cx="79" cy="72" r="1.5" fill="#3B82F6"/>
      <path d="M28 74 Q26 90 24 104 L76 104 Q74 90 72 74Z" fill="#EC4899"/>
      <path d="M36 104 L34 117" stroke="#FFE0C2" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <path d="M64 104 L66 117" stroke="#FFE0C2" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <defs>
        <linearGradient id="mh2" x1="50" y1="0" x2="50" y2="60"><stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/></linearGradient>
        <linearGradient id="mc3" x1="30" y1="52" x2="70" y2="74"><stop offset="0%" stopColor="#F472B6"/><stop offset="100%" stopColor="#EC4899"/></linearGradient>
      </defs>
    </svg>
  );
}

const CHARACTERS = { girl1: CharGirl1, guy1: CharGuy1, girl2: CharGirl2 };

export default function SidebarMascot() {
  const pathname = usePathname();
  const [tipIndex, setTipIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [prevPath, setPrevPath] = useState(pathname);

  // pathname 매칭: /projects/xxx → /projects
  const matchedPath = Object.keys(PAGE_CONFIG).find((key) => {
    if (key === "/") return pathname === "/";
    return pathname.startsWith(key);
  });
  const config = PAGE_CONFIG[matchedPath ?? ""] || DEFAULT_CONFIG;
  const Character = CHARACTERS[config.character];

  useEffect(() => {
    if (pathname !== prevPath) {
      setPrevPath(pathname);
      setTipIndex(0);
      setVisible(true);
    }
  }, [pathname, prevPath]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % config.tips.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [config.tips.length]);

  return (
    <div className="px-3 pb-3">
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl px-3 pt-3 pb-2 relative overflow-hidden">
        {/* 말풍선 */}
        <div
          className="mb-2 transition-all duration-300 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(6px) scale(0.95)",
          }}
        >
          <div className="bg-white rounded-xl px-3.5 py-2.5 shadow-sm border border-violet-100/60">
            <p className="text-sm text-gray-700 font-semibold leading-snug">{config.tips[tipIndex]}</p>
          </div>
          <div
            className="w-3 h-1.5 mx-auto"
            style={{ background: "white", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
          />
        </div>

        {/* 캐릭터 */}
        <div className="flex justify-center" style={{ animation: "sidebarBob 3s ease-in-out infinite" }}>
          <Character size={100} />
        </div>

        {/* 팁 인디케이터 */}
        <div className="flex justify-center gap-1 mt-1.5 pb-1">
          {config.tips.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === tipIndex ? "bg-indigo-400 w-3" : "bg-gray-300/60 w-1"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
