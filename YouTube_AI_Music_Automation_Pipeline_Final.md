# YouTube AI 음악 자동화 파이프라인 — 전체 기획 및 기술 정리 (최종)

## 프로젝트 개요

YouTube 트렌드를 분석하여 인기 음악의 특성을 파악하고, 이를 기반으로 AI 음악을 자동 생성한 뒤 영상까지 제작하여 YouTube에 자동 게시하는 **End-to-End 자동화 시스템** 구축.

유료 분석 사이트(vidIQ, Social Blade, Noxinfluencer 등)가 제공하는 기능을 직접 구현하고, 거기에 AI 음악 생성 + 자동 게시까지 확장하는 것이 목표.

---

## 전체 파이프라인 흐름

```
① YouTube 트렌드 분석              (YouTube Data API v3 - 무료 쿼터)
    ↓
② 자막/가사 추출                    (youtube-transcript-api - 무료)
    ↓
③ 곡 분석 + 장르별 성공 패턴 추출   (LLM API - 소액)
    ↓
④ Suno AI 프롬프트 자동 생성        (LLM API - 소액)
    ↓
⑤ AI 곡 10개 자동 생성              (Suno API - 소액)
    ↓
⑥ 앨범아트 이미지 생성              (Gemini API - 소액)
    ↓
⑦ Remotion으로 영상 제작            (로컬 실행 - 무료)
   - 이미지 + 오디오 합성
   - Whisper 음성 인식 → 자막 자동 생성
   - TikTok 스타일 자막 애니메이션
   - 곡 제목 오버레이 + 전환 효과
   - 10곡 플레이리스트 영상으로 합치기
    ↓
⑧ 제목/설명/태그 자동 생성          (LLM API - 소액)
    ↓
⑨ YouTube 자동 업로드 + 썸네일      (YouTube Data API v3 - 무료 쿼터)
```

**핵심 설계 원칙: 전부 로컬에서 실행하고, 최종 업로드만 API로.**
- 서버 비용 0원
- API 비용만 발생 (소액)
- 터미널 한 줄로 전체 파이프라인 실행 가능

---

## 단계별 상세 기술 명세

---

### STEP 1: YouTube 트렌드 분석

**목적:** 특정 테마/장르에서 최근 인기 있는 영상(음악)을 찾아내기

**사용 API:** YouTube Data API v3

**핵심 엔드포인트 및 쿼터 비용:**

| 엔드포인트 | 용도 | 비용 |
|---|---|---|
| `Channels.list` | 채널의 uploads 플레이리스트 ID 확인 | 1 unit |
| `PlaylistItems.list` | 영상 ID 목록 수집 (페이지당 최대 50개) | 1 unit/페이지 |
| `Videos.list` | 조회수, 좋아요 등 통계 확인 (최대 50개 배치) | 1 unit/호출 |
| `Search.list` | 키워드 기반 검색 (**가급적 사용 자제**) | **100 units** |

**무료 쿼터:** 하루 10,000 units

**Search.list가 뭔가:**
- YouTube 웹사이트 상단 검색창에 키워드 치는 것과 동일한 기능
- 예: `q=먹방&type=video&order=viewCount&publishedAfter=2026-03-12T00:00:00Z`
- 호출 1회에 100 units이라 하루 100번밖에 못 씀
- **절대 남발 금지** → PlaylistItems + Videos 조합이 100배 효율적

**효율적인 검색 전략:**
- `Search.list` 대신 `PlaylistItems.list` + `Videos.list` 조합 사용 (각 1 unit)
- `Videos.list`의 `chart=mostPopular` 파라미터로 카테고리별 인기 영상 조회 가능
- 미리 채널 ID 목록을 확보 → PlaylistItems로 영상 목록 → Videos.list로 조회수 가져오기
- 하루 10,000 units이면 약 **470개 채널** 분석 가능

**실제 비용 계산 예시 (영상 500개짜리 채널 1개):**
- Channels.list: 1 unit
- PlaylistItems.list: 500 ÷ 50 = 10페이지 → 10 units
- Videos.list: 500 ÷ 50 = 10호출 → 10 units
- **합계: 약 21 units**

