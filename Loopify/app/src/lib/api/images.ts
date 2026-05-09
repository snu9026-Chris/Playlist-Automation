import { apiFetch } from "./client";

/**
 * 이미지 관련 API 클라이언트.
 * 숏폼 이미지 생성은 두 단계: 한국어 프롬프트 추천 → 사용자 편집 → 영문 변환 + Imagen 생성.
 */
export const imagesApi = {
  /** 가사·스타일·테마 → 한국어 이미지 프롬프트 1~2문장 추천 (이미지는 안 만듦) */
  recommendPrompt: (params: { projectId: string; slotIndex: number; trackName: string }) =>
    apiFetch<{ prompt: string; error?: string }>(
      "/api/images/recommend-prompt",
      { method: "POST", json: params }
    ),

  /** (편집된) 한국어 프롬프트 → 영문 변환 → Imagen 9:16 생성 */
  generate: (params: { projectId: string; slotIndex: number; prompt: string }) =>
    apiFetch<{ imageUrl: string; error?: string }>(
      "/api/images/generate",
      { method: "POST", json: params }
    ),

  /** 롱폼 배경 이미지 16:9 생성 */
  longformGenerate: (params: { theme: string; index: number; total: number }) =>
    apiFetch<{ imageUrl: string; theme?: string; error?: string }>(
      "/api/images/longform-generate",
      { method: "POST", json: params }
    ),
};
