import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callGpt } from "@/lib/openai";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (
  _req,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const prompt = `너는 유튜브 쇼츠 메타데이터 전문가다.

테마: ${project.theme}

아래 ${tracks.length}개 곡에 대한 유튜브 쇼츠 메타데이터를 생성해라:
${tracks.map((t) => `${t.slot_index + 1}. ${t.prompt}`).join("\n")}

각 곡에 대해:
- title: 유튜브 쇼츠 제목 (한국어, 40자 이내, 이모지 포함 가능)
- description: 설명 (한국어, 100자 이내, 해시태그 포함)
- tags: 태그 5개 (영어+한국어 혼합)

JSON 형식:
{
  "metadata": [
    { "slot_index": 0, "title": "...", "description": "...", "tags": ["tag1", "tag2", ...] }
  ]
}`;

  const parsed = await callGpt({
    prompt,
    json: true,
    temperature: 0.7,
    fallback: { metadata: [] },
  });
  const metadata = parsed.metadata ?? [];

  let updated = 0;
  for (const m of metadata) {
    const track = tracks.find((t) => t.slot_index === m.slot_index);
    if (track) {
      await supabase
        .from("playlist_tracks")
        .update({
          title: m.title,
          description: m.description,
          tags: m.tags ?? [],
        })
        .eq("id", track.id);
      updated++;
    }
  }

  return NextResponse.json({ updated });
});
