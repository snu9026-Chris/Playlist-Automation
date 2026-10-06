import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getValidYouTubeToken } from "@/lib/youtube-auth";
import { publicationStatus, resumeOffset } from "@/lib/upload-policy";
import type { ScheduledUpload } from "@/lib/database.types";

export const maxDuration = 60;
const YT_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

class ExpiredSessionError extends Error {}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { data: queue, error: claimError } = await supabase.rpc("claim_scheduled_upload");
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  const item = queue?.[0] as ScheduledUpload | undefined;
  if (!item) {
    await processComment();
    return NextResponse.json({ message: "No pending uploads" });
  }

  // Leave time to persist recovery state before Vercel terminates the invocation.
  const signal = AbortSignal.timeout(40_000);
  let videoId = item.youtube_video_id;
  try {
    videoId ||= await uploadOne(item, signal);
    // Persist completion before comments or cleanup. Never remove the only source on DB failure.
    const { error } = await supabase.from("scheduled_uploads")
      .update({ status: "completed", youtube_video_id: videoId, error_message: null, locked_at: null })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
    if (item.video_path) await supabase.storage.from("media").remove([item.video_path]);

    return NextResponse.json({ processed: [{ id: item.id, status: "completed", videoId }] });
  } catch (error) {
    const retryCount = item.retry_count + 1;
    const terminal = error instanceof ExpiredSessionError || retryCount >= 3;
    const message = error instanceof Error ? error.message : String(error);
    const { error: saveError } = await supabase.from("scheduled_uploads").update({
      status: terminal ? "failed" : "pending", locked_at: null,
      retry_count: retryCount, error_message: message,
      ...(videoId ? { youtube_video_id: videoId } : {}),
    }).eq("id", item.id);
    // Keep source files and persisted sessions for manual recovery, even on final failure.
    return NextResponse.json({ error: saveError?.message ?? message }, { status: 500 });
  }
}

async function uploadOne(item: ScheduledUpload, signal: AbortSignal): Promise<string> {
  if (!item.video_path || !item.title) throw new Error("Video path and title required");
  const supabase = createServerClient();
  const { data: file, error } = await supabase.storage.from("media").download(item.video_path);
  if (error || !file) throw new Error(error?.message ?? "Storage file missing");
  const bytes = await file.arrayBuffer();
  const token = await getValidYouTubeToken();
  let session = item.upload_session_url;
  let offset = 0;

  if (session) {
    const status = await fetch(session, {
      method: "PUT", signal, headers: { Authorization: `Bearer ${token}`, "Content-Range": `bytes */${bytes.byteLength}` },
    });
    if (status.ok) {
      const data = await status.json();
      if (!data.id) throw new Error("No video ID in completed upload");
      return data.id;
    }
    if (status.status === 404 || status.status === 410) {
      throw new ExpiredSessionError("Upload session expired; verify the channel before manually retrying to avoid duplicate videos");
    }
    if (status.status !== 308) throw new Error(`Upload status: ${status.status}`);
    offset = resumeOffset(status.headers.get("Range"), bytes.byteLength);
    if (offset === bytes.byteLength) throw new Error("Upload completion not confirmed; retry status check");
  } else {
    const init = await fetch(YT_UPLOAD_URL, {
      method: "POST", signal,
      headers: {
        Authorization: `Bearer ${token}`, "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(bytes.byteLength),
      },
      body: JSON.stringify({
        snippet: { title: item.title, description: `${item.description ?? ""}\n\n${(item.tags ?? []).map(t => `#${t}`).join(" ")}`.trim(), tags: item.tags ?? [], categoryId: "10" },
        status: publicationStatus(item.scheduled_at),
      }),
    });
    if (!init.ok) throw new Error(`YouTube init: ${init.status}`);
    session = init.headers.get("Location");
    if (!session) throw new Error("No upload session URL");
    const { error: saveError } = await supabase.from("scheduled_uploads")
      .update({ upload_session_url: session, upload_started_at: new Date().toISOString() }).eq("id", item.id);
    if (saveError) throw new Error(saveError.message);
  }
  const response = await fetch(session, {
    method: "PUT", signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4", "Content-Range": `bytes ${offset}-${bytes.byteLength - 1}/${bytes.byteLength}` },
    body: bytes.slice(offset),
  });
  if (!response.ok) throw new Error(`YouTube upload: ${response.status}`);
  const data = await response.json();
  if (!data.id) throw new Error("No video ID returned");
  return data.id;
}


/** Comments are a separate job so a comment failure never repeats an upload. */
async function processComment() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("claim_scheduled_comment");
  if (error) throw new Error(error.message);
  const item = data?.[0] as ScheduledUpload | undefined;
  if (!item) return;
  let status = "failed";
  try {
    const token = await getValidYouTubeToken();
    const signal = AbortSignal.timeout(10_000);
    const visibility = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${item.youtube_video_id}`, {
      signal, headers: { Authorization: `Bearer ${token}` },
    });
    if (!visibility.ok) throw new Error(`Video status: ${visibility.status}`);
    const video = await visibility.json();
    if (video.items?.[0]?.status?.privacyStatus !== "public") {
      status = "pending"; // YouTube is still processing or waiting to publish.
    } else {
      const response = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
        method: "POST", signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ snippet: { videoId: item.youtube_video_id, topLevelComment: { snippet: { textOriginal: item.first_comment } } } }),
      });
      if (!response.ok) throw new Error(`Comment: ${response.status}`);
      status = "completed";
    }
  } catch (error) { console.error("Scheduled comment failed:", error); }
  const { error: saveError } = await supabase.from("scheduled_uploads")
    .update({ comment_status: status, comment_locked_at: null }).eq("id", item.id);
  if (saveError) throw new Error(saveError.message);
}
