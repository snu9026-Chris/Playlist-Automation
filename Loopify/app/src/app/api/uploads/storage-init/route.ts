import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withErrorHandler } from "@/lib/api-error";

/** Authenticated by the app proxy; direct anonymous Storage writes are disabled. */
export const POST = withErrorHandler(async () => {
  const path = `scheduled/${randomUUID()}.mp4`;
  const { data, error } = await createServerClient().storage.from("media").createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return NextResponse.json({ path, token: data.token });
});
