import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const projectId = formData.get("projectId") as string;
  const slotIndex = parseInt(formData.get("slotIndex") as string, 10);

  if (!file || !projectId || isNaN(slotIndex)) {
    return NextResponse.json({ error: "Missing file, projectId, or slotIndex" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Supabase Storage에 업로드
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `loopify/${projectId}/mp3/track_${slotIndex}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

  // playlist_tracks 업데이트
  const { error: updateError } = await supabase
    .from("playlist_tracks")
    .update({ mp3_url: urlData.publicUrl })
    .eq("project_id", projectId)
    .eq("slot_index", slotIndex);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: urlData.publicUrl });
}
