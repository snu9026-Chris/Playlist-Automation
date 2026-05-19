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
  playerBarStyle: string = "frosted",
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
    drawPlayerPill(ctx, x, y, w, h, elapsed, playerBarStyle);
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
 * 통합 플레이어바 — 숏폼/롱폼 공통, 2종 style 분기.
 *  - iconic: 가운데 재생 원형 + 둘레 ring 진행률 (기본)
 *  - minimal: 컨트롤 작고 진행률만 얇은 라인
 */
export function drawPlayerPill(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, elapsed: number,
  style: string = "iconic",
) {
  if (style === "minimal") _drawPillMinimal(ctx, x, y, w, h, elapsed);
  else _drawPillIconic(ctx, x, y, w, h, elapsed);
}

/* ── Minimal — 캡슐 없이 컨트롤 + 진행률만. 매우 미니멀 ── */
function _drawPillMinimal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, elapsed: number) {
  ctx.save();
  // 아주 옅은 백드롭만 (가독성용)
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(h * 0.3, 24)); ctx.fill();

  // 컨트롤 행 — 작게
  const ctrlY = y + h * 0.42;
  const cx = x + w / 2;
  const btnGap = w * 0.18;
  _drawSkipGlyph(ctx, cx - btnGap, ctrlY, h * 0.22, false);
  // 가운데 일시정지 (흰 원 없이 막대 2개만, 미니멀)
  const psBarW = h * 0.04;
  const psBarH = h * 0.24;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath(); ctx.roundRect(cx - psBarW * 1.4, ctrlY - psBarH / 2, psBarW, psBarH, psBarW * 0.3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + psBarW * 0.4, ctrlY - psBarH / 2, psBarW, psBarH, psBarW * 0.3); ctx.fill();
  _drawSkipGlyph(ctx, cx + btnGap, ctrlY, h * 0.22, true);

  // 진행률 — 매우 얇은 라인 (1px)
  const progY = y + h * 0.78;
  const progPad = w * 0.05;
  const progX = x + progPad;
  const progW = w - progPad * 2;
  const prog = (elapsed * 21 % 210) / 210;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(progX, progY, progW, 1);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(progX, progY, progW * prog, 1);
  ctx.restore();
}

/* ── D. Iconic — 가운데 큰 재생 원 + 둘레 ring 진행률. 진행바 행 없음 ── */
function _drawPillIconic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, elapsed: number) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = h * 0.42;
  const prog = (elapsed * 21 % 210) / 210;

  // outer shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = h * 0.2;
  ctx.shadowOffsetY = h * 0.05;
  ctx.fillStyle = "rgba(0,0,0,0.0)";
  ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ring track
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();

  // ring 진행률 (그라데이션 stroke은 hsl 변화로 흉내)
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  const startAng = -Math.PI / 2;
  const endAng = startAng + prog * Math.PI * 2;
  ctx.shadowColor = "rgba(192,132,252,0.7)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#c084fc";
  ctx.beginPath(); ctx.arc(cx, cy, R + 4, startAng, endAng); ctx.stroke();
  ctx.shadowBlur = 0;

  // 가운데 흰 원 + 일시정지
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.4)";
  ctx.shadowBlur = R * 0.4;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const barW = R * 0.22;
  const barH = R * 0.85;
  ctx.fillStyle = "rgba(28,30,48,0.95)";
  ctx.beginPath(); ctx.roundRect(cx - barW * 1.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + barW * 0.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();

  // 좌우에 작은 이전/다음 (선택적)
  const sideY = cy;
  const sideX = w * 0.32;
  _drawSkipGlyph(ctx, x + sideX, sideY, h * 0.22, false);
  _drawSkipGlyph(ctx, x + w - sideX, sideY, h * 0.22, true);

  ctx.restore();
}

