import type { XGrowthSalesEvaluation } from "./xGrowthSalesSignal";
import type { DecisionType } from "./domain/decisionFacts";
import type { XDailyTopPick, XGrowthIntent, XGrowthOpportunity, XMoneyGateReason } from "./xGrowthOS";
import { auditCandidateUniqueness, candidateMediaDedupeKey } from "./xGrowthCandidateIdentity";
import { isAllowedXGrowthMediaType } from "./xGrowthEligibility";
import { buildXGrowthVariantDiagnostic, summarizeXGrowthVariantDiagnostics } from "./xGrowthDiagnostics";
import { DECISION_TYPES, decisionTypeForCandidate, hasRealConversationSource, isEligibleForDecisionType, passesLinklessQualityGate, type RankedSelectionDiagnostics } from "./xGrowthDailySelection";
import { buildMediaSupplyStageDiagnostics, semanticSupplyDiagnostics, type MediaSupplyStageDiagnostics } from "./xGrowthSupplyDiagnostics";
import { SEMANTIC_CATEGORY_QUOTA } from "./xGrowthSemantic";

export function buildSupplyDiagnostics(
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  candidateDiagnostics: {
    sourcePoolTotal?: number;
    sourcePoolAfterPosted?: number;
    postedExcluded?: number;
    saleVideoSupply?: { fetched: number; activeOfficial: number; afterPosted: number; selected: number };
    prefilterCount?: number;
    humanVoiceTargetCount?: number;
    diversityTargetCount?: number;
    pipeline?: Record<string, number>;
    salesEvaluation?: XGrowthSalesEvaluation & { candidateWorksWithSalesBonus: number };
    videoQualityFailureCounts?: Record<string, number>;
    videoWorkStages?: Array<{
      workId: number;
      title: string;
      sampleUrlOfficial: boolean;
      candidate: boolean;
      expanded: boolean;
      scoreWindow: boolean;
      afterMedia: boolean;
      prefilter: boolean;
      qualityEvaluated: boolean;
      hardGatePassed: boolean;
      finalSelected: boolean;
      rankingScore: number;
      freshnessScore: number;
      discountRate: number;
      saleEndAt: string | null;
      creativeQualityScore: number;
      firstDropReason: string | null;
    }>;
    decisionSupply?: Record<string, {
      dbFetchedWorks?: number;
      dbRawWorks?: number;
      afterPostedCooldown?: number;
      chartEligible?: number;
      uniqueWorks?: number;
      firstDropReasonCounts?: Record<string, number>;
      firstDropByWorkId?: Record<string, string>;
    }>;
    rankingDiagnostics?: RankedSelectionDiagnostics;
  } | undefined,
  decisionSelection: {
    eligibleSupply: Record<DecisionType, number>;
    dedupedEligibleSupply: number;
    selectedBeforeReplenishment: number;
    replenished: number;
    selected: number;
    selectedByType: Record<DecisionType, number>;
  } | undefined,
  postedWorkIds: ReadonlySet<number>,
  mediaMix?: {
    totalVideoCandidates: number;
    videoRaw: number;
    videoEligible: number;
    videoAfterDedupe: number;
    slotEligibleVideo: number;
    eligibleStrongVideos: number;
    eligibleOfficialVideos: number;
    officialCandidateCount: number;
    officialVariantEligibleCount: number;
    selectedVideos: number;
    fallbackOfficialSelected: number;
    selectedVideosBySlot: Record<string, number>;
    rejectionReasons: Record<string, number>;
    uniqueAudit: ReturnType<typeof auditCandidateUniqueness>;
    targetVideos: number;
    unmetReason: string | null;
    generatedVideoVariants: number;
    hardQualityVideoVariants: number;
    semanticSafeVideoUniqueWorks: number;
    availableToFinalVideoUniqueWorks: number;
    selectedVideosBeforeReplenishment: number;
    selectedVideosAfterReplenishment: number;
    videoFirstDropReasonCounts: Record<string, number>;
    videoSupplyStages: MediaSupplyStageDiagnostics;
    imageSupplyStages: MediaSupplyStageDiagnostics;
  },
) {
  const sourceMetrics = sourceMetricsFor(opportunities);
  const roleMetrics = roleMetricsFor(opportunities);
  const reachMetrics = reachMetricsFor(roleMetrics.generatedBySource, roleMetrics.gateOkBySource);
  const slotAllocation = slotAllocationFor(picks);
  const decisionTypeSelected = decisionTypeSelectedFor(picks);
  const diversityRejected = crossPostDiversityRejectedFor(opportunities, picks);
  const postedOverlap = postedOverlapFor(picks, postedWorkIds);
  const opportunityCounts = opportunityCountsFor(opportunities);
  const decisionPipelineByType = decisionTypePipelineByTypeFor(opportunities, picks, candidateDiagnostics);
  const moneyMetrics = moneyMetricsFor(opportunities, picks, postedWorkIds, sourceMetrics.eligibleByIntent.MONEY);
  const semantic = semanticSupplyDiagnostics(opportunities, picks);
  const variantDiagnostics = opportunities.flatMap((item) => item.creativeVariants.map((variant) => buildXGrowthVariantDiagnostic(item, variant, picks)));
  const variantDiagnosticsSummary = summarizeXGrowthVariantDiagnostics(variantDiagnostics);
  const shortages = supplyShortagesFor(reachMetrics, roleMetrics, picks);
  const target = picks.length >= 9 ? "3slot × 最大3候補" as const : "候補不足" as const;
  const decisionPipeline = decisionPipelineSummaryFor(opportunities, opportunityCounts.classified, picks, decisionSelection, decisionPipelineByType);

  return {
    target,
    ...candidatePoolFieldsFor(candidateDiagnostics, opportunities, picks),
    postedOverlap,
    urlOrMediaAvailable: opportunityCounts.urlOrMediaAvailable,
    hardGatePassed: opportunityCounts.hardGatePassed,
    eligibleByIntent: sourceMetrics.eligibleByIntent,
    mediaTypeCounts: sourceMetrics.mediaTypeCounts,
    sourceTypeCounts: sourceMetrics.sourceTypeCounts,
    creativeAngleCounts: sourceMetrics.creativeAngleCounts,
    decisionTypeCounts: sourceMetrics.decisionTypeCounts,
    decisionTypeSelected,
    decisionPipeline,
    slotAllocation,
    gateOkBySource: roleMetrics.gateOkBySource,
    generatedBySource: roleMetrics.generatedBySource,
    humanVoiceNgBySource: roleMetrics.humanVoiceNgBySource,
    nativeVoiceNgBySource: roleMetrics.nativeVoiceNgBySource,
    crossPostDiversityRejected: diversityRejected,
    generatedByRole: roleMetrics.generatedByRole,
    gateOkByRole: roleMetrics.gateOkByRole,
    shortagesByRole: roleMetrics.shortagesByRole,
    reachGenerated: reachMetrics.reachGenerated,
    reachGateOk: reachMetrics.reachGateOk,
    shortages,
    moneyGenerated: moneyMetrics.moneyGenerated,
    moneyHardGatePassed: moneyMetrics.moneyHardGatePassed,
    moneyAllocationEligible: moneyMetrics.moneyAllocationEligible,
    moneyPlaced: moneyMetrics.moneyPlaced,
    moneyGateReasons: moneyMetrics.moneyGateReasons,
    moneyTopFailureReason: moneyMetrics.moneyTopFailureReason,
    semanticSupply: semantic.supply,
    semanticSelected: semantic.selected,
    semanticQuota: SEMANTIC_CATEGORY_QUOTA,
    semanticQuotaOverflowReasons: semantic.overflowReasons,
    semanticMappingReasons: semantic.mappingReasons,
    variantDiagnostics,
    variantDiagnosticsSummary,
    pipeline: pipelineFor(candidateDiagnostics, opportunities, picks, opportunityCounts),
    salesEvaluation: salesEvaluationFor(candidateDiagnostics),
    videoWorkStages: candidateDiagnostics?.videoWorkStages ?? [],
    rankingDiagnostics: candidateDiagnostics?.rankingDiagnostics,
    mediaMix: mediaMix ?? defaultMediaMixFor(picks),
  };
}

