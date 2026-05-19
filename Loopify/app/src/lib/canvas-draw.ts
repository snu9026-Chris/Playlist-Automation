/* ─── Canvas 미리보기 공통 그리기 함수 ───
 * longform/shorts 양쪽 PreviewCanvas에서 공유
 */

import type { OverlayItem } from "./types";

// ─── 헬퍼 ───

export function drawGlassBox(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, radius: number) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, radius); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, radius); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, bw - 2, bh * 0.4, radius); ctx.fill();
}

function calcPosition(pos: string, w: number, h: number, cw: number, ch: number, margin: number) {
  let x = 0, y = 0;
  if (pos.includes("l")) x = margin;
  else if (pos.includes("r")) x = cw - w - margin;
  else x = (cw - w) / 2;
  if (pos.startsWith("t")) y = margin;
  else if (pos.startsWith("b")) y = ch - h - margin;
  else y = (ch - h) / 2;
  return { x, y };
}

/** 주파수 데이터 부스트 (2.5배, max 255 클램프) */
export function boostFreqData(raw: Uint8Array, multiplier = 2.5): Uint8Array {
  const boosted = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    boosted[i] = Math.min(Math.floor(raw[i] * multiplier), 255);
  }
  return boosted;
}

/**
 * 시뮬레이션 주파수 데이터 (오디오 없을 때, 또는 클립이 끝나 무음 상태일 때).
 * Why: 이전 공식은 끝의 ×2 때문에 평균 280으로 튀어 거의 모든 프레임이 255 saturation 됨 →
 *      모든 막대가 같은 높이로 고정되어 "정지" 상태처럼 보였음. 항상 가시적으로 출렁이도록 조정.
 */
export function simulateFreqData(barCount: number, elapsed: number): Uint8Array {
  const data = new Uint8Array(barCount);
  for (let i = 0; i < barCount; i++) {
    // 범위 [25, 215] — 절대 saturation 안 됨, 항상 sin으로 출렁임
    data[i] = Math.floor(120 + Math.sin(elapsed * 4 + i * 0.6) * 70 + Math.random() * 25);
  }
  return data;
}

// ═══════════════════════════════════════
// 프리셋 오버레이 그리기 (longform/shorts 공통)
// ═══════════════════════════════════════

export function drawPresetOverlay(
  ctx: CanvasRenderingContext2D, ov: OverlayItem,
  cw: number, ch: number, margin: number, elapsed: number,
) {
  const s = ov.scale * 0.5;

  const sizes: Record<string, [number, number]> = {
    "youtube-set": [140 * s, 130 * s],
    "watermark": [200 * s, 40 * s],
    "end-screen": [280 * s, 160 * s],
    // 2026-05 리뉴얼: 컨트롤 3개 + 진행바 2행 글래스 캡슐. 정사각형에 가까운 두꺼운 비례.
    "player-bar": [260 * s, 88 * s],
    "player-bar-minimal": [180 * s, 60 * s],
  };
  const [w, h] = sizes[ov.preset || ""] || [100 * s, 40 * s];
  const { x, y } = calcPosition(ov.position, w, h, cw, ch, margin);

  ctx.save();

  if (ov.preset === "youtube-set") {
    _drawYouTubeSet(ctx, x, y, w, h, s);
  } else if (ov.preset === "watermark") {
    _drawWatermark(ctx, x, y, w, h, ov.channelName || "LOOPIFY");
  } else if (ov.preset === "player-bar" || ov.preset === "player-bar-minimal") {
    drawPlayerPill(ctx, x, y, w, h, elapsed);
  } else if (ov.preset === "end-screen") {
    _drawEndScreen(ctx, x, y, w, h, s, ov.channelName || "MY CHANNEL");
  }

  ctx.restore();
}

