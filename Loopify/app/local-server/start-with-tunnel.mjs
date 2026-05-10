/**
 * Loopify 로컬 렌더 서버 + Cloudflare Quick Tunnel 통합 런처.
 *
 * Why: Vercel-deployed Loopify(HTTPS)가 사용자 PC의 render-server(HTTP)를
 *      직접 못 부른다(Mixed Content 차단). Cloudflare Tunnel로 HTTPS 통로를 만들고,
 *      받은 임시 URL을 Supabase app_config 에 자동 동기화해서 deployed 앱이
 *      매번 최신 URL을 알 수 있게 한다.
 *
 * 동작:
 *   1. render-server.mjs 자식 프로세스로 spawn (port 4100)
 *   2. cloudflared tunnel --url http://localhost:4100 spawn
 *   3. cloudflared 출력에서 https://*.trycloudflare.com URL 추출
 *   4. Supabase app_config 테이블에 upsert (key='render_tunnel_url')
 *   5. URL 바뀌면 다시 push
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// .env.local 직접 로드 (dotenv 의존성 없이)
function loadEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch (e) {
    console.warn("⚠ .env.local 로드 실패:", e.message);
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.");
  process.exit(1);
}

console.log("\n  Loopify 통합 런처");
console.log("  ─ 렌더 서버: http://localhost:4100");
console.log("  ─ Cloudflare Tunnel 시작…\n");

// 1. 렌더 서버
const renderProc = spawn("node", ["local-server/render-server.mjs"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
});

// 2. Cloudflared quick tunnel
const tunnelProc = spawn("cloudflared", ["tunnel", "--url", "http://localhost:4100"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

let tunnelUrl = null;

async function pushUrlToSupabase(url) {
  const endpoint = `${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ key: "render_tunnel_url", value: url, updated_at: new Date().toISOString() }]),
    });
    if (res.ok) {
      console.log(`✓ Supabase 동기화 완료: ${url}\n`);
    } else {
      console.error(`✗ Supabase 동기화 실패 (${res.status}):`, await res.text());
    }
  } catch (e) {
    console.error("✗ Supabase 요청 에러:", e.message);
  }
}

const handleTunnelOutput = async (data) => {
  const text = data.toString();
  process.stdout.write(text);
  // cloudflared가 stdout/stderr에 https://abc-def.trycloudflare.com 형식으로 출력
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && match[0] !== tunnelUrl) {
    tunnelUrl = match[0];
    console.log(`\n  Tunnel URL 감지: ${tunnelUrl}`);
    await pushUrlToSupabase(tunnelUrl);
  }
};

tunnelProc.stdout.on("data", handleTunnelOutput);
tunnelProc.stderr.on("data", handleTunnelOutput);

const cleanup = () => {
  console.log("\n\n  종료 중…");
  try { renderProc.kill(); } catch {}
  try { tunnelProc.kill(); } catch {}
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

renderProc.on("exit", (code) => {
  console.log(`✗ render-server 종료 (코드: ${code}). 전체 종료.`);
  cleanup();
});
tunnelProc.on("exit", (code) => {
  console.log(`✗ cloudflared 종료 (코드: ${code}). 전체 종료.`);
  cleanup();
});