**기간별 조회수 변화량 한계:**
- API는 **누적 조회수**만 제공, "최근 1달 증가량" 같은 건 직접 계산해야 함
- **주기적으로 데이터를 수집하여 DB에 저장**하고 차이를 계산하는 구조 필요
- 이것이 유료 서비스들의 핵심 부가가치이며, 데이터가 쌓일수록 정교한 분석 가능

**인증:**
- 읽기 전용 작업(검색, 조회)은 **API 키**만으로 충분
- 업로드 등 쓰기 작업에는 **OAuth 2.0** 필요

**쿼터 초과 시:** 429 에러 → 다음 날 자정(태평양 시간)에 리셋. 추가 쿼터 필요 시 Google Cloud Console에서 신청 가능 (승인까지 시간 소요)

---

### STEP 2: 자막/가사 추출

**목적:** 인기 영상의 내용(대사, 가사)을 텍스트로 추출

**사용 도구:** `youtube-transcript-api` (Python 라이브러리)

**특징:**
- YouTube API 쿼터를 **전혀 소모하지 않음** (무료)
- 영상 ID만 넣으면 자동 생성 자막 또는 수동 자막을 텍스트로 추출
- 한국어, 영어 등 다국어 지원

**코드 예시:**
```python
from youtube_transcript_api import YouTubeTranscriptApi

transcript = YouTubeTranscriptApi.get_transcript("영상ID", languages=['ko', 'en'])
full_text = ' '.join([t['text'] for t in transcript])
```

**주의사항:**
- 자막이 아예 없는 영상(자동 자막도 비활성화된 경우)은 추출 불가
  - 이 경우 음성을 직접 추출하여 **Whisper**(OpenAI STT 모델) 등으로 변환 필요
  - 비용과 처리 시간이 크게 증가함
- 한국어 자동 생성 자막은 정확도가 들쭉날쭉 (오탈자 존재)
  - LLM 요약 시 어느 정도 자동 보정됨

---

### STEP 3: LLM을 활용한 곡 분석

**목적:** 추출된 자막/가사를 바탕으로 곡의 특성을 분석

**사용 도구:** LLM API (GPT, Claude, Gemini 중 선택)

**분석 가능 항목 (프롬프트 하나로 전부 처리):**
- 주제 요약 (예: "이별 후 그리움을 다룬 곡")
- 감성 분석 (기쁨/슬픔/분노/그리움/희망 비율)
- 언어 분석 (한국어/영어/일본어 등)
- 장르/무드 태깅 (발라드, 감성적, 새벽감성 등)
- 필요 시 추가 항목은 프롬프트에 한 줄 추가하면 됨

**프롬프트 예시:**
```python
prompt = f"""
다음 노래 가사를 분석해서 JSON으로 응답해줘.

가사:
{lyrics_text}

분석 항목:
1. 주제 요약 (한 줄)
2. 감성 분석 (기쁨/슬픔/분노/그리움/희망 각각 0~100%)
3. 언어 (한국어/영어/일본어 등)
4. 장르/무드 태그 3~5개
"""
```

**LLM 응답 예시:**
```json
{
  "summary": "이별 후 상대를 그리워하는 감정을 다룬 곡",
  "sentiment": {
    "슬픔": 65,
    "그리움": 80,
    "희망": 15,
    "기쁨": 5,
    "분노": 10
  },
  "language": "한국어",
  "mood_tags": ["발라드", "감성적", "새벽감성", "이별", "회상"]
}
```

**왜 별도 NLP 도구 없이 LLM만으로 충분한가:**
- 예전에는 감성 분석 = BERT, 장르 분류 = 별도 모델 등 항목마다 다른 도구 필요
- 지금은 LLM이 프롬프트 하나로 전부 처리
- 분석 항목 추가/변경도 프롬프트 수정만으로 즉시 반영

