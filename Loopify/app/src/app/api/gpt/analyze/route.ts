import { NextResponse } from "next/server";
import { callGpt } from "@/lib/openai";
import { withErrorHandler } from "@/lib/api-error";

export const POST = withErrorHandler(async (req) => {
  const { tracks } = await req.json();

  const prompt = `너는 10년 경력의 음악 프로듀서이자 히트곡 구조 분석 전문가다.

아래 ${tracks.length}곡을 **각각 개별적으로 심층 분석**해라.

${tracks.map((t: any, i: number) => `${i + 1}. "${t.title}" by ${t.artist} (BPM: ${t.audio_features?.bpm ?? "N/A"}, Energy: ${t.audio_features?.energy ?? "N/A"}, Danceability: ${t.audio_features?.danceability ?? "N/A"}, Valence: ${t.audio_features?.valence ?? "N/A"})`).join("\n")}

각 곡마다 아래 9가지 관점에서 **이 곡이 왜 히트했는지** 분석해라:

1. **Hook / 킬링파트** — 귀에 꽂히는 핵심 멜로디·가사·리듬 패턴. 어떤 요소가 중독성을 만드는지.
2. **Structure (곡 구조)** — Intro-Verse-Pre-Chorus-Chorus-Bridge 배치. 후렴 진입 타이밍(몇 초 만에 코러스?). 구조적 특이점.
3. **Chord Progression** — 코드 진행 특성 (4536, 1564, minor loop 등). 코드가 주는 정서적 효과.
4. **Melodic Simplicity** — 멜로디 음역대, 움직임 범위, 따라부르기 난이도. 단순할수록 대중적.
5. **Repetition & Earworm** — 같은 프레이즈·가사·리듬의 반복 횟수와 패턴. 이어웜(earworm) 요소.
6. **Production / 사운드** — 핵심 악기, 신디사이저, 비트 스타일, 믹싱 특징 (808 베이스, 사이드체인, 필터 스윕, 공간감 등).
7. **Energy Curve** — 곡 전체의 에너지 흐름. 빌드업→드롭, 긴장→해소 구간. 다이나믹 변화.
8. **Vocal Style** — 보컬 톤, 전달 방식 (위스퍼링, 파워풀, 오토튠, 레이어링 등). 보컬이 곡에 기여하는 방식.
9. **Trend Fit** — 이 곡이 현재 음악 트렌드(2024-2026)와 어떻게 맞닿아 있는지.

**출력 규칙:**
- analysis는 위 9가지를 종합해서 **6~10문장**으로 작성 (한국어)
- 단순히 "좋다", "인기있다"가 아니라 **구체적인 음악적 요소명**을 반드시 언급
- 각 곡에 어울리는 AI 음악 생성 테마 방향 2~3개 추천

JSON 형식으로 응답:
{
  "tracks": [
    {
      "title": "원곡 제목",
      "artist": "아티스트",
      "analysis": "심층 히트 구조 분석 (한국어, 6~10문장)",
      "themes": ["테마1", "테마2", "테마3"]
    }
  ]
}`;

  const result = await callGpt({
    prompt,
    json: true,
    temperature: 0.7,
    fallback: { tracks: [] },
  });
  return NextResponse.json(result);
});
