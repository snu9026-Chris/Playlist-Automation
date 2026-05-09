import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST: Nano Banana (Gemini 2.5 Flash)로 15개 이미지 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: project } = await supabase
    .from("playlist_projects")
    .select("theme, prompts")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: tracks } = await supabase
    .from("playlist_tracks")
    .select("id, slot_index, prompt")
    .eq("project_id", id)
    .order("slot_index");

  if (!tracks) {
    return NextResponse.json({ error: "No tracks" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_AI_API_KEY" }, { status: 500 });
  }

  let generated = 0;

  for (const track of tracks) {
    try {
      const imagePrompt = `Create a vertical album cover art (1080x1920) for a YouTube Short music video.
Theme: ${project.theme}
Music style: ${track.prompt}
Style: Modern, cinematic, abstract art. No text or letters. Rich colors, atmospheric.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: imagePrompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
              responseMimeType: "image/png",
            },
          }),
        }
      );

      const data = await res.json();
      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData
      );

      if (imagePart?.inlineData?.data) {
        // Supabase Storage에 업로드
        const buffer = Buffer.from(imagePart.inlineData.data, "base64");
        const path = `loopify/${id}/images/track_${track.slot_index}.png`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, buffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

          await supabase
            .from("playlist_tracks")
            .update({ image_url: urlData.publicUrl })
            .eq("id", track.id);

          generated++;
        }
      }
    } catch (e) {
      console.error(`Image generation failed for track ${track.slot_index}:`, e);
    }
  }

  return NextResponse.json({ generated });
}
