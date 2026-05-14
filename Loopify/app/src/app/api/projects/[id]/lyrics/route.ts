/**
 * 이 파일은 mp3 클립을 받아 Gemini 멀티모달로 가사를 받아쓰고,
 * 그 결과를 playlist_projects.prompts[slotIndex].lyrics 에 저장한다.
 *
 * - 입력: { slotIndex: number, audioBase64: string, mimeType?: string }
 * - 출력: { lyrics: string }
 *
 * Why: 사용자가 슬롯별 가사를 손으로 타이핑해 넣던 단계를 자동화한다.
 * 텍스트 LLM은 오디오를 못 다루므로 Gemini의 멀티모달이 적합.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callGeminiAudio } from "@/lib/gemini";
import { withErrorHandler, errorResponse } from "@/lib/api-error";

// 오디오 추출은 30초 이상 걸릴 수 있으므로 넉넉히
export const maxDuration = 60;

export const POST = withErrorHandler(async (req, ctx) => {
  const { id } = await ctx.params;
  const { slotIndex, audioBase64, mimeType } = await req.json();

  if (typeof slotIndex !== "number" || !audioBase64) {
    return errorResponse("slotIndex(number)와 audioBase64(string)는 필수", 400);
  }

  // 가사 받아쓰기 프롬프트 — 추측 금지, 들리는 것만, 섹션 태그 금지
  const extractPrompt = `이 오디오 클립의 보컬 가사를 한국어로 받아써라.

규칙:
- 실제로 들리는 가사만 적어라. 추측·창작 금지
- 영어 가사라면 영어 그대로, 한국어는 한국어 그대로
- 줄바꿈으로 한 행씩 구분
- [Chorus], [Verse] 같은 섹션 태그 붙이지 마라
- 안 들리는 부분은 그냥 생략
- 부연 설명 없이 가사 본문만 응답`;

  const text: string = await callGeminiAudio({
    prompt: extractPrompt,
    audioBase64,
    audioMimeType: mimeType || "audio/mpeg",
    temperature: 0.2,
  });

  const lyrics = (text || "").trim();

  // DB 동기화: playlist_projects.prompts JSON 배열의 slotIndex 위치에 lyrics 갱신
  const supabase = createServerClient();
  const { data: project } = await supabase
    .from("playlist_projects")
    .select("prompts")
    .eq("id", id)
    .single();

  const prompts: any[] = Array.isArray(project?.prompts) ? [...project!.prompts] : [];
  while (prompts.length <= slotIndex) prompts.push({});
  prompts[slotIndex] = { ...(prompts[slotIndex] ?? {}), lyrics };

  await supabase
    .from("playlist_projects")
    .update({ prompts })
    .eq("id", id);

  return NextResponse.json({ lyrics });
});
