/**
 * 사용자 PC의 로컬 렌더 서버에 접속할 Cloudflare Tunnel URL을 반환한다.
 *
 * 시점: start.bat → start-with-tunnel.mjs가 cloudflared를 띄우면서 받은 임시 HTTPS URL을
 *       Supabase app_config 테이블에 upsert한다. 브라우저는 이 라우트로 최신 URL을 받아
 *       /health 폴링·렌더 호출에 사용.
 *
 * 응답: { url: string | null }
 *  - null = 아직 tunnel 안 떠있음 (사용자가 start.bat 안 돌렸거나, cloudflared 시작 중)
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("app_config")
      .select("value, updated_at")
      .eq("key", "render_tunnel_url")
      .single();
    return NextResponse.json({ url: data?.value ?? null, updatedAt: data?.updated_at ?? null });
  } catch {
    return NextResponse.json({ url: null });
  }
}
