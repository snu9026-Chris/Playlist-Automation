/* ─── 이미지 처리 유틸리티 ─── */

/** File → base64 data URL */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Blob → base64 data URL */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** 이미지를 지정 크기로 압축 (JPEG) */
export function compressImage(dataUrl: string, w: number, h: number, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

/** 이미지를 16:9로 중앙 크롭 후 1920x1080으로 리사이즈 */
export function cropTo16x9(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const targetRatio = 16 / 9;
      const imgRatio = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, 1920, 1080);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** 이미지 다운로드 */
export function downloadImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/** 오디오 파일 길이 구하기 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    });
    audio.addEventListener("error", () => resolve(0));
    audio.src = URL.createObjectURL(file);
  });
}

/** 시간 포맷팅 */
export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`;
}
