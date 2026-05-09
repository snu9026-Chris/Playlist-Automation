import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { platform } = await req.json();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("platforms")
    .update({
      status: "disconnected",
      oauth_token: null,
      refresh_token: null,
      expires_at: null,
    })
    .eq("name", platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
