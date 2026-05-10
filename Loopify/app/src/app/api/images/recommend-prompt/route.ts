/**
 * 이 파일은 곡의 가사·스타일을 분석해서 9:16 앨범 커버 이미지 생성에 쓸
 * **한국어 프롬프트 1~2문장**을 추천한다.
 * - 입력: { projectId, slotIndex, trackName }
 * - 출력: { prompt: string }  (한국어, 사용자가 textarea에서 편집 후 /api/images/generate 로 보냄)
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callGemini } from "@/lib/gemini";
import { withErrorHandler } from "@/lib/api-error";

export const maxDuration = 30;

export const POST = withErrorHandler(async (req) => {
  const { projectId, slotIndex, trackName } = await req.json();

  // 프로젝트의 가사·스타일·테마 로드
  let style = "";
  let lyrics = "";
  let projectTheme = "";

  if (projectId) {
    const supabase = createServerClient();
    const { data: project } = await supabase
      .from("playlist_projects")
      .select("theme, prompts")
      .eq("id", projectId)
      .single();

    projectTheme = project?.theme ?? "";
    const prompts = project?.prompts ?? [];
    const p = prompts[slotIndex];
    if (p) {
      style = p.style ?? "";
      lyrics = p.lyrics ?? "";
    }
  }

  // 가사에서 시각적 키워드 후보 (섹션 태그 제거, 첫 15줄)
  const lyricsKeywords = lyrics
    .split("\n")
    .filter((l: string) => l.trim() && !l.startsWith("["))
    .slice(0, 15)
    .join(" / ");

  // 외부 디렉팅 규칙·예시 모두 제거. 사용자가 자유롭게 비주얼을 잡을 수 있도록 곡 정보만 전달.
  const recommendPrompt = `아래 곡 정보로 9:16 세로 이미지를 만들 한국어 프롬프트 1~2문장만 작성해라.

곡 제목: "${trackName}"
스타일: ${style}
프로젝트 테마: ${projectTheme}
가사 핵심: ${lyricsKeywords || "없음"}

한국어 1~2문장만 응답:`;

  const text = await callGemini({ prompt: recommendPrompt, temperature: 0.8 });
  const prompt = (text || "").trim() || `${trackName} 앨범 커버 아트`;

  return NextResponse.json({ prompt });
});
