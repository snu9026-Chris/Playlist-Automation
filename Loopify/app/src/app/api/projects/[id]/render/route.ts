import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST: ffmpeg로 쇼츠 15개 렌더링 (이미지 + 오디오 클립 + 비주얼라이저)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: tracks } = await supabase
    .from("playlist_tracks")
    .select("*")
    .eq("project_id", id)
    .not("mp3_url", "is", null)
    .not("image_url", "is", null)
    .not("clip_start", "is", null)
    .order("slot_index");

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ error: "Tracks not ready for rendering" }, { status: 400 });
  }

  // TODO: 실제 ffmpeg 렌더링 로직
  // 각 트랙에 대해:
  // 1. mp3에서 clip_start~clip_end 구간 추출
  // 2. image_url 다운로드
  // 3. ffmpeg로 이미지 + 오디오 + 비주얼라이저 합성 (1080x1920, 20초)
  // 4. Supabase Storage에 mp4 업로드
  // 5. playlist_tracks.short_mp4_url 업데이트

  // 현재는 placeholder — 실제 ffmpeg 구현은 @ffmpeg-installer/ffmpeg 설치 후
  let rendered = 0;

  for (const track of tracks) {
    try {
      // Placeholder: mp4_url을 임시 세팅
      await supabase
        .from("playlist_tracks")
        .update({ short_mp4_url: `pending_render_${track.slot_index}` })
        .eq("id", track.id);
      rendered++;
    } catch (e) {
      console.error(`Render failed for track ${track.slot_index}:`, e);
    }
  }

  return NextResponse.json({ rendered });
}
