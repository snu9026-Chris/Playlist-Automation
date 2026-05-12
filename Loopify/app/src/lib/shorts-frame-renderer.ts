/* ─── 숏폼 프레임 추출기 ───
 * 한 슬롯(이미지 + 20s 오디오 클립 + 가사/EQ 프리셋)을 1080x1920 PNG 프레임 시퀀스로 추출한다.
 * 미리보기(ShortsPreview)와 똑같은 AnalyserNode + RAF 경로를 쓰므로 시각 결과 100% 동일.
 *
 * 핵심 트릭: 음소거 실시간 재생.
 *   - MediaElementSource → Analyser → Gain(0) → destination
 *   - 오디오는 실제로 재생되지만 gain=0이라 소리는 안 남
 *   - AnalyserNode는 정상 동작 (오프라인 컨텍스트는 AnalyserNode 한계로 사용 불가)
 *
 * 트레이드오프: 슬롯당 20초 실제 대기. 15곡이면 약 5분.
 *   탭이 백그라운드면 브라우저가 RAF·오디오를 throttle → 결과 깨질 수 있음.
 *   사용자에겐 "렌더 중에는 탭을 켜두세요" 안내 필요.
 */
"use client";

import {
  boostFreqData,
  drawEqualizer,
  drawShortsLyrics,
  drawShortsPlayerBar,
} from "./canvas-draw";

const W = 1080;
const H = 1920;
const CLIP_DURATION = 20; // 초

// canvas-draw.ts의 EQ/가사/플레이어바 함수들은 미리보기 베이스(270×480)에서 픽셀이 고정돼있다.
// 렌더(1080×1920)에서 그대로 호출하면 오버레이가 4배 작아 보임 → ctx.scale(SCALE)로 보정.
// 미리보기와 비례 100% 동일하게 유지.
const PREVIEW_W = 270;
const PREVIEW_H = 480;
const OVERLAY_SCALE = W / PREVIEW_W; // = 4

export interface RenderFramesOpts {
  /** 20초 오디오 클립 (WAV Blob from extractClip) */
  audioBlob: Blob;
  /** 배경 이미지 URL (Supabase Storage public URL 또는 data URL) */
  imageUrl: string;
  /** 이퀄라이저 스타일 — 미리보기와 동일 키 */
  eqType: string;
  /** 활성 프리셋 set */
  presets: Set<string>;
  /** 가사 (presets에 "lyrics" 포함된 경우만 사용) */
  lyrics: string;
  /** 프레임 레이트. 기본 30 */
  fps?: number;
  /** 진행 콜백 — 0~1 */
  onProgress?: (ratio: number) => void;
}

/**
 * 한 슬롯에 대해 1080x1920 PNG 프레임을 fps × 20초만큼 생성.
 *
 * @returns PNG Blob 배열 (순서대로). ffmpeg-shorts.encodeShortsMp4에 그대로 넘기면 됨.
 */
export async function renderShortsFrames(opts: RenderFramesOpts): Promise<Blob[]> {
  const { audioBlob, imageUrl, eqType, presets, lyrics, fps = 30, onProgress } = opts;
  const totalFrames = CLIP_DURATION * fps;

  // ── 1. 배경 이미지 로드 (CORS 대응) ──
  // Supabase Storage public URL은 CORS 헤더 정상이므로 crossOrigin="anonymous"로 캔버스 오염 회피.
  const img = await loadImage(imageUrl);

  // ── 2. 캔버스 셋업 (1080x1920) ──
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // ── 3. 오디오 셋업 (음소거 실시간 재생) ──
  const audioUrl = URL.createObjectURL(audioBlob);
  const audioEl = new Audio();
  audioEl.src = audioUrl;
  audioEl.crossOrigin = "anonymous";
  audioEl.preload = "auto";

  // canplaythrough 이벤트 대기 — readyState >= 4 확인
  await new Promise<void>((resolve, reject) => {
    audioEl.oncanplaythrough = () => resolve();
    audioEl.onerror = () => reject(new Error("audio load failed"));
    audioEl.load();
  });

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audioEl);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const muteGain = audioCtx.createGain();
  muteGain.gain.value = 0; // 완전 음소거. 재생되지만 소리 안 남.

  source.connect(analyser);
  analyser.connect(muteGain);
  muteGain.connect(audioCtx.destination);

  // ── 4. 재생 시작 + 프레임 캡처 ──
  await audioCtx.resume();
  await audioEl.play();
  const startTime = performance.now();

  const frames: Blob[] = [];

  try {
    for (let f = 0; f < totalFrames; f++) {
      const targetMs = (f / fps) * 1000;

      // 다음 프레임 시각까지 대기 (RAF 기반)
      while (performance.now() - startTime < targetMs) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }

      // 현재 시점 freq data 추출
      const raw = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(raw);
      const freqData = boostFreqData(raw);

      const elapsed = (performance.now() - startTime) / 1000;

      // ── 캔버스 그리기 (미리보기와 동일 순서) ──
      // 배경 이미지는 풀해상도 1080×1920로 그림
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);

      // 오버레이는 미리보기 좌표계(270×480)로 그린 뒤 4배 transform으로 키움 → 비례 일치
      ctx.save();
      ctx.scale(OVERLAY_SCALE, OVERLAY_SCALE);
      if (presets.has("eq")) drawEqualizer(ctx, eqType, freqData, PREVIEW_W, PREVIEW_H);
      if (presets.has("lyrics") && lyrics) drawShortsLyrics(ctx, lyrics, PREVIEW_W, PREVIEW_H, elapsed);
      if (presets.has("player-bar")) drawShortsPlayerBar(ctx, PREVIEW_W, PREVIEW_H, elapsed);
      ctx.restore();

      // ── JPEG로 캡처 (PNG보다 10~20배 작아 메모리 부담↓, 시각 품질 차이 미미) ──
      const blob = await canvasToBlob(canvas);
      frames.push(blob);

      onProgress?.(f / totalFrames);
    }
  } finally {
    audioEl.pause();
    audioEl.src = "";
    URL.revokeObjectURL(audioUrl);
    await audioCtx.close().catch(() => {});
  }

  return frames;
}

// ─── 헬퍼 ───

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      0.92
    );
  });
}
