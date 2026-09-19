import type { VideoAnalysisResult } from "@/lib/xVideoAnalysis";

const BIJYO_INTRO_PADDING_SECONDS = 2;

function finiteTrimSeconds(value: unknown, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) return 0;
  return Number(value.toFixed(1));
}

function detectedAnalysisTrimSeconds(analysis: VideoAnalysisResult) {
  const evidenceSeconds = analysis.videoEvidence
    .filter((item) => item.kind === "title_card_duration_sec")
    .map((item) => typeof item.value === "number" ? item.value : item.timeSec)
    .map((value) => finiteTrimSeconds(value, 15));
  const detectedBlankEnd = finiteTrimSeconds(analysis.rawMetrics.blankIntroEndSec, 10);
  const hasBlankIntroMetric = typeof analysis.rawMetrics.blankIntroEndSec === "number" && Number.isFinite(analysis.rawMetrics.blankIntroEndSec);
  const detectedBlackEnd = finiteTrimSeconds(analysis.rawMetrics.blackIntroEndSec, 10);
  const introEnd = hasBlankIntroMetric ? detectedBlankEnd : detectedBlackEnd;
  const introPlusTwo = introEnd > 0 ? finiteTrimSeconds(introEnd + BIJYO_INTRO_PADDING_SECONDS, 15) : 0;
  return { existingTrim: Math.max(...evidenceSeconds, 0), detectedBlackEnd, detectedBlankEnd, introEnd, introPlusTwo };
}

export function calculateBijyoTrimStart(analysis: VideoAnalysisResult, existingTrimStartSeconds = 0) {
  const detected = detectedAnalysisTrimSeconds(analysis);
  const existingTrimStart = finiteTrimSeconds(existingTrimStartSeconds, 15);
  const trimStartSeconds = Number(Math.max(existingTrimStart, detected.existingTrim, detected.introPlusTwo).toFixed(1));
  const nonIntroMaximum = Math.max(existingTrimStart, detected.existingTrim);
  const reason = detected.introPlusTwo > nonIntroMaximum
    ? "intro_plus_2s"
    : detected.existingTrim > existingTrimStart
      ? "title_card"
      : existingTrimStart > 0
        ? "existing_analysis"
        : "none";
  return { trimStartSeconds, reason, existingTrimStart, detectedExistingTrim: detected.existingTrim, detectedBlackEnd: detected.detectedBlackEnd, detectedBlankEnd: detected.detectedBlankEnd, introEnd: detected.introEnd, introPlusTwo: detected.introPlusTwo } as const;
}