**노래 가사 분석 시 저작권 주의:**
- 가사 원문을 웹사이트에 그대로 표시하면 **저작권 침해** 리스크
- Genius 같은 가사 사이트도 음악 출판사와 별도 라이선스 계약 운영
- **안전한 접근:** 가사 원문 대신 LLM이 분석한 메타데이터(주제, 감성, 무드)만 서비스에 표시

**비용:**
- 가사 텍스트는 보통 짧음 (300~500 단어)
- 곡 하나 분석에 **약 5~10원** (Claude Sonnet 기준)

---

### STEP 3-1: 장르별 성공곡 히스토리 분석 (확장)

**목적:** 현재 트렌드뿐 아니라, 해당 장르에서 역대 성공했던 곡들의 공통 패턴까지 추출하여 더 정교한 Suno 프롬프트 생성

**구조:**
1. **현재 트렌드 분석:** 최근 1달 인기곡 상위 20곡 특성 추출
2. **장르별 성공곡 히스토리 분석:** 해당 장르에서 최근 1년간 조회수 높았던 곡들의 공통 패턴 추출
3. **두 분석을 합쳐서** Suno 프롬프트 생성 → 트렌드 반영 + 검증된 성공 공식 적용

**DB가 핵심:**
- 장르별 인기곡 데이터를 주기적으로 수집 (YouTube API)
- 각 곡의 자막/가사 분석 결과를 DB에 저장
- **데이터가 쌓일수록 장르별 성공 패턴이 정교해지는 구조**
- 서비스를 오래 운영할수록 경쟁력이 생기는 모델

**성공곡 패턴 예시:**
> K-Pop 발라드 성공곡들의 공통점:
> - 피아노 인트로로 시작
> - 2절 후반에 키 전환
> - 후렴 멜로디가 단순하고 반복적
> - 곡 길이 3분 30초~4분

**프롬프트 구조:**
```python
prompt = f"""
[현재 트렌드]
{최근_인기곡_분석}

[이 장르의 성공곡 공통 특성]
{장르별_성공곡_분석}

위 두 가지를 모두 반영해서 Suno AI 프롬프트를 생성해줘.
현재 트렌드의 분위기를 따르되, 
성공곡들의 검증된 구조적 패턴을 적용해줘.
"""
```

---

### STEP 4: Suno AI 프롬프트 자동 생성

**목적:** 분석된 트렌드 + 성공 패턴을 기반으로 Suno AI에 넣을 프롬프트를 LLM이 자동 생성

**LLM 출력 예시:**
```
Genre: K-Pop Ballad
BPM: 72
Mood: melancholic, dreamy, late-night
Structure: Intro - Verse - Pre-chorus - Chorus - Verse - Bridge - Chorus - Outro
Vocal: soft female vocal, breathy, emotional
Tags: sad, piano, strings, ambient
```

**비용:** LLM 호출 1회, 약 10~20원

---

### STEP 5: Suno API로 곡 자동 생성

**목적:** LLM이 생성한 프롬프트를 Suno API에 전달하여 실제 곡 자동 생성 (비슷한 느낌의 곡 10개)

**현재 상황 (중요):**
- Suno는 **공식 공개 API를 아직 제공하지 않음** (파트너 베타만 존재)
- 서드파티 API 서비스(sunoapi.org 등)를 통해 REST API 방식으로 사용 가능
- 오픈소스 래퍼(github.com/gcui-art/suno-api)도 존재하나 비공식이라 계정 밴 리스크 있음

**서드파티 API 주요 엔드포인트:**
- `/api/generate` — 프롬프트 기반 음악 생성
- `/api/custom_generate` — 커스텀 모드 (가사, 스타일, 제목 지정)
- `/api/generate_lyrics` — 가사 자동 생성
- `/api/extend_audio` — 오디오 길이 연장
- `/api/generate_stems` — 보컬/반주 분리

**코드 예시:**
```python
response = requests.post("https://api.sunoapi.org/v1/generate", 
    headers={"Authorization": "Bearer YOUR_KEY"},
    json={
        "prompt": llm이_생성한_프롬프트,
        "style": "K-Pop Ballad",
        "lyrics": llm이_생성한_가사
    }
)
audio_url = response.json()["audio_url"]
```

