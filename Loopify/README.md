# Loopify

Spotify 트렌드 분석 기반 AI 음악 쇼츠 15개 자동 생성·업로드 본인 전용 웹 서비스.

## 폴더 구조

```
Loopify/
├── README.md                          (이 파일)
├── docs/
│   ├── planning/                      기획 문서 (Q&A 결과물)
│   │   ├── 01-context-priming.json    리서치
│   │   ├── 02-feature-spec.json       기능 기획
│   │   ├── 03-screen-structure.json   화면 기획
│   │   ├── 04-design-spec.json        UI 디자인
│   │   └── upload.mjs                 Supabase 업로드 스크립트
│   └── references/                    참고 자료
│       ├── loopdrop-reference.md      Loopdrop 전체 기획 (인프라 공유)
│       └── oauth-document.md          OAuth 플랫폼별 함정 가이드
└── (Next.js 프로젝트는 start.project로 생성 예정)
```

## Supabase

- Project: **Loopify**
- project_id: `1c601a38-c91b-453e-9287-29275adddc36`
- Loopdrop과 같은 Supabase 프로젝트 공유 (platforms 테이블 재사용)

## 핵심 결정 요약

- 쇼츠 15개 자동 파이프라인이 MVP, 롱폼은 Phase 2
- Vercel Hobby + Fluid Compute + ffmpeg in Functions (로컬 서버 없음)
- Suno 음원 생성·다운로드는 수동, 업로드부터는 전체 자동
- YouTube Resumable Upload를 브라우저에서 직행
- Loopdrop의 YouTube OAuth 토큰 재사용 (platforms 테이블)

상세는 `docs/planning/` 의 4개 JSON 파일 참조.
