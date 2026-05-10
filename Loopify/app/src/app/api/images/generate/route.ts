/**
 * 이 파일은 사용자가 (편집한) 한국어 프롬프트를 받아서
 * Gemini로 영문 변환 → Imagen 9:16 이미지 생성을 수행한다.
 * - 입력: { projectId, slotIndex, prompt }   (prompt는 한국어)
 * - 출력: { imageUrl }
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callGemini } from "@/lib/gemini";
import { generateImage } from "@/lib/imagen";
import { withErrorHandler } from "@/lib/api-error";

export const maxDuration = 60;

export const POST = withErrorHandler(async (req) => {
  const { projectId, slotIndex, prompt } = await req.json();

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt가 비어있습니다" }, { status: 400 });
  }

  // 한국어 프롬프트를 Imagen에 적합한 영문으로 변환 (Imagen은 영문이 더 안정적)
  const translatePrompt = `다음 한국어 이미지 프롬프트를 영어로 번역해라.
시각 요소(색감, 분위기, 오브젝트, 구도)를 빠짐없이 보존하고, 설명 없이 영문 프롬프트만 출력한다.

한국어: ${prompt.trim()}

English:`;

  const englishRaw = await callGemini({ prompt: translatePrompt, temperature: 0.3 });
  const englishPrompt = (englishRaw || "").trim() || prompt.trim();

  // 사용자 프롬프트 100% — 외부 wrapper("album cover" 등) 추가 안 함.
  // 이전엔 "Music album cover art style ... Bold colors, iconic" 같은 wrapper가
  // 사용자 의도("실사", "조용한") 를 압도해서 엉뚱한 이미지가 나왔음.
  const { imageUrl } = await generateImage({ prompt: englishPrompt, aspectRatio: "9:16" });

  // 메타데이터만 Supabase에 저장 (실제 이미지는 클라이언트가 보유)
  if (projectId && typeof slotIndex === "number") {
    const supabase = createServerClient();
    await supabase
      .from("playlist_tracks")
      .update({ image_url: `imagen_generated_slot_${slotIndex}` })
      .eq("project_id", projectId)
      .eq("slot_index", slotIndex);
  }

  return NextResponse.json({ imageUrl });
});
