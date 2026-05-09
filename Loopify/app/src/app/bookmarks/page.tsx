"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  ArrowRight,
  Music,
  ChevronLeft,
  ChevronRight as ChevronR,
} from "lucide-react";
import { bookmarksApi, type BookmarkRow as Bookmark } from "@/lib/api/bookmarks";

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  useEffect(() => {
    bookmarksApi.list().then(setBookmarks).finally(() => setLoading(false));
  }, []);

  const removeBookmark = async (spotifyId: string) => {
    await bookmarksApi.remove(spotifyId);
    setBookmarks((prev) => prev.filter((b) => b.spotify_track_id !== spotifyId));
  };

  // 날짜별 북마크 맵
  const dateMap = useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    bookmarks.forEach((b) => {
      const key = new Date(b.created_at).toISOString().split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [bookmarks]);

  // 선택된 날짜의 북마크
  const filtered = selectedDate
    ? dateMap.get(selectedDate) ?? []
    : bookmarks;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 대시보드
          </Link>
          <h1 className="text-xl font-bold text-gray-900">북마크</h1>
          <span className="text-sm text-gray-400 tabular-nums">{bookmarks.length}곡</span>
        </div>
        {bookmarks.length >= 3 && (
          <Link
            href="/new?from=bookmarks"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 transition-all shadow-sm"
          >
            이 북마크로 프로젝트 시작
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse pearl-card h-40" />
      ) : bookmarks.length === 0 ? (
        <div className="pearl-card p-12 text-center">
          <Music className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-700">북마크가 없습니다</p>
          <p className="mt-1 text-sm text-gray-400">트렌드 탐색에서 마음에 드는 곡을 담아보세요</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 transition-all shadow-sm"
          >
            트렌드 탐색하기
          </Link>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 왼쪽: 북마크 목록 */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* 필터 표시 */}
            {selectedDate && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="text-sm text-gray-400 tabular-nums">{filtered.length}곡</span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="ml-2 text-xs text-indigo-500 hover:underline"
                >
                  전체 보기
                </button>
              </div>
            )}

            <div className="pearl-card divide-y divide-pearl-200">
              {filtered.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-pearl-50 transition-colors">
                  {/* 앨범아트 */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-pearl-200 shrink-0">
                    {b.image_url && <img src={b.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>

                  {/* 곡 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{b.title}</p>
                    <p className="text-sm text-gray-400 truncate">{b.artist}</p>
                  </div>

                  {/* 날짜 */}
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(b.created_at).toLocaleDateString("ko-KR")}
                  </span>

                  {/* 삭제 */}
                  <button
                    onClick={() => removeBookmark(b.spotify_track_id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  이 날짜에 담은 곡이 없습니다
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 달력 */}
          <div className="w-72 shrink-0">
            <MiniCalendar
              month={calMonth}
              onMonthChange={setCalMonth}
              dateMap={dateMap}
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mini Calendar ─── */
function MiniCalendar({
  month,
  onMonthChange,
  dateMap,
  selectedDate,
  onSelectDate,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  dateMap: Map<string, Bookmark[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();

  const firstDay = new Date(year, mon, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => onMonthChange(new Date(year, mon - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, mon + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="pearl-card p-5 sticky top-8">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-pearl-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {year}년 {mon + 1}월
        </span>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-pearl-100 transition-colors">
          <ChevronR className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;

          const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = dateMap.get(dateStr)?.length ?? 0;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;

          return (
            <button
              key={dateStr}
              onClick={() => count > 0 && onSelectDate(dateStr)}
              disabled={count === 0}
              className={`relative w-full aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                isSelected
                  ? "bg-indigo-500 text-white font-bold"
                  : isToday
                  ? "bg-indigo-50 text-indigo-600 font-semibold"
                  : count > 0
                  ? "text-gray-900 hover:bg-pearl-100 cursor-pointer font-medium"
                  : "text-gray-300 cursor-default"
              }`}
            >
              {day}
              {/* 북마크 dot */}
              {count > 0 && !isSelected && (
                <div className="absolute bottom-0.5 flex gap-0.5">
                  {count <= 3 ? (
                    Array.from({ length: count }).map((_, j) => (
                      <div key={j} className="w-1 h-1 rounded-full bg-indigo-400" />
                    ))
                  ) : (
                    <>
                      <div className="w-1 h-1 rounded-full bg-indigo-400" />
                      <div className="w-1 h-1 rounded-full bg-indigo-400" />
                      <div className="w-1 h-1 rounded-full bg-violet-400" />
                    </>
                  )}
                </div>
              )}
              {count > 0 && isSelected && (
                <span className="absolute -bottom-0.5 text-[9px] font-bold">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-4 pt-3 border-t border-pearl-200 flex items-center gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          북마크 있음
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className="text-white text-[10px] -ml-2.5 font-bold">n</span>
          선택됨
        </div>
      </div>
    </div>
  );
}
