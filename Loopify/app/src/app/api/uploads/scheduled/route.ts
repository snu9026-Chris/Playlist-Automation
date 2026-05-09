import { NextResponse } from "next/server";
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
