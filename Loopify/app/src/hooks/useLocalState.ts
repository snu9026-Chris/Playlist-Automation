"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState + localStorage 영속화. SSR-safe (마운트 후에만 읽음 → hydration mismatch 없음).
 */
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
    loadedRef.current = true;
  }, [key]);

  useEffect(() => {
    if (!loadedRef.current || typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}
