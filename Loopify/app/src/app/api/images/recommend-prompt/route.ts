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

  const recommendPrompt = `너는 음악 앨범 커버 아트 디렉터다.
아래 곡의 가사·스타일·프로젝트 테마를 분석해서, 9:16 세로형 앨범 커버 이미지를 만들기 위한 **한국어 프롬프트 1~2문장**을 작성해라.

곡 제목: "${trackName}"
스타일: ${style}
프로젝트 테마: ${projectTheme}
가사 핵심:
${lyricsKeywords || "가사 없음"}

규칙:
- 한국어로 작성 (사용자가 읽고 편집할 수 있어야 함)
- 시각 요소를 구체적으로: 색감 팔레트, 분위기, 핵심 오브젝트, 구도
- 실제 사람 얼굴은 피하고 실루엣·추상적 인물·오브젝트 중심으로
- "파티", "클럽", "콘서트" 같은 뻔한 표현 금지
- 텍스트·로고·글자 묘사 금지
- 예시: "달빛 아래 고대 석벽 위에 홀로 선 실루엣, 보랏빛 안개가 피어오르는 우울하고 푸른 은빛 톤의 앨범 커버 아트"

한국어 1~2문장만 응답:`;

  const text = await callGemini({ prompt: recommendPrompt, temperature: 0.8 });
  const prompt = (text || "").trim() || `${trackName} 앨범 커버 아트`;

  return NextResponse.json({ prompt });
});
