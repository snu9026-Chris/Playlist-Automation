import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";
import type { Database } from "@/lib/database.types";

type BookmarkInsert = Database["public"]["Tables"]["track_bookmarks"]["Insert"];

export const GET = withErrorHandler(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("track_bookmarks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

export const POST = withErrorHandler(async (req) => {
  const body = await req.json();
  const supabase = createServerClient();

  const row: BookmarkInsert = {
    spotify_track_id: body.spotify_track_id,
    title: body.title,
    artist: body.artist,
    preview_url: body.preview_url,
    image_url: body.image_url,
    audio_features: body.audio_features,
  };

  const { data, error } = await supabase
    .from("track_bookmarks")
    .upsert(row, { onConflict: "spotify_track_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

export const DELETE = withErrorHandler(async (req) => {
  const body = await req.json();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("track_bookmarks")
    .delete()
    .eq("spotify_track_id", body.spotify_track_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
