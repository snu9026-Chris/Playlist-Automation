import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";

// POST: 새 프로젝트 생성
export const POST = withErrorHandler(async (req) => {
  const { theme, reference_tracks, prompts } = await req.json();
  const supabase = createServerClient();

  // 1. playlist_projects 생성
  const { data: project, error: pErr } = await supabase
    .from("playlist_projects")
    .insert({
      theme,
      status: "in_progress",
      reference_tracks,
      prompts,
      shorts_status: "pending",
      shorts_youtube_urls: [],
      longform_status: "pending",
    })
    .select()
    .single();

  if (pErr || !project) {
    return NextResponse.json({ error: pErr?.message ?? "Failed to create project" }, { status: 500 });
  }

  // 2. playlist_tracks 15개 생성
  const trackRows = prompts.map((p: any, i: number) => ({
    project_id: project.id,
    slot_index: i,
    prompt: `[Style]\n${p.style ?? p.prompt ?? ""}\n\n[Lyrics]\n${p.lyrics ?? ""}`,
    upload_status: "pending",
    tags: [],
  }));

  const { error: tErr } = await supabase.from("playlist_tracks").insert(trackRows);

  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  return NextResponse.json(project);
});