function _drawYouTubeSet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number) {
  const rightX = x + w;
  // YT 로고
  const logoW = 36 * s, logoH = 26 * s;
  ctx.fillStyle = "#FF0000";
  ctx.beginPath(); ctx.roundRect(rightX - logoW, y, logoW, logoH, 5 * s); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.roundRect(rightX - logoW + 1, y + 1, logoW - 2, logoH * 0.45, 4 * s); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(rightX - logoW * 0.6, y + logoH * 0.22);
  ctx.lineTo(rightX - logoW * 0.6, y + logoH * 0.78);
  ctx.lineTo(rightX - logoW * 0.25, y + logoH * 0.5);
  ctx.closePath(); ctx.fill();

  // 구독+벨 글래스 카드
  const cardY = y + logoH + 6 * s;
  const cardW = w, cardH = 28 * s;
  drawGlassBox(ctx, rightX - cardW, cardY, cardW, cardH, cardH / 2);
  const subW = cardW * 0.6, subH = cardH - 4 * s;
  ctx.fillStyle = "#FF0000";
  ctx.beginPath(); ctx.roundRect(rightX - cardW + 2 * s, cardY + 2 * s, subW, subH, subH / 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath(); ctx.roundRect(rightX - cardW + 3 * s, cardY + 3 * s, subW - 2, subH * 0.45, subH / 2); ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `bold ${Math.round(10 * s)}px Inter, Pretendard, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("구독", rightX - cardW + 2 * s + subW / 2, cardY + cardH / 2);
  const bellR = (cardH - 6 * s) / 2;
  const bellCx = rightX - bellR - 4 * s;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(bellCx, cardY + cardH / 2, bellR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(bellCx, cardY + cardH / 2, bellR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = `${Math.round(bellR)}px sans-serif`;
  ctx.fillText("🔔", bellCx, cardY + cardH / 2 + 1);

  // 좋아요/댓글/공유
  const actY = cardY + cardH + 6 * s;
  const actW = w * 0.85, actH = 26 * s;
  drawGlassBox(ctx, rightX - actW, actY, actW, actH, actH / 2);
  const icons = ["👍", "💬", "↗"], txts = ["좋아요", "댓글", "공유"];
  const segW = actW / 3;
  for (let i = 0; i < 3; i++) {
    const cx = rightX - actW + segW * i + segW / 2;
    ctx.fillStyle = "white";
    ctx.font = `${Math.round(8 * s)}px sans-serif`;
    ctx.fillText(icons[i], cx - 6 * s, actY + actH / 2);
    ctx.font = `600 ${Math.round(6 * s)}px Inter, Pretendard, sans-serif`;
    ctx.fillText(txts[i], cx + 3 * s, actY + actH / 2);
    if (i < 2) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(rightX - actW + segW * (i + 1) - 0.5, actY + 5 * s, 1, actH - 10 * s);
    }
  }
  ctx.textAlign = "start";
}

function _drawWatermark(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, channelName: string) {
  const name = channelName.toUpperCase();
  ctx.font = `700 ${Math.round(h * 0.35)}px Inter, Pretendard, sans-serif`;
  const badgeW = Math.max(ctx.measureText(name).width + 30, w);
  drawGlassBox(ctx, x + (w - badgeW) / 2, y, badgeW, h * 0.6, h * 0.3);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, x + w / 2, y + h * 0.3);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `italic ${Math.round(h * 0.22)}px Georgia, serif`;
  ctx.fillText("Some songs bring back the warmth of that time.", x + w / 2, y + h * 0.8);
  ctx.textAlign = "start";
}

/**
 * 통합 플레이어바 (Compact Glass Pill) — 숏폼/롱폼 공통.
 * 컨트롤: 이전 / 재생(큰 원) / 다음 3개. 시간 표시 없음.
 * 비율: 가로 길이를 줄이고 세로를 늘려 정사각형에 가까운 두꺼운 캡슐.
 * 글래스 4겹: drop shadow + 본체 그라데이션 + 상단 inner highlight + 외곽선.
 *
 * 좌표는 호출자가 정함 → 숏폼은 화면 중앙 정렬, 롱폼은 오버레이 좌표 그대로.
 */
export function drawPlayerPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, elapsed: number) {
  const radius = Math.min(h * 0.32, 26);

  ctx.save();

  // 1. drop shadow — 본체 아래에 부드러운 그림자 (입체감)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = h * 0.22;
  ctx.shadowOffsetY = h * 0.06;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  ctx.restore();

  // 2. 본체 — 위 살짝 밝고 아래 살짝 어두운 그라데이션 (빛이 위에서 떨어진 효과)
  const bodyGrad = ctx.createLinearGradient(0, y, 0, y + h);
  bodyGrad.addColorStop(0, "rgba(48,52,72,0.72)");
  bodyGrad.addColorStop(1, "rgba(20,22,38,0.82)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();

  // 3. 상단 inner highlight (위 절반에 흰색 그라데이션) — 글래스 광택
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip();
  const hlGrad = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  hlGrad.addColorStop(0, "rgba(255,255,255,0.32)");
  hlGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hlGrad;
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h * 0.55, radius - 1); ctx.fill();
  ctx.restore();

  // 4. 외곽선 1px
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, radius); ctx.stroke();

  // ── 컨트롤 행 (상단 56% 위치) ──
  const ctrlY = y + h * 0.38;
  const cx = x + w / 2;
  const btnGap = w * 0.24;
  const sideBtn = h * 0.30;   // 좌우 버튼 크기
  const playBtn = h * 0.42;   // 가운데 재생 버튼 (좌우보다 큼)

  _drawSkipBtn(ctx, cx - btnGap, ctrlY, sideBtn, false);
  _drawPlayCircle(ctx, cx, ctrlY, playBtn);
  _drawSkipBtn(ctx, cx + btnGap, ctrlY, sideBtn, true);

  // ── 진행바 행 (하단 78% 위치) ──
  const progY = y + h * 0.78;
  const progPad = w * 0.08;
  const progX = x + progPad;
  const progW = w - progPad * 2;
  const trackH = Math.max(h * 0.05, 3);

  const totalSec = 210; // 3:30 가정
  const currentSec = (elapsed * 21) % totalSec;
  const prog = currentSec / totalSec;

  // 트랙 (어두운 inner)
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.beginPath(); ctx.roundRect(progX, progY, progW, trackH, trackH / 2); ctx.fill();

  // 채워진 진행 + 글로우
  const fillW = Math.max(progW * prog, trackH);
  const fillGrad = ctx.createLinearGradient(progX, 0, progX + fillW, 0);
  fillGrad.addColorStop(0, "#818cf8");
  fillGrad.addColorStop(1, "#c084fc");
  ctx.save();
  ctx.shadowColor = "rgba(192,132,252,0.7)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = fillGrad;
  ctx.beginPath(); ctx.roundRect(progX, progY, fillW, trackH, trackH / 2); ctx.fill();
  ctx.restore();

  // Thumb — 흰 원 + ring glow
  const thumbR = Math.max(trackH * 1.5, 4);
  ctx.save();
  ctx.shadowColor = "rgba(192,132,252,0.8)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(progX + fillW, progY + trackH / 2, thumbR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(167,139,250,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(progX + fillW, progY + trackH / 2, thumbR + 0.5, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
}

/** 재생/일시정지 — 흰 원 + 일시정지 막대 2개 (재생 중인 상태로 표시) */
function _drawPlayCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 내부 미세 그라데이션 (입체감)
  const innerGrad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  innerGrad.addColorStop(0, "rgba(255,255,255,1)");
  innerGrad.addColorStop(1, "rgba(220,225,240,0.95)");
  ctx.fillStyle = innerGrad;
  ctx.beginPath(); ctx.arc(cx, cy, size / 2 - 0.5, 0, Math.PI * 2); ctx.fill();
  // 일시정지 막대 2개
  const barW = size * 0.11;
  const barH = size * 0.42;
  ctx.fillStyle = "rgba(28,30,48,0.95)";
  ctx.beginPath(); ctx.roundRect(cx - barW * 1.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + barW * 0.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();
}

/** 이전/다음 버튼 — 삼각형 두 개 + 막대. forward=true면 우측 다음, false면 좌측 이전. */
function _drawSkipBtn(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, forward: boolean) {
  const triH = size * 0.7;
  const triW = size * 0.42;
  const dir = forward ? 1 : -1;

  ctx.save();
  // 미세한 drop shadow로 입체감
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = size * 0.15;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fillStyle = "rgba(255,255,255,0.92)";

  // 안쪽 삼각형 (중앙 근처)
  ctx.beginPath();
  ctx.moveTo(cx - dir * triW * 0.05, cy - triH / 2);
  ctx.lineTo(cx - dir * triW * 0.05, cy + triH / 2);
  ctx.lineTo(cx + dir * (triW - triW * 0.05), cy);
  ctx.closePath(); ctx.fill();

  // 바깥쪽 삼각형
  ctx.beginPath();
  ctx.moveTo(cx + dir * (triW - triW * 0.05), cy - triH / 2);
  ctx.lineTo(cx + dir * (triW - triW * 0.05), cy + triH / 2);
  ctx.lineTo(cx + dir * (triW * 2 - triW * 0.1), cy);
  ctx.closePath(); ctx.fill();

  // 끝 막대 (다음=오른쪽, 이전=왼쪽)
  const barX = forward ? cx + triW * 1.95 : cx - triW * 1.95 - size * 0.09;
  ctx.fillRect(barX, cy - triH / 2, size * 0.09, triH);

  ctx.restore();
}

function _drawEndScreen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, channelName: string) {
  drawGlassBox(ctx, x, y, w, h, 12 * s);
  const accentW = 80 * s;
  const grad = ctx.createLinearGradient(x + w / 2 - accentW / 2, 0, x + w / 2 + accentW / 2, 0);
  grad.addColorStop(0, "#818cf8"); grad.addColorStop(1, "#c084fc");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(x + w / 2 - accentW / 2, y, accentW, 2, 1); ctx.fill();
  const eLogoW = 32 * s, eLogoH = 22 * s;
  ctx.fillStyle = "#FF0000";
  ctx.beginPath(); ctx.roundRect(x + w / 2 - eLogoW / 2, y + 14 * s, eLogoW, eLogoH, 5 * s); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 4 * s, y + 18 * s);
  ctx.lineTo(x + w / 2 - 4 * s, y + 32 * s);
  ctx.lineTo(x + w / 2 + 7 * s, y + 25 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = `800 ${Math.round(12 * s)}px Inter, Pretendard, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(channelName, x + w / 2, y + 48 * s);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + w * 0.25, y + 58 * s, w * 0.5, 1);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `italic ${Math.round(7 * s)}px Georgia, Pretendard, serif`;
  ctx.fillText("그냥 보통의 날들이 가득하기를,", x + w / 2, y + 70 * s);
  ctx.fillText("그 나날들 속에 나와 함께하기만을 바란다.", x + w / 2, y + 82 * s);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `${Math.round(5.5 * s)}px Inter, Pretendard, sans-serif`;
  ctx.fillText("좋아요와 구독 부탁드립니다", x + w / 2, y + h - 10 * s);
  ctx.textAlign = "start";
}

