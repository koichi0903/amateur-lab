import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";

type CandidateQualityBreakdown = ExecutionCandidate["quality"]["breakdown"];

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) ?? "-";
}

function withFallback<T>(value: T | null | undefined) {
  return value ?? "-";
}

export function formatCandidateQualityBreakdown(breakdown: CandidateQualityBreakdown) {
  return `stop ${breakdown.stopPower ?? breakdown.firstLineStop ?? "-"} / visual ${breakdown.visualLeverage ?? breakdown.visual ?? "-"} / specificity ${breakdown.specificity ?? "-"} / proof ${breakdown.proof ?? "-"} / curiosity ${breakdown.broadCuriosity ?? breakdown.audience ?? "-"} / follow ${breakdown.followReason ?? "-"} / role ${breakdown.roleDifferentiation ?? "-"} / smell ${breakdown.spamSalesSmell ?? "-"}`;
}

export function buildCandidateVisualReviewValues(input: Pick<ExecutionCandidate, "visualUnderstanding" | "quality" | "reactionType" | "whyThisAngle">) {
  const visual = input.visualUnderstanding;
  if (!visual) return null;

  return {
    visualAnalysisStatus: visual.visualAnalysisStatus,
    analyzerVersion: visual.analyzerVersion,
    rawVisualEvidence: firstText(visual.rawVisualEvidence, visual.concreteVisualCue),
    cueConfidence: withFallback(visual.cueConfidence),
    humanObservation: firstText(visual.humanObservation),
    evidenceSource: firstText(visual.evidenceSource, visual.sourceEvidence),
    visualMoment: visual.visualMoment,
    compositionOrStyle: firstText(visual.compositionOrStyle),
    cameraDistanceOrFraming: firstText(visual.cameraDistanceOrFraming),
    naturalness: withFallback(input.quality.breakdown.followReason),
    specificity: withFallback(input.quality.breakdown.specificity),
    qualityReasons: input.quality.reasons.join(" / "),
    reactionType: withFallback(input.reactionType),
    whyThisAngle: input.whyThisAngle,
  };
}
