import { buildMyfansSupplyAudit, type MyfansSupplyAuditCandidate, type MyfansSupplyAuditRecoveryRow, type MyfansSupplyAuditTopicRow } from "@/lib/myfansSupplyAudit";
import {
  MYFANS_DAILY_FRESH_DAYS,
  POSTED_SOURCE_COOLDOWN_DAYS,
  QUOTE_MIN_SCORE,
  daysSinceIsoAtPlanDate,
  quoteUrlFromCandidate,
  sourceValueForQuote,
  visualPriority,
} from "@/lib/myfansQuotePool";
import { MYFANS_QUALITY_GATE_MINIMUM } from "@/lib/myfansPublicCopyQuality";
import { topicThresholdFor } from "@/lib/myfansTopicValue";
import type { MyfansAnalytics } from "@/lib/myfansAnalytics";
import type { MyfansLinkedCandidateFunnelCandidate } from "@/lib/myfansLinkedCandidateFunnel";
import type { MyfansDailyOptionCandidate, MyfansExecutionDiagnostics } from "./myfansXExecution";
import type { buildMyfansQuotePool } from "@/lib/myfansQuotePool";

export function buildMyfansExecutionAudit<
  TCandidate extends MyfansDailyOptionCandidate & MyfansLinkedCandidateFunnelCandidate & MyfansSupplyAuditCandidate,
  TRecovery extends MyfansSupplyAuditRecoveryRow,
  TLinkedCandidateFunnel,
>(input: {
  allDailyOptions: MyfansDailyOptionCandidate[];
  analytics: MyfansAnalytics;
  buildLinkedCandidateFunnel: () => TLinkedCandidateFunnel;
  finalPublishableCandidates: TCandidate[];
  growthQuotePoolCount: number;
  pastUsage: {
    latestSource: (sourceUrl: string) => { date: string; actualPosted: boolean } | null | undefined;
  };
  planDate: string;
  quotePool: ReturnType<typeof buildMyfansQuotePool>;
  recoveryHistory: TRecovery[];
  rotation: Array<{ slot: string }>;
  topicRows: MyfansSupplyAuditTopicRow[];
}) {
  const {
    allDailyOptions,
    analytics,
    buildLinkedCandidateFunnel,
    finalPublishableCandidates,
    growthQuotePoolCount,
    pastUsage,
    planDate,
    quotePool,
    recoveryHistory,
    rotation,
    topicRows,
  } = input;
  const qualityGateHoldReasons = [...recoveryHistory
    .filter((attempt) => attempt.verdict !== "PASS")
    .reduce((counts, attempt) => counts.set(attempt.holdReason || "QUALITY_GATE_HOLD", (counts.get(attempt.holdReason || "QUALITY_GATE_HOLD") ?? 0) + 1), new Map<string, number>())]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const diagnostics: MyfansExecutionDiagnostics = {
    planDateJst: planDate,
    rawQuoteCount: analytics.quoteCandidateSource.dbCount,
    rawFresh14dCount: quotePool.funnel.rawFresh14d,
    hardEligibleCount: quotePool.funnel.hardEligible,
    ranked12Count: quotePool.funnel.ranked12,
    mediaScopeCount: quotePool.funnel.mediaScoped,
    freshnessCooldownCount: quotePool.funnel.freshnessCooldownCount,
    sourceValuePassCount: quotePool.funnel.sourceValuePass,
    sourceValueLowCount: quotePool.funnel.sourceValueLow,
    qualifiedDiscoveryCount: quotePool.funnel.qualified,
    qualifiedDiscoveryIds: quotePool.funnel.qualifiedDiscoveryIds,
    productLinkedCount: quotePool.funnel.productLinkedCount,
    creatorMapHitCount: quotePool.funnel.creatorMapHitCount,
    growthQuotePoolCount,
    postDedupeCount: quotePool.global.length,
    qualityGatePassCount: recoveryHistory.filter((attempt) => attempt.verdict === "PASS").length,
    qualityGateHoldCount: recoveryHistory.filter((attempt) => attempt.verdict !== "PASS").length,
    qualityGateHoldReasons,
    finalCandidateCount: finalPublishableCandidates.length,
    finalOptionCount: allDailyOptions.length,
    selectedCount: finalPublishableCandidates.length,
  };
  const linkedCandidateFunnel = buildLinkedCandidateFunnel();
  const supplyAudit = buildMyfansSupplyAudit({
    sourceRows: analytics.quoteCandidates,
    topicRows,
    recoveryHistory,
    finalPublishableCandidates,
    rotation,
    planDate,
    pastUsage,
    helpers: {
      sourceValueForQuote,
      daysSinceIsoAtPlanDate,
      quoteUrlFromCandidate,
      visualPriority,
      topicThresholdFor,
      dailyFreshDays: MYFANS_DAILY_FRESH_DAYS,
      postedSourceCooldownDays: POSTED_SOURCE_COOLDOWN_DAYS,
      quoteMinScore: QUOTE_MIN_SCORE,
      qualityGateMinimum: MYFANS_QUALITY_GATE_MINIMUM,
    },
  });
  return { diagnostics, linkedCandidateFunnel, supplyAudit };
}
