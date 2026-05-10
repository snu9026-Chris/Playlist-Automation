/**
 * 예약 업로드 큐 — 조회(GET) + 등록(POST)
 *
 * GET:  현재 큐의 모든 row 반환 (UI 목록용)
 * POST: 한 영상에 대해 scheduled_uploads 테이블에 row INSERT
 *       (영상 파일은 클라이언트가 미리 Supabase Storage media/scheduled/* 에 올려두고 path만 전달)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("scheduled_uploads")
      .select("*, playlist_tracks(title, slot_index), playlist_projects(theme)")
      .order("scheduled_at", { ascending: true });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

interface ScheduleBody {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  firstComment?: string;
  scheduledAt: string;
  trackId?: string | null;
  projectId?: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ScheduleBody;
  const { videoPath, title, scheduledAt } = body;

  if (!videoPath || !title || !scheduledAt) {
    return NextResponse.json(
      { error: "videoPath, title, scheduledAt required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("scheduled_uploads")
    .insert({
      video_path: videoPath,
      title,
      description: body.description ?? null,
      tags: body.tags ?? [],
      first_comment: body.firstComment ?? null,
      scheduled_at: scheduledAt,
      track_id: body.trackId ?? null,
      project_id: body.projectId ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
