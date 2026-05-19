"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boostFreqData, simulateFreqData } from "@/lib/canvas-draw";

type AudioSource = File | Blob | null | undefined;

interface UseAudioVisualizerOpts {
  /** 캔버스 논리 픽셀 크기 (CSS 픽셀 기준). drawFrame 안에서 그대로 사용. */
  width: number;
  height: number;
  /** Retina 대응. 기본 2 */
  dpr?: number;
  /** 오디오 자동 정지 시간 (초). 기본 10. 캔버스 RAF는 무관, 항상 무한. */
  stopAfter?: number;
  /** RAF 안에서 매 프레임 호출. ctx는 dpr scale 적용된 상태. */
  drawFrame: (params: {
    ctx: CanvasRenderingContext2D;
    elapsed: number;
    freqData: Uint8Array;
    width: number;
    height: number;
  }) => void;
  /** drawFrame이 의존하는 props가 바뀔 때 재구독되도록 deps 전달 */
  deps: any[];
}

interface UseAudioVisualizerReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** audio가 실제 재생 중인지 (캔버스 RAF는 항상 돌고 있어 이와 무관) */
  playing: boolean;
  /** 오디오 재생 시작. RAF는 분석 데이터로 자동 전환 */
  start: (source: AudioSource) => Promise<void>;
  /** 오디오만 정지. RAF는 simulation 모드로 계속 돔 (정지 상태에서도 출렁임 유지) */
  stop: () => void;
}

/**
 * 캔버스 시각화 훅 — 마운트 시점부터 RAF가 항상 돌며 simulateFreqData로 그림.
 * 사용자가 start(audio) 호출하면 AudioContext+Analyser 셋업해 실제 분석 데이터로 전환.
 * stop() 호출 또는 stopAfter 경과 시 오디오만 정리, RAF는 계속 simulation 모드로.
 *
 * 이전 구현은 start() 호출 전엔 RAF 자체를 안 돌려서 정지 상태에서 캔버스가
 * 빈 검은색으로 머무는 문제가 있었음. 이제는 "정지" 상태가 곧 "시뮬레이션 출렁임" 상태.
 */
export function useAudioVisualizer(opts: UseAudioVisualizerOpts): UseAudioVisualizerReturn {
  const { width, height, dpr = 2, stopAfter = 10, drawFrame } = opts;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  const rafRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStartTimeRef = useRef<number | null>(null);
  // RAF closure 안에서 최신 값을 참조하기 위한 ref (deps 변경 시 RAF 재시작 안 해도 됨)
  const drawFrameRef = useRef(drawFrame);
  const stopAfterRef = useRef(stopAfter);
  useEffect(() => {
    drawFrameRef.current = drawFrame;
    stopAfterRef.current = stopAfter;
  });

  /** 오디오만 정리 — RAF는 계속 돔. unmount 시도 동일 (RAF는 별도 cleanup) */
  const stop = useCallback(() => {
    try { (sourceRef.current as AudioBufferSourceNode | null)?.stop?.(); } catch {}
    try { audioElRef.current?.pause(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    audioElRef.current = null;
    audioCtxRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    audioStartTimeRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(async (source: AudioSource) => {
    if (!canvasRef.current || !source) return;

    // 이전 오디오 정리
    stop();

    try {
      const audioCtx = new AudioContext();
      // 일부 브라우저는 user gesture 안에서도 suspended로 시작 → 명시적 resume
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      if (source instanceof File) {
        // File: decodeAudioData → BufferSource (정밀, 일회성)
        const arrayBuffer = await source.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const bufSrc = audioCtx.createBufferSource();
        bufSrc.buffer = audioBuffer;
        bufSrc.connect(analyser);
        analyser.connect(audioCtx.destination);
        bufSrc.start();
        sourceRef.current = bufSrc;
      } else {
        // Blob: <audio> + MediaElementSource (부분 클립 재생용)
        const url = URL.createObjectURL(source);
        const audio = new Audio(url);
        audio.volume = 0.5;
        const mediaSrc = audioCtx.createMediaElementSource(audio);
        mediaSrc.connect(analyser);
        analyser.connect(audioCtx.destination);
        await audio.play();
        audioElRef.current = audio;
        sourceRef.current = mediaSrc;
      }

      audioStartTimeRef.current = performance.now();
      setPlaying(true);
    } catch (e) {
      console.warn("audio setup failed:", e);
      stop();
    }
  }, [stop]);

  // 캔버스 마운트되면 RAF 자동 시작 — 항상 simulation 데이터로 그림.
  // audio가 추가되면 analyserRef로 자동 전환. deps 변경 시 RAF만 재시작(audio는 ref로 살아있음).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const rafStartTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - rafStartTime) / 1000;

      let freqData: Uint8Array;
      const analyser = analyserRef.current;
      if (analyser && audioStartTimeRef.current !== null) {
        const raw = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(raw);
        let sum = 0;
        for (let k = 0; k < raw.length; k++) sum += raw[k];
        const avg = sum / raw.length;
        // 평균 너무 작으면 (오디오 안 흐름/디코딩 대기 등) simulation으로 fallback — "정지"처럼 보이는 거 방지
        freqData = avg < 5 ? simulateFreqData(32, elapsed) : boostFreqData(raw);

        // 오디오 stopAfter 경과 시 오디오만 정리 (RAF는 계속 simulation 모드로)
        const audioElapsed = (now - audioStartTimeRef.current) / 1000;
        if (audioElapsed > stopAfterRef.current) {
          stop();
        }
      } else {
        freqData = simulateFreqData(32, elapsed);
      }

      drawFrameRef.current({ ctx, elapsed, freqData, width, height });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, dpr, ...opts.deps]);

  // 언마운트 시 오디오 정리 (RAF는 위 effect의 cleanup에서)
  useEffect(() => stop, [stop]);

  return { canvasRef, playing, start, stop };
}
