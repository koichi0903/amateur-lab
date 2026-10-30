import {
  applyMediaEligibility,
  checkMediaAssetUrlsForWorkIds,
  fetchMediaAssets,
  syncSampleMovieAssetsForWorkIds,
} from "./xGrowthMediaOperations";
import { applyRankingHistory } from "./xGrowthDailySelection";
import {
  VIDEO_QUALITY_EVALUATION_WORK_LIMIT,
  X_GROWTH_PINNED_EVALUATION_WORK_IDS,
  cheapCandidatePrefilter,
  isOfficialEligibleVideoCandidate,
  officialVideoWorkIds,
  preserveDecisionLanesBeforeLimit,
} from "./xGrowthEligibility";
import { compareOpportunitiesByPeakScore, expandCreativeSupply, scoreOpportunity } from "./xGrowthOpportunityScoring";
import { fetchRankingSnapshotHistory, getPostedWorkIds } from "./xGrowthOperations";
import { withCreativeQuality } from "./xGrowthCreativeQuality";
import { getXPostCandidates, type XPostCandidate } from "./xPostPlanner";
import type { XPostLog } from "./xPostLogs";
import { isFanzaXGrowthTechnicalSampleMovie } from "./xMediaAssets";
import type { XGrowthOpportunity } from "./xGrowthOS";
import { syncAndProbeCandidateMedia } from "./xGrowthMediaPreflight";

export type XGrowthVideoCandidateEvaluation = {
  evaluatedWorks: number;
  hardGatePassedWorks: number;
  candidates: Array<{
    workId: number;
    title: string;
    sampleUrlOfficial: boolean;
    hardGatePassed: boolean;
    firstDropReason: string | null;
    rankingScore: number;
    freshnessScore: number;
    discountRate: number;
    saleEndAt: string | null;
    creativeQualityScore: number;
  }>;
  failureCounts: Record<string, number>;
  pipeline: Record<string, number>;
};

/**
 * Evaluate the dedicated video pool without running or persisting the daily Top Picks plan.
 * This deliberately keeps candidate-pool work separate from the existing Top Picks allocator.
 */
