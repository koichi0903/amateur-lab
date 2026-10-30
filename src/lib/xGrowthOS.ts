import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import type { XGrowthSalesEvaluation } from "@/lib/xGrowthSalesSignal";
import { calculateXGrowthSalesSignal } from "@/lib/xGrowthSalesSignal";
import { getXGrowthPersistencePlan } from "@/lib/xGrowthDryRun";
import type { FanzaXGrowth } from "@/lib/fanzaXAccountGrowth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getXPostCandidates } from "@/lib/xPostPlanner";
import type { XCreativeLearningRow, XPostLog, XPostOutcome } from "@/lib/xPostLogs";
import { buildSeriesIdeas, buildStrategicMission } from "@/lib/xGrowthPlanning";
import { applyMediaEligibility, fetchMediaAssets } from "@/lib/xGrowthMediaOperations";
import {
  buildConversationRadarFromData,
  fetchRankingSnapshotHistory,
  getPersistedGrowthTables,
  getXGrowthSystemStatus,
  persistRankingSnapshots,
  persistCreativeLearning,
  persistOpportunities,
  persistDailyTopPicks,
  getPostedWorkIds,
  checkMediaAssetUrlsForWorkIds,
  syncSampleMovieAssetsForWorkIds,
  upsertDailyPlan,
  type XGrowthSystemStatus,
} from "@/lib/xGrowthOperations";
import { getXMediaSupplyStatus, getRightsReviewQueue } from "@/lib/xMediaAssets";
import { isVideoCandidate } from "@/lib/xVideoCandidate";
import { syncAndProbeCandidateMedia } from "./xGrowthMediaPreflight";

import type { DecisionType } from "@/lib/domain/decisionFacts";
import { auditCandidateUniqueness } from "./xGrowthCandidateIdentity";
export { auditCandidateUniqueness, candidateDedupeKey, candidateMediaDedupeKey, isDistinctCandidate } from "./xGrowthCandidateIdentity";
import type { RankedDuplicateBreakdown } from "./xGrowthMediaMix";
export { selectRankedMediaMix, type RankedDuplicateBreakdown, type RankedMediaMixCandidate } from "./xGrowthMediaMix";
import { VIDEO_QUALITY_EVALUATION_WORK_LIMIT, X_GROWTH_PINNED_EVALUATION_WORK_IDS, cheapCandidatePrefilter, preserveDecisionLanesBeforeLimit } from "./xGrowthEligibility";
import { tokyoDate } from "./xGrowthTime";
import { compareOpportunitiesByPeakScore, expandCreativeSupply, scoreOpportunity } from "./xGrowthOpportunityScoring";
export { expandCreativeSupply, presentationDecisionFactsForSource, scoreOpportunity } from "./xGrowthOpportunityScoring";
import { auditDailyDiversity, type MediaSupplyStageDiagnostics } from "./xGrowthSupplyDiagnostics";
import { buildLearning, buildNativeXLearning } from "./xGrowthLearning";
import { withCreativeQuality } from "./xGrowthCreativeQuality";
export { withCreativeQuality };
export { VIDEO_QUALITY_EVALUATION_WORK_LIMIT, X_GROWTH_PINNED_EVALUATION_WORK_IDS, cheapCandidatePrefilter, isAllowedXGrowthMediaType, isOfficialEligibleVideoCandidate, isStrongSafeVideoCandidate, officialVideoWorkIds, preserveDecisionLanesBeforeLimit, videoEligibilityReasons } from "./xGrowthEligibility";
export { isMediaVariantSelectionEligible, isSoftQualityEligible } from "./xGrowthEligibility";
export { buildXGrowthVariantDiagnostic, summarizeXGrowthVariantDiagnostics } from "./xGrowthDiagnostics";
import { applyRankingHistory, recentPostedWorkIds, selectRankedDailyTopPicks } from "./xGrowthDailySelection";
import { buildSupplyDiagnostics } from "./xGrowthSupplyReport";
export { buildXGrowthVideoCandidateEvaluation, type XGrowthVideoCandidateEvaluation } from "./xGrowthVideoCandidateEvaluation";
import { buildXGrowthPipelineReport } from "./xGrowthPipelineReport";
import type { XDailyMission, XDailyTopPick, XGrowthAudit, XGrowthIntent, XGrowthOpportunity, XMoneyGateReason, XSemanticHookCategory } from "./xGrowthTypes";
export type { XCreativeAngle, XDailyMission, XDailyTopPick, XGrowthAudit, XGrowthIntent, XGrowthOpportunity, XGrowthVariantDiagnostic, XMoneyGateReason, XOpportunityEvent, XOpportunitySourceType, XSemanticHookCategory } from "./xGrowthTypes";