**비용:** Suno Premier 구독 기준 곡당 약 **$0.03~0.04 (약 30~40원)**

**생성 소요 시간:** 약 20~30초/곡

**곡 미리 듣기 및 저장:**
- API 응답으로 audio_url(mp3/wav 링크)이 반환됨 → 웹에서 `<audio>` 태그로 바로 재생 가능
- 원하는 폴더에 저장:
```python
audio = requests.get(audio_url)
save_path = "C:/output/songs/song_01.mp3"
os.makedirs(os.path.dirname(save_path), exist_ok=True)
with open(save_path, "wb") as f:
    f.write(audio.content)
```

**리스크:** Suno 공식 API가 아직 없어 서드파티 의존이라는 점이 유일한 리스크

---

### STEP 6: 앨범아트 이미지 생성 (Gemini API)

**목적:** 생성된 곡의 분위기에 맞는 앨범 커버/아트 이미지 생성

**사용 API:** Google Gemini API (이미지 생성)

**ChatGPT 대신 Gemini를 선택한 이유:** ChatGPT(DALL-E)의 디자인 퀄리티가 상대적으로 낮아서 Gemini 쪽이 더 적합

**선택 가능 모델:**

| 모델 | 장당 비용 | 특징 |
|---|---|---|
| Imagen 4 Fast | **$0.02 (약 27원)** | 가장 저렴, 품질 괜찮음 |
| Nano Banana (Gemini 2.5 Flash Image) | $0.039 (약 53원) | 대화형 편집 가능 |
| Nano Banana 2 (Gemini 3.1 Flash Image) | $0.045 (약 60원) | 4K 지원, 최신 |
| Nano Banana Pro (Gemini 3 Pro Image) | $0.134 (약 180원) | 최고 품질, 4K |

**무료 티어:**
- Google AI Studio에서 하루 약 500장까지 무료 (Nano Banana 기준)
- 프로토타이핑에 유용
- 단, API 호출은 첫 요청부터 과금

**자동화 흐름:**
1. LLM이 곡 분석 결과를 기반으로 **이미지 생성 프롬프트를 영어로 자동 생성**
2. Gemini API로 이미지 생성
3. 생성된 이미지를 Remotion 영상 제작 + 썸네일에 활용

```python
image_prompt = llm("이 곡의 분위기에 맞는 앨범 커버 이미지 프롬프트를 영어로 만들어줘: " + 곡_분석_결과)
response = gemini.generate_image(prompt=image_prompt)
image_data = response.image  # base64 이미지
```

---

### STEP 7: Remotion으로 영상 제작 (핵심 변경사항)

**목적:** 곡 10개 + 이미지를 합쳐서 자막 포함된 고퀄리티 플레이리스트 영상 제작

**사용 도구:** Remotion (React 기반 프로그래매틱 영상 제작 프레임워크)

#### Remotion이란?

- React 코드로 영상을 만드는 **오픈소스 프레임워크** (github.com/remotion-dev/remotion)
- CSS, Canvas, SVG, WebGL 등 웹 기술 전부 사용 가능
- GUI 편집 프로그램(CapCut, Premiere) 없이 **코드로 영상 자동화**
- 개인 사용 무료, 기업은 라이선스 필요

#### FFmpeg 대신 Remotion을 선택한 이유

| | FFmpeg | Remotion |
|---|---|---|
| 정체 | 커맨드라인 영상 편집 도구 | React 기반 영상 제작 프레임워크 |
| 음성 인식 (STT) | **못 함** | **Whisper 내장 지원** |
| 자막 생성 | .srt 파일 있어야 가능 | **음성에서 자동 생성 + 애니메이션** |
| 자막 스타일 | 기본 텍스트만 | **TikTok 스타일 단어별 하이라이트, 바운스 등** |
| 텍스트/이미지 오버레이 | 가능 (제한적) | React 컴포넌트로 자유자재 |
| 디자인 자유도 | 낮음 | **React/CSS로 무한대** |
| 전환 효과 | 복잡한 필터 문법 | React 컴포넌트로 쉽게 구현 |
| 비용 | 무료 | 개인 무료, 기업은 라이선스 |

