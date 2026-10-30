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
import { syncAndProbeCandidateMedia } from "./xGrowthMediaPreflight";
import {
  buildXGrowthVideoCandidateSignals,
  collectHardGatePassedVideoIds,
  collectVideoQualityFailureCounts,
  selectBestVideoOpportunityByWorkId,
} from "./xGrowthVideoCandidateSummary";

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
  const eligibleVideoOpportunities = opportunities.filter(isOfficialEligibleVideoCandidate);
  const hardGateVideoIds = collectHardGatePassedVideoIds(eligibleVideoOpportunities);
  const videoQualityFailureCounts = collectVideoQualityFailureCounts(eligibleVideoOpportunities);
  const candidateByWorkId = new Map(candidateResult.candidates.map((item) => [item.workId, item]));
  const opportunityByWorkId = selectBestVideoOpportunityByWorkId(eligibleVideoOpportunities);
  const candidates = buildXGrowthVideoCandidateSignals(candidateVideoIds, candidateByWorkId, opportunityByWorkId, {
    expandedVideoIds,
    scoreWindowVideoIds,
    afterMediaVideoIds,
    prefilterVideoIds,
    hardGateVideoIds,
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
