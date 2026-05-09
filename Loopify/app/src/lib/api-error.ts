/* ─── API 라우트 공통 에러 핸들러 ─── */

import { NextResponse } from "next/server";

/** API 라우트를 try/catch로 감싸는 래퍼 */
export function withErrorHandler(
  handler: (req: Request, ctx?: any) => Promise<NextResponse>,
) {
  return async (req: Request, ctx?: any) => {
    try {
      return await handler(req, ctx);
    } catch (e: any) {
      console.error(`[API Error] ${req.method} ${req.url}:`, e);
      return NextResponse.json(
        { error: e.message || "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/** 에러 응답 생성 헬퍼 */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 성공 응답 생성 헬퍼 */
export function successResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
