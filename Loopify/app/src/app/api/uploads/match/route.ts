import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { fileName } = await req.json();

  if (!fileName) {
    return NextResponse.json({ error: "fileName required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // 파일명에서 _highlight.mp4 제거하고 키워드 추출
  const cleanName = fileName
    .replace(/_highlight\.mp4$/i, "")
    .replace(/\.mp4$/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();

  // playlist_tracks에서 title로 매칭 시도
  const { data: tracks } = await supabase
    .from("playlist_tracks")
    .select("title, description, tags, prompt")
    .not("title", "is", null);

  if (!tracks || tracks.length === 0) {
    return NextResponse.json({ matched: false });
  }

  // 파일명과 가장 유사한 트랙 찾기
  let bestMatch = null;
  let bestScore = 0;

  for (const track of tracks) {
    const trackTitle = (track.title ?? "").toLowerCase();
    // 단어 매칭 점수 계산
    const fileWords = cleanName.split(/\s+/);
    const titleWords = trackTitle.split(/\s+/);
    let matchCount = 0;
    for (const fw of fileWords) {
      if (fw.length < 2) continue;
      if (titleWords.some((tw: string) => tw.includes(fw) || fw.includes(tw))) {
        matchCount++;
      }
    }
    const score = fileWords.length > 0 ? matchCount / fileWords.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = track;
    }
  }

  if (bestMatch && bestScore > 0.3) {
    return NextResponse.json({
      matched: true,
      title: bestMatch.title,
      description: bestMatch.description,
      tags: bestMatch.tags,
    });
  }

  return NextResponse.json({ matched: false });
}
