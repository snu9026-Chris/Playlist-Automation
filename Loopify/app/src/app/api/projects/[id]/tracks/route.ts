import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";

export const GET = withErrorHandler(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("playlist_tracks")
    .select("*")
    .eq("project_id", id)
    .order("slot_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});
