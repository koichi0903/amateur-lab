import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";

type CandidateQualityBreakdown = ExecutionCandidate["quality"]["breakdown"];

export function formatCandidateQualityBreakdown(breakdown: CandidateQualityBreakdown) {
  return `stop ${breakdown.stopPower ?? breakdown.firstLineStop ?? "-"} / visual ${breakdown.visualLeverage ?? breakdown.visual ?? "-"} / specificity ${breakdown.specificity ?? "-"} / proof ${breakdown.proof ?? "-"} / curiosity ${breakdown.broadCuriosity ?? breakdown.audience ?? "-"} / follow ${breakdown.followReason ?? "-"} / role ${breakdown.roleDifferentiation ?? "-"} / smell ${breakdown.spamSalesSmell ?? "-"}`;
}