**결론:** FFmpeg는 단순 합치기에는 좋지만, 자막 자동 생성 + 애니메이션이 필요하면 Remotion이 압도적

#### FFmpeg이란? (참고)

- 1999년부터 있는 오픈소스 멀티미디어 도구
- 터미널에서 명령어로 실행하는 프로그램 (GUI 없음)
- Claude 스킬이나 API가 아닌 **독립적인 로컬 프로그램**
- `brew install ffmpeg` (Mac) / `apt install ffmpeg` (Linux)으로 설치
- 영상 합치기, 자르기, 포맷 변환, 오디오 추출 등 거의 다 가능
- YouTube, Netflix, Twitch 등도 내부적으로 사용
- Remotion도 내부적으로 FFmpeg를 사용함
- **비용 0원, API 토큰 소모 없음**

#### Remotion 영상 제작 흐름

**7-1. 음성 인식 → 자막 자동 생성 (Whisper)**

Remotion은 Whisper를 내장 지원하여 오디오에서 자동으로 자막을 생성:
- `@remotion/install-whisper-cpp` — 로컬 Whisper 실행 (무료, GPU 있으면 빠름)
- `@remotion/openai-whisper` — OpenAI Whisper API 사용 (1분당 $0.006)
- `@remotion/whisper-web` — 브라우저 내 로컬 음성 인식 (OpenAI 키 불필요)

Whisper 비용:

| 방식 | 비용 |
|---|---|
| 로컬 실행 (whisper-cpp) | **무료** |
| OpenAI API 호출 | 1분당 $0.006 (약 8원) |
| 브라우저 내 실행 (whisper-web) | **무료** |

**7-2. TikTok 스타일 자막 애니메이션**

Remotion의 `createTikTokStyleCaptions()` 함수로 단어별 하이라이트 자막 생성:

```javascript
import { createTikTokStyleCaptions } from '@remotion/captions';

const { pages } = createTikTokStyleCaptions({
  captions,
  combineTokensWithinMilliseconds: 500, // 단어별 애니메이션
});
```

- 단어가 말해지는 순간 하이라이트 + 바운스 애니메이션
- combineTokensWithinMilliseconds 값으로 속도 조절 가능

**7-3. 이미지 + 오디오 합성 + 곡 제목 오버레이**

React 컴포넌트로 영상 구성:
```jsx
// 각 트랙을 React 컴포넌트로 정의
const Track = ({ image, audio, title, captions }) => (
  <>
    <Img src={image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <Audio src={audio} />
    <TikTokCaptions captions={captions} />
    <TrackTitle text={title} />
  </>
);
```

**7-4. 10곡 플레이리스트로 합치기**

Remotion의 `<Series>` 컴포넌트로 순차 재생:
```jsx
import { Series } from 'remotion';

const Playlist = () => (
  <Series>
    {tracks.map((track, i) => (
      <Series.Sequence durationInFrames={track.durationFrames} key={i}>
        <Track {...track} />
      </Series.Sequence>
    ))}
  </Series>
);
```

**7-5. 최종 렌더링**

```bash
npx remotion render src/index.ts Playlist output/playlist_final.mp4
```

**비용:** Remotion + Whisper(로컬) 모두 **무료**. 로컬 컴퓨터에서 실행.

#### Claude Code와 Remotion

- Claude Code한테 "이 mp3 10개랑 이미지로 자막 포함된 플레이리스트 영상 만들어줘"라고 시키면 Remotion 코드를 작성하고 실행까지 해줌
- FFmpeg 명령어든 Remotion 코드든 직접 외울 필요 없음

---

### STEP 8: 제목/설명/태그 자동 생성 (LLM)

**목적:** YouTube SEO에 최적화된 메타데이터를 LLM이 자동 생성

