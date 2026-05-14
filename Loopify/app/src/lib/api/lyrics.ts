/**
 * 가사 자동 추출 API 클라이언트 래퍼.
 * mp3 클립 Blob을 base64로 인코딩한 뒤 서버 라우트에 보낸다.
 */
import { apiFetch } from "./client";

/** Blob → base64 (data URL prefix 제거). 20MB 미만 권장. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  // 한 번에 처리하면 큰 파일에서 call stack overflow — chunk로 자른다
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

export const lyricsApi = {
  /** mp3 클립 Blob → Gemini 멀티모달로 가사 받아쓰기. DB도 함께 갱신. */
  extract: async (params: {
    projectId: string;
    slotIndex: number;
    clipBlob: Blob;
  }) => {
    const audioBase64 = await blobToBase64(params.clipBlob);
    return apiFetch<{ lyrics: string; error?: string }>(
      `/api/projects/${params.projectId}/lyrics`,
      {
        method: "POST",
        json: {
          slotIndex: params.slotIndex,
          audioBase64,
          mimeType: params.clipBlob.type || "audio/mpeg",
        },
      },
    );
  },
};
