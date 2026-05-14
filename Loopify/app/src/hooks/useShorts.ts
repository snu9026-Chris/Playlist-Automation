"use client";

import { useCallback, useMemo, useState } from "react";
import { analyzeAudioPeak, extractClip } from "@/lib/audio-analyzer";
import { projectsApi } from "@/lib/api/projects";
import { lyricsApi } from "@/lib/api/lyrics";
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
  /** 가사 자동 추출 진행 중인 슬롯들 (slotId) */
  const [extractingLyrics, setExtractingLyrics] = useState<Set<string>>(new Set());
  /** 전체 일괄 추출 진행 중 플래그 */
  const [extractingAllLyrics, setExtractingAllLyrics] = useState(false);

  const filledCount = useMemo(() => slots.filter((s) => s.file).length, [slots]);
  const analyzedCount = useMemo(() => slots.filter((s) => s.clip).length, [slots]);
  const imagesReady = useMemo(() => slots.filter((s) => s.imageUrl).length, [slots]);

  const selectProject = useCallback(async (p: Project) => {
    setSelectedId(p.id);
    setSelectedTheme(p.theme);
    const newSlots = Array.from({ length: SLOT_COUNT }, (_, i) => ({
      id: `slot-${p.id}-${i}-${Date.now()}`,
      slotIndex: i,
      file: null,
      fileName: "",
      clip: null,
      clipBlob: null,
      analyzing: false,
      imageUrl: null,
    }));
    setSlots(newSlots);
    setActiveStep(1);

    // 가사·스타일은 프로젝트 생성 시 playlist_projects.prompts 에 저장돼있음.
    // shorts 페이지가 이전엔 이걸 안 읽어서 textarea가 비어있던 버그 — 선택 시 자동으로 채움.
    try {
      const project = await projectsApi.get(p.id) as { prompts?: Array<{ style?: string; lyrics?: string }> };
      const prompts = project?.prompts ?? [];
      const lyricsMap: Record<string, string> = {};
      for (const slot of newSlots) {
        const promptRow = prompts[slot.slotIndex];
        if (promptRow?.lyrics) lyricsMap[slot.id] = promptRow.lyrics;
      }
      setLyrics(lyricsMap);
    } catch (e) {
      console.error("프로젝트 가사 로드 실패:", e);
      setLyrics({});
    }
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

  /**
   * 단일 슬롯의 mp3 클립에서 가사 자동 추출 (Gemini 멀티모달).
   * 호출 측에서 기존 가사 덮어쓰기 confirm을 처리한다.
   */
  const extractLyricsForSlot = useCallback(
    async (slotId: string): Promise<string | null> => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot?.clipBlob || !selectedId) return null;

      setExtractingLyrics((prev) => {
        const next = new Set(prev);
        next.add(slotId);
        return next;
      });

      try {
        const result = await lyricsApi.extract({
          projectId: selectedId,
          slotIndex: slot.slotIndex,
          clipBlob: slot.clipBlob,
        });
        const text = result.lyrics ?? "";
        setLyrics((prev) => ({ ...prev, [slotId]: text }));
        return text;
      } catch (e) {
        console.error(`가사 추출 실패 slot ${slot.slotIndex}:`, e);
        return null;
      } finally {
        setExtractingLyrics((prev) => {
          const next = new Set(prev);
          next.delete(slotId);
          return next;
        });
      }
    },
    [slots, selectedId],
  );

  /**
   * 클립이 준비된 모든 슬롯에 대해 순차 추출.
   * 순차 처리 이유: Gemini rate limit + 한 번에 15개 동시 호출 시 일부 실패 위험.
   */
  const extractAllLyrics = useCallback(async () => {
    const targets = slots.filter((s) => s.clipBlob);
    if (targets.length === 0) return;
    setExtractingAllLyrics(true);
    try {
      for (const slot of targets) {
        await extractLyricsForSlot(slot.id);
      }
    } finally {
      setExtractingAllLyrics(false);
    }
  }, [slots, extractLyricsForSlot]);

  return {
    // state
    selectedId,
    selectedTheme,
    slots,
    activeStep,
    analyzingAll,
    lyrics,
    extractingLyrics,
    extractingAllLyrics,
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
    extractLyricsForSlot,
    extractAllLyrics,
  };
}
