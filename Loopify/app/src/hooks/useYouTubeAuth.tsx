"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { youtubeApi } from "@/lib/api/youtube";

interface YouTubeAuthState {
  /** null = 로딩 중, true = 연결됨, false = 미연결/만료 */
  connected: boolean | null;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<YouTubeAuthState | null>(null);

/**
 * YouTube 연결 상태 단일 진실 원천. Header / uploads / 기타 페이지가 같은 값을 본다.
 *
 * Why: 이전엔 Header와 uploads 페이지가 각자 fetch + useState를 가지고 있어
 * 한 곳에서 disconnect해도 다른 곳은 stale 상태였다.
 */
export function YouTubeAuthProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await youtubeApi.status();
      setConnected(!!data.connected);
    } catch {
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await youtubeApi.disconnect();
    setConnected(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <Ctx.Provider value={{ connected, refresh, disconnect }}>{children}</Ctx.Provider>;
}

export function useYouTubeAuth(): YouTubeAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useYouTubeAuth must be used within YouTubeAuthProvider");
  return ctx;
}
