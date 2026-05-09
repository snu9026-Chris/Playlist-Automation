"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Bookmark,
  BookmarkCheck,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft,
  Globe,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { bookmarksApi } from "@/lib/api/bookmarks";
import { apiFetchSafe } from "@/lib/api/client";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  preview_url: string | null;
  audio_features?: {
    bpm: number;
    energy: number;
    danceability: number;
    valence: number;
  };
}

const COUNTRIES = [
  { code: "global", label: "Global" },
  { code: "KR", label: "한국" },
  { code: "US", label: "미국" },
  { code: "JP", label: "일본" },
  { code: "GB", label: "영국" },
  { code: "BR", label: "브라질" },
];

const CATEGORIES = ["전체", "Chill", "Lofi", "Jazz", "K-Pop", "Electronic", "Pop", "Hip-Hop"];

interface BookmarkInfo {
  id: string;
  title: string;
  artist: string;
  image_url: string | null;
}

export default function ExplorePage() {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkList, setBookmarkList] = useState<BookmarkInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState("global");
  const [category, setCategory] = useState("전체");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 북마크 로드
  useEffect(() => {
    bookmarksApi.list().then((data) => {
      setBookmarks(new Set(data.map((b) => b.spotify_track_id)));
      setBookmarkList(data.map((b) => ({
        id: b.spotify_track_id,
        title: b.title,
        artist: b.artist,
        image_url: b.image_url,
      })));
    });
  }, []);

  // 트렌드 로드
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ country, category });
    if (search) params.set("q", search);
    apiFetchSafe<SpotifyTrack[]>(`/api/spotify/trends?${params}`, [])
      .then(setTracks)
      .finally(() => setLoading(false));
  }, [country, category, search]);

  const toggleBookmark = async (track: SpotifyTrack) => {
    const wasBookmarked = bookmarks.has(track.id);
    const artistName = track.artists.map((a) => a.name).join(", ");
    const imageUrl = track.album.images[0]?.url ?? null;

    // 낙관적 업데이트: 즉시 반영
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(track.id);
      else next.add(track.id);
      return next;
    });
    if (wasBookmarked) {
      setBookmarkList((prev) => prev.filter((b) => b.id !== track.id));
    } else {
      setBookmarkList((prev) => [...prev, { id: track.id, title: track.name, artist: artistName, image_url: imageUrl }]);
    }

    try {
      if (wasBookmarked) {
        await bookmarksApi.remove(track.id);
      } else {
        await bookmarksApi.add({
          spotify_track_id: track.id,
          title: track.name,
          artist: artistName,
          preview_url: track.preview_url,
          image_url: imageUrl,
          audio_features: track.audio_features ?? null,
        });
      }
    } catch {
      // 실패 시 롤백
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(track.id);
        else next.delete(track.id);
        return next;
      });
      if (wasBookmarked) {
        setBookmarkList((prev) => [...prev, { id: track.id, title: track.name, artist: artistName, image_url: imageUrl }]);
      } else {
        setBookmarkList((prev) => prev.filter((b) => b.id !== track.id));
      }
    }
  };

  const togglePlay = (track: SpotifyTrack) => {
    if (!track.preview_url) return;

    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(track.preview_url);
    audio.volume = 0.5;
    audio.play();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  return (
    <div className="flex gap-6">
      {/* 왼쪽: 트렌드 메인 */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            대시보드
          </Link>
          <h1 className="text-xl font-bold">트렌드 탐색</h1>
        </div>

        {/* 검색 + 필터 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="트랙, 아티스트 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* 국가 탭 */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted" />
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setCountry(c.code)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              country === c.code
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              category === cat
                ? "bg-indigo-50 text-primary font-medium"
                : "text-muted hover:bg-surface"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 결과 그리드 */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface h-64" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg font-medium">트렌드를 불러올 수 없습니다</p>
          <p className="text-sm mt-1">Spotify API 키를 확인해 주세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isBookmarked={bookmarks.has(track.id)}
              isPlaying={playingId === track.id}
              onBookmark={() => toggleBookmark(track)}
              onPlay={() => togglePlay(track)}
            />
          ))}
        </div>
      )}
      </div>

      {/* 오른쪽: 북마크 현황판 */}
      <div className="w-64 shrink-0">
        <div className="pearl-card p-4 sticky top-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-indigo-500" />
              북마크
            </h3>
            <span className="text-xs font-bold tabular-nums text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              {bookmarkList.length}곡
            </span>
          </div>

          {bookmarkList.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              곡 카드의 북마크 아이콘을<br />눌러서 담아보세요
            </p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {bookmarkList.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-pearl-50 transition-colors group">
                    {b.image_url ? (
                      <img src={b.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-pearl-200 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{b.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{b.artist}</p>
                    </div>
                    <button
                      onClick={() => {
                        const fakeTrack = { id: b.id, name: b.title, artists: [{ name: b.artist }], album: { images: [{ url: b.image_url }] }, preview_url: null, audio_features: null } as any;
                        toggleBookmark(fakeTrack);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {bookmarkList.length >= 3 && (
                <Link
                  href={`/new?from=bookmarks&country=${country}&category=${category}`}
                  className="flex items-center justify-center gap-1.5 w-full mt-3 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 transition-all"
                >
                  프로젝트 시작
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackCard({
  track,
  isBookmarked,
  isPlaying,
  onBookmark,
  onPlay,
}: {
  track: SpotifyTrack;
  isBookmarked: boolean;
  isPlaying: boolean;
  onBookmark: () => void;
  onPlay: () => void;
}) {
  const [showPlayer, setShowPlayer] = useState(false);
  const artistName = track.artists.map((a) => a.name).join(", ");
  const albumArt = track.album.images[0]?.url;
  const af = track.audio_features;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* Album art */}
      <div className="relative aspect-square bg-surface">
        {albumArt && (
          <img src={albumArt} alt={track.name} className="w-full h-full object-cover" />
        )}
        {/* Play overlay */}
        <button
          onClick={() => setShowPlayer(!showPlayer)}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            showPlayer ? "bg-white/90 scale-100" : "bg-white/80 scale-0 group-hover:scale-100"
          }`}>
            {showPlayer ? (
              <Pause className="w-5 h-5 text-foreground" />
            ) : (
              <Play className="w-5 h-5 text-foreground ml-0.5" />
            )}
          </div>
        </button>
        {/* Bookmark button */}
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark(); }}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-all duration-200 ${
            isBookmarked
              ? "bg-emerald-500 text-white scale-110"
              : "bg-white/80 text-gray-400 hover:bg-white hover:text-gray-700"
          }`}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Spotify mini player */}
      {showPlayer && (
        <iframe
          src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`}
          width="100%"
          height="80"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="border-0"
        />
      )}

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-foreground line-clamp-1">{track.name}</h3>
        <p className="text-xs text-muted line-clamp-1 mt-0.5">{artistName}</p>

        {/* Audio features bars */}
        {af && (
          <div className="mt-2 space-y-1">
            <FeatureBar label="BPM" value={af.bpm} max={200} display={`${Math.round(af.bpm)}`} />
            <FeatureBar label="에너지" value={af.energy} max={1} />
            <FeatureBar label="댄스" value={af.danceability} max={1} />
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureBar({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-muted shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-from to-audio-accent rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      {display && <span className="text-muted tabular-nums w-8 text-right">{display}</span>}
    </div>
  );
}