type CandidateDiagnosticsInput = Parameters<typeof buildSupplyDiagnostics>[2];
type DecisionSelectionInput = Parameters<typeof buildSupplyDiagnostics>[3];

function withDefault<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function sourceMetricsFor(opportunities: XGrowthOpportunity[]) {
  const eligibleByIntent: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  const mediaTypeCounts: Record<string, number> = {};
  const sourceTypeCounts: Record<string, number> = {};
  const creativeAngleCounts: Record<string, number> = {};
  const decisionTypeCounts: Record<string, number> = {};
  for (const item of opportunities) {
    mediaTypeCounts[item.mediaType] = (mediaTypeCounts[item.mediaType] ?? 0) + 1;
    sourceTypeCounts[item.sourceType] = (sourceTypeCounts[item.sourceType] ?? 0) + 1;
    creativeAngleCounts[item.creativeAngle] = (creativeAngleCounts[item.creativeAngle] ?? 0) + 1;
    const decisionType = item.decisionFacts?.decisionType ?? "UNKNOWN";
    decisionTypeCounts[decisionType] = (decisionTypeCounts[decisionType] ?? 0) + 1;
    for (const role of ["REACH", "FOLLOW", "AUTHORITY", "MONEY"] as const) {
      if (passesLinklessQualityGate(item, role) && hasRealConversationSource(item, role)) eligibleByIntent[role] += 1;
    }
  }
  return { eligibleByIntent, mediaTypeCounts, sourceTypeCounts, creativeAngleCounts, decisionTypeCounts };
}

