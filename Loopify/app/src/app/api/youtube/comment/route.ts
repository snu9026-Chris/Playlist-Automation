import { NextResponse } from "next/server";
import { getValidYouTubeToken } from "@/lib/youtube-auth";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const { videoId, comment } = await req.json();

  if (!videoId || !comment) {
    return NextResponse.json({ error: "videoId and comment required" }, { status: 400 });
  }

  const accessToken = await getValidYouTubeToken();

  // 댓글 작성 (5초 대기 후 재시도 — 영상이 processing 상태인 경우 대비)
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 5000));
    }

    const commentRes = await fetch(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            videoId,
            topLevelComment: {
              snippet: { textOriginal: comment },
            },
          },
        }),
      }
    );

    if (commentRes.ok) {
      const result = await commentRes.json();
      return NextResponse.json({ success: true, commentId: result.id });
    }

    const err = await commentRes.json().catch(() => ({}));
    lastError = err.error?.message ?? commentRes.statusText;

    // "video not found" 또는 "processing"이면 재시도
    if (lastError.includes("processig") || lastError.includes("not found") || commentRes.status === 404) {
      continue;
    }

    break;
  }

  return NextResponse.json({ error: lastError }, { status: 500 });
});
