import { NextResponse } from "next/server";
import { getValidYouTubeToken } from "@/lib/youtube-auth";

/**
 * YouTube 연결 상태 확인.
 *
 * getValidYouTubeToken()을 호출해서:
 *  - access_token이 살아있으면 그대로 반환 → connected:true
 *  - 만료되었지만 refresh_token이 있으면 자동 갱신 후 → connected:true
 *  - refresh_token도 없거나 갱신 실패 → connected:false
 *
 * 이전엔 expires_at만 보고 만료 판정해서, refresh로 살릴 수 있는 토큰도
 * 미연결로 잘못 표시되던 버그가 있었음.
 */
export async function GET() {
  try {
    await getValidYouTubeToken();
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