function roleMetricsFor(opportunities: XGrowthOpportunity[]) {
  const gateOkBySource: Record<string, number> = {};
  const generatedBySource: Record<string, number> = {};
  const humanVoiceNgBySource: Record<string, number> = {};
  const nativeVoiceNgBySource: Record<string, number> = {};
  const generatedByRole: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  const gateOkByRole: Record<XGrowthIntent, number> = { REACH: 0, FOLLOW: 0, AUTHORITY: 0, CONVERSATION: 0, MONEY: 0 };
  for (const item of opportunities) {
    generatedBySource[item.sourceType] = (generatedBySource[item.sourceType] ?? 0) + 1;
    const ok = item.creativeVariants.some((variant) => variant.quality.passed);
    if (ok) gateOkBySource[item.sourceType] = (gateOkBySource[item.sourceType] ?? 0) + 1;
    for (const role of new Set(item.creativeVariants.map((variant) => variant.intent))) {
      generatedByRole[role] = (generatedByRole[role] ?? 0) + 1;
    }
    for (const role of new Set(item.creativeVariants.filter((variant) => variant.quality.passed).map((variant) => variant.intent))) {
      gateOkByRole[role] = (gateOkByRole[role] ?? 0) + 1;
    }
    const hasHumanNg = item.creativeVariants.some((variant) => !variant.quality.lastMile.humanVoice.passed);
    if (hasHumanNg) humanVoiceNgBySource[item.sourceType] = (humanVoiceNgBySource[item.sourceType] ?? 0) + 1;
    const hasNativeNg = item.creativeVariants.some((variant) => !variant.quality.lastMile.nativeXVoice.passed);
    if (hasNativeNg) nativeVoiceNgBySource[item.sourceType] = (nativeVoiceNgBySource[item.sourceType] ?? 0) + 1;
  }
  const roleTargets: Record<XGrowthIntent, number> = { REACH: 5, FOLLOW: 3, AUTHORITY: 2, CONVERSATION: 0, MONEY: 2 };
  const shortagesByRole = (Object.keys(roleTargets) as XGrowthIntent[]).reduce((acc, role) => {
    acc[role] = Math.max(0, roleTargets[role] - (generatedByRole[role] ?? 0));
    return acc;
  }, {} as Record<XGrowthIntent, number>);
  return { gateOkBySource, generatedBySource, humanVoiceNgBySource, nativeVoiceNgBySource, generatedByRole, gateOkByRole, shortagesByRole };
}

