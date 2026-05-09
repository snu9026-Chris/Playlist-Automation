"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Music, Film, ImageIcon, Download,
  Check, Loader2, Trash2, Wand2, Lock,
} from "lucide-react";
import type {
  EqualizerType, LoopType, OverlayItem,
  Mp3File, GeneratedImage,
} from "@/lib/types";
import { fileToBase64, compressImage, cropTo16x9, downloadImage, getAudioDuration, formatTime } from "@/lib/image-utils";
import { StepBadge } from "@/components/shared/StepBadge";
import { PreviewCanvas } from "@/components/longform/PreviewCanvas";
import { OverlayEditor } from "@/components/longform/OverlayEditor";
import { imagesApi } from "@/lib/api/images";

export default function LongformPage() {
  const [mp3s, setMp3s] = useState<Mp3File[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imageCount, setImageCount] = useState(4);
  const [projectTheme, setProjectTheme] = useState("");
  const [generatingImages, setGeneratingImages] = useState(false);
  const [eqType, setEqType] = useState<EqualizerType>("glass");
  const [loopType, setLoopType] = useState<LoopType>("crossfade");
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderUrl] = useState("http://localhost:4100");
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null);
  const [downloadPath, setDownloadPath] = useState("");
  const [renderProgress, setRenderProgress] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  // mp3
  const handleMp3Files = async (fileList: FileList) => {
    const newFiles: Mp3File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const duration = await getAudioDuration(f);
      newFiles.push({ file: f, name: f.name, duration });
    }
    setMp3s((prev) => [...prev, ...newFiles]);
  };

  const removeMp3 = (idx: number) => setMp3s((prev) => prev.filter((_, i) => i !== idx));
  const totalDuration = mp3s.reduce((sum, m) => sum + m.duration, 0);

  // 이미지 생성
  const generateImages = async () => {
    if (!projectTheme) { alert("테마를 입력해 주세요"); return; }
    setGeneratingImages(true);
    const generated: GeneratedImage[] = [];

    for (let i = 0; i < imageCount; i++) {
      try {
        const data = await imagesApi.longformGenerate({ theme: projectTheme, index: i, total: imageCount });
        if (data.imageUrl) generated.push({ url: data.imageUrl, selected: true });
      } catch {}
    }

    setImages(generated);
    setGeneratingImages(false);
  };

  // 이미지 업로드 (16:9 강제 크롭)
  const handleImageUpload = async (fileList: FileList) => {
    const newImages: GeneratedImage[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) continue;
      const cropped = await cropTo16x9(file);
      newImages.push({ url: cropped, selected: true });
    }
    setImages((prev) => [...prev, ...newImages]);
  };

  const saveImage = (url: string, idx: number) => downloadImage(url, `longform_bg_${idx + 1}.jpg`);

  const toggleImageSelect = (idx: number) => {
    setImages((prev) => prev.map((img, i) => i === idx ? { ...img, selected: !img.selected } : img));
  };

  const selectedImages = images.filter((img) => img.selected);

  // 렌더링
  const renderLongform = async () => {
    if (mp3s.length === 0 || selectedImages.length === 0) return;

    setRenderProgress("서버 연결 확인 중...");
    try {
      const h = await fetch(`${renderUrl}/health`);
      const hd = await h.json();
      if (hd.status === "bundling") {
        setRenderProgress("Remotion 번들 준비 중... 잠시 후 다시 시도해주세요.");
        return;
      }
      if (hd.status !== "ok") throw new Error();
    } catch {
      setRenderProgress("로컬 서버 연결 실패. node local-server/render-server.mjs 실행 후 다시 시도하세요.");
      setShowUrlInput(true);
      return;
    }

    setRendering(true);
    setRenderProgress("mp3 준비 중...");

    try {
      const mp3Base64List: string[] = [];
      for (const m of mp3s) {
        mp3Base64List.push(await fileToBase64(m.file));
      }

      setRenderProgress("이미지 압축 중...");
      const imageBase64List: string[] = [];
      for (const img of selectedImages) {
        imageBase64List.push(await compressImage(img.url, 1920, 1080));
      }

      setRenderProgress("로컬 서버에서 렌더링 중...");

      const res = await fetch(`${renderUrl}/render-longform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mp3Base64List,
          imageBase64List,
          theme: projectTheme,
          imageLoopDuration: 10,
          eqType,
          loopType,
          overlays: await Promise.all(overlays.map(async (o) => {
            if (o.isPreset) {
              return {
                isPreset: true,
                preset: o.preset,
                channelName: o.channelName || "",
                position: o.position,
                scale: o.scale,
                opacity: o.opacity,
                timing: o.timing,
                timingSeconds: o.timingSeconds,
                chromakey: "none",
                fileName: o.name,
              };
            }
            return {
              base64: await fileToBase64(o.file!),
              position: o.position,
              scale: o.scale,
              opacity: o.opacity,
              timing: o.timing,
              timingSeconds: o.timingSeconds,
              chromakey: o.chromakey,
              fileName: o.name,
            };
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDownloadFileName(data.fileName);
        setDownloadPath(data.outputPath ?? `local-server/output/${data.fileName}`);
        setRenderProgress("완료!");
      } else {
        setRenderProgress(`실패: ${data.error}`);
      }
    } catch (e: any) {
      setRenderProgress(`에러: ${e.message}`);
    }
    setRendering(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 대시보드
        </Link>
        <h1 className="text-xl font-bold text-gray-900">롱폼 만들기</h1>
      </div>

      {/* ── Step 1: MP3 업로드 ── */}
      <div className="pearl-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <StepBadge num={1} done={mp3s.length > 0} />
          <div>
            <h3 className="font-semibold text-gray-900">MP3 업로드</h3>
            <p className="text-xs text-gray-400">플레이리스트에 넣을 곡들을 순서대로 업로드하세요</p>
          </div>
          {mp3s.length > 0 && (
            <div className="ml-auto text-right">
              <span className="text-sm font-bold tabular-nums text-indigo-500">{mp3s.length}곡</span>
              <span className="text-xs text-gray-400 ml-2">{formatTime(totalDuration)}</span>
            </div>
          )}
        </div>

        <label
          className="flex items-center gap-3 px-4 py-4 border-2 border-dashed border-pearl-300 rounded-xl hover:border-indigo-300 cursor-pointer transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleMp3Files(e.dataTransfer.files); }}
        >
          <input type="file" accept=".mp3,audio/mpeg" multiple className="hidden"
            onChange={(e) => e.target.files && handleMp3Files(e.target.files)} />
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">mp3 파일 드래그 또는 클릭</span>
        </label>

        {mp3s.length > 0 && (
          <div className="space-y-1">
            {mp3s.map((m, i) => (
              <div key={`${m.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5 bg-pearl-50 rounded-lg group">
                <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0">
                  <Music className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">#{i + 1}</span>
                <span className="text-sm text-gray-700 truncate flex-1">{m.name}</span>
                <span className="text-xs tabular-nums text-gray-400">{formatTime(m.duration)}</span>
                <button onClick={() => removeMp3(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 2: 이미지 생성 ── */}
      <div className={`pearl-card p-5 space-y-4 ${mp3s.length === 0 ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-3">
          <StepBadge num={2} done={images.length > 0} locked={mp3s.length === 0} />
          <div>
            <h3 className="font-semibold text-gray-900">배경 이미지</h3>
            <p className="text-xs text-gray-400">AI 생성 또는 직접 업로드 (16:9 자동 크롭)</p>
          </div>
        </div>

        {mp3s.length > 0 && (
          <>
            {/* AI 생성 */}
            <div className="flex items-center gap-3">
              <input
                type="text" value={projectTheme} onChange={(e) => setProjectTheme(e.target.value)}
                placeholder="장면 묘사 (예: 비 오는 도시 야경, 카페 창가...)"
                className="flex-1 px-3 py-2 rounded-lg border border-pearl-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-pearl-200 text-sm">
                <option value={3}>3장</option>
                <option value={4}>4장</option>
              </select>
              <button onClick={generateImages} disabled={generatingImages || !projectTheme}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm">
                {generatingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                AI 생성
              </button>
            </div>

            {/* 이미지 업로드 */}
            <label
              className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-pearl-300 rounded-xl hover:border-indigo-300 cursor-pointer transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files); }}
            >
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">이미지 파일 드래그 또는 클릭 (자동 16:9 크롭)</span>
            </label>

            {images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">클릭해서 루프에 사용할 이미지를 선택/해제하세요</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-video rounded-xl overflow-hidden group">
                      <button onClick={() => toggleImageSelect(i)}
                        className={`w-full h-full transition-all ${
                          img.selected ? "ring-3 ring-indigo-500 shadow-lg" : "opacity-40 hover:opacity-70"
                        }`}>
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-full">#{i + 1}</span>
                      {img.selected && <Check className="absolute top-2 right-2 w-5 h-5 text-white bg-indigo-500 rounded-full p-0.5" />}
                      {/* 저장 + 삭제 버튼 */}
                      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); saveImage(img.url, i); }}
                          className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80">
                          <Download className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)); }}
                          className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/80">
                          <Trash2 className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{selectedImages.length}장 선택됨</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Step 2.5: 이퀄라이저 + 루프 설정 + 미리보기 ── */}
      <div className={`pearl-card p-5 space-y-4 ${selectedImages.length === 0 ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-3">
          <StepBadge num={2.5} done={false} locked={selectedImages.length === 0} label="⚙️" />
          <div>
            <h3 className="font-semibold text-gray-900">이퀄라이저 & 루프 설정</h3>
            <p className="text-xs text-gray-400">스타일을 선택하고 미리보기로 확인하세요</p>
          </div>
        </div>

        {selectedImages.length > 0 && (
          <>
            {/* 이퀄라이저 타입 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">이퀄라이저 스타일</p>
              <div className="flex flex-wrap gap-2">
                {(["glass", "symmetric", "circle", "pulse"] as EqualizerType[]).map((t) => {
                  const labels: Record<EqualizerType, string> = {
                    glass: "글래스", symmetric: "대칭 스펙트럼", circle: "원형", pulse: "펄스",
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => setEqType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        eqType === t
                          ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                          : "bg-pearl-100 text-gray-500 hover:bg-pearl-200"
                      }`}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 오버레이 설정 */}
            <OverlayEditor overlays={overlays} setOverlays={setOverlays} />

            {/* 미리보기 (PNG 오버레이 포함) */}
            <PreviewCanvas
              images={selectedImages.map((img) => img.url)}
              overlays={overlays}
              audioFile={mp3s[0]?.file}
              eqType={eqType}
            />
          </>
        )}
      </div>

      {/* ── Step 3: 렌더링 ── */}
      <div className={`pearl-card p-5 space-y-4 ${selectedImages.length === 0 ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-3">
          <StepBadge num={3} done={!!downloadFileName} locked={selectedImages.length === 0} />
          <div>
            <h3 className="font-semibold text-gray-900">영상 렌더링</h3>
            <p className="text-xs text-gray-400">
              {selectedImages.length}장 이미지 루프 + {eqType} 이퀄라이저 + {mp3s.length}곡 합본 → mp4 ({formatTime(totalDuration)})
            </p>
          </div>
        </div>

        {selectedImages.length > 0 && (
          <>
            {showUrlInput && (
              <div className="flex items-center gap-2">
                <input type="text" value={renderUrl} readOnly
                  className="text-xs px-3 py-1.5 rounded-lg border border-pearl-200 w-56 font-mono text-gray-400" />
                <span className="text-xs text-red-500">✗ 로컬 서버 실행 필요</span>
              </div>
            )}

            <button onClick={renderLongform} disabled={rendering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold disabled:opacity-50 shadow-sm">
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
              롱폼 렌더링 시작
            </button>

            {renderProgress && (
              <p className={`text-sm ${downloadFileName ? "text-emerald-600 font-medium" : "text-gray-500"}`}>
                {renderProgress}
              </p>
            )}

            {downloadFileName && (
              <div className="pearl-card p-5 space-y-3 border-l-4 border-emerald-400">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-gray-900">렌더링 완료</h4>
                </div>
                <div className="bg-pearl-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-400 mb-1">저장 위치</p>
                  <p className="text-sm font-mono text-gray-700 break-all">{downloadPath}</p>
                </div>
                <p className="text-xs text-gray-400">파일 탐색기에서 위 경로를 열어 영상을 확인하세요</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

