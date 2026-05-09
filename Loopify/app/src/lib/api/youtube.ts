import { apiFetch, apiFetchSafe } from "./client";

export const youtubeApi = {
  status: () =>
    apiFetchSafe<{ connected: boolean }>("/api/projects/youtube-status", { connected: false }),

  disconnect: () =>
    apiFetch("/api/auth/disconnect", { method: "POST", json: { platform: "youtube" } }),

  /** 서버에서 resumable session URL 발급 (access_token은 서버에만 머무름) */
  initUpload: (params: { title: string; description: string; tags: string[]; fileSize: number }) =>
    apiFetch<{ uploadSessionUrl: string }>("/api/youtube/upload-init", {
      method: "POST",
      json: params,
    }),

  /** 첫 댓글은 토큰을 노출하지 않기 위해 서버 경유 */
  comment: (videoId: string, comment: string) =>
    apiFetch("/api/youtube/comment", { method: "POST", json: { videoId, comment } }),
};
