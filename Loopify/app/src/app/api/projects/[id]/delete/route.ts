/**
 * 이 파일은 프로젝트 소프트 삭제 / 영구 삭제 / 복구를 처리한다.
 *  - POST   : 소프트 삭제 (status='deleted', deleted_at=now())
 *  - DELETE : 영구 삭제 (cascade로 tracks, scheduled_uploads도 같이 삭제됨)
 *  - PATCH  : 복구 (status='in_progress', deleted_at=NULL)
 *
 * 30분 카운트다운의 진실 소스는 DB의 deleted_at 컬럼이다.
 * 만료된 row의 영구 삭제는 /api/projects/recent 호출 시점에 일괄 청소된다.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";

// POST: 소프트 삭제
export const POST = withErrorHandler(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabase = createServerClient();

  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from("playlist_projects")
    .update({
      status: "deleted",
      deleted_at: deletedAt,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    deleted_at: deletedAt,
    restorable_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
});

// DELETE: 영구 삭제 (cascade)
export const DELETE = withErrorHandler(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("playlist_projects")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, permanent: true });
});

// PATCH: 복구
export const PATCH = withErrorHandler(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("playlist_projects")
    .update({ status: "in_progress", deleted_at: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, restored: true });
});
