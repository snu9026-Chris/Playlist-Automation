/* ─── 숏폼 wasm 인코더 ───
 * 이 파일은 브라우저에서 ffmpeg.wasm을 로드하고, PNG 프레임 시퀀스 + WAV 오디오를 mp4로 인코딩한다.
 * 서버 부담 0 — 모든 처리는 사용자 PC에서.
 *
 * 흐름:
 *   1. loadFFmpeg() — 최초 1회만 wasm 코어를 unpkg CDN에서 받아 메모리 로드 (~30MB)
 *   2. encodeShortsMp4() — 프레임 PNG들 + 오디오 WAV → 1080x1920 mp4
 */
"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// CDN에서 가져오는 ffmpeg.wasm core (single-thread 빌드 — SharedArrayBuffer 불필요)
const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/**
 * ffmpeg.wasm 인스턴스를 lazy 로드. 페이지당 1회만 실제 로드, 이후 재사용.
 * 진행률 로그가 필요하면 onProgress 콜백 (0~1 또는 "loading" 표시용)을 넘긴다.
 */
async function loadFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));

    // CDN을 직접 import하면 CORS/COEP 문제 있을 수 있어 toBlobURL로 우회
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}

export interface EncodeOptions {
  /** PNG Blob 시퀀스 (frame_0001.png 식으로 순서대로 가상 FS에 쓰임) */
  frames: Blob[];
  /** 오디오 (WAV/MP3) Blob */
  audio: Blob;
  /** 프레임 레이트. 기본 30 */
  fps?: number;
  /** 진행 콜백 — 0~1 */
  onProgress?: (ratio: number) => void;
  /** ffmpeg 로그 콜백 (디버깅) */
  onLog?: (msg: string) => void;
}

/**
 * 1080x1920 mp4 인코딩. 입력 프레임 자체가 1080x1920이라고 가정.
 * 결과는 Blob (video/mp4) 반환.
 */
export async function encodeShortsMp4(opts: EncodeOptions): Promise<Blob> {
  const { frames, audio, fps = 30, onProgress, onLog } = opts;
  if (frames.length === 0) throw new Error("frames empty");

  const ffmpeg = await loadFFmpeg(onLog);

  // 진행률: ffmpeg 인코딩 동안 0~1로 흐름
  let progressHandler: ((e: { progress: number }) => void) | null = null;
  if (onProgress) {
    progressHandler = ({ progress }) => onProgress(Math.min(Math.max(progress, 0), 1));
    ffmpeg.on("progress", progressHandler);
  }

  try {
    // ── 1. 프레임 PNG들을 가상 FS에 기록 ──
    // 4자리 zero-pad — frame_0001.png ~ frame_0600.png (20s × 30fps 기준)
    for (let i = 0; i < frames.length; i++) {
      const name = `frame_${String(i + 1).padStart(4, "0")}.jpg`;
      await ffmpeg.writeFile(name, await fetchFile(frames[i]));
    }

    // ── 2. 오디오 기록 ──
    await ffmpeg.writeFile("audio.wav", await fetchFile(audio));

    // ── 3. 인코딩 실행 ──
    // -framerate (in) + -i (PNG sequence) + -i (audio) + libx264 + aac
    // -shortest: 오디오/비디오 중 짧은 쪽에 맞춰 자름
    // -pix_fmt yuv420p: YouTube/대부분 플레이어 호환
    // -movflags +faststart: 스트리밍 시 metadata 앞으로 (업로드 후 빠른 재생)
    await ffmpeg.exec([
      "-framerate", String(fps),
      "-i", "frame_%04d.jpg",
      "-i", "audio.wav",
      "-c:v", "libx264",
      "-preset", "ultrafast",  // 사용자 PC 부담 줄임 (속도 우선, 파일 좀 큼)
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      "output.mp4",
    ]);

    // ── 4. 결과 읽기 ──
    const data = await ffmpeg.readFile("output.mp4");
    const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    const mp4Blob = new Blob([buffer.buffer as ArrayBuffer], { type: "video/mp4" });

    // ── 5. 가상 FS 정리 (다음 인코딩 위해) ──
    for (let i = 0; i < frames.length; i++) {
      const name = `frame_${String(i + 1).padStart(4, "0")}.jpg`;
      await ffmpeg.deleteFile(name).catch(() => {});
    }
    await ffmpeg.deleteFile("audio.wav").catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});

    return mp4Blob;
  } finally {
    if (progressHandler) ffmpeg.off("progress", progressHandler);
  }
}

/**
 * 사전 워밍업 — 첫 렌더 클릭 전에 wasm 코어를 미리 받아두면 첫 렌더 대기시간 단축.
 * 페이지 마운트 시점에 호출 권장 (UI 차단 없음).
 */
export function warmupFFmpeg(): Promise<void> {
  return loadFFmpeg().then(() => undefined);
}