function reachMetricsFor(generatedBySource: Record<string, number>, gateOkBySource: Record<string, number>) {
  const reachSources = ["MARKET", "COMPARISON", "JUDGMENT", "HIDDEN_GEM", "PRICE_EVENT", "WORK"];
  return {
    reachSources,
    reachGenerated: reachSources.reduce((sum, source) => sum + (generatedBySource[source] ?? 0), 0),
    reachGateOk: reachSources.reduce((sum, source) => sum + (gateOkBySource[source] ?? 0), 0),
  };
}

function slotAllocationFor(picks: XDailyTopPick[]) {
  return picks.reduce((counts, pick) => {
    const slot = pick.slotId ?? "unassigned";
    counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

function decisionTypeSelectedFor(picks: XDailyTopPick[]) {
  const decisionTypeSelected: Record<string, number> = {};
  for (const pick of picks) {
    const decisionType = pick.decisionFacts?.decisionType ?? "UNKNOWN";
    decisionTypeSelected[decisionType] = (decisionTypeSelected[decisionType] ?? 0) + 1;
  }
  return decisionTypeSelected;
}

function crossPostDiversityRejectedFor(opportunities: XGrowthOpportunity[], picks: XDailyTopPick[]) {
  return opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed) && !picks.some((pick) => pick.workId === item.workId || pick.sourceType === item.sourceType)).length;
}

function postedOverlapFor(picks: XDailyTopPick[], postedWorkIds: ReadonlySet<number>) {
  return picks.filter((pick) => postedWorkIds.has(pick.workId)).length;
}

function opportunityCountsFor(opportunities: XGrowthOpportunity[]) {
  return {
    classified: opportunities.filter((item) => decisionTypeForCandidate(item) !== "UNKNOWN").length,
    urlOrMediaAvailable: opportunities.filter((item) => Boolean(item.sampleMovieUrl || item.imageUrl || item.recommendedMediaUrl)).length,
    hardGatePassed: opportunities.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed)).length,
  };
}

function decisionTypeSupplyFor(
  supply: NonNullable<NonNullable<CandidateDiagnosticsInput>["decisionSupply"]>[string] | undefined,
  typeItems: XGrowthOpportunity[],
) {
  const diagnostics = supply ?? {};
  return {
    dbFetchedWorks: withDefault(diagnostics.dbFetchedWorks, withDefault(diagnostics.dbRawWorks, 0)),
    dbRawWorks: withDefault(diagnostics.dbRawWorks, 0),
    baseXFilters: withDefault(diagnostics.afterPostedCooldown, 0),
    postedCooldown: withDefault(diagnostics.afterPostedCooldown, 0),
    mediaEligible: typeItems.filter((item) => item.mediaUsage !== "not_available" && Boolean(item.sampleMovieUrl || item.imageUrl)).length,
    uniqueWorks: new Set(typeItems.map((item) => item.workId)).size,
    chartEligible: withDefault(diagnostics.chartEligible, typeItems.length),
    firstDropReasonCounts: withDefault(diagnostics.firstDropReasonCounts, {}),
    firstDropByWorkId: withDefault(diagnostics.firstDropByWorkId, {}),
  };
}

function decisionTypePipelineEntry(
  decisionType: DecisionType,
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  candidateDiagnostics: CandidateDiagnosticsInput,
) {
  const typeItems = opportunities.filter((item) => isEligibleForDecisionType(item, decisionType));
  const typePicks = picks.filter((pick) => decisionTypeForCandidate(pick) === decisionType);
  const uniqueMedia = new Set(typeItems.map((item) => candidateMediaDedupeKey(item)).filter((key): key is string => Boolean(key)));
  const qualityItems = typeItems.filter((item) => item.creativeVariants.some((variant) => variant.quality.passed));
  const supply = candidateDiagnostics?.decisionSupply?.[decisionType];
  return [decisionType, {
    ...decisionTypeSupplyFor(supply, typeItems),
    uniqueMedia: uniqueMedia.size,
    uniqueUrls: new Set(typeItems.map((item) => item.sampleMovieUrl || item.imageUrl).filter(Boolean)).size,
    creativeVariants: typeItems.reduce((sum, item) => sum + item.creativeVariants.length, 0),
    qualityEligible: qualityItems.length,
    selected: typePicks.length,
    persisted: typePicks.length,
  }] as const;
}

