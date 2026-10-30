import type { VideoAnalysisResult } from "./xVideoAnalysis";

export type PixelStats = {
  brightness: number;
  red: number;
  green: number;
  blue: number;
  histogram: number[];
  detail: number;
  colorVariance: number;
};

export type FrameSummary = {
  changes: number[];
  openingMotionDelta: number;
  midMotionDelta: number;
  brightnessMean: number;
  motion: "high" | "medium" | "low";
  pacing: "fast" | "medium" | "slow";
  firstChangeSec: number | null;
};

export function videoFrameDistance(a: PixelStats, b: PixelStats) {
  return Math.min(1, Math.abs(a.brightness - b.brightness) * 1.6 + (Math.abs(a.red - b.red) + Math.abs(a.green - b.green) + Math.abs(a.blue - b.blue)) / 3);
}

function classifyMotion(opening: number, mid: number): FrameSummary["motion"] {
  if (mid >= 0.18 || opening >= 0.22) return "high";
  if (mid >= 0.08 || opening >= 0.1) return "medium";
  return "low";
}

function classifyPacing(changes: number[]): FrameSummary["pacing"] {
  const notableChanges = changes.filter((change) => change >= 0.1).length;
  if (notableChanges >= 3) return "fast";
  if (notableChanges >= 1) return "medium";
  return "slow";
}

export function summarizeVideoFrames(frames: PixelStats[], times: number[]): FrameSummary {
  const changes = frames.slice(1).map((item, index) => videoFrameDistance(frames[index], item));
  const openingMotionDelta = changes.slice(0, 2).reduce((total, change) => total + change, 0) / Math.max(1, Math.min(2, changes.length));
  const midMotionDelta = changes.length ? changes[changes.length - 1] : 0;
  const brightnessMean = frames.reduce((total, frame) => total + frame.brightness, 0) / Math.max(1, frames.length);
  const firstChangeIndex = changes.findIndex((change) => change >= 0.1);
  return {
    changes,
    openingMotionDelta,
    midMotionDelta,
    brightnessMean,
    motion: classifyMotion(openingMotionDelta, midMotionDelta),
    pacing: classifyPacing(changes),
    firstChangeSec: firstChangeIndex >= 0 ? times[firstChangeIndex + 1] : null,
  };
}

function motionAndPacingEvidence(summary: FrameSummary): VideoAnalysisResult["videoEvidence"] {
  return [
    { kind: "motion_level", value: summary.motion, confidence: 0.8, safePhrase: summary.motion === "high" ? "画面の変化が大きい。" : summary.motion === "medium" ? "画面はゆっくり変わる。" : "画面の変化は控えめ。" },
    { kind: "pacing", value: summary.pacing, confidence: 0.8, safePhrase: summary.pacing === "fast" ? "切り替わりが早め。" : summary.pacing === "slow" ? "入り方はゆっくり。" : "切り替わりは中くらい。" },
  ];
}

function appendBrightnessEvidence(evidence: VideoAnalysisResult["videoEvidence"], frames: PixelStats[]) {
  const openingBrightness = frames[0]?.brightness ?? 0;
  const closingBrightness = frames.at(-1)?.brightness ?? openingBrightness;
  const brightnessDelta = closingBrightness - openingBrightness;
  if (Math.abs(brightnessDelta) < 0.08) return brightnessDelta;
  evidence.push({
    kind: "brightness",
    value: brightnessDelta > 0 ? "brighter" : "darker",
    confidence: 0.8,
    safePhrase: brightnessDelta > 0 ? "最初より途中の方が明るく見える。" : "最初より途中の方が暗く見える。",
  });
  return brightnessDelta;
}

function colorDeltaBetweenFirstAndLast(frames: PixelStats[]) {
  if (frames.length <= 1) return 0;
  const first = frames[0];
  const last = frames.at(-1)!;
  return (Math.abs(last.red - first.red) + Math.abs(last.green - first.green) + Math.abs(last.blue - first.blue)) / 3;
}

function appendColorEvidence(evidence: VideoAnalysisResult["videoEvidence"], frames: PixelStats[], brightnessDelta: number) {
  const colorDelta = colorDeltaBetweenFirstAndLast(frames);
  if (colorDelta >= 0.12 && Math.abs(brightnessDelta) < 0.08) {
    evidence.push({ kind: "visual_style", value: "color_contrast", confidence: 0.78, safePhrase: "前半と途中で色味の見え方が変わる。" });
  }
}

function appendOpeningEvidence(evidence: VideoAnalysisResult["videoEvidence"], summary: FrameSummary, times: number[]) {
  const { firstChangeSec, openingMotionDelta } = summary;
  if (firstChangeSec !== null && openingMotionDelta >= 0.1) {
    evidence.push({ kind: "first_visual_change_sec", value: firstChangeSec, confidence: openingMotionDelta >= 0.18 ? 0.82 : 0.7, timeSec: firstChangeSec, safePhrase: `冒頭${firstChangeSec.toFixed(1)}秒付近で画面が変わる。` });
  }
  if (openingMotionDelta >= 0.18) {
    evidence.push({ kind: "opening_strength", value: "strong", confidence: 0.78, timeSec: times[1], safePhrase: "冒頭から画面の変化がある。" }, { kind: "notable_video_hook", value: "opening_change", confidence: 0.78, timeSec: times[1], safePhrase: "入り方が少し予想と違う。" });
  } else if (openingMotionDelta < 0.07) {
    evidence.push({ kind: "opening_strength", value: "weak", confidence: 0.78, timeSec: times[1], safePhrase: "冒頭は静かに始まる。" }, { kind: "notable_video_hook", value: "calm_opening", confidence: 0.78, timeSec: times[0], safePhrase: "最初は静かに始まる。" });
  }
}

function appendBlankIntroEvidence(evidence: VideoAnalysisResult["videoEvidence"], blankIntro: { endSec: number; kind: "black" | "white" | null }) {
  if (blankIntro.endSec <= 0) return;
  evidence.push({
    kind: "title_card_duration_sec",
    value: blankIntro.endSec,
    confidence: 0.82,
    timeSec: blankIntro.endSec,
    safePhrase: `${blankIntro.kind === "white" ? "明るい" : "暗い"}無内容イントロが終わるのは冒頭${blankIntro.endSec.toFixed(1)}秒付近。`,
  });
}

export function buildVideoEvidence(
  frames: PixelStats[],
  times: number[],
  summary: FrameSummary,
  blankIntro: { endSec: number; kind: "black" | "white" | null },
) {
  const evidence = motionAndPacingEvidence(summary);
  const brightnessDelta = appendBrightnessEvidence(evidence, frames);
  appendColorEvidence(evidence, frames, brightnessDelta);
  appendOpeningEvidence(evidence, summary, times);
  appendBlankIntroEvidence(evidence, blankIntro);
  return evidence;
}
