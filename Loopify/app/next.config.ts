import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* COEP/COOP 헤더 제거 — 외부 리소스(Spotify embed, 폰트 CDN) 차단 방지 */
  /* FFmpeg.wasm은 단일 스레드 모드로 사용 */
};

export default nextConfig;
