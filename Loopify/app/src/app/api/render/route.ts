import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import os from "os";

export const maxDuration = 60;

function getFFmpegPath(): string {
  try {
    // eval로 감싸서 Turbopack 정적 분석 우회
    const mod = eval('require("@ffmpeg-installer/ffmpeg")');
    return mod.path;
  } catch {
    return "ffmpeg";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, imageBase64, slotIndex, subtitle } = await req.json();

    if (!audioBase64 || !imageBase64) {
      return NextResponse.json({ error: "audioBase64 and imageBase64 required" }, { status: 400 });
    }

    const ffmpegPath = getFFmpegPath();

    // ffmpeg 존재 확인
    try {
      execSync(`"${ffmpegPath}" -version`, { stdio: "pipe", timeout: 5000 });
    } catch (e: any) {
      return NextResponse.json({
        error: "ffmpeg not found",
        path: ffmpegPath,
        detail: e.message,
      }, { status: 500 });
    }

    const tmpDir = join(os.tmpdir(), `loopify_render_${Date.now()}`);
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    const audioPath = join(tmpDir, "audio.wav");
    const imagePath = join(tmpDir, "image.jpg");
    const outputPath = join(tmpDir, "output.mp4");

    // base64 → 파일
    const audioData = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    writeFileSync(audioPath, Buffer.from(audioData, "base64"));

    const imageData = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    writeFileSync(imagePath, Buffer.from(imageData, "base64"));

    // ffmpeg 렌더링
    const filterComplex = [
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[bg]",
      "[1:a]showwaves=s=1080x180:mode=cline:colors=0x8B5CF6@0.7|0x6366F1@0.5|0xD946EF@0.6:rate=30[waves]",
      "[bg][waves]overlay=0:1740:shortest=1[vout]",
    ].join(";");

    const cmd = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -filter_complex "${filterComplex}" -map "[vout]" -map "1:a" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 96k -t 20 -pix_fmt yuv420p -movflags +faststart "${outputPath}"`;

    execSync(cmd, { timeout: 50000, maxBuffer: 100 * 1024 * 1024 });

    const mp4Buffer = readFileSync(outputPath);
    const mp4Base64 = `data:video/mp4;base64,${mp4Buffer.toString("base64")}`;

    // cleanup
    try { unlinkSync(audioPath); unlinkSync(imagePath); unlinkSync(outputPath); } catch {}

    return NextResponse.json({
      success: true,
      videoBase64: mp4Base64,
      sizeKB: Math.round(mp4Buffer.length / 1024),
    });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      stderr: e.stderr?.toString()?.slice(0, 500),
    }, { status: 500 });
  }
}