/** 재생 글리프 — 흰 원 + 일시정지 막대 2개 (재생 중 상태로 표시) */
function _drawPlayGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.4)";
  ctx.shadowBlur = size * 0.3;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const barW = size * 0.11;
  const barH = size * 0.42;
  ctx.fillStyle = "rgba(28,30,48,0.95)";
  ctx.beginPath(); ctx.roundRect(cx - barW * 1.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + barW * 0.6, cy - barH / 2, barW, barH, barW * 0.3); ctx.fill();
}

/** 이전/다음 글리프 — 삼각2 + 끝 막대 */
function _drawSkipGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, forward: boolean) {
  const triH = size * 0.7;
  const triW = size * 0.42;
  const dir = forward ? 1 : -1;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.moveTo(cx - dir * triW * 0.05, cy - triH / 2);
  ctx.lineTo(cx - dir * triW * 0.05, cy + triH / 2);
  ctx.lineTo(cx + dir * (triW - triW * 0.05), cy);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + dir * (triW - triW * 0.05), cy - triH / 2);
  ctx.lineTo(cx + dir * (triW - triW * 0.05), cy + triH / 2);
  ctx.lineTo(cx + dir * (triW * 2 - triW * 0.1), cy);
  ctx.closePath(); ctx.fill();
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
  if (eqType === "spike") _drawSpikeEq(ctx, freqData, cw, ch);
  else if (eqType === "neon-dots") _drawNeonDotsEq(ctx, freqData, cw, ch);
  else if (eqType === "neon-ring") _drawNeonRingEq(ctx, freqData, cw, ch);
  else if (eqType === "neon-rotor") _drawNeonRotorEq(ctx, freqData, cw, ch);
  else if (eqType === "neon-arc") _drawNeonArcEq(ctx, freqData, cw, ch);
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

/** 스파이크 — 진폭 큰 데이터만 sharp triangle로 솟음 */
function _drawSpikeEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const pointCount = 48;
  const eqW = cw * 0.72;
  const eqH = ch * 0.13;
  const startX = (cw - eqW) / 2;
  const baseY = ch - ch * 0.1;
  const stepW = eqW / (pointCount - 1);
  const norm = _normalize(freqData, pointCount);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(startX, baseY); ctx.lineTo(startX + eqW, baseY); ctx.stroke();

  ctx.save();
  ctx.shadowColor = "hsla(280,90%,70%,0.5)";
  ctx.shadowBlur = 6;
  for (let i = 0; i < pointCount; i++) {
    const v = norm[i];
    if (v < 0.2) continue;
    const x = startX + i * stepW;
    const bH = v * eqH;
    const hue = 200 + (i / pointCount) * 130;
    ctx.fillStyle = `hsla(${hue}, 95%, 75%, ${0.85})`;
    ctx.beginPath();
    ctx.moveTo(x - stepW * 0.4, baseY);
    ctx.lineTo(x, baseY - bH);
    ctx.lineTo(x + stepW * 0.4, baseY);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ───────── 원형/방사형 ───────── */

function _drawNeonDotsEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const count = 36;
  const cx = cw / 2;
  const cy = ch - ch * 0.16;
  const baseR = cw * 0.05;
  const maxLen = cw * 0.13;
  const norm = _normalize(freqData, count);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const v = norm[i];
    const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
    const hue = 195 + (i / count) * 130;
    // 도트 3개를 거리별로
    for (let d = 0; d < 3; d++) {
      const r = baseR + (d + 1) * (maxLen / 3) * v;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const dotR = 1.2 + v * (2 - d * 0.4);
      ctx.shadowBlur = 6 + v * 6;
      ctx.shadowColor = `hsla(${hue}, 95%, 70%, 0.7)`;
      ctx.fillStyle = `hsla(${hue}, 100%, ${75 - d * 5}%, ${0.85 - d * 0.2})`;
      ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function _drawNeonRingEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const cx = cw / 2;
  const cy = ch - ch * 0.16;
  const baseR = cw * 0.04;
  const norm = _normalize(freqData, 24);
  const avgV = _avg(norm);
  // 동심원 4개
  for (let r = 0; r < 4; r++) {
    const i = Math.floor((r / 4) * 24);
    const v = norm[i];
    const radius = baseR + r * cw * 0.025 + v * cw * 0.03;
    const hue = 195 + r * 35;
    ctx.save();
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, ${0.5 + v * 0.4})`;
    ctx.shadowBlur = 10 + v * 8;
    ctx.strokeStyle = `hsla(${hue}, 100%, 72%, ${0.4 + v * 0.5})`;
    ctx.lineWidth = 1.5 + v * 1;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 중앙 점
  ctx.save();
  ctx.shadowColor = "rgba(192,132,252,0.8)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = `rgba(255,255,255,${0.7 + avgV * 0.3})`;
  ctx.beginPath(); ctx.arc(cx, cy, 2 + avgV * 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 회전 로터 — 시계 방향으로 회전 (elapsed 기반) */
function _drawNeonRotorEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const blades = 24;
  const cx = cw / 2;
  const cy = ch - ch * 0.16;
  const baseR = cw * 0.045;
  const maxLen = cw * 0.12;
  const norm = _normalize(freqData, blades);
  const rot = (performance.now() / 1500) % (Math.PI * 2); // 천천히 회전
  ctx.save();
  for (let i = 0; i < blades; i++) {
    const v = norm[i];
    const ang = (i / blades) * Math.PI * 2 + rot;
    const hue = 195 + (i / blades) * 130;
    const len = baseR + v * maxLen;
    ctx.shadowBlur = 8 + v * 12;
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, 0.7)`;
    ctx.strokeStyle = `hsla(${hue}, 100%, 75%, ${0.6 + v * 0.4})`;
    ctx.lineWidth = 2 + v * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (baseR + 2), cy + Math.sin(ang) * (baseR + 2));
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
  // 중앙 검은 원 (입체감)
  ctx.fillStyle = "rgba(15,16,28,0.7)";
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.fill();
}

