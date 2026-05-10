/**
 * Loopify 로컬 렌더링 서버 (Remotion 기반)
 *
 * 브라우저에서 POST로 mp3 클립 + 이미지 + 오버레이 데이터를 보내면
 * Remotion으로 영상을 렌더링합니다.
 *
 * 실행: node local-server/render-server.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const PORT = 4100;
const OUTPUT_DIR = path.join("C:", "Users", "USER", "Desktop", "Playlist Automation", "output");
const TEMP_DIR = path.join(process.cwd(), "local-server", "temp");
const BASE_URL = `http://localhost:${PORT}`;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// FFmpeg — MP3 concat 전용으로 유지
const FFMPEG = process.env.FFMPEG_PATH
  || "C:\\Users\\USER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

try {
  execSync(`"${FFMPEG}" -version`, { stdio: "pipe" });
  console.log("  ffmpeg found (MP3 concat용):", FFMPEG);
} catch {
  console.warn("  ffmpeg not found — longform MP3 concat 불가. Shorts는 정상 작동.");
}

// ─── Remotion 번들 ───
let bundleLocation = null;
const renderProgress = new Map(); // renderId → { progress: 0~1 }

async function initBundle() {
  console.log("  Remotion 번들 생성 중...");
  const entryPoint = path.resolve(process.cwd(), "local-server", "remotion", "index.ts");
  bundleLocation = await bundle({
    entryPoint,
    onProgress: (p) => {
      if (p === 100) console.log("  Remotion 번들 완료!");
    },
  });
  console.log("  번들 위치:", bundleLocation);
}

// ─── MIME 타입 ───
const MIME_MAP = {
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
};

// ─── HTTP 서버 ───
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: bundleLocation ? "ok" : "bundling",
      outputDir: OUTPUT_DIR,
      renderer: "remotion",
    }));
    return;
  }

  // ─── Temp 파일 서빙 (Remotion 헤드리스 Chromium용) ───
  if (req.method === "GET" && req.url?.startsWith("/temp/")) {
    const fileName = decodeURIComponent(req.url.replace("/temp/", ""));
    const filePath = path.join(TEMP_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName).toLowerCase();
      const mime = MIME_MAP[ext] || "application/octet-stream";
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  // ─── 렌더 진행률 ───
  if (req.method === "GET" && req.url?.startsWith("/render-progress/")) {
    const renderId = req.url.replace("/render-progress/", "");
    const prog = renderProgress.get(renderId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ progress: prog?.progress ?? 0 }));
    return;
  }

  // ─── Shorts 렌더링 ───
  if (req.method === "POST" && req.url === "/render") {
    if (!bundleLocation) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Remotion 번들 준비 중입니다. 잠시 후 다시 시도해주세요." }));
      return;
    }

    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const {
        projectId, slotIndex, audioBase64, imageBase64, subtitle, trackTitle,
        eqType = "none", showPlayerBar = false,
      } = data;
      // 클라이언트가 보낸 eqType은 "none" | "glass" | "circle" | "pulse" | "symmetric"

      const safeName = (trackTitle || `track_${slotIndex + 1}`)
        .replace(/\.mp3$/i, "")
        .replace(/[^a-zA-Z0-9가-힣\s_-]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60);
      const outputFileName = `${safeName}_highlight.mp4`;

      const id = `${projectId}_slot${slotIndex}`;
      const audioFileName = `${id}_audio.wav`;
      const imageFileName = `${id}_image.png`;
      const audioPath = path.join(TEMP_DIR, audioFileName);
      const imagePath = path.join(TEMP_DIR, imageFileName);
      const outputPath = path.join(OUTPUT_DIR, outputFileName);

      // base64 → 파일 저장
      fs.writeFileSync(audioPath, Buffer.from(audioBase64.split(",").pop(), "base64"));
      fs.writeFileSync(imagePath, Buffer.from(imageBase64.split(",").pop(), "base64"));

      // 자막 → Remotion Sequence용 데이터
      const fps = 30;
      const duration = 20;
      const subtitleLines = [];
      if (subtitle) {
        const lines = subtitle.split("\n").filter(Boolean);
        const lineTime = duration / Math.max(lines.length, 1);
        lines.forEach((text, i) => {
          subtitleLines.push({
            text,
            startFrame: Math.round(i * lineTime * fps),
            endFrame: Math.round(Math.min((i + 1) * lineTime, duration) * fps),
          });
        });
      }

      const inputProps = {
        audioUrl: `${BASE_URL}/temp/${audioFileName}`,
        imageUrl: `${BASE_URL}/temp/${imageFileName}`,
        subtitleLines,
        eqType,
        showPlayerBar,
      };

      console.log(`  Shorts 렌더링 시작: slot ${slotIndex} (eq=${eqType}, playerBar=${showPlayerBar}, lyrics=${subtitleLines.length}줄)...`);
      const renderId = `shorts_${id}`;
      renderProgress.set(renderId, { progress: 0 });

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "Shorts",
        inputProps,
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          renderProgress.set(renderId, { progress });
        },
      });

      renderProgress.delete(renderId);

      // cleanup
      try { fs.unlinkSync(audioPath); fs.unlinkSync(imagePath); } catch {}

      console.log(`  Shorts 렌더링 완료: ${outputPath}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, outputPath, fileName: outputFileName }));
    } catch (e) {
      console.error("Shorts render error:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── 롱폼 렌더링 ───
  if (req.method === "POST" && req.url === "/render-longform") {
    if (!bundleLocation) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Remotion 번들 준비 중입니다. 잠시 후 다시 시도해주세요." }));
      return;
    }

    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const {
        mp3Base64List, imageBase64List, theme,
        imageLoopDuration = 10, eqType = "freqbar", loopType = "crossfade",
        overlays = [],
      } = data;

      const id = `longform_${Date.now()}`;
      const fps = 30;

      // 1. MP3 파일들 저장
      const mp3Paths = [];
      for (let i = 0; i < mp3Base64List.length; i++) {
        const fileName = `${id}_audio_${i}.mp3`;
        const mp3Path = path.join(TEMP_DIR, fileName);
        fs.writeFileSync(mp3Path, Buffer.from(mp3Base64List[i].split(",").pop(), "base64"));
        mp3Paths.push({ path: mp3Path, fileName });
      }

      // 2. 이미지 파일들 저장
      const imgFileNames = [];
      for (let i = 0; i < imageBase64List.length; i++) {
        const fileName = `${id}_img_${i}.jpg`;
        const imgPath = path.join(TEMP_DIR, fileName);
        fs.writeFileSync(imgPath, Buffer.from(imageBase64List[i].split(",").pop(), "base64"));
        imgFileNames.push(fileName);
      }

      // 3. MP3 합치기 (FFmpeg concat — Remotion은 오디오 concat 불가)
      const concatListPath = path.join(TEMP_DIR, `${id}_concat.txt`);
      const concatContent = mp3Paths.map(p => `file '${p.path.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatListPath, concatContent);

      const mergedFileName = `${id}_merged.mp3`;
      const mergedAudioPath = path.join(TEMP_DIR, mergedFileName);
      console.log("  MP3 합치는 중...");
      execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${mergedAudioPath}"`, { timeout: 120000 });

      // 총 길이 확인
      const probeResult = execSync(`"${FFMPEG}" -i "${mergedAudioPath}" 2>&1 || true`, { encoding: "utf-8" });
      const durationMatch = probeResult.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
      let totalSeconds = 3600;
      if (durationMatch) {
        totalSeconds = parseInt(durationMatch[1]) * 3600
          + parseInt(durationMatch[2]) * 60
          + parseInt(durationMatch[3])
          + parseInt(durationMatch[4]) / 100;
      }
      const durationInFrames = Math.ceil(totalSeconds * fps);

      console.log(`  총 길이: ${totalSeconds}초 (${durationInFrames} frames)`);

      // 4. 오버레이 파일 저장 (프리셋은 파일 없이 처리)
      const overlayConfigs = [];
      for (let i = 0; i < overlays.length; i++) {
        const ov = overlays[i];

        if (ov.isPreset) {
          // 프리셋 오버레이 — 파일 없이 Remotion 컴포넌트로 렌더링
          overlayConfigs.push({
            url: "",
            type: "preset",
            preset: ov.preset,
            channelName: ov.channelName || "",
            position: ov.position || "br",
            scale: ov.scale || 1,
            opacity: (ov.opacity || 90) / 100,
            timing: ov.timing || "always",
            timingSeconds: ov.timingSeconds || 10,
            chromakey: "none",
          });
          continue;
        }

        const ext = (ov.fileName || "overlay.png").split(".").pop() || "png";
        const ovFileName = `${id}_overlay_${i}.${ext}`;
        const ovPath = path.join(TEMP_DIR, ovFileName);
        fs.writeFileSync(ovPath, Buffer.from(ov.base64.split(",").pop(), "base64"));

        const isVideo = /\.(webm|mov|mp4|gif|mkv)$/i.test(ov.fileName || "");
        overlayConfigs.push({
          url: `${BASE_URL}/temp/${ovFileName}`,
          type: isVideo ? "video" : "image",
          position: ov.position || "br",
          scale: ov.scale || 1,
          opacity: (ov.opacity || 80) / 100,
          timing: ov.timing || "always",
          timingSeconds: ov.timingSeconds || 10,
          chromakey: ov.chromakey || "none",
        });
      }

      // 5. Remotion 렌더링
      const outputFileName = `${(theme || "longform").replace(/[^a-zA-Z0-9가-힣\s_-]/g, "").replace(/\s+/g, "_")}_playlist.mp4`;
      const outputPath = path.join(OUTPUT_DIR, outputFileName);

      const inputProps = {
        audioUrl: `${BASE_URL}/temp/${mergedFileName}`,
        imageUrls: imgFileNames.map(f => `${BASE_URL}/temp/${f}`),
        loopType,
        eqType,
        imageLoopDuration,
        overlays: overlayConfigs,
      };

      console.log(`  롱폼 렌더링 시작 (${totalSeconds}초, EQ=${eqType}, Loop=${loopType}, 오버레이 ${overlayConfigs.length}개)...`);
      const renderId = `longform_${id}`;
      renderProgress.set(renderId, { progress: 0 });

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "Longform",
        inputProps,
      });

      // durationInFrames 오버라이드 (오디오 길이 기반)
      await renderMedia({
        composition: { ...composition, durationInFrames },
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        concurrency: 4,
        onProgress: ({ progress }) => {
          renderProgress.set(renderId, { progress });
          if (Math.round(progress * 100) % 10 === 0) {
            console.log(`  렌더링 진행: ${Math.round(progress * 100)}%`);
          }
        },
      });

      renderProgress.delete(renderId);

      // cleanup temp
      try {
        mp3Paths.forEach(p => fs.unlinkSync(p.path));
        imgFileNames.forEach(f => fs.unlinkSync(path.join(TEMP_DIR, f)));
        overlays.forEach((_, i) => {
          const ext = (overlays[i].fileName || "overlay.png").split(".").pop() || "png";
          try { fs.unlinkSync(path.join(TEMP_DIR, `${id}_overlay_${i}.${ext}`)); } catch {}
        });
        fs.unlinkSync(concatListPath);
        fs.unlinkSync(mergedAudioPath);
      } catch {}

      console.log(`  롱폼 렌더링 완료: ${outputPath}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, fileName: outputFileName, outputPath }));
    } catch (e) {
      console.error("Longform render error:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 렌더링된 파일 다운로드
  if (req.method === "GET" && req.url?.startsWith("/download/")) {
    const fileName = decodeURIComponent(req.url.replace("/download/", ""));
    const filePath = path.join(OUTPUT_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  // 렌더링된 파일 삭제 — 사용자가 다운로드 완료 후 호출. 디스크 누적 방지.
  if (req.method === "DELETE" && req.url?.startsWith("/download/")) {
    const fileName = decodeURIComponent(req.url.replace("/download/", ""));
    // path traversal 방지 — 파일명에 슬래시·점점 막음
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid filename" }));
      return;
    }
    const filePath = path.join(OUTPUT_DIR, fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  ✓ Deleted after download: ${fileName}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.maxHeadersCount = 100;
server.timeout = 600000; // 10분 타임아웃

// 서버 시작 + Remotion 번들
(async () => {
  server.listen(PORT, () => {
    console.log(`\n  Loopify Render Server (Remotion) on http://localhost:${PORT}`);
    console.log(`   Output: ${OUTPUT_DIR}`);
    console.log(`   Remotion 번들 준비 중...\n`);
  });
  await initBundle();
  console.log(`\n  서버 준비 완료! 렌더링 가능.\n`);
})();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
