/**
 * 이 파일은 최근 프로젝트 목록을 반환한다.
 * 호출 시점에 다음을 함께 처리한다:
 *  - deleted_at이 30분 이상 지난 row를 영구 삭제 (cron 없이 lazy 청소)
 *  - 살아있는 row + 30분 안에 소프트 삭제된 row를 함께 응답에 포함
 *    (클라이언트가 회색 카드로 표시하기 위해 deleted_at도 함께 내려줌)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RESTORE_WINDOW_MS = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "5", 10);
    // 기본은 살아있는 프로젝트만. 프로젝트 관리 페이지에서만 ?include_deleted=1 로 호출.
    const includeDeleted = searchParams.get("include_deleted") === "1";

    const supabase = createServerClient();

    // 1) 만료된 소프트 삭제 row 영구 정리 (deleted_at < now - 30min)
    const expiredCutoff = new Date(Date.now() - RESTORE_WINDOW_MS).toISOString();
    await supabase
      .from("playlist_projects")
      .delete()
      .not("deleted_at", "is", null)
      .lt("deleted_at", expiredCutoff);

    // 2) 목록 조회. 기본은 deleted_at IS NULL인 row만, 옵션이면 모두 반환.
    let query = supabase
      .from("playlist_projects")
      .select("id, theme, status, shorts_youtube_urls, deleted_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    const { data } = await query;
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
