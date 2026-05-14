/* ─── Google Gemini 호출 단일 진입점 (서버 전용) ─── */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-latest";
const DEFAULT_AUDIO_MODEL = "gemini-2.5-flash";

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

interface CallGeminiAudioOpts {
  prompt: string;
  /** base64 인코딩된 오디오 데이터 (data URL prefix 없이) */
  audioBase64: string;
  /** 기본 "audio/mpeg" (mp3). wav면 "audio/wav" 등 */
  audioMimeType?: string;
  model?: string;
  temperature?: number;
  json?: boolean;
  fallback?: unknown;
}

/**
 * Gemini 멀티모달 호출 — 오디오 + 텍스트 프롬프트.
 * 가사 받아쓰기, 음악 분위기 분석 등 audio 입력이 필요한 라우트가 사용.
 *
 * Why: 텍스트 LLM은 못 하는 영역. inlineData(base64)는 20MB 이하 권장.
 */
export async function callGeminiAudio(opts: CallGeminiAudioOpts): Promise<any> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const model = opts.model ?? DEFAULT_AUDIO_MODEL;
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: opts.audioMimeType ?? "audio/mpeg",
                data: opts.audioBase64,
              },
            },
            { text: opts.prompt },
          ],
        },
      ],
      generationConfig,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini audio error: ${data?.error?.message || res.statusText}`);
  }
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!opts.json) return text.trim();

  try {
    return JSON.parse(text);
  } catch {
    return opts.fallback ?? {};
  }
}
