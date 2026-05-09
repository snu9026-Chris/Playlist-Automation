import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callGemini } from "@/lib/gemini";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const { tracks, projectTheme, projectId } = await req.json();

  // 프로젝트에서 prompts(style + lyrics) 가져오기
  let promptsData: any[] = [];
  if (projectId) {
    const supabase = createServerClient();
    const { data: project } = await supabase
      .from("playlist_projects")
      .select("prompts")
      .eq("id", projectId)
      .single();
    promptsData = project?.prompts ?? [];
  }

  const trackList = tracks
    .map((t: any) => {
      const p = promptsData[t.index];
      const style = p?.style ?? "";
      const lyricsSnippet = (p?.lyrics ?? "")
        .split("\n")
        .filter((l: string) => l.trim() && !l.startsWith("["))
        .slice(0, 10)
        .join(" / ");

      return `#${t.index + 1}: "${t.name}"
  Style: ${style}
  Lyrics keywords: ${lyricsSnippet || "없음"}`;
    })
    .join("\n\n");

  const prompt = `너는 음악 앨범 커버 아트 디렉터다.

아래 곡들의 YouTube Shorts 배경 이미지 테마를 각각 추천해라.
이미지는 **앨범 커버 아트 스타일**이다.

프로젝트 전체 테마: ${projectTheme}

곡 목록 (Style 태그와 가사 키워드 포함):
${trackList}

규칙:
- 각 곡의 **가사에서 핵심 시각 이미지**를 추출해서 테마에 반영
- Style 태그의 장르/무드와 일치하는 비주얼
- 앨범 커버 아트에 어울리는 구체적 장면 묘사
- 테마는 영어로, 구체적인 비주얼 키워드 포함
- 예: "lone figure walking under silver moonlight on ancient stone walls, mist rising, blue-purple palette"
- 절대 일반적인 "party", "club" 같은 뻔한 테마 금지 — 가사에 맞는 고유한 장면을 묘사

JSON으로 응답:
{
  "themes": {
    "0": "구체적인 앨범 커버 장면 묘사",
    "1": "구체적인 앨범 커버 장면 묘사"
  }
}`;

  const result = await callGemini({
    prompt,
    json: true,
    temperature: 0.8,
    fallback: { themes: {} },
  });
  return NextResponse.json(result);
});
