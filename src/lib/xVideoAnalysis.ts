import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { probeVideoFile } from "@/lib/xVideoTrim";
import type { XVisualFactKind } from "@/lib/xVisualVideoFacts";
import { detectBlankIntroEnd, detectBlackIntroEnd, type OpeningBrightnessSample, type OpeningFrameSample } from "@/lib/xVideoOpening";
import { buildVideoEvidence, summarizeVideoFrames, videoFrameDistance, type PixelStats } from "@/lib/xVideoAnalysisMetrics";
import { parsePpm } from "@/lib/xVideoPpm";

export const VIDEO_ANALYSIS_VERSION = "video-frame-facts-v3";
export type VideoAnalysisResult = {
  version: string;
  sourceFingerprint: string;
  analyzedAt: string;
  durationSec: number;
  frameTimesSec: number[];
  rawMetrics: Record<string, unknown>;
  videoEvidence: Array<{ kind: XVisualFactKind; value: string | number | boolean; confidence: number; timeSec?: number; safePhrase?: string }>;
  jacketEvidence: Array<{ kind: XVisualFactKind; value: string | number | boolean; confidence: number; timeSec?: number; safePhrase?: string }>;
  diagnostics: string[];
};

function binary() { return join(process.cwd(), "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe"); }
function run(command: string, args: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true }); const chunks: Buffer[] = []; const errors: Buffer[] = [];
    child.stdout.on("data", (x) => chunks.push(Buffer.from(x))); child.stderr.on("data", (x) => errors.push(Buffer.from(x)));
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(Buffer.concat(errors).toString().trim() || `ffmpeg exited ${code}`)));
  });
}
async function download(url: string, file: string) {
  const response = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!response.ok || !response.body) throw new Error(`download ${response.status}`);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(file));
}
async function frame(file: string, seconds: number) {
  const bytes = await run(binary(), ["-hide_banner", "-loglevel", "error", "-ss", seconds.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=64:36", "-f", "image2pipe", "-vcodec", "ppm", "pipe:1"]);
  return parsePpm(bytes);
}
export function videoSourceFingerprint(url: string) { return createHash("sha256").update(url.trim().toLowerCase()).digest("hex"); }

function analysisFrameTimes(durationSec: number, trimStartSeconds: number): number[] {
  const raw = [0, 3, 6, 10, durationSec / 2].map((offset) => Math.min(Math.max(0, durationSec - 0.05), trimStartSeconds + offset));
  return [...new Set(raw.map((time) => Number(time.toFixed(3))))];
}

function openingFrameTimes(durationSec: number): number[] {
  return Array.from(
    { length: Math.floor(Math.min(8, durationSec) / 0.25) + 1 },
    (_, index) => Number(Math.min(index * 0.25, Math.max(0, durationSec - 0.05)).toFixed(3)),
  ).filter((time, index, all) => all.indexOf(time) === index);
}

async function captureFrames(file: string, times: number[]) {
  const frames: PixelStats[] = [];
  for (const time of times) frames.push(await frame(file, time));
  return frames;
}

async function captureOpeningSamples(file: string, durationSec: number) {
  const samples: OpeningFrameSample[] = [];
  for (const timeSec of openingFrameTimes(durationSec)) {
    const sample = await frame(file, timeSec);
    samples.push({ timeSec, brightness: sample.brightness, detail: sample.detail, colorVariance: sample.colorVariance });
  }
  return samples;
}

function rawFrameMetrics(frames: PixelStats[]) {
  return frames.map(({ brightness, red, green, blue, histogram, detail, colorVariance }) => ({ brightness, red, green, blue, histogram, detail, colorVariance }));
}

async function compareJacket(
  dir: string,
  jacketUrl: string | null | undefined,
  frames: PixelStats[],
  evidence: VideoAnalysisResult["videoEvidence"],
) {
  const jacketEvidence: VideoAnalysisResult["jacketEvidence"] = [];
  const diagnostics: string[] = [];
  let jacketMetrics: Record<string, unknown> = {};
  if (jacketUrl) {
    const jacket = join(dir, "jacket.jpg");
    try {
      await download(jacketUrl, jacket);
      const jacketFrame = await frame(jacket, 0);
      const colorDistance = videoFrameDistance(jacketFrame, frames[0]);
      const brightnessDistance = Math.abs(jacketFrame.brightness - (frames[0]?.brightness ?? jacketFrame.brightness));
      jacketMetrics = { brightness: jacketFrame.brightness, colorDistance, brightnessDistance };
      if (colorDistance >= 0.16 && brightnessDistance >= 0.06) {
        jacketEvidence.push({ kind: "jacket_sample_mismatch", value: true, confidence: 0.78, safePhrase: "ジャケと動画で明るさと色味が違う。" });
        evidence.push({ kind: "jacket_sample_mismatch", value: true, confidence: 0.78, safePhrase: "ジャケと動画で明るさと色味が違う。" });
      }
    } catch {
      diagnostics.push("jacket comparison failed");
    }
  }
  return { jacketEvidence, diagnostics, jacketMetrics };
}

function analysisFailure(input: { sourceUrl: string }, error: unknown): VideoAnalysisResult {
  return {
    version: VIDEO_ANALYSIS_VERSION,
    sourceFingerprint: videoSourceFingerprint(input.sourceUrl),
    analyzedAt: new Date().toISOString(),
    durationSec: 0,
    frameTimesSec: [],
    rawMetrics: {},
    videoEvidence: [],
    jacketEvidence: [],
    diagnostics: [error instanceof Error ? error.message : "analysis failed"],
  };
}

export async function analyzeSampleMovie(input: { sourceUrl: string; trimStartSeconds?: number; jacketUrl?: string | null }): Promise<VideoAnalysisResult> {
  const dir = await mkdtemp(join(tmpdir(), "x-growth-analysis-"));
  const movie = join(dir, "sample.mp4");
  try {
    await download(input.sourceUrl, movie);
    const probe = await probeVideoFile(movie);
    const trimStartSeconds = Math.max(0, input.trimStartSeconds ?? 0);
    const times = analysisFrameTimes(probe.durationSeconds, trimStartSeconds);
    const frames = await captureFrames(movie, times);
    const openingFrameSamples = await captureOpeningSamples(movie, probe.durationSeconds);
    const openingSamples: OpeningBrightnessSample[] = openingFrameSamples.map(({ timeSec, brightness }) => ({ timeSec, brightness }));
    const blackIntroEndSec = detectBlackIntroEnd(openingSamples, probe.durationSeconds);
    const blankIntro = detectBlankIntroEnd(openingFrameSamples, probe.durationSeconds);
    const summary = summarizeVideoFrames(frames, times);
    const evidence = buildVideoEvidence(frames, times, summary, blankIntro);
    const jacket = await compareJacket(dir, input.jacketUrl, frames, evidence);
    return {
      version: VIDEO_ANALYSIS_VERSION,
      sourceFingerprint: videoSourceFingerprint(input.sourceUrl),
      analyzedAt: new Date().toISOString(),
      durationSec: probe.durationSeconds,
      frameTimesSec: times,
      rawMetrics: {
        brightnessMean: summary.brightnessMean,
        openingMotionDelta: summary.openingMotionDelta,
        midMotionDelta: summary.midMotionDelta,
        frameChanges: summary.changes,
        frames: rawFrameMetrics(frames),
        openingBrightnessSamples: openingSamples,
        openingFrameSamples,
        blackIntroEndSec,
        blankIntroEndSec: blankIntro.endSec,
        blankIntroKind: blankIntro.kind,
        jacket: jacket.jacketMetrics,
      },
      videoEvidence: evidence,
      jacketEvidence: jacket.jacketEvidence,
      diagnostics: jacket.diagnostics,
    };
  } catch (error) {
    return analysisFailure(input, error);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
