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

export const VIDEO_ANALYSIS_VERSION = "video-frame-facts-v2";
type PixelStats = { brightness: number; red: number; green: number; blue: number; histogram: number[]; detail: number; colorVariance: number };
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
function parsePpm(buffer: Buffer): PixelStats {
  if (buffer.subarray(0, 2).toString() !== "P6") throw new Error("ffmpeg did not return PPM");
  let index = 2; const tokens: string[] = [];
  while (tokens.length < 3) { while (buffer[index] === 10 || buffer[index] === 13 || buffer[index] === 32 || buffer[index] === 9) index++; if (buffer[index] === 35) { while (buffer[index] !== 10) index++; continue; } const start = index; while (buffer[index] > 32) index++; tokens.push(buffer.subarray(start, index).toString()); }
  const [width, height, max] = tokens.map(Number); const values = buffer.subarray(index); const pixels = Math.min(width * height, Math.floor(values.length / 3));
  let r = 0, g = 0, b = 0; const histogram = Array.from({ length: 8 }, () => 0); let brightness = 0; let brightnessSquared = 0; let detail = 0;
  for (let i = 0; i < pixels; i++) { const rr = values[i * 3] / max, gg = values[i * 3 + 1] / max, bb = values[i * 3 + 2] / max; r += rr; g += gg; b += bb; const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb; brightness += y; histogram[Math.min(7, Math.floor(y * 8))]++; }
  for (let i = 0; i < pixels; i++) {
    const rr = values[i * 3] / max, gg = values[i * 3 + 1] / max, bb = values[i * 3 + 2] / max;
    const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    brightnessSquared += y * y;
    if (i % width !== 0) {
      const previous = (0.2126 * values[(i - 1) * 3] + 0.7152 * values[(i - 1) * 3 + 1] + 0.0722 * values[(i - 1) * 3 + 2]) / max;
      detail += Math.abs(y - previous);
    }
  }
  const meanBrightness = brightness / pixels;
  return { brightness: meanBrightness, red: r / pixels, green: g / pixels, blue: b / pixels, histogram: histogram.map((x) => x / pixels), detail: detail / Math.max(1, pixels - height), colorVariance: Math.max(0, brightnessSquared / pixels - meanBrightness * meanBrightness) };
}
async function frame(file: string, seconds: number) {
  const bytes = await run(binary(), ["-hide_banner", "-loglevel", "error", "-ss", seconds.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=64:36", "-f", "image2pipe", "-vcodec", "ppm", "pipe:1"]);
  return parsePpm(bytes);
}
function distance(a: PixelStats, b: PixelStats) { return Math.min(1, Math.abs(a.brightness - b.brightness) * 1.6 + (Math.abs(a.red - b.red) + Math.abs(a.green - b.green) + Math.abs(a.blue - b.blue)) / 3); }
export function videoSourceFingerprint(url: string) { return createHash("sha256").update(url.trim().toLowerCase()).digest("hex"); }

export async function analyzeSampleMovie(input: { sourceUrl: string; trimStartSeconds?: number; jacketUrl?: string | null }): Promise<VideoAnalysisResult> {
  const dir = await mkdtemp(join(tmpdir(), "x-growth-analysis-")); const movie = join(dir, "sample.mp4"); const diagnostics: string[] = [];
  try {
    await download(input.sourceUrl, movie); const probe = await probeVideoFile(movie); const trim = Math.max(0, input.trimStartSeconds ?? 0); const raw = [0, 3, 6, 10, probe.durationSeconds / 2].map((n) => Math.min(Math.max(0, probe.durationSeconds - 0.05), trim + n));
    const times = [...new Set(raw.map((n) => Number(n.toFixed(3))))]; const frames: PixelStats[] = []; for (const time of times) frames.push(await frame(movie, time));
    const openingTimes = Array.from({ length: Math.floor(Math.min(8, probe.durationSeconds) / 0.25) + 1 }, (_, index) => Number(Math.min(index * 0.25, Math.max(0, probe.durationSeconds - 0.05)).toFixed(3))).filter((time, index, all) => all.indexOf(time) === index);
    const openingFrameSamples: OpeningFrameSample[] = []; for (const time of openingTimes) { const sample = await frame(movie, time); openingFrameSamples.push({ timeSec: time, brightness: sample.brightness, detail: sample.detail, colorVariance: sample.colorVariance }); }
    const openingSamples: OpeningBrightnessSample[] = openingFrameSamples.map(({ timeSec, brightness }) => ({ timeSec, brightness }));
    const blackIntroEndSec = detectBlackIntroEnd(openingSamples, probe.durationSeconds);
    const blankIntro = detectBlankIntroEnd(openingFrameSamples, probe.durationSeconds);
    const changes = frames.slice(1).map((item, i) => distance(frames[i], item)); const opening = changes.slice(0, 2).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(2, changes.length)); const mid = changes.length ? changes[changes.length - 1] : 0;
    const mean = frames.reduce((a, b) => a + b.brightness, 0) / Math.max(1, frames.length); const motion = mid >= 0.18 || opening >= 0.22 ? "high" : mid >= 0.08 || opening >= 0.1 ? "medium" : "low"; const pacing = changes.filter((x) => x >= 0.1).length >= 3 ? "fast" : changes.filter((x) => x >= 0.1).length >= 1 ? "medium" : "slow";
    const firstChangeIndex = changes.findIndex((x) => x >= 0.1); const firstChange = firstChangeIndex >= 0 ? times[firstChangeIndex + 1] : null;
    const evidence: VideoAnalysisResult["videoEvidence"] = [
      { kind: "motion_level", value: motion, confidence: 0.8, safePhrase: motion === "high" ? "画面の変化が大きい。" : motion === "medium" ? "画面はゆっくり変わる。" : "画面の変化は控えめ。" },
      { kind: "pacing", value: pacing, confidence: 0.8, safePhrase: pacing === "fast" ? "切り替わりが早め。" : pacing === "slow" ? "入り方はゆっくり。" : "切り替わりは中くらい。" },
    ];
    const openingBrightness = frames[0]?.brightness ?? 0;
    const closingBrightness = frames.at(-1)?.brightness ?? openingBrightness;
    const brightnessDelta = closingBrightness - openingBrightness;
    if (Math.abs(brightnessDelta) >= 0.08) evidence.push({
      kind: "brightness",
      value: brightnessDelta > 0 ? "brighter" : "darker",
      confidence: 0.8,
      safePhrase: brightnessDelta > 0 ? "最初より途中の方が明るく見える。" : "最初より途中の方が暗く見える。",
    });
    const colorDelta = frames.length > 1
      ? (Math.abs((frames.at(-1)?.red ?? 0) - (frames[0]?.red ?? 0)) + Math.abs((frames.at(-1)?.green ?? 0) - (frames[0]?.green ?? 0)) + Math.abs((frames.at(-1)?.blue ?? 0) - (frames[0]?.blue ?? 0))) / 3
      : 0;
    if (colorDelta >= 0.12 && Math.abs(brightnessDelta) < 0.08) evidence.push({ kind: "visual_style", value: "color_contrast", confidence: 0.78, safePhrase: "前半と途中で色味の見え方が変わる。" });
    if (firstChange !== null && opening >= 0.1) evidence.push({ kind: "first_visual_change_sec", value: firstChange, confidence: opening >= 0.18 ? 0.82 : 0.7, timeSec: firstChange, safePhrase: `冒頭${firstChange.toFixed(1)}秒付近で画面が変わる。` });
    if (opening >= 0.18) evidence.push({ kind: "opening_strength", value: "strong", confidence: 0.78, timeSec: times[1], safePhrase: "冒頭から画面の変化がある。" }, { kind: "notable_video_hook", value: "opening_change", confidence: 0.78, timeSec: times[1], safePhrase: "入り方が少し予想と違う。" });
    else if (opening < 0.07) evidence.push({ kind: "opening_strength", value: "weak", confidence: 0.78, timeSec: times[1], safePhrase: "冒頭は静かに始まる。" }, { kind: "notable_video_hook", value: "calm_opening", confidence: 0.78, timeSec: times[0], safePhrase: "最初は静かに始まる。" });
    if (blankIntro.endSec > 0) evidence.push({ kind: "title_card_duration_sec", value: blankIntro.endSec, confidence: 0.82, timeSec: blankIntro.endSec, safePhrase: `${blankIntro.kind === "white" ? "明るい" : "暗い"}無内容イントロが終わるのは冒頭${blankIntro.endSec.toFixed(1)}秒付近。` });
    const jacketEvidence: VideoAnalysisResult["jacketEvidence"] = [];
    let jacketMetrics: Record<string, unknown> = {};
    if (input.jacketUrl) {
      const jacket = join(dir, "jacket.jpg");
      try { await download(input.jacketUrl, jacket); const jacketFrame = await frame(jacket, 0); const colorDistance = distance(jacketFrame, frames[0]); const brightnessDistance = Math.abs(jacketFrame.brightness - (frames[0]?.brightness ?? jacketFrame.brightness)); jacketMetrics = { brightness: jacketFrame.brightness, colorDistance, brightnessDistance }; if (colorDistance >= 0.16 && brightnessDistance >= 0.06) { jacketEvidence.push({ kind: "jacket_sample_mismatch", value: true, confidence: 0.78, safePhrase: "ジャケと動画で明るさと色味が違う。" }); evidence.push({ kind: "jacket_sample_mismatch", value: true, confidence: 0.78, safePhrase: "ジャケと動画で明るさと色味が違う。" }); } }
      catch { diagnostics.push("jacket comparison failed"); }
    }
    return { version: VIDEO_ANALYSIS_VERSION, sourceFingerprint: videoSourceFingerprint(input.sourceUrl), analyzedAt: new Date().toISOString(), durationSec: probe.durationSeconds, frameTimesSec: times, rawMetrics: { brightnessMean: mean, openingMotionDelta: opening, midMotionDelta: mid, frameChanges: changes, frames: frames.map((x) => ({ brightness: x.brightness, red: x.red, green: x.green, blue: x.blue, histogram: x.histogram, detail: x.detail, colorVariance: x.colorVariance })), openingBrightnessSamples: openingSamples, openingFrameSamples, blackIntroEndSec, blankIntroEndSec: blankIntro.endSec, blankIntroKind: blankIntro.kind, jacket: jacketMetrics }, videoEvidence: evidence, jacketEvidence, diagnostics };
  } catch (error) { return { version: VIDEO_ANALYSIS_VERSION, sourceFingerprint: videoSourceFingerprint(input.sourceUrl), analyzedAt: new Date().toISOString(), durationSec: 0, frameTimesSec: [], rawMetrics: {}, videoEvidence: [], jacketEvidence: [], diagnostics: [error instanceof Error ? error.message : "analysis failed"] }; }
  finally { await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}
