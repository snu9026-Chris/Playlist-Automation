import { NextResponse } from "next/server";

/**
 * @deprecated 보안 위험으로 비활성화됨.
 *
 * 이전에는 access_token을 브라우저에 그대로 반환했지만, XSS 한 번이면 토큰이 탈취되어
 * 채널 전체를 조작할 수 있었다. 이제 브라우저는 토큰을 받지 못한다 — 대신
 * /api/youtube/upload-init 으로 단발성 resumable session URL만 받아 PUT 업로드한다.
 * 댓글은 /api/youtube/comment 로 서버 경유.
 */
export async function GET() {
  return NextResponse.json(
    { error: "deprecated: use /api/youtube/upload-init for upload, /api/youtube/comment for comments" },
    { status: 410 }
  );
}
