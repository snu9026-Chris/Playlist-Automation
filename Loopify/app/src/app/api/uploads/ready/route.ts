import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("playlist_tracks")
      .select("id, project_id, slot_index, title, upload_status, short_mp4_url, short_youtube_url, mp3_url, playlist_projects(theme)")
      .order("created_at", { ascending: false });

    const result = (data ?? []).map((t: any) => ({
      ...t,
      project_theme: t.playlist_projects?.theme ?? "",
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
