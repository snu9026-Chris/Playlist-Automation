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
    "player-bar": [340 * s, 60 * s],
    "player-bar-minimal": [240 * s, 28 * s],
  };
  const [w, h] = sizes[ov.preset || ""] || [100 * s, 40 * s];
  const { x, y } = calcPosition(ov.position, w, h, cw, ch, margin);

  ctx.save();

  if (ov.preset === "youtube-set") {
    _drawYouTubeSet(ctx, x, y, w, h, s);
  } else if (ov.preset === "watermark") {
    _drawWatermark(ctx, x, y, w, h, ov.channelName || "LOOPIFY");
  } else if (ov.preset === "player-bar" || ov.preset === "player-bar-minimal") {
    _drawPlayerBar(ctx, x, y, w, h, s, elapsed, ov.preset === "player-bar");
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

function _drawPlayerBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, elapsed: number, full: boolean) {
  drawGlassBox(ctx, x, y, w, h, 12 * s);
  const prog = (elapsed % 10) / 10;
  const pad = 10 * s;
  const btnSize = full ? 16 * s : 12 * s;

  // 일시정지
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(x + pad + btnSize / 2, y + h / 2, btnSize / 2 + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white";
  ctx.fillRect(x + pad + btnSize * 0.25, y + h / 2 - btnSize * 0.3, 2.5 * s, btnSize * 0.6);
  ctx.fillRect(x + pad + btnSize * 0.55, y + h / 2 - btnSize * 0.3, 2.5 * s, btnSize * 0.6);

  if (full) {
    // 되감기/빨리감기
    for (const [offset, dir] of [[10, -1], [26, 1]] as [number, number][]) {
      const bx = x + pad + btnSize + offset * s;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.roundRect(bx - 2, y + h / 2 - 7 * s, 14 * s, 14 * s, 3 * s); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      if (dir === -1) {
        ctx.beginPath(); ctx.moveTo(bx + 10 * s, y + h / 2 - 4 * s); ctx.lineTo(bx + 4 * s, y + h / 2); ctx.lineTo(bx + 10 * s, y + h / 2 + 4 * s); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + 6 * s, y + h / 2 - 4 * s); ctx.lineTo(bx, y + h / 2); ctx.lineTo(bx + 6 * s, y + h / 2 + 4 * s); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(bx, y + h / 2 - 4 * s); ctx.lineTo(bx + 6 * s, y + h / 2); ctx.lineTo(bx, y + h / 2 + 4 * s); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + 4 * s, y + h / 2 - 4 * s); ctx.lineTo(bx + 10 * s, y + h / 2); ctx.lineTo(bx + 4 * s, y + h / 2 + 4 * s); ctx.fill();
      }
    }
  }

  // 프로그레스 바
  const barStart = full ? x + pad + btnSize + 44 * s : x + pad + btnSize + 10 * s;
  const barEnd = x + w - pad - 50 * s;
  const barW2 = barEnd - barStart;
  const barY2 = y + h / 2 - 1.5;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath(); ctx.roundRect(barStart, barY2, barW2, 3, 1.5); ctx.fill();
  const grad = ctx.createLinearGradient(barStart, 0, barStart + barW2 * prog, 0);
  grad.addColorStop(0, "#818cf8"); grad.addColorStop(1, "#c084fc");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(barStart, barY2, barW2 * prog, 3, 1.5); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(barStart + barW2 * prog, barY2 + 1.5, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(167,139,250,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(barStart + barW2 * prog, barY2 + 1.5, 4 * s, 0, Math.PI * 2); ctx.stroke();

  // 시간
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `500 ${Math.round(6 * s)}px monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`${Math.floor((elapsed % 600) / 60)}:${Math.floor(elapsed % 60).toString().padStart(2, "0")}`, x + w - pad, y + h / 2 + 2);
  ctx.textAlign = "start";
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
// 이퀄라이저 그리기 (longform/shorts 공통)
// ═══════════════════════════════════════

export function drawEqualizer(
  ctx: CanvasRenderingContext2D, eqType: string,
  freqData: Uint8Array, cw: number, ch: number,
) {
  const barCount = Math.min(freqData.length, 48);
  const eqW = cw * 0.55;
  const eqH = 65;
  const startX = (cw - eqW) / 2;
  const startY = ch - eqH - 15;

  ctx.save();

  if (eqType === "glass") {
    _drawGlassEq(ctx, freqData, barCount, eqW, eqH, startX, startY);
  } else if (eqType === "circle") {
    _drawCircleEq(ctx, freqData, barCount, cw, ch);
  } else if (eqType === "pulse") {
    _drawPulseEq(ctx, freqData, barCount, cw, ch);
  } else if (eqType === "symmetric") {
    _drawSymmetricEq(ctx, freqData, barCount, eqW, eqH, startX, startY);
  }

  ctx.restore();
}

function _drawGlassEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, barCount: number, eqW: number, eqH: number, startX: number, startY: number) {
  const barW = eqW / barCount;
  const gap = Math.max(2, barW * 0.18);
  for (let i = 0; i < barCount; i++) {
    const v = freqData[i] / 255;
    const bH = v * eqH * 0.88;
    const x = startX + i * barW + gap / 2;
    const w = Math.max(barW - gap, 2);
    const by = startY + eqH - bH;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + v * 0.18})`;
    ctx.beginPath(); ctx.roundRect(x, by, w, bH, 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + v * 0.2})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(x, by, w, bH, 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.3 + v * 0.2})`;
    ctx.fillRect(x + 1, by, w - 2, Math.min(bH, 4));
    ctx.fillStyle = `rgba(255,255,255,0.2)`;
    ctx.fillRect(x, by, 1, bH);
    ctx.fillStyle = `rgba(129,140,248,${v * 0.25})`;
    ctx.fillRect(x, by + bH * 0.6, w, bH * 0.4);
  }
}

function _drawCircleEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, barCount: number, cw: number, ch: number) {
  const cx = cw / 2, cy = ch - 85;
  const baseR = 18, maxLen = 30;
  ctx.strokeStyle = "rgba(167,139,250,0.15)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < barCount; i++) {
    const v = freqData[i] / 255;
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    const hue = 250 + (i / barCount) * 60;
    ctx.strokeStyle = `hsla(${hue}, 80%, 72%, ${0.4 + v * 0.6})`;
    ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
    ctx.lineTo(cx + Math.cos(angle) * (baseR + v * maxLen), cy + Math.sin(angle) * (baseR + v * maxLen));
    ctx.stroke();
  }
}

function _drawPulseEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, barCount: number, cw: number, ch: number) {
  const cx = cw / 2, cy = ch - 85;
  for (let r = 0; r < 6; r++) {
    const v = freqData[Math.floor((r / 6) * barCount)] / 255;
    const radius = ((r + 1) / 6) * 45;
    ctx.strokeStyle = `hsla(${240 + r * 8}, 75%, 72%, ${0.1 + v * 0.5})`;
    ctx.lineWidth = 1.5 + v * 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  }
  const avgV = Array.from(freqData).reduce((a, b) => a + b, 0) / freqData.length / 255;
  ctx.fillStyle = `rgba(196,132,252,${0.3 + avgV * 0.5})`;
  ctx.beginPath(); ctx.arc(cx, cy, 3 + avgV * 6, 0, Math.PI * 2); ctx.fill();
}

function _drawSymmetricEq(ctx: CanvasRenderingContext2D, freqData: Uint8Array, barCount: number, eqW: number, eqH: number, startX: number, startY: number) {
  const barW2 = eqW / barCount;
  const gap2 = Math.max(1.5, barW2 * 0.15);
  const midEq = startY + eqH / 2;
  const maxH = eqH / 2 * 0.88;

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.beginPath(); ctx.roundRect(startX - 4, startY - 4, eqW + 8, eqH + 8, 8); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.roundRect(startX - 4, startY - 4, eqW + 8, eqH + 8, 8); ctx.stroke();

  for (let i = 0; i < barCount; i++) {
    const v = freqData[i] / 255;
    const bH = v * maxH;
    const bx = startX + i * barW2 + gap2 / 2;
    const bw = Math.max(barW2 - gap2, 1.5);

    const upGrad = ctx.createLinearGradient(0, midEq, 0, midEq - bH);
    upGrad.addColorStop(0, "rgba(129,140,248,0.15)");
    upGrad.addColorStop(0.5, "rgba(129,140,248,0.4)");
    upGrad.addColorStop(1, "rgba(196,132,252,0.7)");
    ctx.fillStyle = upGrad;
    ctx.beginPath(); ctx.roundRect(bx, midEq - bH, bw, bH, bw / 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(bx + 0.5, midEq - bH, bw - 1, Math.min(bH, 2));

    const dnGrad = ctx.createLinearGradient(0, midEq, 0, midEq + bH);
    dnGrad.addColorStop(0, "rgba(129,140,248,0.15)");
    dnGrad.addColorStop(0.5, "rgba(99,102,241,0.35)");
    dnGrad.addColorStop(1, "rgba(79,70,229,0.6)");
    ctx.fillStyle = dnGrad;
    ctx.beginPath(); ctx.roundRect(bx, midEq, bw, bH, bw / 2); ctx.fill();
  }

  ctx.strokeStyle = "rgba(167,139,250,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(startX, midEq); ctx.lineTo(startX + eqW, midEq); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(startX, midEq); ctx.lineTo(startX + eqW, midEq); ctx.stroke();
}

// ═══════════════════════════════════════
// 숏폼 전용 그리기 (재생바, 가사)
// ═══════════════════════════════════════

export function drawShortsPlayerBar(ctx: CanvasRenderingContext2D, W: number, H: number, elapsed: number) {
  const barW3 = W * 0.8, barH3 = 26;
  const x = (W - barW3) / 2, y = H - 50;
  const prog = (elapsed % 10) / 10;
  ctx.save();
  drawGlassBox(ctx, x, y, barW3, barH3, barH3 / 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath(); ctx.arc(x + 16, y + barH3 / 2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white";
  ctx.fillRect(x + 13, y + barH3 / 2 - 4, 2.5, 8);
  ctx.fillRect(x + 17, y + barH3 / 2 - 4, 2.5, 8);
  const pStart = x + 30, pW = barW3 - 60;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath(); ctx.roundRect(pStart, y + barH3 / 2 - 1.5, pW, 3, 1.5); ctx.fill();
  const grad = ctx.createLinearGradient(pStart, 0, pStart + pW * prog, 0);
  grad.addColorStop(0, "#818cf8"); grad.addColorStop(1, "#c084fc");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(pStart, y + barH3 / 2 - 1.5, pW * prog, 3, 1.5); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(pStart + pW * prog, y + barH3 / 2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "500 7px monospace"; ctx.textAlign = "right";
  ctx.fillText(`0:${Math.floor(elapsed % 20).toString().padStart(2, "0")}`, x + barW3 - 8, y + barH3 / 2 + 2.5);
  ctx.restore();
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
