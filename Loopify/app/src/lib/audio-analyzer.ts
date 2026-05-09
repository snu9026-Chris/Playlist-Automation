/**
 * 브라우저 Web Audio API로 mp3 파일의 에너지 피크 구간을 찾는다.
 * 서버 업로드 없이 브라우저 RAM에서 처리.
 */

export interface ClipResult {
  clipStart: number;
  clipEnd: number;
  clipDuration: number;
  duration: number;
  peakEnergy: number;
}

/**
 * mp3 File에서 가장 에너지 높은 20초 구간을 찾는다.
 */
export async function analyzeAudioPeak(
  file: File,
  clipDuration: number = 20
): Promise<ClipResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // 0.5초 윈도우로 RMS 에너지 계산
  const windowSize = Math.floor(sampleRate * 0.5);
  const energies: number[] = [];

  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += channelData[j] * channelData[j];
    }
    energies.push(Math.sqrt(sum / windowSize));
  }

  // 슬라이딩 윈도우: clipDuration초 구간의 평균 에너지가 가장 높은 지점
  const clipWindows = Math.floor(clipDuration / 0.5);
  let maxEnergy = 0;
  let maxStart = 0;

  for (let i = 0; i <= energies.length - clipWindows; i++) {
    let sum = 0;
    for (let j = i; j < i + clipWindows; j++) {
      sum += energies[j];
    }
    const avg = sum / clipWindows;
    if (avg > maxEnergy) {
      maxEnergy = avg;
      maxStart = i;
    }
  }

  const clipStart = Math.round(maxStart * 0.5 * 10) / 10;
  const clipEnd = Math.min(Math.round((clipStart + clipDuration) * 10) / 10, duration);
  const actualClipDuration = Math.round((clipEnd - clipStart) * 10) / 10;

  await audioContext.close();

  return {
    clipStart,
    clipEnd,
    clipDuration: actualClipDuration,
    duration,
    peakEnergy: maxEnergy,
  };
}

/**
 * Web Audio API의 OfflineAudioContext로 mp3 클립을 추출해 WAV Blob으로 반환.
 * FFmpeg.wasm 없이도 동작 (SharedArrayBuffer 불필요).
 */
export async function extractClip(
  file: File,
  clipStart: number,
  clipEnd: number
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const startSample = Math.floor(clipStart * sampleRate);
  const endSample = Math.floor(clipEnd * sampleRate);
  const length = endSample - startSample;

  // OfflineAudioContext로 구간 추출
  const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);
  const source = offlineCtx.createBufferSource();

  // 원본에서 클립 구간만 복사
  const clipBuffer = offlineCtx.createBuffer(channels, length, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    const destData = clipBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      destData[i] = sourceData[startSample + i] ?? 0;
    }
  }

  source.buffer = clipBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  await audioContext.close();

  // AudioBuffer → WAV Blob
  return audioBufferToWav(renderedBuffer);
}

/**
 * AudioBuffer를 WAV 형식의 Blob으로 변환
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV 헤더
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // PCM 데이터
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