function decisionTypePipelineByTypeFor(
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  candidateDiagnostics: CandidateDiagnosticsInput,
) {
  return Object.fromEntries(DECISION_TYPES.map((decisionType) =>
    decisionTypePipelineEntry(decisionType, opportunities, picks, candidateDiagnostics),
  ));
}

function decisionSelectionCountsFor(
  picks: XDailyTopPick[],
  decisionSelection: DecisionSelectionInput,
) {
  const selection = decisionSelection ?? {} as NonNullable<DecisionSelectionInput>;
  return {
    eligible: Object.values(selection.eligibleSupply ?? {}).reduce((sum, count) => sum + count, 0),
    dedupedEligible: selection.dedupedEligibleSupply ?? 0,
    selectedBeforeReplenishment: selection.selectedBeforeReplenishment ?? picks.length,
    replenished: selection.replenished ?? 0,
    selected: selection.selected ?? picks.length,
  };
}

function decisionSelectionTypesFor(decisionSelection: DecisionSelectionInput) {
  const selection = decisionSelection ?? {} as NonNullable<DecisionSelectionInput>;
  return {
    eligibleByType: selection.eligibleSupply ?? { RECORD_LOW: 0, HIGH_DISCOUNT_NOT_LOW: 0, HIDDEN_VALUE: 0 },
    selectedByType: selection.selectedByType ?? { RECORD_LOW: 0, HIGH_DISCOUNT_NOT_LOW: 0, HIDDEN_VALUE: 0 },
  };
}

function decisionPipelineSummaryFor(
  opportunities: XGrowthOpportunity[],
  classified: number,
  picks: XDailyTopPick[],
  decisionSelection: DecisionSelectionInput,
  byType: ReturnType<typeof decisionTypePipelineByTypeFor>,
) {
  const counts = decisionSelectionCountsFor(picks, decisionSelection);
  const types = decisionSelectionTypesFor(decisionSelection);
  return {
    rawSupply: opportunities.length,
    classified,
    ...counts,
    persisted: picks.length,
    ...types,
    byType,
  };
}

function addMoneyAvailabilityReasons(
  reasons: Set<XMoneyGateReason>,
  item: XGrowthOpportunity,
  moneyVariants: XGrowthOpportunity["creativeVariants"],
  postedWorkIds: ReadonlySet<number>,
) {
  if (!moneyVariants.some((variant) => Boolean(variant.url))) reasons.add("missing_affiliate_url");
  if (item.freshness.status === "expired") reasons.add("stale_or_expired");
  if (!item.currentPrice && !item.previousPrice && !item.discountRate) reasons.add("price_truth_unavailable");
  if (item.mediaUsage === "not_available") reasons.add("media_mismatch");
  if (postedWorkIds.has(item.workId)) reasons.add("duplicate_or_posted");
}

function addMoneyQualityReasons(reasons: Set<XMoneyGateReason>, moneyVariants: XGrowthOpportunity["creativeVariants"]) {
  if (moneyVariants.some((variant) => !variant.quality.lastMile.passed)) {
    const lastMile = moneyVariants.find((variant) => !variant.quality.lastMile.passed)?.quality.lastMile;
    if (lastMile?.humanVoice.passed === false) reasons.add("last_mile_ng");
    if (lastMile?.nativeXVoice.passed === false) reasons.add("native_x_voice_ng");
    if (lastMile?.reasons.some((reason) => /explicit|unsafe|露出|安全/.test(reason))) reasons.add("unsafe_or_too_explicit");
  }
}

function moneyGateReasonsForWork(item: XGrowthOpportunity, postedWorkIds: ReadonlySet<number>) {
  const reasons = new Set<XMoneyGateReason>();
  const moneyVariants = item.creativeVariants.filter((variant) => variant.intent === "MONEY");
  addMoneyAvailabilityReasons(reasons, item, moneyVariants, postedWorkIds);
  addMoneyQualityReasons(reasons, moneyVariants);
  if (!reasons.size && !moneyVariants.some((variant) => variant.quality.passed)) reasons.add("other");
  return { workId: item.workId, candidateId: moneyVariants[0]?.id ?? null, reasons: [...reasons] };
}

