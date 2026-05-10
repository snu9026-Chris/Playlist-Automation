/**
 * Vercel Cron — 예약된 YouTube 업로드 처리.
 *
 * 흐름 (각 pending row마다):
 *   1. status='processing'으로 락 (중복 실행 방지)
 *   2. Supabase Storage(media bucket)에서 영상 다운로드
 *   3. getValidYouTubeToken() — refresh 자동 (oauth-guide #6)
 *   4. YouTube Resumable Upload init → uploadSessionUrl 발급
 *   5. PUT으로 영상 파일 전송
 *   6. 첫 댓글 있으면 5초 후 재시도 3회 작성 (oauth-guide #4)
 *   7. 성공 → status='completed' + youtube_video_id 저장 + Storage 파일 삭제
 *   8. 실패 → retry_count++ (3회 미만이면 'pending' 복귀)
 *           최종 실패 시('failed')에도 Storage 파일 삭제 (사용자 요구)
 *
 * vercel.json cron이 매일 1회 호출. 한 번에 최대 5개 처리.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getValidYouTubeToken } from "@/lib/youtube-auth";

// 5MB × 5 영상 = 최대 25MB 업로드. Pro 플랜에서 60초까지 허용.
export const maxDuration = 60;

const YT_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const YT_COMMENT_URL =
  "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet";

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: queue } = await supabase
    .from("scheduled_uploads")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (!queue || queue.length === 0) {
    return NextResponse.json({ message: "No pending uploads" });
  }

  const results: Array<{ id: string; status: string; videoId?: string; error?: string }> = [];

  for (const item of queue) {
    await supabase.from("scheduled_uploads").update({ status: "processing" }).eq("id", item.id);

    try {
      const videoId = await uploadOne(item);

      await supabase
        .from("scheduled_uploads")
        .update({ status: "completed", youtube_video_id: videoId, error_message: null })
        .eq("id", item.id);

      // 성공 시 Storage 파일 정리
      if (item.video_path) {
        await supabase.storage.from("media").remove([item.video_path]);
      }

      results.push({ id: item.id, status: "completed", videoId });
    } catch (e: any) {
      const retryCount = (item.retry_count ?? 0) + 1;
      const isLastTry = retryCount >= 3;

      await supabase
        .from("scheduled_uploads")
        .update({
          status: isLastTry ? "failed" : "pending",
          retry_count: retryCount,
          error_message: e.message ?? String(e),
        })
        .eq("id", item.id);

      // 최종 실패 시 Storage 파일 삭제 (사용자 요구: 깔끔)
      if (isLastTry && item.video_path) {
        await supabase.storage.from("media").remove([item.video_path]).catch(() => {});
      }

      results.push({ id: item.id, status: isLastTry ? "failed" : "retrying", error: e.message });
    }
  }

  return NextResponse.json({ processed: results });
}

/** 한 영상에 대한 업로드 + 첫 댓글. 실패 시 throw. 성공 시 videoId 반환. */
async function uploadOne(item: any): Promise<string> {
  if (!item.video_path) throw new Error("video_path missing");
  if (!item.title) throw new Error("title missing");

  const supabase = createServerClient();

  // 1. 영상 파일 다운로드
  const { data: fileData, error: dlError } = await supabase.storage
    .from("media")
    .download(item.video_path);
  if (dlError || !fileData) throw new Error(`Storage download: ${dlError?.message ?? "no data"}`);

  const fileBuffer = await fileData.arrayBuffer();

  // 2. YouTube access_token (refresh 자동)
  const accessToken = await getValidYouTubeToken();

  // 3. Resumable Upload init
  const tags: string[] = item.tags ?? [];
  const tagHashtags = tags.map((t) => `#${t}`).join(" ");
  const fullDescription = `${item.description ?? ""}\n\n${tagHashtags}`.trim();

  const initRes = await fetch(YT_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(fileBuffer.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title: item.title,
        description: fullDescription,
        tags,
        categoryId: "10", // Music
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`YouTube init: ${err.error?.message ?? initRes.statusText}`);
  }

  const uploadSessionUrl = initRes.headers.get("Location");
  if (!uploadSessionUrl) throw new Error("No upload session URL");

  // 4. 파일 PUT
  const uploadRes = await fetch(uploadSessionUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`YouTube PUT: ${uploadRes.statusText}`);
  }

  const uploadData = await uploadRes.json();
  const videoId = uploadData.id as string | undefined;
  if (!videoId) throw new Error("No videoId returned");

  // 5. 첫 댓글 (있을 때만, 실패해도 영상은 올라간 상태이므로 throw 안 함)
  if (item.first_comment) {
    try {
      await postFirstComment(accessToken, videoId, item.first_comment);
    } catch (e) {
      console.error("First comment failed (non-fatal):", e);
    }
  }

  return videoId;
}

/** 영상 processing 대비 5초 간격 3회 재시도 (oauth-guide #4). */
async function postFirstComment(accessToken: string, videoId: string, comment: string) {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(YT_COMMENT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: comment } },
        },
      }),
    });

    if (res.ok) return;

    const err = await res.json().catch(() => ({}));
    lastError = err.error?.message ?? res.statusText;
    // 영상 processing 중이거나 not found면 재시도, 다른 에러는 즉시 중단
    if (lastError.includes("processig") || lastError.includes("not found") || res.status === 404) {
      continue;
    }
    break;
  }
  throw new Error(`Comment failed: ${lastError}`);
}
