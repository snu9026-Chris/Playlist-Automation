import { NextResponse } from "next/server";
import { callGpt } from "@/lib/openai";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const { title, description, tags } = await req.json();

  const prompt = `너는 YouTube Shorts 메타데이터 전문가다.

아래 곡 정보를 기반으로 YouTube Shorts 업로드용 메타데이터를 추천해라:
- 현재 제목: ${title}
- 현재 설명: ${description || "없음"}
- 현재 태그: ${(tags ?? []).join(", ") || "없음"}

추천 규칙:
1. **title**: YouTube Shorts에 최적화된 한국어 제목 (40자 이내, 이모지 1~2개 포함, 호기심 유발)
2. **description**: 한국어 설명만 (100자 이내). 해시태그는 여기에 넣지 마라 — 태그 필드에 따로 넣는다
3. **tags**: 영어+한국어 혼합 태그 8~10개 (# 없이 단어만)
4. **firstComment**: 한국어 첫 댓글 (구독 유도 + 소통 유도, 50자 이내)

중요: description에 해시태그(#)를 넣지 마라. 태그는 tags 필드에만.

JSON으로 응답:
{
  "title": "추천 제목",
  "description": "추천 설명 (해시태그 없이)",
  "tags": ["tag1", "tag2"],
  "firstComment": "추천 첫 댓글"
}`;

  const result = await callGpt({
    prompt,
    json: true,
    temperature: 0.8,
  });
  return NextResponse.json(result);
});
