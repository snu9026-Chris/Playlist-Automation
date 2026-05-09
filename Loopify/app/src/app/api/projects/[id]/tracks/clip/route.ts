import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const { slotIndex, clipStart, clipEnd } = await req.json();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("playlist_tracks")
    .update({ clip_start: clipStart, clip_end: clipEnd })
    .eq("project_id", id)
    .eq("slot_index", slotIndex);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
