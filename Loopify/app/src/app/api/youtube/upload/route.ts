import { NextResponse } from "next/server";
import { getValidYouTubeToken } from "@/lib/youtube-auth";
import { withErrorHandler } from "@/lib/api-error";

export const maxDuration = 60;

/**
 * 서버 사이드 YouTube 업로드 (브라우저로 토큰 노출 없이 작은 파일을 업로드할 때).
 * 큰 파일은 /api/youtube/upload-init 으로 resumable session URL을 발급받아 브라우저에서 PUT.
 */
export const POST = withErrorHandler(async (req) => {
  const { title, description, tags, firstComment, videoBase64 } = await req.json();

  if (!videoBase64) {
    return NextResponse.json({ error: "videoBase64 required" }, { status: 400 });
  }

  const accessToken = await getValidYouTubeToken();

  // base64 → Buffer
  const videoData = videoBase64.includes(",") ? videoBase64.split(",")[1] : videoBase64;
  const videoBuffer = Buffer.from(videoData, "base64");

  // 설명 끝에 태그를 해시태그로 추가
  const tagHashtags = (tags ?? []).map((t: string) => `#${t}`).join(" ");
  const fullDescription = `${description ?? ""}\n\n${tagHashtags}`.trim();

  // Step 1: Resumable upload init
  const metadata = {
    snippet: {
      title: title ?? "Untitled",
      description: fullDescription,
      tags: tags ?? [],
      categoryId: "10",
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBuffer.length),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    return NextResponse.json({
      error: `YouTube upload init failed: ${err.error?.message ?? initRes.statusText}`,
    }, { status: 500 });
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    return NextResponse.json({ error: "No upload URL returned" }, { status: 500 });
  }

  // Step 2: 파일 업로드
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.length),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    return NextResponse.json({
      error: `YouTube upload failed: ${err.error?.message ?? uploadRes.statusText}`,
    }, { status: 500 });
  }

  const uploadData = await uploadRes.json();
  const videoId = uploadData.id;

  // Step 3: 첫 댓글
  if (firstComment && videoId) {
    try {
      await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            videoId,
            topLevelComment: {
              snippet: { textOriginal: firstComment },
            },
          },
        }),
      });
    } catch {}
  }

  return NextResponse.json({
    success: true,
    videoId,
    youtubeUrl: `https://youtube.com/shorts/${videoId}`,
  });
});
