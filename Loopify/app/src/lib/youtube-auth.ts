/* ─── YouTube OAuth 토큰 관리 (서버 전용) ─── */

import { createServerClient } from "@/lib/supabase";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Supabase platforms 테이블에서 YouTube refresh_token으로 항상 신선한 access_token을 발급한다.
 *
 * 보안 원칙: 이 함수의 반환값은 절대 브라우저로 노출되어선 안 된다.
 * 브라우저로 보낼 일이 있을 때는 access_token 대신 그 토큰으로 만든 단발성 리소스 URL
 * (예: resumable upload session URL) 만 보낸다.
 */
export async function getValidYouTubeToken(): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("platforms")
    .select("oauth_token, refresh_token, expires_at")
    .eq("name", "youtube")
    .single();

  if (!data?.refresh_token) {
    throw new Error("YouTube not connected");
  }

  // expires_at이 충분히 남아있으면 기존 토큰 재사용 (60초 여유)
  if (data.oauth_token && data.expires_at) {
    const expiresMs = new Date(data.expires_at).getTime();
    if (expiresMs - Date.now() > 60_000) return data.oauth_token;
  }

  const refreshRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  const refreshData = await refreshRes.json();

  if (!refreshData.access_token) {
    throw new Error(`Token refresh failed: ${refreshData.error_description ?? refreshData.error ?? "unknown"}`);
  }

  await supabase
    .from("platforms")
    .update({
      oauth_token: refreshData.access_token,
      expires_at: new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq("name", "youtube");

  return refreshData.access_token;
}

/** authorization_code 한 번 교환 (OAuth callback 전용) */
export async function exchangeAuthCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}
