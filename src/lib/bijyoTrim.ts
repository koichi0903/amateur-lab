import type { VideoAnalysisResult } from "@/lib/xVideoAnalysis";

const BIJYO_MINIMUM_TRIM_SECONDS = 2;

function finiteTrimSeconds(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) return 0;
  return Number(value.toFixed(1));
}

function detectedAnalysisTrimSeconds(analysis: VideoAnalysisResult) {
  const evidenceSeconds = analysis.videoEvidence
    .filter((item) => item.kind === "title_card_duration_sec" || item.kind === "first_visual_change_sec")
    .map((item) => typeof item.value === "number" ? item.value : item.timeSec)
    .map((value) => finiteTrimSeconds(value, 15));
  const detectedBlackEnd = finiteTrimSeconds(analysis.rawMetrics.blackIntroEndSec, 10);
  return { existingTrim: Math.max(...evidenceSeconds, 0), detectedBlackEnd };
}

export function calculateBijyoTrimStart(analysis: VideoAnalysisResult, existingTrimStartSeconds = 0) {
  const detected = detectedAnalysisTrimSeconds(analysis);
  const existingTrimStart = finiteTrimSeconds(existingTrimStartSeconds, 15);
  const trimStartSeconds = Number(Math.max(BIJYO_MINIMUM_TRIM_SECONDS, existingTrimStart, detected.existingTrim, detected.detectedBlackEnd).toFixed(1));
  const analysisMaximum = Math.max(detected.existingTrim, detected.detectedBlackEnd);
  const reason = analysisMaximum > Math.max(BIJYO_MINIMUM_TRIM_SECONDS, existingTrimStart)
    ? detected.detectedBlackEnd >= detected.existingTrim ? "black_intro" : "title_card"
    : existingTrimStart > BIJYO_MINIMUM_TRIM_SECONDS ? "existing_analysis" : "minimum_2s";
  return { trimStartSeconds, reason, existingTrimStart, detectedExistingTrim: detected.existingTrim, detectedBlackEnd: detected.detectedBlackEnd } as const;
}
