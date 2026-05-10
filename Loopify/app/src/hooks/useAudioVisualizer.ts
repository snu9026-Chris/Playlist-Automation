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
  /** 자동 정지 시간 (초). 기본 10 */
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
  playing: boolean;
  start: (source: AudioSource) => Promise<void>;
  stop: () => void;
}

/**
 * mp3 클립이나 File을 입력받아 캔버스에 시각화하는 공통 훅.
 *
 * Why: ShortsPreview와 longform PreviewCanvas가 AudioContext + Analyser + RAF + cleanup을
 * 거의 동일하게 가지고 있었음. 이 훅으로 중앙화하면 메모리 누수도 한 곳에서만 관리.
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
  const startTimeRef = useRef(0);
  const startedRef = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try { (sourceRef.current as AudioBufferSourceNode | null)?.stop?.(); } catch {}
    try { audioElRef.current?.pause(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    audioElRef.current = null;
    audioCtxRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    startedRef.current = false;
    setPlaying(false);
  }, []);

  const start = useCallback(async (source: AudioSource) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 캔버스 논리 크기 + DPR
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 이전 세션 정리
    stop();

    // 오디오 셋업 — 옵션 (소스가 없으면 시뮬레이션 데이터로만 그림)
    if (source) {
      try {
        const audioCtx = new AudioContext();
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
      } catch (e) {
        console.warn("audio setup failed:", e);
      }
    }

    startTimeRef.current = performance.now();
    startedRef.current = true;
    setPlaying(true);

    const tick = () => {
      if (!startedRef.current) return;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;

      let freqData: Uint8Array;
      if (analyserRef.current) {
        const raw = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(raw);
        // 클립이 끝나 무음 상태면 시뮬레이션으로 채움 — 시각화가 "정지"된 듯 보이지 않게
        let sum = 0;
        for (let k = 0; k < raw.length; k++) sum += raw[k];
        const avg = sum / raw.length;
        freqData = avg < 5 ? simulateFreqData(32, elapsed) : boostFreqData(raw);
      } else {
        freqData = simulateFreqData(32, elapsed);
      }

      drawFrame({ ctx, elapsed, freqData, width, height });

      if (elapsed > stopAfter) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, dpr, stopAfter, stop, ...opts.deps]);

  // 언마운트 시 자동 정리
  useEffect(() => stop, [stop]);

  return { canvasRef, playing, start, stop };
}
