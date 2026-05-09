"use client";

import { useCallback, useMemo, useState } from "react";
import { analyzeAudioPeak, extractClip } from "@/lib/audio-analyzer";
import { projectsApi } from "@/lib/api/projects";
import type { Project, TrackSlot } from "@/lib/types";

const SLOT_COUNT = 15;

/**
 * shorts 페이지의 도메인 로직. UI는 이 훅의 반환값만 소비한다.
 *
 * Why: 페이지 컴포넌트에 상태·이펙트·fetch가 섞여있어 테스트하기 어렵고
 * 자식 컴포넌트가 stale state를 받기 쉬웠음. 도메인 훅으로 모아 단일 책임을 만든다.
 */
export function useShorts() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [slots, setSlots] = useState<TrackSlot[]>([]);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  /** key는 TrackSlot.id (안정 키). slotIndex는 표시순서일 뿐이라 사용 금지. */
  const [lyrics, setLyrics] = useState<Record<string, string>>({});

  const filledCount = useMemo(() => slots.filter((s) => s.file).length, [slots]);
  const analyzedCount = useMemo(() => slots.filter((s) => s.clip).length, [slots]);
  const imagesReady = useMemo(() => slots.filter((s) => s.imageUrl).length, [slots]);

  const selectProject = useCallback((p: Project) => {
    setSelectedId(p.id);
    setSelectedTheme(p.theme);
    setSlots(Array.from({ length: SLOT_COUNT }, (_, i) => ({
      id: `slot-${p.id}-${i}-${Date.now()}`,
      slotIndex: i,
      file: null,
      fileName: "",
      clip: null,
      clipBlob: null,
      analyzing: false,
      imageUrl: null,
    })));
    setLyrics({});
    setActiveStep(1);
  }, []);

  const reset = useCallback(() => {
    setSelectedId(null);
    setSelectedTheme("");
    setSlots([]);
    setLyrics({});
    setActiveStep(1);
  }, []);

  const updateSlotById = useCallback((id: string, patch: Partial<TrackSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const setFiles = useCallback((files: FileList) => {
    setSlots((prev) => {
      const next = [...prev];
      for (let i = 0; i < files.length && i < SLOT_COUNT; i++) {
        next[i] = { ...next[i], file: files[i], fileName: files[i].name };
      }
      return next;
    });
  }, []);

  const reorderFilled = useCallback((fromIdx: number, toIdx: number) => {
    setSlots((prev) => {
      const filled = prev.filter((s) => s.file);
      const empty = prev.filter((s) => !s.file);
      const [moved] = filled.splice(fromIdx, 1);
      filled.splice(toIdx, 0, moved);
      const reindexed = filled.map((s, i) => ({ ...s, slotIndex: i }));
      const remaining = empty.map((s, i) => ({ ...s, slotIndex: reindexed.length + i }));
      return [...reindexed, ...remaining];
    });
  }, []);

  /**
   * 전체 분석 + 클립 추출. 분석 결과는 즉시 로컬 변수로 잡아 저장 (stale closure 방지).
   */
  const analyzeAll = useCallback(async () => {
    setAnalyzingAll(true);
    // 함수 시작 시점 스냅샷의 파일 슬롯들을 순회
    const snapshot = slots.filter((s) => s.file);

    for (const slot of snapshot) {
      if (!slot.file) continue;
      updateSlotById(slot.id, { analyzing: true });

      try {
        const clip = await analyzeAudioPeak(slot.file);
        const clipBlob = await extractClip(slot.file, clip.clipStart, clip.clipEnd);
        updateSlotById(slot.id, { clip, clipBlob, analyzing: false });

        if (selectedId) {
          await projectsApi
            .saveClip(selectedId, slot.slotIndex, clip.clipStart, clip.clipEnd)
            .catch((err) => console.error(`clip save failed slot ${slot.slotIndex}:`, err));
        }
      } catch (e) {
        console.error(`분석 실패 slot ${slot.slotIndex}:`, e);
        updateSlotById(slot.id, { analyzing: false });
      }
    }

    setAnalyzingAll(false);
    setActiveStep(2);
  }, [slots, selectedId, updateSlotById]);

  return {
    // state
    selectedId,
    selectedTheme,
    slots,
    activeStep,
    analyzingAll,
    lyrics,
    // derived
    filledCount,
    analyzedCount,
    imagesReady,
    // actions
    selectProject,
    reset,
    setFiles,
    reorderFilled,
    updateSlotById,
    analyzeAll,
    setLyrics,
    setActiveStep,
  };
}