export { assignSemanticHook, SEMANTIC_CATEGORY_QUOTA, semanticHookCategory } from "./xGrowthSemantic";

export { decisionTypeForCandidate, decisionTypesForCandidate, isDecisionFactEligible } from "./xGrowthDailySelection";

export type XGrowthOS = {
  opportunities: XGrowthOpportunity[];
  dailyTopPicks: XDailyTopPick[];
  dailyNoPostReason: string | null;
  mission: XDailyMission;
  audit: XGrowthAudit;
  conversationRadar: Array<{ key: string; target: string; query: string; suggestedAction: string }>;
  seriesIdeas: Array<{ key: string; title: string; detail: string }>;
  learning: Array<{ key: string; label: string; finding: string; strength: "strong" | "watch" | "weak" }>;
  manualMetrics: string[];
  dailyPlan: Record<string, unknown> | null;
  persistedOpportunities: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  systemStatus: XGrowthSystemStatus;
  mediaSupply: Awaited<ReturnType<typeof getXMediaSupplyStatus>>;
  rightsReviewQueue: Awaited<ReturnType<typeof getRightsReviewQueue>>["rows"];
  supplyDiagnostics: {
    target: "3slot × 最大3候補" | "候補不足";
    sourcePoolTotal: number;
    sourcePoolAfterPosted: number;
    saleVideoSupply: { fetched: number; activeOfficial: number; afterPosted: number; selected: number };
    prefilterCount: number;
    humanVoiceTargetCount: number;
    diversityTargetCount: number;
    postedExcluded: number;
    postedOverlap: number;
    urlOrMediaAvailable: number;
    hardGatePassed: number;
    eligibleByIntent: Record<XGrowthIntent, number>;
    mediaTypeCounts: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
    creativeAngleCounts: Record<string, number>;
    slotAllocation: Record<string, number>;
    gateOkBySource: Record<string, number>;
    generatedBySource: Record<string, number>;
    humanVoiceNgBySource: Record<string, number>;
    nativeVoiceNgBySource: Record<string, number>;
    crossPostDiversityRejected: number;
    generatedByRole: Record<XGrowthIntent, number>;
    gateOkByRole: Record<XGrowthIntent, number>;
    shortagesByRole: Record<XGrowthIntent, number>;
    reachGenerated: number;
    reachGateOk: number;
    shortages: string[];
    videoQualityFailureCounts: Record<string, number>;
    moneyGenerated: number;
    moneyHardGatePassed: number;
    moneyAllocationEligible: number;
    moneyPlaced: number;
    moneyGateReasons: Array<{ workId: number; candidateId: string | null; reasons: XMoneyGateReason[] }>;
    moneyTopFailureReason: XMoneyGateReason | null;
    semanticSupply: Record<XSemanticHookCategory, number>;
    semanticSelected: Record<XSemanticHookCategory, number>;
    semanticQuota: Record<XSemanticHookCategory, number>;
    semanticQuotaOverflowReasons: string[];
    semanticMappingReasons: Record<string, number>;
    decisionPipeline: {
      rawSupply: number;
      classified: number;
      eligible: number;
      dedupedEligible: number;
      selectedBeforeReplenishment: number;
      replenished: number;
      selected: number;
      persisted: number;
      eligibleByType: Record<string, number>;
      selectedByType: Record<string, number>;
      byType: Record<string, {
        dbFetchedWorks: number;
        dbRawWorks: number;
        baseXFilters: number;
        postedCooldown: number;
        mediaEligible: number;
        uniqueWorks: number;
        uniqueMedia: number;
        uniqueUrls: number;
        chartEligible: number;
        creativeVariants: number;
        qualityEligible: number;
        firstDropReasonCounts: Record<string, number>;
        firstDropByWorkId: Record<string, string>;
        selected: number;
        persisted: number;
      }>;
    };
    pipeline: Record<string, number>;
    salesEvaluation: XGrowthSalesEvaluation & { candidateWorksWithSalesBonus: number };
    videoWorkStages: Array<{
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
    mediaMix: {
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
      };
    rankingDiagnostics?: {
      candidateVariants: number;
      uniqueWorksBeforeCollapse: number;
      lostUniqueWorksAfterCollapse: number;
      duplicateBreakdown: RankedDuplicateBreakdown;
      rankedPoolTotalUniqueWorks: number;
      videoEligibleUnique: number;
      imageEligibleUnique: number;
      excludedPosted: number;
      excludedDuplicate: number;
      excludedUnusable: number;
      excludedHardQuality: number;
      excludedSemantic: number;
      topRankedCandidates: Array<{ workId: number; mediaType: string; score: number; rank: number; decisionType: DecisionType; role: XGrowthIntent }>;
      mediaQuotaChosen: string;
      decisionCoverageAdjustments: number;
      finalRanks: number[];
    };
  };
  nativeXLearning: {
    overusedPatterns: string[];
    winningPatterns: string[];
    avoidConstructions: string[];
  };
  performanceTimings: Record<string, number>;
};



const DAILY_PICK_COOLDOWN_DAYS = 1;

async function fetchRecentDailyPickWorkIds(days = DAILY_PICK_COOLDOWN_DAYS) {
  const since = tokyoDate(-days);
  const today = tokyoDate();
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .select("work_id,opportunity_date,opportunity_key,creative_genome")
    .eq("account_handle", "hakkutsu_lab")
    .gte("opportunity_date", since)
    .lt("opportunity_date", today)
    .like("opportunity_key", "daily-pick-%")
    .limit(100);
  if (error) return new Set<number>();
  return new Set((data ?? [])
    .filter((row) => {
      const pick = ((row as { creative_genome?: Record<string, unknown> | null }).creative_genome?.persisted_top_pick ?? null) as { isSelected?: boolean } | null;
      return pick?.isSelected !== false;
    })
    .map((row) => Number((row as { work_id?: unknown }).work_id))
    .filter((workId) => Number.isSafeInteger(workId) && workId > 0));
}

export async function buildXGrowthOS({
  growth,
  performance,
  logs,
  outcomes,
  creativeLearning,
  salesEvaluation,
  includeDeferred = true,
  readOnlyDryRun = false,
}: {
  growth: FanzaXGrowth;
  performance: AffiliatePerformanceRow[];
  logs: XPostLog[];
  outcomes: XPostOutcome[];
  creativeLearning: XCreativeLearningRow[];
  salesEvaluation?: XGrowthSalesEvaluation;
  includeDeferred?: boolean;
  readOnlyDryRun?: boolean;
}): Promise<XGrowthOS> {
  const timings: Record<string, number> = {};
  const mark = async <T,>(label: string, task: Promise<T>) => {
    const started = Date.now();
    const result = await task;
    timings[label] = Date.now() - started;
    return result;
  };
  const postedWorkResult = await mark("posted_work_ids_ms", getPostedWorkIds());
  const salesSignalByWork = new Map(performance.map((row) => [row.workId, row]));
  const candidateResult = await mark("candidate_generation_ms", getXPostCandidates(performance, logs, postedWorkResult.workIds));
  candidateResult.candidates = candidateResult.candidates.map((candidate) => {
    const performanceRow = salesSignalByWork.get(candidate.workId);
    if (!performanceRow) return candidate;
    const signal = calculateXGrowthSalesSignal(performanceRow.currentMonthSalesCount, performanceRow.prior90DaySalesCount);
    return { ...candidate, salesScoreBonus: signal.scoreBonus, currentMonthSalesCount: signal.currentMonthSalesCount, prior90DaySalesCount: signal.prior90DaySalesCount, salesReason: signal.reason };
  });
  // Probe the actual video candidates after syncing them. A broad preflight
  // before candidate generation cannot guarantee that these works are checked.
  const videoCandidatesToProbe = candidateResult.candidates
    .filter((item) => Boolean(item.sampleMovieUrl))
    .map((item) => item.workId);
  const mediaPreflight = await syncAndProbeCandidateMedia(
    videoCandidatesToProbe,
    syncSampleMovieAssetsForWorkIds,
    checkMediaAssetUrlsForWorkIds,
    100,
  );
  timings.media_assets_sync_ms = mediaPreflight.syncElapsedMs;
  timings.media_assets_probe_ms = mediaPreflight.probeElapsedMs;
  timings.media_assets_probe_checked = mediaPreflight.probe.checked;
  if (mediaPreflight.sync.error) timings.media_assets_sync_error = 1;
  if (mediaPreflight.probe.error) timings.media_assets_probe_error = 1;
  const expandedCandidates = expandCreativeSupply(candidateResult.candidates);
  const scoredAll = expandedCandidates.map(scoreOpportunity).sort(compareOpportunitiesByPeakScore);
  const baseLimit = 500;
  const scored = preserveDecisionLanesBeforeLimit(scoredAll, baseLimit, X_GROWTH_PINNED_EVALUATION_WORK_IDS);
  const [media, rankingHistories] = await Promise.all([
    mark("media_assets_ms", fetchMediaAssets(scored.map((item) => item.workId))),
    mark("ranking_history_ms", fetchRankingSnapshotHistory(scored.map((item) => item.workId))),
  ]);
  const currentSampleUrls = new Set(scored
    .filter((item) => item.sampleMovieUrl)
    .map((item) => `${item.workId}:${item.sampleMovieUrl}`));
  const currentUrlMediaAssets = new Map([...media.assets].filter(([workId, asset]) => currentSampleUrls.has(`${workId}:${asset.source_url}`)));
  const mediaEligible = applyMediaEligibility(scored, currentUrlMediaAssets).map((item) => item.mediaType === "sample_movie" && item.canNativeVideo
    ? { ...item, mediaDecision: "公式FANZA/DMMのHTTPSサンプルURLを確認。実際の取得可能性は未確認" }
    : item);
  const rankedOpportunities = applyRankingHistory(mediaEligible, rankingHistories.histories);
  const prefilterStarted = Date.now();
  // 90 quality candidates are enough for the three-slot allocator while
  // avoiding Human Voice work on the long tail.
  // Keep a wide real-media supply for the slot allocator. The previous 90-item
  // prefilter made semantic/source ranking decide supply before media eligibility
  // and left otherwise usable works unavailable for later fallback.
  const narrowedOpportunities = cheapCandidatePrefilter(rankedOpportunities, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
  timings.cheap_prefilter_ms = Date.now() - prefilterStarted;
  timings.prefilter_input_count = rankedOpportunities.length;
  timings.prefilter_output_count = narrowedOpportunities.length;
  const qualityStarted = Date.now();
  const opportunities = narrowedOpportunities.map((item) => withCreativeQuality(item, logs));
  timings.creative_quality_ms = Date.now() - qualityStarted;
  timings.human_voice_target_count = opportunities.length;
  const mission = buildStrategicMission(growth, logs, creativeLearning);
  const recentDailyPickWorkIds = await mark("recent_daily_pick_cooldown_ms", fetchRecentDailyPickWorkIds());
  const postedWorkIds = new Set([...recentPostedWorkIds(logs), ...postedWorkResult.workIds]);
  const allocatorStarted = Date.now();
  const dailySelection = selectRankedDailyTopPicks(opportunities, logs, recentDailyPickWorkIds, postedWorkIds);
  timings.bucket_allocation_ms = Date.now() - allocatorStarted;
  timings.fallback_allocator_ms = timings.bucket_allocation_ms;
  timings.media_mix_ms = dailySelection.mediaMix.mediaMixMs;
  const diversityStarted = Date.now();
  // Ranking is the source of truth. Diversity is audited after selection, but
  // it must not silently delete ranked candidates or recreate slot quotas.
  const diversityResult = { picks: dailySelection.picks, audit: auditDailyDiversity(dailySelection.picks) };
  timings.final_diversity_check_ms = Date.now() - diversityStarted;
  timings.diversity_pass_ms = timings.final_diversity_check_ms;
  timings.diversity_target_count = dailySelection.picks.length;
  const finalMediaMix = {
    ...dailySelection.mediaMix,
    uniqueAudit: auditCandidateUniqueness(diversityResult.picks, postedWorkIds),
    selectedVideos: diversityResult.picks.filter((pick) => isVideoCandidate(pick)).length,
    selectedVideosBySlot: diversityResult.picks.reduce((counts, pick) => {
      if (isVideoCandidate(pick)) {
        const slot = pick.slotId ?? "unassigned";
        counts[slot] = (counts[slot] ?? 0) + 1;
      }
      return counts;
      }, {} as Record<string, number>),
    selectedVideosAfterReplenishment: diversityResult.picks.filter((pick) => isVideoCandidate(pick)).length,
  };
  finalMediaMix.unmetReason = finalMediaMix.targetVideos > finalMediaMix.selectedVideos
    ? finalMediaMix.unmetReason ?? "最終Diversity Gate後に目標未達。安全性・semantic・重複制約を優先"
    : finalMediaMix.unmetReason;
  const pipelineReport = buildXGrowthPipelineReport({
    candidates: candidateResult.candidates,
    expandedCandidates,
    scored,
    rankedOpportunities,
    prefilterOpportunities: narrowedOpportunities,
    opportunities,
    selectedPicks: diversityResult.picks,
    slotEligibleCount: dailySelection.picks.length,
    finalSelectedCount: diversityResult.picks.length,
  });
  const { pipeline, videoQualityFailureCounts, videoWorkStages } = pipelineReport;
  const salesEvaluationBase: XGrowthSalesEvaluation = salesEvaluation ?? {
    currentMonth: "unknown", prior90DayFromMonth: "unknown", prior90DayThroughMonth: "unknown",
    currentMonthRows: 0, prior90DayRows: 0, unscopedCurrentMonthRows: 0, unscopedPrior90DayRows: 0,
    futureRowsExcluded: 0, currentMonthSalesCount: 0, prior90DaySalesCount: 0, currentMonthWorks: 0,
    prior90DayWorks: 0, dedupedWorkMonthEntries: 0, signalsAppliedWorks: 0,
  };
  const candidateWorksWithSalesBonus = new Set(candidateResult.candidates.filter((candidate) => (candidate.salesScoreBonus ?? 0) > 0).map((candidate) => candidate.workId)).size;
  const supplyDiagnostics = buildSupplyDiagnostics(opportunities, diversityResult.picks, { ...candidateResult.diagnostics, prefilterCount: narrowedOpportunities.length, humanVoiceTargetCount: opportunities.length, diversityTargetCount: dailySelection.picks.length, pipeline, salesEvaluation: { ...salesEvaluationBase, candidateWorksWithSalesBonus }, videoWorkStages, videoQualityFailureCounts, rankingDiagnostics: dailySelection.rankingDiagnostics }, dailySelection.decisionSelection, postedWorkIds, finalMediaMix);
  const nativeXLearning = buildNativeXLearning(logs, outcomes);
  const persistencePlan = getXGrowthPersistencePlan(readOnlyDryRun, includeDeferred);
  const persistedTopPicks = persistencePlan.persistTopPicks
    ? await mark("persisted_top_picks_ms", persistDailyTopPicks({
      mission,
      topPicks: diversityResult.picks,
      supplyDiagnostics,
      nativeXLearning,
      performanceTimings: timings,
    }))
    : { plan: null, error: null };
  const deferredStarted = Date.now();
  const deferred = persistencePlan.runDeferredWrites ? await Promise.all([
    upsertDailyPlan(mission),
    persistOpportunities(opportunities.slice(0, 16)),
    buildConversationRadarFromData(opportunities),
    getPersistedGrowthTables(),
    persistCreativeLearning(creativeLearning.slice(0, 12)),
    persistRankingSnapshots(opportunities.slice(0, 16)),
    mark("media_supply_ms", getXMediaSupplyStatus()),
    mark("rights_review_ms", getRightsReviewQueue(12)),
  ]) : null;
  timings.deferred_admin_ms = Date.now() - deferredStarted;
  const [planResult, persistedResult, radarResult, persistedTables, , rankingSnapshotResult, mediaSupply, rightsReviewQueue] = deferred ?? [
    { plan: null, error: null },
    { error: null },
    { rows: [], error: null },
    { opportunities: [], snapshots: [], migrationError: null },
    null,
    { error: null },
    { error: null, mp4Candidates: 0, synced: 0, unknown: 0, review: 0, allowed: 0, blocked: 0, dead: 0, topPickRightsWaiting: 0 },
    { rows: [], error: null },
  ];
  const systemStatus = getXGrowthSystemStatus(
    firstDefinedError(media.error, rankingHistories.error, persistedTopPicks.error, persistedResult.error, radarResult.error, persistedTables.migrationError, rankingSnapshotResult.error, planResult.error),
    firstDefinedError(rankingHistories.error, rankingSnapshotResult.error),
  );

  return {
    opportunities: opportunities.slice(0, 16).map((item) => ({
      ...item,
      creativeVariants: item.creativeVariants.slice(0, 4),
    })),
    dailyTopPicks: diversityResult.picks,
    dailyNoPostReason: dailySelection.reason,
    mission,
    audit: {
      reuse: ["x_post_logs", "既存リンク画像", "works / price_history / ranking / review", "work_page_views / affiliate_clicks", "xCreativeEngineの投稿文バリアント"],
      replace: ["作品起点の固定3投稿Planner", "/admin/revenue内のX候補運用UI", "単一funnelScore中心の判断"],
      retire: ["新Growth OSと重複する旧X候補パネル", "クリックだけで成功判定する旧学習", "myfansと混ざる可能性のある手動運用"],
    },
    conversationRadar: (radarResult.rows as Array<Record<string, unknown>>).map((row) => ({
      key: String(row.id),
      target: `${row.target_type}: ${row.target_name}`,
      query: String(row.topic),
      suggestedAction: `${row.suggested_reply} / 外部X検索: ${row.external_status === "unavailable" ? "unavailable" : "available"}`,
    })),
    seriesIdeas: buildSeriesIdeas(performance, opportunities),
    learning: buildLearning(creativeLearning, outcomes),
    manualMetrics: ["bookmarks", "profile_visits", "follows", "X側link_clicks"],
    dailyPlan: (planResult.plan ?? null) as Record<string, unknown> | null,
    persistedOpportunities: (persistedTables.opportunities ?? []) as Record<string, unknown>[],
    snapshots: (persistedTables.snapshots ?? []) as Record<string, unknown>[],
    systemStatus,
    mediaSupply,
    rightsReviewQueue: rightsReviewQueue.rows,
    supplyDiagnostics,
    nativeXLearning,
    performanceTimings: timings,
  };
}

function firstDefinedError(...errors: Array<string | null | undefined>) {
  for (const error of errors) {
    if (error !== null && error !== undefined) return error;
  }
  return null;
}
