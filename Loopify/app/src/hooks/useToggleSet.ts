"use client";

import { useCallback, useState } from "react";

/**
 * Set<T>를 토글로 다루는 훅. shorts 프리셋, 다중 선택 필터 등에서 반복되던 패턴.
 */
export function useToggleSet<T>(initial?: Iterable<T>) {
  const [set, setSet] = useState<Set<T>>(() => new Set(initial ?? []));

  const toggle = useCallback((value: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const has = useCallback((value: T) => set.has(value), [set]);

  return { set, toggle, has, setSet };
}
