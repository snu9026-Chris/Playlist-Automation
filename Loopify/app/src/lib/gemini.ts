/* ─── Google Gemini 텍스트 호출 단일 진입점 (서버 전용) ─── */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-latest";

interface CallGeminiOpts {
  prompt: string;
  json?: boolean;
  temperature?: number;
  model?: string;
  fallback?: unknown;
}

/**
 * Gemini 텍스트 호출. json: true 면 파싱된 객체, 아니면 trim된 string.
 *
 * Why: 4개 이미지 관련 라우트가 같은 fetch + parse를 반복하고 있었음.
 */
export async function callGemini(opts: CallGeminiOpts): Promise<any> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig,
    }),
  });

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!opts.json) return text.trim();

  try {
    return JSON.parse(text);
  } catch {
    return opts.fallback ?? {};
  }
}
