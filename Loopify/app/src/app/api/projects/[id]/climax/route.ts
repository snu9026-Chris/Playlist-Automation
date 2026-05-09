import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST: ffmpeg RMS로 15개 트랙의 클라이맥스(20초) 자동 추출
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // mp3_url이 있는 트랙 조회
  const { data: tracks } = await supabase
    .from("playlist_tracks")
    .select("id, mp3_url, slot_index")
    .eq("project_id", id)
    .not("mp3_url", "is", null)
    .order("slot_index");

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "No tracks with mp3" }, { status: 400 });
  }

  // TODO: 실제 ffmpeg RMS 분석 — Vercel Functions에서 실행
  // 현재는 기본값(60초 시작, 20초 구간) 세팅
  const updates = tracks.map((t) => ({
    id: t.id,
    clip_start: 60,
    clip_end: 80,
  }));

  for (const u of updates) {
    await supabase
      .from("playlist_tracks")
      .update({ clip_start: u.clip_start, clip_end: u.clip_end })
      .eq("id", u.id);
  }

  return NextResponse.json({ updated: updates.length });
}
