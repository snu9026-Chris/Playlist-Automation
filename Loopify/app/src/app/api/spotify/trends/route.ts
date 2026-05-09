import { NextRequest, NextResponse } from "next/server";

// Spotify client_credentials 토큰 캐시
let tokenCache: { token: string; expires: number } | null = null;

async function getSpotifyToken() {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

// 국가별 Top 50 playlist ID 매핑
const PLAYLIST_MAP: Record<string, string> = {
  global: "37i9dQZEVXbMDoHDwVN2tF",
  KR: "37i9dQZEVXbNxXF4SkHj9F",
  US: "37i9dQZEVXbLRQDuF5jeBp",
  JP: "37i9dQZEVXbKXQ4mDTEBXq",
  GB: "37i9dQZEVXbLnolsZ8PSNw",
  BR: "37i9dQZEVXbMXbN3EUUhlg",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country") || "global";
    const category = searchParams.get("category") || "전체";
    const q = searchParams.get("q");

    const token = await getSpotifyToken();
    const headers = { Authorization: `Bearer ${token}` };

    // 검색 모드
    if (q) {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
        { headers }
      );
      const data = await res.json();
      const tracks = data.tracks?.items ?? [];

      return NextResponse.json(
        tracks.map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: t.artists,
          album: t.album,
          preview_url: t.preview_url,
          audio_features: null,
        }))
      );
    }

    // 차트 모드 — 플레이리스트 시도, 실패 시 검색 fallback
    const playlistId = PLAYLIST_MAP[country] ?? PLAYLIST_MAP.global;
    const plRes = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=10&fields=items(track(id,name,artists,album,preview_url))`,
      { headers }
    );

    let tracks: any[] = [];

    if (plRes.ok) {
      const plData = await plRes.json();
      const items = plData.items ?? [];
      tracks = items.map((i: any) => i.track).filter(Boolean);
    }

    // 플레이리스트 실패 or 빈 결과 → 검색 fallback (최신곡 위주)
    if (tracks.length === 0) {
      const countryTag: Record<string, string> = {
        global: "", KR: "korean ", US: "american ", JP: "japanese ", GB: "british ", BR: "brazilian ",
      };
      const region = countryTag[country] ?? "";
      const genre = category !== "전체" ? category.toLowerCase() : "pop";

      const queries = [
        `${region}${genre} year:2025-2026`,
        `${region}${genre} year:2024-2026`,
        `${genre} year:2025-2026`,
        genre,
      ];

      for (const searchQ of queries) {
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQ)}&type=track&limit=10`,
          { headers }
        );
        const searchData = await searchRes.json();
        tracks = searchData.tracks?.items ?? [];
        if (tracks.length > 0) break;
      }
    }

    return NextResponse.json(
      tracks.map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: t.artists,
        album: t.album,
        preview_url: t.preview_url,
        audio_features: null,
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
