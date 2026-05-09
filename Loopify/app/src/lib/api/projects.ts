import type { Project } from "@/lib/types";
import { apiFetch, apiFetchSafe } from "./client";

export const projectsApi = {
  /**
   * 최근 프로젝트 목록.
   * @param limit 가져올 개수
   * @param opts.includeDeleted true면 30분 내 소프트 삭제된 프로젝트도 포함 (프로젝트 관리 페이지 전용)
   */
  recent: (limit = 5, opts: { includeDeleted?: boolean } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts.includeDeleted) params.set("include_deleted", "1");
    return apiFetchSafe<Project[]>(`/api/projects/recent?${params.toString()}`, []);
  },

  get: (id: string) =>
    apiFetch(`/api/projects/${id}`),

  tracks: (id: string) =>
    apiFetchSafe<any[]>(`/api/projects/${id}/tracks`, []),

  saveClip: (id: string, slotIndex: number, clipStart: number, clipEnd: number) =>
    apiFetch(`/api/projects/${id}/tracks/clip`, {
      method: "POST",
      json: { slotIndex, clipStart, clipEnd },
    }),

  create: (data: { theme: string; reference_tracks: any[]; prompts: any[] }) =>
    apiFetch<{ id: string }>(`/api/projects`, { method: "POST", json: data }),

  softDelete: (id: string) =>
    apiFetch(`/api/projects/${id}/delete`, { method: "POST" }),

  hardDelete: (id: string) =>
    apiFetch(`/api/projects/${id}/delete`, { method: "DELETE" }),

  restore: (id: string) =>
    apiFetch(`/api/projects/${id}/delete`, { method: "PATCH" }),

  generateMetadata: (id: string) =>
    apiFetch(`/api/projects/${id}/metadata`, { method: "POST" }),
};
