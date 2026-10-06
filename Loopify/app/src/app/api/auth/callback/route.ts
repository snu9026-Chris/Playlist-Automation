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

  const savedState = req.cookies.get("youtube_oauth_state")?.value;
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${baseUrl}${path}`);
    response.cookies.set("youtube_oauth_state", "", { maxAge: 0, path: "/api/auth/callback" });
    return response;
  };
  if (!state || !savedState || state !== savedState) {
    return redirect("/uploads?error=invalid_state");
  }
  if (error || !code) {
    return redirect("/uploads?error=oauth_failed");
  }

  if (state === savedState) {
    try {
      const tokenData = await exchangeAuthCode(code, redirectUri);

      if (!tokenData.access_token || !tokenData.refresh_token) {
        return redirect("/uploads?error=token_failed");
      }

      // 사용자 정보 조회
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      // Supabase에 저장 (platforms 테이블 — upsert)
      const supabase = createServerClient();
      const { error: saveError } = await supabase
        .from("platforms")
        .upsert({
          name: "youtube",
          status: "connected",
          oauth_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
          account_name: userData.name ?? "YouTube",
        }, { onConflict: "name" });

      if (saveError) throw new Error(saveError.message);
      return redirect("/uploads?success=youtube");
    } catch {
      return redirect("/uploads?error=exception");
    }
  }

  return redirect("/uploads");
}