**프롬프트 예시:**
```python
metadata_prompt = f"""
아래 플레이리스트 정보를 바탕으로 YouTube 업로드용 메타데이터를 만들어줘.

곡 목록: {곡_리스트}
장르: {장르}
분위기: {무드_태그}

JSON으로 응답:
- title: 클릭을 유도하는 한국어 제목
- description: SEO 최적화된 설명 (타임스탬프 포함)
- tags: 검색 노출용 키워드 20개
- category: YouTube 카테고리 번호
"""
```

**LLM 출력 예시:**
```json
{
  "title": "💫 새벽감성 K-Pop 발라드 플레이리스트 | 2026년 최신 AI 음악",
  "description": "이별 후 그리움을 담은 감성 발라드 10곡\n\n⏱ 타임스탬프\n0:00 Track 1 - 밤하늘\n3:42 Track 2 - 빗소리\n...",
  "tags": ["감성발라드", "새벽감성", "플레이리스트", "AI음악", "KPOP", ...],
  "category": "10"
}
```

**비용:** LLM 호출 1회, 약 10~20원

---

### STEP 9: YouTube 자동 업로드

**목적:** 로컬에서 완성된 영상 + 메타데이터를 YouTube에 자동 게시

**사용 API:** YouTube Data API v3 — `videos.insert` 엔드포인트

**필수 인증:** OAuth 2.0 (처음 1회 인증 후 refresh token 저장하면 이후 자동)

**필요한 OAuth 스코프:**
- `https://www.googleapis.com/auth/youtube.upload` — 영상 업로드
- `https://www.googleapis.com/auth/youtube` — 썸네일 설정 등 추가 작업

**코드 예시:**
```python
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

youtube = build("youtube", "v3", credentials=oauth_credentials)

# 영상 업로드
request = youtube.videos().insert(
    part="snippet,status",
    body={
        "snippet": {
            "title": metadata["title"],
            "description": metadata["description"],
            "tags": metadata["tags"],
            "categoryId": metadata["category"]
        },
        "status": {
            "privacyStatus": "public",  # 또는 "private"으로 검토 후 공개
            "selfDeclaredMadeForKids": False
        }
    },
    media_body=MediaFileUpload("C:/output/playlist_final.mp4")
)
response = request.execute()
video_id = response["id"]

# 썸네일 설정 (Gemini로 만든 이미지 활용)
youtube.thumbnails().set(
    videoId=video_id,
    media_body=MediaFileUpload("thumbnail.jpg")
).execute()
```

**쿼터 비용 (매우 중요):**

| 작업 | 비용 |
|---|---|
| `videos.insert` (업로드) | **1,600 units** |
| `thumbnails.set` (썸네일) | 50 units |
| 하루 기본 쿼터 | 10,000 units |
| **하루 최대 업로드 가능 수** | **약 6개 영상** |

**쿼터 확장:**
- Google Cloud Console에서 무료로 쿼터 증가 신청 가능
- 사용 사례와 YouTube API 서비스 약관 준수 문서 제출 필요

**업로드 후 프로세스:**
- YouTube가 자동으로 트랜스코딩 및 콘텐츠 리뷰 수행
- `notifySubscribers` 파라미터(기본 true)로 구독자 알림 제어 가능

---

## LLM API 비용 비교

곡 분석, 프롬프트 생성, 메타데이터 생성 등 모든 텍스트 처리 작업에 사용.

| 서비스 | 추천 모델 | 입력 100만 토큰 | 출력 100만 토큰 | 곡 1개 분석 비용 |
|---|---|---|---|---|
| OpenAI | GPT-4o mini | $0.15 | $0.60 | **약 1~2원** |
| Google | Gemini Flash | $0.075 | — | **약 1원 이하** |
| Anthropic | Claude Haiku | $0.80 | $4.00 | **약 5~10원** |

**가성비 추천:** 가사 분석 같은 비교적 단순한 작업에는 **GPT-4o mini** 또는 **Gemini Flash**가 가장 효율적

---

