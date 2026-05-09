import { NextResponse } from "next/server";
import { callGpt } from "@/lib/openai";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const { tracks, promptsPerTrack } = await req.json();

  const perTrack = promptsPerTrack ?? 3;
  const totalTarget = 15;

  const trackDescriptions = (tracks ?? [])
    .map((t: any, i: number) => `
--- 레퍼런스 ${i + 1}: "${t.title}" by ${t.artist} ---
Audio: BPM ${t.audio_features?.bpm ?? "N/A"}, Energy ${t.audio_features?.energy ?? "N/A"}
분석: ${t.analysis ?? "없음"}
선택 테마: ${t.theme ?? "없음"}
`)
    .join("\n");

  const prompt = `너는 Suno AI 음악 생성 프롬프트 전문가다.

아래 레퍼런스 곡들의 분석 결과를 기반으로, 각 곡당 ${perTrack}개씩 총 ${totalTarget}개의 Suno 프롬프트를 생성해라.

${trackDescriptions}

## Suno 프롬프트 형식 (반드시 이 구조를 따라라):

각 프롬프트는 2개 파트로 구성된다:

**1. Style (스타일 태그):**
- 쉼표로 구분된 태그 **8개 이상**
- 장르, 서브장르, 무드, 악기, 보컬 스타일, 시대 느낌, 템포, 프로덕션 특성 포함
- 예: "indie pop, retro pop, soft rock, nostalgic, warm, emotional, male vocal, 70s vibe, clean guitar, soft drums"

**2. Lyrics (가사) — 반드시 3분(180초) 분량:**
- **최소 40줄 이상**, 아래 구조를 반드시 포함:
  [Intro] (2~4줄)
  [Verse 1] (6~8줄)
  [Pre-Chorus] (2~4줄)
  [Chorus] (6~8줄)
  [Verse 2] (6~8줄)
  [Pre-Chorus] (2~4줄)
  [Chorus] (6~8줄)
  [Bridge] (4~6줄)
  [Final Chorus] (6~8줄)
  [Outro] (2~4줄)
- 영어 가사
- 해당 레퍼런스 곡의 감성·주제와 유사하되 완전히 새로운 가사
- 멜로디 단순성, 반복성, earworm 요소를 고려해서 후렴은 따라부르기 쉽게
- **절대로 짧게 쓰지 마라. Verse 1개 + Chorus 1개만 쓰는 것은 금지. 위 구조를 전부 채워라.**

## 핵심 규칙:
- 각 프롬프트의 style은 해당 레퍼런스 곡의 **히트 요소(hook, 구조, 코드 진행, 프로덕션)**를 반영
- 복사가 아닌 **변주** — 원곡의 성공 요소를 차용하되 새로운 곡
- source_track에 어떤 레퍼런스 기반인지 표시
- 총 정확히 ${totalTarget}개

JSON 형식으로 응답:
{
  "prompts": [
    {
      "index": 0,
      "style": "태그1, 태그2, 태그3, ...",
      "lyrics": "[Intro]\\n가사\\n\\n[Verse 1]\\n가사\\n\\n[Chorus]\\n가사...",
      "genre": "메인 장르",
      "mood": "메인 무드",
      "source_track": "원곡 제목"
    }
  ]
}`;

  const result = await callGpt({
    prompt,
    json: true,
    temperature: 0.85,
    fallback: { prompts: [] },
  });
  return NextResponse.json(result);
});
