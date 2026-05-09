/* ─── Google Imagen 이미지 생성 단일 진입점 (서버 전용) ─── */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "imagen-4.0-fast-generate-001";

interface GenerateImageOpts {
  prompt: string;
  /** "9:16" | "16:9" | "1:1" 등 */
  aspectRatio: string;
  model?: string;
  sampleCount?: number;
}

interface GenerateImageResult {
  /** data:image/png;base64,... 형태의 dataUrl */
  imageUrl: string;
  /** Buffer로 다룰 일이 있는 경우 (예: Supabase Storage 업로드) */
  base64: string;
}

/**
 * Imagen 호출 → data URL 반환.
 *
 * Why: 3개 라우트가 같은 fetch + base64 추출 + dataUrl 조립을 반복했음.
 */
export async function generateImage(opts: GenerateImageOpts): Promise<GenerateImageResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${BASE}/${model}:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt }],
      parameters: {
        sampleCount: opts.sampleCount ?? 1,
        aspectRatio: opts.aspectRatio,
      },
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message ?? "Imagen error");
  }

  const base64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) {
    throw new Error("No image generated");
  }

  return {
    base64,
    imageUrl: `data:image/png;base64,${base64}`,
  };
}