// ═══════════════════════════════════════
// 이퀄라이저 그리기 (longform/shorts 공통) — 3종: white / neon / color
// 모두 cw 비례로 그려서 미리보기(270×480) ↔ 렌더(1080×1920) 양쪽에서 동일하게 보임.
// 변화량을 시각적으로 강조하기 위해 minScale을 두고 휴식 구간엔 살짝 가라앉도록 정규화함.
// ═══════════════════════════════════════

export function drawEqualizer(
  ctx: CanvasRenderingContext2D, eqType: string,
  freqData: Uint8Array, cw: number, ch: number,
) {
  ctx.save();
  if (eqType === "white") {
    _drawWhiteEq(ctx, freqData, cw, ch);
  } else if (eqType === "neon") {
    _drawNeonEq(ctx, freqData, cw, ch);
  } else if (eqType === "color") {
    _drawColorEq(ctx, freqData, cw, ch);
  }
  ctx.restore();
}

/** freqData를 0~1 정규화 + 곡선 적용해 변화량 강조. 평균이 너무 낮으면 0에 가깝게 떨어뜨려 "쉬는" 느낌도 살림. */
function _normalize(freqData: Uint8Array, count: number): number[] {
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const v = freqData[Math.min(i, freqData.length - 1)] / 255;
    // pow 0.65 — 작은 값은 살짝 들어올려 항상 보이게, 큰 값은 거의 그대로 유지
    out[i] = Math.pow(v, 0.65);
  }
  return out;
}

