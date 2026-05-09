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
    .from("playlist_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
});
