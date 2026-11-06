import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import ffprobe from "@ffprobe-installer/ffprobe";
import { isOfficialFanzaDmmSampleUrl, validateTrimStartSeconds } from "@/lib/xMediaAssets";

function bundledBinary(kind: "ffmpeg" | "ffprobe") {
  return kind === "ffmpeg" ? ffmpeg.path : ffprobe.path;
}

export type TrimVideoForXResult = {
  file: string;
  dir: string;
  contentType: "video/mp4";
  durationSeconds: number;
  outputDurationSeconds: number;
  width: number | null;
  height: number | null;
  codec: string | null;
  audioCodec: string | null;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
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

async function downloadSource(url: string, file: string, options?: { maxBytes?: number; timeoutMs?: number; rejectRedirects?: boolean; followOfficialRedirects?: boolean }) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("動画URLがHTTP/HTTPSではありません。");
  const signal = options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined;
  let response: Response;
  if (options?.followOfficialRedirects) {
    let currentUrl = url;
    for (let redirectCount = 0; ; redirectCount += 1) {
      if (!isOfficialFanzaDmmSampleUrl(currentUrl)) throw new Error("公式FANZA/DMM以外へ転送されたため取得を停止しました。");
      response = await fetch(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        ...(signal ? { signal } : {}),
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) break;
      if (redirectCount >= 3) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("公式サンプル動画のリダイレクト回数が上限を超えました。");
      }
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isOfficialFanzaDmmSampleUrl(nextUrl)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("公式FANZA/DMM以外へ転送されたため取得を停止しました。");
      }
      await response.body?.cancel().catch(() => undefined);
      currentUrl = nextUrl;
    }
  } else {
    response = await fetch(url, {
      cache: "no-store",
      ...(signal ? { signal } : {}),
      ...(options?.rejectRedirects ? { redirect: "error" as const } : {}),
    });
  }
  if (!response.ok || !response.body) throw new Error(`元動画を取得できませんでした (${response.status})。`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/video|mp4|octet-stream/i.test(contentType)) throw new Error(`動画ではない応答です: ${contentType}`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (options?.maxBytes && Number.isFinite(declaredSize) && declaredSize > options.maxBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("元動画が設定した容量上限を超えています。");
  }
  let received = 0;
  const limited = async function* () {
    const reader = response.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (options?.maxBytes && received > options.maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error("元動画が設定した容量上限を超えています。");
        }
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  };
  await pipeline(Readable.from(limited()), createWriteStream(file));
}

export async function probeVideoFile(file: string) {
  const { stdout } = await runBinary(bundledBinary("ffprobe"), [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; duration?: string; width?: number; height?: number }>;
  };
  const durationSeconds = Number(data.format?.duration ?? data.streams?.find((stream) => stream.duration)?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("動画の長さを取得できませんでした。");
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const audio = data.streams?.find((stream) => stream.codec_type === "audio");
  return {
    durationSeconds,
    codec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    width: Number.isSafeInteger(video?.width) ? video!.width! : null,
    height: Number.isSafeInteger(video?.height) ? video!.height! : null,
  };
}

export async function trimVideoForX(
  input: { sourceUrl: string; trimStartSeconds: number; trimEndSeconds?: number | null },
  downloadOptions?: { maxBytes?: number; timeoutMs?: number; rejectRedirects?: boolean },
) {
  const dir = await mkdtemp(join(tmpdir(), "x-growth-trim-"));
  const sourceFile = join(dir, "source.mp4");
  const outputFile = join(dir, "x-post-trimmed.mp4");
  try {
    await downloadSource(input.sourceUrl, sourceFile, downloadOptions);
    const sourceProbe = await probeVideoFile(sourceFile);
    const validation = validateTrimStartSeconds(input.trimStartSeconds, sourceProbe.durationSeconds);
    if (!validation.ok) throw new Error(validation.error);
    const requestedEnd = input.trimEndSeconds == null ? null : Number(input.trimEndSeconds);
    if (requestedEnd != null && (!Number.isFinite(requestedEnd) || requestedEnd <= validation.value || requestedEnd > sourceProbe.durationSeconds)) {
      throw new Error("切り抜き終了秒は開始秒より後、動画の長さ以内にしてください。");
    }
    const trimEndSeconds = requestedEnd == null ? null : Math.round(requestedEnd * 10) / 10;
    if (trimEndSeconds != null && (trimEndSeconds <= validation.value || trimEndSeconds > sourceProbe.durationSeconds)) {
      throw new Error("切り抜き終了秒は開始秒より後、動画の長さ以内にしてください。");
    }
    const trimArgs = [
      "-y",
      "-ss", validation.value.toFixed(1),
      "-i", sourceFile,
    ];
    if (trimEndSeconds != null) trimArgs.push("-t", (trimEndSeconds - validation.value).toFixed(1));
    trimArgs.push(
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
    );
    await runBinary(bundledBinary("ffmpeg"), trimArgs);
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
      width: outputProbe.width,
      height: outputProbe.height,
      codec: outputProbe.codec,
      audioCodec: outputProbe.audioCodec,
      trimStartSeconds: validation.value,
      trimEndSeconds,
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

