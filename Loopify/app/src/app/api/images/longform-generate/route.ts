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

  // 1. Gemini로 사용자 테마를 영어 장면 묘사로 변환
  let sceneDescription = theme;
  try {
    const translated = await callGemini({
      prompt: `Convert this music video background theme into a detailed English scene description for image generation. Be very specific about objects, lighting, colors, and mood.

Theme: "${theme}"

Respond with ONLY the English description, one paragraph, no quotes:`,
      temperature: 0.7,
    });
    if (translated) sceneDescription = translated;
  } catch {}

  // 2. Imagen으로 이미지 생성
  const imagePrompt = `${sceneDescription}. ${motion}. Wide 16:9 cinematic shot, atmospheric, moody, high quality, no text, no letters, suitable for music playlist video background.`;

  try {
    const { imageUrl } = await generateImage({ prompt: imagePrompt, aspectRatio: "16:9" });
    return NextResponse.json({ imageUrl, theme: sceneDescription });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
});