export async function buildXGrowthVideoCandidateEvaluation(logs: XPostLog[]): Promise<XGrowthVideoCandidateEvaluation> {
  const evaluationLimit = VIDEO_QUALITY_EVALUATION_WORK_LIMIT;
  const posted = await getPostedWorkIds();
  const candidateResult = await getXPostCandidates([], logs, posted.workIds);
  const isOfficialVideoCandidate = (item: Pick<XPostCandidate, "sampleMovieUrl">) =>
    Boolean(item.sampleMovieUrl) && isFanzaXGrowthTechnicalSampleMovie(undefined, item.sampleMovieUrl).usable;
  const candidateVideoIds = new Set(candidateResult.candidates.filter(isOfficialVideoCandidate).map((item) => item.workId));
  const videoWorkIdsToProbe = candidateResult.candidates
    .filter((item) => Boolean(item.sampleMovieUrl))
    .map((item) => item.workId);
  await syncAndProbeCandidateMedia(
    videoWorkIdsToProbe,
    syncSampleMovieAssetsForWorkIds,
    checkMediaAssetUrlsForWorkIds,
    100,
  );
  const expandedCandidates = expandCreativeSupply(candidateResult.candidates);
  const expandedVideoIds = new Set(expandedCandidates.filter(isOfficialVideoCandidate).map((item) => item.workId));
  const scoredAll = expandedCandidates.map(scoreOpportunity).sort(compareOpportunitiesByPeakScore);
  const scored = preserveDecisionLanesBeforeLimit(scoredAll, evaluationLimit, X_GROWTH_PINNED_EVALUATION_WORK_IDS);
  const [media, rankingHistories] = await Promise.all([
    fetchMediaAssets(scored.map((item) => item.workId)),
    fetchRankingSnapshotHistory(scored.map((item) => item.workId)),
  ]);
  const currentSampleUrls = new Set(scored
    .filter((item) => item.sampleMovieUrl)
    .map((item) => `${item.workId}:${item.sampleMovieUrl}`));
  const currentUrlMediaAssets = new Map([...media.assets].filter(([workId, asset]) =>
    currentSampleUrls.has(`${workId}:${asset.source_url}`)));
  const mediaEligible = applyMediaEligibility(scored, currentUrlMediaAssets);
  const rankedOpportunities = applyRankingHistory(mediaEligible, rankingHistories.histories);
  const narrowedOpportunities = cheapCandidatePrefilter(rankedOpportunities, evaluationLimit);
  const opportunities = narrowedOpportunities.map((item) => withCreativeQuality(item, logs));

  const scoreWindowVideoIds = officialVideoWorkIds(scored);
  const afterMediaVideoIds = officialVideoWorkIds(rankedOpportunities);
  const prefilterVideoIds = officialVideoWorkIds(narrowedOpportunities);
  const qualityVideoWorkIds = officialVideoWorkIds(opportunities);
  const hardGateVideoIds = new Set(opportunities
    .filter((item) => isOfficialEligibleVideoCandidate(item)
      && item.creativeVariants.some((variant) => variant.mediaType === "sample_movie" && variant.quality.passed))
    .map((item) => item.workId));
  const videoQualityFailureCounts: Record<string, number> = {};
  for (const item of opportunities) {
    if (!isOfficialEligibleVideoCandidate(item)) continue;
    for (const variant of item.creativeVariants.filter((candidate) => candidate.mediaType === "sample_movie" && !candidate.quality.passed)) {
      for (const axis of variant.quality.gate.failed) {
        const key = `axis:${axis}`;
        videoQualityFailureCounts[key] = (videoQualityFailureCounts[key] ?? 0) + 1;
      }
      for (const reason of variant.quality.lastMile.reasons) {
        const key = `last-mile:${reason}`;
        videoQualityFailureCounts[key] = (videoQualityFailureCounts[key] ?? 0) + 1;
      }
    }
  }

  const candidateByWorkId = new Map(candidateResult.candidates.map((item) => [item.workId, item]));
  const opportunityByWorkId = new Map<number, XGrowthOpportunity>();
  for (const item of opportunities) {
    if (!isOfficialEligibleVideoCandidate(item)) continue;
    const current = opportunityByWorkId.get(item.workId);
    const currentQuality = Math.max(0, ...(current?.creativeVariants
      .filter((variant) => variant.mediaType === "sample_movie" && variant.quality.passed)
      .map((variant) => variant.quality.total) ?? []));
    const nextQuality = Math.max(0, ...item.creativeVariants
      .filter((variant) => variant.mediaType === "sample_movie" && variant.quality.passed)
      .map((variant) => variant.quality.total));
    if (!current || nextQuality > currentQuality) opportunityByWorkId.set(item.workId, item);
  }

  const candidates = [...candidateVideoIds].map((workId) => {
    const candidate = candidateByWorkId.get(workId);
    const opportunity = opportunityByWorkId.get(workId);
    const expanded = expandedVideoIds.has(workId);
    const scoreWindow = scoreWindowVideoIds.has(workId);
    const afterMedia = afterMediaVideoIds.has(workId);
    const prefilter = prefilterVideoIds.has(workId);
    const hardGatePassed = hardGateVideoIds.has(workId);
    const firstDropReason = !expanded ? "creative_supply_expansion"
      : !scoreWindow ? "shared_score_window"
        : !afterMedia ? "current_url_media_eligibility"
          : !prefilter ? "shared_quality_prefilter"
            : !hardGatePassed ? "creative_quality_gate" : null;
    const creativeQualityScore = Math.max(0, ...(opportunity?.creativeVariants
      .filter((variant) => variant.mediaType === "sample_movie" && variant.quality.passed)
      .map((variant) => variant.quality.total) ?? []));
    return {
      workId,
      title: candidate?.title ?? `作品 ${workId}`,
      sampleUrlOfficial: true,
      hardGatePassed,
      firstDropReason,
      rankingScore: candidate?.score ?? 0,
      freshnessScore: opportunity?.freshness.total ?? 0,
      discountRate: candidate?.discountRate ?? 0,
      saleEndAt: candidate?.saleEndAt ?? null,
      creativeQualityScore,
    };
  });
  const hardGatePassedWorks = hardGateVideoIds.size;

  return {
    evaluatedWorks: qualityVideoWorkIds.size,
    hardGatePassedWorks,
    candidates,
    failureCounts: videoQualityFailureCounts,
    pipeline: {
      candidateWorks: candidateVideoIds.size,
      expandedWorks: expandedVideoIds.size,
      scoreWindowWorks: scoreWindowVideoIds.size,
      afterMediaWorks: afterMediaVideoIds.size,
      prefilterWorks: prefilterVideoIds.size,
      qualityEvaluatedWorks: qualityVideoWorkIds.size,
      hardGatePassedWorks,
    },
  };
}
