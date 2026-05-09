/* ─── 클라이언트 fetch 통합 진입점 ─── */

interface ApiError extends Error {
  status: number;
  body?: any;
}

export async function apiFetch<T = any>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  // 빈 응답 안전 처리
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

  if (!res.ok) {
    const err = new Error(parsed?.error ?? res.statusText) as ApiError;
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}

/** 실패해도 throw하지 않고 fallback 반환 — 페이지 초기 로드 등에 사용 */
export async function apiFetchSafe<T>(
  url: string,
  fallback: T,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  try {
    return await apiFetch<T>(url, init);
  } catch {
    return fallback;
  }
}