function moneyGateReasonsFor(opportunities: XGrowthOpportunity[], postedWorkIds: ReadonlySet<number>) {
  return opportunities
    .filter((item) => item.sourceType === "MONEY")
    .map((item) => moneyGateReasonsForWork(item, postedWorkIds))
    .filter((entry) => entry.reasons.length > 0);
}

function moneyTopFailureReasonFor(reasons: Array<{ workId: number; candidateId: string | null; reasons: XMoneyGateReason[] }>) {
  const reasonCounts = new Map<XMoneyGateReason, number>();
  for (const entry of reasons) {
    for (const reason of entry.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  return [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function moneyMetricsFor(
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  postedWorkIds: ReadonlySet<number>,
  moneyAllocationEligible: number,
) {
  const moneyGateReasons = moneyGateReasonsFor(opportunities, postedWorkIds);
  return {
    moneyGenerated: opportunities.filter((item) => item.sourceType === "MONEY").length,
    moneyHardGatePassed: opportunities.filter((item) => item.sourceType === "MONEY" && item.creativeVariants.some((variant) => variant.intent === "MONEY" && variant.quality.passed)).length,
    moneyAllocationEligible,
    moneyPlaced: picks.filter((pick) => pick.role === "MONEY").length,
    moneyGateReasons,
    moneyTopFailureReason: moneyTopFailureReasonFor(moneyGateReasons),
  };
}

function roleShortagesFor(reachGenerated: number, reachGateOk: number, generatedByRole: Record<XGrowthIntent, number>) {
  return [
    reachGenerated < 5 ? "REACH供給目標5件に対して" + reachGenerated + "件" : "",
    generatedByRole.FOLLOW + generatedByRole.AUTHORITY < 5 ? "FOLLOW/AUTHORITY供給目標5件に対して" + (generatedByRole.FOLLOW + generatedByRole.AUTHORITY) + "件" : "",
    generatedByRole.MONEY < 2 ? "MONEY供給目標2件に対して" + generatedByRole.MONEY + "件。強い価格/CTR日だけ採用" : "",
    reachGateOk === 0 ? "REACH候補は" + reachGenerated + "件生成したがGate OKが不足" : "",
  ];
}

function sourceShortagesFor(
  reachGenerated: number,
  reachGateOk: number,
  reachSources: string[],
  humanVoiceNgBySource: Record<string, number>,
  gateOkBySource: Record<string, number>,
) {
  return [
    reachGenerated > reachGateOk ? "REACH候補は" + reachGenerated + "件生成、Gate OKは" + reachGateOk + "件" : "",
    reachSources.some((source) => (humanVoiceNgBySource[source] ?? 0) > 0)
      ? "Human Voice Gate NG: " + reachSources.map((source) => source + " " + (humanVoiceNgBySource[source] ?? 0)).filter((text) => !text.endsWith(" 0")).join(" / ")
      : "",
    (gateOkBySource.MARKET ?? 0) + (gateOkBySource.COMPARISON ?? 0) + (gateOkBySource.JUDGMENT ?? 0) + (gateOkBySource.FOLLOW_UP ?? 0) === 0
      ? "市場/比較/判断/続報のGate OK候補が不足"
      : "",
    (gateOkBySource.MONEY ?? 0) + (gateOkBySource.PRICE_EVENT ?? 0) === 0
      ? "MONEY/価格イベントのGate OK候補が不足"
      : "",
  ];
}

function selectionShortagesFor(picks: XDailyTopPick[]) {
  return [
    picks.length >= 2 && !picks.some((pick) => pick.role === "REACH")
      ? "FOLLOW+FOLLOW系になった理由: REACH候補が全Gate NG、または当日セット重複で不採用"
      : "",
    picks.length < 9 ? "3slot×3の目標に対して" + picks.length + "件" : "",
  ];
}

function supplyShortagesFor(
  reachMetrics: ReturnType<typeof reachMetricsFor>,
  roleMetrics: ReturnType<typeof roleMetricsFor>,
  picks: XDailyTopPick[],
) {
  return [
    ...roleShortagesFor(reachMetrics.reachGenerated, reachMetrics.reachGateOk, roleMetrics.generatedByRole),
    ...sourceShortagesFor(reachMetrics.reachGenerated, reachMetrics.reachGateOk, reachMetrics.reachSources, roleMetrics.humanVoiceNgBySource, roleMetrics.gateOkBySource),
    ...selectionShortagesFor(picks),
  ].filter(Boolean);
}

function candidatePoolFieldsFor(
  candidateDiagnostics: CandidateDiagnosticsInput,
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
) {
  return {
    sourcePoolTotal: withDefault(candidateDiagnostics?.sourcePoolTotal, opportunities.length),
    sourcePoolAfterPosted: withDefault(candidateDiagnostics?.sourcePoolAfterPosted, opportunities.length),
    saleVideoSupply: withDefault(candidateDiagnostics?.saleVideoSupply, { fetched: 0, activeOfficial: 0, afterPosted: 0, selected: 0 }),
    videoQualityFailureCounts: withDefault(candidateDiagnostics?.videoQualityFailureCounts, {}),
    prefilterCount: withDefault(candidateDiagnostics?.prefilterCount, opportunities.length),
    humanVoiceTargetCount: withDefault(candidateDiagnostics?.humanVoiceTargetCount, opportunities.length),
    diversityTargetCount: withDefault(candidateDiagnostics?.diversityTargetCount, picks.length),
    postedExcluded: withDefault(candidateDiagnostics?.postedExcluded, 0),
  };
}

function pipelineFor(
  candidateDiagnostics: CandidateDiagnosticsInput,
  opportunities: XGrowthOpportunity[],
  picks: XDailyTopPick[],
  counts: ReturnType<typeof opportunityCountsFor>,
) {
  return candidateDiagnostics?.pipeline ?? {
    rawCandidates: opportunities.length,
    afterPosted: opportunities.length,
    afterStale: opportunities.filter((item) => item.freshness.status !== "expired").length,
    afterMedia: opportunities.filter((item) => isAllowedXGrowthMediaType(item.mediaType)).length,
    afterQuality: counts.hardGatePassed,
    afterSemantic: picks.length,
    slotEligible: picks.length,
    finalSelected: picks.length,
  };
}

function salesEvaluationFor(candidateDiagnostics: CandidateDiagnosticsInput) {
  return candidateDiagnostics?.salesEvaluation ?? {
    currentMonth: "unknown", prior90DayFromMonth: "unknown", prior90DayThroughMonth: "unknown",
    currentMonthRows: 0, prior90DayRows: 0, unscopedCurrentMonthRows: 0, unscopedPrior90DayRows: 0,
    futureRowsExcluded: 0, currentMonthSalesCount: 0, prior90DaySalesCount: 0, currentMonthWorks: 0,
    prior90DayWorks: 0, dedupedWorkMonthEntries: 0, signalsAppliedWorks: 0, candidateWorksWithSalesBonus: 0,
  };
}

function defaultMediaMixFor(picks: XDailyTopPick[]) {
  const selectedVideos = picks.filter((pick) => pick.mediaType === "sample_movie").length;
  return {
    totalVideoCandidates: 0,
    videoRaw: 0,
    videoEligible: 0,
    videoAfterDedupe: 0,
    slotEligibleVideo: 0,
    eligibleStrongVideos: 0,
    eligibleOfficialVideos: 0,
    officialCandidateCount: 0,
    officialVariantEligibleCount: 0,
    selectedVideos,
    fallbackOfficialSelected: 0,
    selectedVideosBySlot: {},
    rejectionReasons: {},
    uniqueAudit: auditCandidateUniqueness(picks),
    targetVideos: 0,
    unmetReason: null,
    generatedVideoVariants: 0,
    hardQualityVideoVariants: 0,
    semanticSafeVideoUniqueWorks: 0,
    availableToFinalVideoUniqueWorks: 0,
    selectedVideosBeforeReplenishment: selectedVideos,
    selectedVideosAfterReplenishment: selectedVideos,
    videoFirstDropReasonCounts: {},
    videoSupplyStages: buildMediaSupplyStageDiagnostics([], "sample_movie", new Set(), new Set()),
    imageSupplyStages: buildMediaSupplyStageDiagnostics([], "existing_link_image", new Set(), new Set()),
  };
}

