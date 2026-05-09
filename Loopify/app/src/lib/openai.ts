/* ─── OpenAI Chat Completions 단일 진입점 (서버 전용) ─── */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

interface CallGptOpts {
  prompt: string;
  /** JSON 응답을 강제하고 자동 파싱 */
  json?: boolean;
  temperature?: number;
  model?: string;
  /** json: true 인 경우 파싱 실패 시 반환할 fallback. 미지정이면 빈 객체 */
  fallback?: unknown;
}

/**
 * GPT 호출. json: true 면 응답을 파싱한 객체를, 아니면 raw text를 반환한다.
 *
 * Why: 4개 라우트에서 같은 fetch + JSON.parse + try/catch를 복붙하던 걸 한 곳으로.
 */
export async function callGpt(opts: CallGptOpts): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [{ role: "user", content: opts.prompt }],
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  if (!opts.json) return content;

  try {
    return JSON.parse(content);
  } catch {
    return opts.fallback ?? {};
  }
}
