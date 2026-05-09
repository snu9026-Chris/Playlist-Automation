import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getValidYouTubeToken } from "@/lib/youtube-auth";
import { withErrorHandler } from "@/lib/api-error";

// POST: YouTube Resumable Upload로 트랙 업로드 (현재는 placeholder)
export const POST = withErrorHandler(async (
  _req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabase = createServerClient();

  // 토큰 사전 발급해서 만료/연결 끊김을 미리 체크 (현재 placeholder라 사용 안 하지만 검증 의미)
  let _accessToken: string;
  try {
    _accessToken = await getValidYouTubeToken();
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "YouTube auth failed" }, { status: 401 });
  }

  // 업로드할 트랙 조회
  const { data: tracks } = await supabase
    .from("playlist_tracks")
    .select("*")
    .eq("project_id", id)
    .not("short_mp4_url", "is", null)
    .eq("upload_status", "pending")
    .order("slot_index");

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "No tracks ready to upload" }, { status: 400 });
  }

  const results: { slot: number; status: string; url?: string; error?: string }[] = [];

  // Promise.allSettled로 병렬 업로드
  const uploads = tracks.map(async (track) => {
    try {
      await supabase
        .from("playlist_tracks")
        .update({ upload_status: "uploading" })
        .eq("id", track.id);

      // TODO: 실제 YouTube Resumable Upload 구현
      // 1. POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
      //    - snippet: { title, description, tags, categoryId: "10" (Music) }
      //    - status: { privacyStatus: "public", selfDeclaredMadeForKids: false }
      //    - 응답 헤더의 Location이 upload URL
      // 2. PUT {upload_url} with video file body
      // 3. 응답에서 video ID 추출

      // Placeholder
      const youtubeUrl = `https://youtube.com/shorts/placeholder_${track.slot_index}`;

      await supabase
        .from("playlist_tracks")
        .update({
          upload_status: "completed",
          short_youtube_url: youtubeUrl,
        })
        .eq("id", track.id);

      return { slot: track.slot_index, status: "completed", url: youtubeUrl };
    } catch (e: any) {
      await supabase
        .from("playlist_tracks")
        .update({ upload_status: "failed" })
        .eq("id", track.id);

      return { slot: track.slot_index, status: "failed", error: e.message };
    }
  });

  const settled = await Promise.allSettled(uploads);
  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      results.push({ slot: -1, status: "failed", error: String(r.reason ?? "unknown") });
    }
  }

  // 프로젝트 shorts_youtube_urls 업데이트
  const completedUrls = results.filter((r) => r.url).map((r) => r.url!);
  if (completedUrls.length > 0) {
    const { data: proj } = await supabase
      .from("playlist_projects")
      .select("shorts_youtube_urls")
      .eq("id", id)
      .single();

    const existing = proj?.shorts_youtube_urls ?? [];
    await supabase
      .from("playlist_projects")
      .update({
        shorts_youtube_urls: [...existing, ...completedUrls],
        shorts_status: "completed",
      })
      .eq("id", id);
  }

  return NextResponse.json({ results });
});