/** 좌우 호 — 반원 형태로 좌우 펼침 */
function _drawNeonArcEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, cw: number, ch: number) {
  const blades = 30;
  const cx = cw / 2;
  const cy = ch - ch * 0.08;
  const baseR = cw * 0.06;
  const maxLen = cw * 0.16;
  const norm = _normalize(freqData, blades);
  ctx.save();
  for (let i = 0; i < blades; i++) {
    const v = norm[i];
    // 위쪽 반원 (-π → 0)
    const ang = -Math.PI + (i / (blades - 1)) * Math.PI;
    const hue = 195 + (i / blades) * 130;
    const len = baseR + v * maxLen;
    ctx.shadowBlur = 8 + v * 10;
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, 0.7)`;
    ctx.strokeStyle = `hsla(${hue}, 100%, 72%, ${0.6 + v * 0.4})`;
    ctx.lineWidth = 2 + v * 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (baseR + 2), cy + Math.sin(ang) * (baseR + 2));
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  // baseline 호 (옅은 라인)
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, baseR, -Math.PI, 0); ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════
// 숏폼 전용 그리기 (재생바, 가사)
// ═══════════════════════════════════════

/**
 * 숏폼 재생 컨트롤러 — 통합 drawPlayerPill 호출 래퍼.
 * 화면 W에 비례해 가운데 정렬, 상단에서 살짝 띄워 이퀄라이저(하단)와 안 겹치게 배치.
 */
export function drawShortsPlayerBar(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number, style: string = "frosted") {
  const barW = Math.min(W * 0.82, 240);
  const barH = barW * 0.36;
  const x = (W - barW) / 2;
  const y = H * 0.06;
  drawPlayerPill(ctx, x, y, barW, barH, elapsed, style);
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

// ═══════════════════════════════════════
// 워터마크 — 7종 (none + 6) 시안 (디자인 갤러리에서 선택)
// ═══════════════════════════════════════

export interface WatermarkOpts {
  channelName?: string;  // "Mocca's playlist" 같은 채널명
  trackTitle?: string;   // "Sunshine Paradise" 같은 현재 곡명
  trackList?: string[];  // 곡 목록 (marquee용)
}

/** 워터마크 통합 dispatcher. 화면 좌표계는 호출자의 W/H. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number,
  style: string, opts: WatermarkOpts = {},
) {
  if (style === "none" || !style) return;
  ctx.save();
  if (style === "rotating-circle") _drawRotatingCircle(ctx, W, H, elapsed, opts);
  else if (style === "marquee") _drawMarquee(ctx, W, H, elapsed, opts);
  else if (style === "minimal-line") _drawMinimalLine(ctx, W, H, opts);
  else if (style === "dot-progress") _drawDotProgress(ctx, W, H, elapsed);
  ctx.restore();
}

/* ── 1. 회전 원형 텍스트 — 좌하단 (이미지 #19) ── */
function _drawRotatingCircle(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number, opts: WatermarkOpts) {
  const text = (opts.channelName || "Music for Every Moment") + " · ";
  const r = Math.min(W, H) * 0.085;
  const cx = W * 0.13;
  const cy = H - H * 0.13;
  const rotation = (elapsed * 0.4) % (Math.PI * 2); // 천천히 회전

  ctx.save();
  // 옅은 원 베이스
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // 회전 텍스트 — 글자 하나씩 호 따라 배치
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${Math.round(r * 0.22)}px Inter, Pretendard, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fullText = text.repeat(2);
  const chars = fullText.split("");
  const angleStep = (Math.PI * 2) / chars.length;
  for (let i = 0; i < chars.length; i++) {
    const a = i * angleStep;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -r);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ── 2. 흐르는 곡 목록 — 우하단 가로 마키 (이미지 #20) ── */
function _drawMarquee(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number, opts: WatermarkOpts) {
  const tracks = opts.trackList && opts.trackList.length > 0
    ? opts.trackList
    : ["Sunshine Paradise", "The Middle", "Fool Me Once", "Catch Me", "Head Over Heels", "Kisses the Sun"];
  const text = tracks.join("   •   ") + "   •   ";
  const fontSize = Math.max(H * 0.022, 10);
  ctx.save();
  ctx.font = `500 ${fontSize}px Inter, Pretendard, sans-serif`;
  const textW = ctx.measureText(text).width;
  const totalW = textW + 40;
  // 좌→우 흐름 (시간에 따라 offset 변화)
  const speed = W * 0.035;
  const offset = (elapsed * speed) % totalW;
  const y = H - H * 0.05;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 3;
  // 두 번 그려서 끊김 없는 흐름
  ctx.fillText(text, W - offset, y);
  ctx.fillText(text, W - offset + totalW, y);
  ctx.restore();
}

/* ── 3. 미니멀 라인 — 좌하단 옅은 한 줄 텍스트 ── */
function _drawMinimalLine(ctx: CanvasRenderingContext2D, W: number, H: number, opts: WatermarkOpts) {
  const channel = opts.channelName || "Music for every moment";
  ctx.save();
  ctx.font = `italic 500 ${Math.round(H * 0.018)}px Georgia, Pretendard, serif`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillText(channel, W * 0.05, H - H * 0.04);
  // 작은 라인
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(W * 0.05, H - H * 0.035);
  ctx.lineTo(W * 0.05 + W * 0.08, H - H * 0.035);
  ctx.stroke();
  ctx.restore();
}

/* ── 4. 도트 진행률 — 우상단 작은 도트 N개 (재생 진행 시각화) ── */
function _drawDotProgress(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number) {
  const total = 15;
  const prog = (elapsed * 21 % 210) / 210;
  const active = Math.floor(prog * total);
  const dotR = Math.max(H * 0.005, 2);
  const gap = dotR * 3;
  const totalW = total * gap;
  const startX = W - W * 0.05 - totalW;
  const y = H * 0.05;
  ctx.save();
  ctx.shadowColor = "rgba(192,132,252,0.7)";
  for (let i = 0; i < total; i++) {
    const on = i < active;
    ctx.shadowBlur = on ? 5 : 0;
    ctx.fillStyle = on
      ? "rgba(255,255,255,0.95)"
      : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(startX + i * gap + dotR, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
