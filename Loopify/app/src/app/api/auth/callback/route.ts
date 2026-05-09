import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { exchangeAuthCode } from "@/lib/youtube-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://myloopify.vercel.app";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/uploads?error=oauth_failed`);
  }

  if (state === "youtube") {
    try {
      const tokenData = await exchangeAuthCode(code, redirectUri);

      if (!tokenData.access_token) {
        return NextResponse.redirect(`${baseUrl}/uploads?error=token_failed`);
      }

      // 사용자 정보 조회
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      // Supabase에 저장 (platforms 테이블 — upsert)
      const supabase = createServerClient();
      await supabase
        .from("platforms")
        .upsert({
          name: "youtube",
          status: "connected",
          oauth_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
          account_name: userData.name ?? "YouTube",
        }, { onConflict: "name" });

      return NextResponse.redirect(`${baseUrl}/uploads?success=youtube`);
    } catch {
      return NextResponse.redirect(`${baseUrl}/uploads?error=exception`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/uploads`);
}