function _avg(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

/* ── 화이트 글래스 — frosted glass 톤의 흰 막대 ──
 * 어떤 커버 위에서도 무난. 막대 위쪽에 highlight cap, 본체에 미세 그라데이션으로 입체감.
 * 변화폭이 명확히 보이도록 막대 높이를 풀로 사용 (0.95).
 */
function _drawWhiteEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const barCount = 22;
  const eqW = cw * 0.62;
  const eqH = ch * 0.135;
  const startX = (cw - eqW) / 2;
  const startY = ch - eqH - ch * 0.04;
  const barW = eqW / barCount;
  const gap = Math.max(2, barW * 0.22);
  const w = Math.max(barW - gap, 2);

  const norm = _normalize(freqData, barCount);
  const avgV = _avg(norm);

  // 배경 frosted panel (아주 옅은 흰색)
  ctx.fillStyle = `rgba(255,255,255,${0.04 + avgV * 0.04})`;
  ctx.beginPath(); ctx.roundRect(startX - 8, startY - 6, eqW + 16, eqH + 12, 10); ctx.fill();

  for (let i = 0; i < barCount; i++) {
    const v = norm[i];
    const bH = Math.max(v * eqH * 0.95, 1.5);
    const x = startX + i * barW + gap / 2;
    const by = startY + eqH - bH;

    // 본체 — 위에서 아래로 alpha 그라데이션 (위 진함)
    const grad = ctx.createLinearGradient(0, by, 0, by + bH);
    grad.addColorStop(0, `rgba(255,255,255,${0.55 + v * 0.4})`);
    grad.addColorStop(1, `rgba(255,255,255,${0.25 + v * 0.25})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, by, w, bH, w * 0.45); ctx.fill();

    // 상단 cap highlight (1.5px)
    ctx.fillStyle = `rgba(255,255,255,${0.85 + v * 0.15})`;
    ctx.beginPath(); ctx.roundRect(x, by, w, Math.min(bH, 1.8), w * 0.45); ctx.fill();

    // 좌측 inner highlight (입체감)
    ctx.fillStyle = `rgba(255,255,255,${0.3 + v * 0.2})`;
    ctx.fillRect(x + 0.5, by + 1, 0.7, bH - 2);
  }
}

/* ── 네온 글로우 — 중심에서 방사형으로 뻗는 빛 + 펄스 링 ──
 * 시안→마젠타 그라데이션. shadowBlur로 진짜 글로우 살림. 변화폭 크고 시각 임팩트 강함.
 */
function _drawNeonEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const barCount = 48;
  const cx = cw / 2;
  const cy = ch - ch * 0.16;
  const baseR = cw * 0.05;     // 16~54px (270~1080 범위)
  const maxLen = cw * 0.13;    // 35~140px — 기존 30px보다 크게

  const norm = _normalize(freqData, barCount);
  const avgV = _avg(norm);

  // 중앙 펄스 글로우 (전체 평균 진폭에 반응)
  const pulseR = baseR * 0.55 + avgV * baseR * 0.5;
  const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR * 3);
  pulseGrad.addColorStop(0, `rgba(192,132,252,${0.55 + avgV * 0.4})`);
  pulseGrad.addColorStop(0.5, `rgba(99,102,241,${0.2 + avgV * 0.3})`);
  pulseGrad.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = pulseGrad;
  ctx.beginPath(); ctx.arc(cx, cy, pulseR * 3, 0, Math.PI * 2); ctx.fill();

  // 내부 링
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + avgV * 0.5})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.stroke();

  // 방사형 빛줄기 (shadowBlur로 글로우)
  ctx.save();
  for (let i = 0; i < barCount; i++) {
    const v = norm[i];
    if (v < 0.04) continue;
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    // 시안(180) → 보라(280) → 마젠타(320) 흐름
    const hue = 195 + (i / barCount) * 130;
    const len = baseR + v * maxLen;

    const r1 = baseR + 2;
    const r2 = len;
    const x1 = cx + Math.cos(angle) * r1;
    const y1 = cy + Math.sin(angle) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy + Math.sin(angle) * r2;

    ctx.shadowBlur = 8 + v * 14;
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, ${0.6 + v * 0.4})`;
    ctx.strokeStyle = `hsla(${hue}, 100%, 75%, ${0.65 + v * 0.35})`;
    ctx.lineWidth = 2.5 + v * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 끝점에 작은 점 (별처럼)
    if (v > 0.4) {
      ctx.shadowBlur = 12 + v * 10;
      ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${0.9})`;
      ctx.beginPath(); ctx.arc(x2, y2, 1.2 + v * 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ── 컬러 그라데이션 — 좌→우 무지개 흐름 막대 ──
 * 막대마다 hue가 달라서 컬러풀. 각 막대는 위→아래로 채도 그라데이션 + 글로우.
 */
function _drawColorEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const barCount = 28;
  const eqW = cw * 0.7;
  const eqH = ch * 0.14;
  const startX = (cw - eqW) / 2;
  const startY = ch - eqH - ch * 0.04;
  const barW = eqW / barCount;
  const gap = Math.max(1.5, barW * 0.2);
  const w = Math.max(barW - gap, 2);

  const norm = _normalize(freqData, barCount);

  // 배경 옅은 패널
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.roundRect(startX - 8, startY - 6, eqW + 16, eqH + 12, 12); ctx.fill();

  ctx.save();
  for (let i = 0; i < barCount; i++) {
    const v = norm[i];
    const bH = Math.max(v * eqH * 0.95, 2);
    const x = startX + i * barW + gap / 2;
    const by = startY + eqH - bH;
    // 파랑(210) → 보라(280) → 핫핑크(330) → 오렌지(20) — 좌에서 우로 무지개
    const hue = 210 + (i / barCount) * 170;

    // 글로우 (shadowBlur)
    ctx.shadowBlur = 6 + v * 10;
    ctx.shadowColor = `hsla(${hue}, 100%, 65%, ${0.5 + v * 0.4})`;

    // 본체 — 수직 그라데이션 (위는 밝은 색, 아래는 진한 색)
    const grad = ctx.createLinearGradient(0, by, 0, by + bH);
    grad.addColorStop(0, `hsla(${hue}, 100%, 78%, ${0.95})`);
    grad.addColorStop(0.5, `hsla(${hue}, 90%, 60%, ${0.85})`);
    grad.addColorStop(1, `hsla(${hue}, 80%, 45%, ${0.65})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, by, w, bH, w * 0.45); ctx.fill();

    // 상단 cap (밝은 흰)
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,${0.7 + v * 0.3})`;
    ctx.beginPath(); ctx.roundRect(x, by, w, Math.min(bH, 2), w * 0.45); ctx.fill();
  }
  ctx.restore();

  // 하단 baseline 그라데이션 라인
  const lineGrad = ctx.createLinearGradient(startX, 0, startX + eqW, 0);
  lineGrad.addColorStop(0, "rgba(96,165,250,0.4)");
  lineGrad.addColorStop(0.5, "rgba(192,132,252,0.4)");
  lineGrad.addColorStop(1, "rgba(251,146,60,0.4)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX, startY + eqH);
  ctx.lineTo(startX + eqW, startY + eqH);
  ctx.stroke();
}

// ═══════════════════════════════════════
// 숏폼 전용 그리기 (재생바, 가사)
// ═══════════════════════════════════════

/**
 * 숏폼 재생 컨트롤러 — 통합 drawPlayerPill 호출 래퍼.
 * 화면 W에 비례해 가운데 정렬, 상단에서 살짝 띄워 이퀄라이저(하단)와 안 겹치게 배치.
 */
export function drawShortsPlayerBar(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number) {
  const barW = Math.min(W * 0.82, 240);
  const barH = barW * 0.36;
  const x = (W - barW) / 2;
  const y = H * 0.06;
  drawPlayerPill(ctx, x, y, barW, barH, elapsed);
}

export function drawShortsLyrics(ctx: CanvasRenderingContext2D, lyrics: string, W: number, H: number, elapsed: number) {
  const lines = lyrics.split("\n").filter(Boolean);
  if (lines.length === 0) return;
  const lineTime = 20 / Math.max(lines.length, 1);
  const currentLine = Math.min(Math.floor(elapsed / lineTime * (10 / 20)), lines.length - 1);
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "bold 11px Inter, Pretendard, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  if (lines[currentLine]) ctx.fillText(lines[currentLine], W / 2, H - 180, W - 40);
  ctx.restore();
}
