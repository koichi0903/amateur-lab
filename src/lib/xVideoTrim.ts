import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { validateTrimStartSeconds } from "@/lib/xMediaAssets";

function bundledBinary(kind: "ffmpeg" | "ffprobe") {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("同梱ffmpegはWindows x64環境だけに対応しています。");
  return kind === "ffmpeg"
    ? join(process.cwd(), "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe")
    : join(process.cwd(), "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe");
}

const ffmpegPath = bundledBinary("ffmpeg");
const ffprobePath = bundledBinary("ffprobe");

export type TrimVideoForXResult = {
  file: string;
  dir: string;
  contentType: "video/mp4";
  durationSeconds: number;
  outputDurationSeconds: number;
  codec: string | null;
  audioCodec: string | null;
  trimStartSeconds: number;
};

function runBinary(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${basename(command)} exited with code ${code}`));
    });
  });
}

async function downloadSource(url: string, file: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("動画URLがHTTP/HTTPSではありません。");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) throw new Error(`元動画を取得できませんでした (${response.status})。`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/video|mp4|octet-stream/i.test(contentType)) throw new Error(`動画ではない応答です: ${contentType}`);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(file));
}

export async function probeVideoFile(file: string) {
  const { stdout } = await runBinary(ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; duration?: string }>;
  };
  const durationSeconds = Number(data.format?.duration ?? data.streams?.find((stream) => stream.duration)?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("動画の長さを取得できませんでした。");
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const audio = data.streams?.find((stream) => stream.codec_type === "audio");
  return {
    durationSeconds,
    codec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
  };
}

export async function trimVideoForX(input: { sourceUrl: string; trimStartSeconds: number }) {
  const dir = await mkdtemp(join(tmpdir(), "x-growth-trim-"));
  const sourceFile = join(dir, "source.mp4");
  const outputFile = join(dir, "x-post-trimmed.mp4");
  try {
    await downloadSource(input.sourceUrl, sourceFile);
    const sourceProbe = await probeVideoFile(sourceFile);
    const validation = validateTrimStartSeconds(input.trimStartSeconds, sourceProbe.durationSeconds);
    if (!validation.ok) throw new Error(validation.error);
    await runBinary(ffmpegPath, [
      "-y",
      "-ss", validation.value.toFixed(1),
      "-i", sourceFile,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-avoid_negative_ts", "make_zero",
      outputFile,
    ]);
    const outputProbe = await probeVideoFile(outputFile);
    const outputStat = await stat(outputFile);
    if (outputStat.size <= 0) throw new Error("トリム後動画が空です。");
    await unlink(sourceFile).catch(() => undefined);
    return {
      file: outputFile,
      dir,
      contentType: "video/mp4" as const,
      durationSeconds: sourceProbe.durationSeconds,
      outputDurationSeconds: outputProbe.durationSeconds,
      codec: outputProbe.codec,
      audioCodec: outputProbe.audioCodec,
      trimStartSeconds: validation.value,
    } satisfies TrimVideoForXResult;
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readAndCleanupTrimmedVideo(result: TrimVideoForXResult) {
  try {
    return await readFile(result.file);
  } finally {
    await rm(result.dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
