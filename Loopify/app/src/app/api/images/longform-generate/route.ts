import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";
import { generateImage } from "@/lib/imagen";
import { withErrorHandler } from "@/lib/api-error";

const MOTION_VARIATIONS = [
  "camera angle straight on, neutral position",
  "camera slightly shifted to the left, subtle parallax",
  "camera slightly zoomed in, closer perspective",
  "camera slightly shifted to the right, gentle drift",
];

export const POST = withErrorHandler(async (req) => {
  const { theme, index, total: _total } = await req.json();
  const motion = MOTION_VARIATIONS[index % MOTION_VARIATIONS.length];

  // 1. Gemini로 한국어 → 영어 단순 번역만 수행 (외부 디렉팅·구체화 요청 제거).
  //    Imagen은 영어가 더 안정적이라 번역만 하고 시각 의도는 사용자 텍스트에 맡김.
  let sceneDescription = theme;
  try {
    const translated = await callGemini({
      prompt: `Translate this Korean image prompt to English, preserving all visual elements. Output only the English text:

Korean: "${theme}"
English:`,
      temperature: 0.3,
    });
    if (translated) sceneDescription = translated.trim();
  } catch {}

  // 2. Imagen 호출 — wrapper("cinematic, atmospheric, moody, music playlist…") 제거.
  //    motion 변주는 4장 슬라이드쇼 패럴랙스 효과를 위한 의도된 기능이라 유지.
  //    "no text"만 남김 (Imagen이 텍스트 박는 단점 방지).
  const imagePrompt = `${sceneDescription}. ${motion}, 16:9, no text in image.`;

  try {
    const { imageUrl } = await generateImage({ prompt: imagePrompt, aspectRatio: "16:9" });
    return NextResponse.json({ imageUrl, theme: sceneDescription });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
});
