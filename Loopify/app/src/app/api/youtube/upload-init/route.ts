import { NextResponse } from "next/server";
import { getValidYouTubeToken } from "@/lib/youtube-auth";
import { withErrorHandler } from "@/lib/api-error";

/**
 * YouTube Resumable Upload 세션 URL을 발급한다.
 *
 * 반환값(uploadSessionUrl)은 단발성 짧은 시간 유효한 URL로,
 * 브라우저는 이 URL에 PUT으로만 파일을 올릴 수 있다 (다른 권한 없음).
 * access_token 자체는 서버 밖으로 나가지 않는다.
 */
export const POST = withErrorHandler(async (req) => {
  const { title, description, tags, fileSize } = await req.json();

  if (!fileSize || typeof fileSize !== "number") {
    return NextResponse.json({ error: "fileSize required" }, { status: 400 });
  }

  const accessToken = await getValidYouTubeToken();

  const tagHashtags = (tags ?? []).map((t: string) => `#${t}`).join(" ");
  const fullDescription = `${description ?? ""}\n\n${tagHashtags}`.trim();

  const metadata = {
    snippet: {
      title: title || "Untitled",
      description: fullDescription,
      tags: tags ?? [],
      categoryId: "10", // Music
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
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: `YouTube init failed: ${err.error?.message ?? initRes.statusText}` },
      { status: initRes.status }
    );
  }

  const uploadSessionUrl = initRes.headers.get("Location");
  if (!uploadSessionUrl) {
    return NextResponse.json({ error: "No upload URL returned" }, { status: 500 });
  }

  return NextResponse.json({ uploadSessionUrl });
});