## 총 비용 정리 (플레이리스트 1개 = 곡 10개, 로컬 실행 기준)

| 단계 | 도구 | 비용 |
|---|---|---|
| YouTube 트렌드 분석 | YouTube Data API v3 | **무료** (쿼터 내) |
| 자막/가사 추출 | youtube-transcript-api | **무료** |
| 곡 분석 + 성공패턴 추출 | LLM API | **10~20원** |
| Suno 프롬프트 생성 | LLM API | **10~20원** |
| 곡 10개 생성 | Suno API | **300~400원** |
| 앨범아트 이미지 | Gemini API | **27~180원** (1장) |
| 영상 제작 (Remotion) | 로컬 실행 | **무료** |
| 음성 인식 자막 (Whisper) | 로컬 실행 | **무료** |
| 제목/설명/태그 생성 | LLM API | **10~20원** |
| YouTube 업로드 + 썸네일 | YouTube Data API v3 | **무료** (쿼터 내) |
| **합계** | | **약 400~700원** |

**서버 비용: 0원** (전부 로컬 실행)

이전 구조(AI Video API 사용)에서는 1,600~22,000원이었으나, Remotion + 로컬 실행으로 전환하면서 **약 400~700원**까지 절감.

---

## 분석 불가능한 데이터 (참고)

YouTube API로 **절대 가져올 수 없는** 데이터들:

- 시청 지속 시간 (Watch Time)
- CTR (클릭률)
- 노출수 (Impressions)
- 시청자 연령/성별 분포
- 트래픽 소스

이 데이터들은 **YouTube Analytics API**로만 접근 가능하며, **본인 채널 데이터만** 볼 수 있음. Social Blade 같은 서비스도 조회수 변화량으로 추정만 하는 이유.

---

## 기술 스택 요약

| 영역 | 기술 |
|---|---|
| 백엔드 언어 | Python (추천) + Node.js (Remotion) |
| 트렌드 데이터 수집 | YouTube Data API v3 |
| 자막 추출 | youtube-transcript-api |
| 텍스트 분석/생성 | LLM API (GPT-4o mini / Gemini Flash) |
| 음악 생성 | Suno API (서드파티) |
| 이미지 생성 | Gemini API (Imagen 4 Fast 또는 Nano Banana) |
| 음성 인식 (STT) | Whisper (Remotion 내장 / 로컬 실행) |
| 영상 제작 + 자막 | **Remotion** (React 기반, 로컬 실행) |
| 영상 편집 보조 | FFmpeg (Remotion 내부에서 사용) |
| 영상 업로드 | YouTube Data API v3 (OAuth 2.0) |
| 데이터베이스 | PostgreSQL / MongoDB (트렌드 히스토리 저장용) |

---

## 실행 방식

**로컬 터미널 한 줄로 전체 파이프라인 실행:**
```bash
python run_pipeline.py --genre "K-Pop 발라드" --count 10
```

또는 **Claude Code에게 시키기:**
```
"이 폴더에 있는 mp3 10개랑 이미지 1장으로 
자막 포함된 플레이리스트 영상 만들어서 유튜브에 올려줘"
```

---

## 주요 리스크 및 고려사항

1. **Suno 공식 API 부재:** 서드파티 의존으로 안정성/지속성 리스크 존재
2. **YouTube 업로드 쿼터:** 하루 6개 제한, 대량 업로드 시 쿼터 증가 신청 필요
3. **저작권:** 가사 원문 표시 금지, AI 생성 곡의 저작권 관련 법률 확인 필요 (2026년 기준 미국 저작권청은 순수 AI 생성 저작물 저작권 불인정)
4. **자막 없는 영상:** Whisper 등 STT 대체 수단 필요
5. **쿼터 초과:** YouTube API 429 에러 시 다음 날 자정(태평양 시간)에 리셋
6. **Search.list 남용 주의:** 하루 100회밖에 못 씀, PlaylistItems 우회 전략 필수
7. **Remotion 라이선스:** 개인/소규모는 무료, 기업 규모 시 라이선스 확인 필요
