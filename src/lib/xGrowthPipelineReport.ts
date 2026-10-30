import type { XDailyTopPick, XGrowthOpportunity } from "./xGrowthTypes";
import type { XPostCandidate } from "./xPostPlanner";
import { isOfficialFanzaDmmSampleUrl } from "./xMediaAssets";
import {
  VIDEO_QUALITY_EVALUATION_WORK_LIMIT,
  isAllowedXGrowthMediaType,
  isOfficialEligibleVideoCandidate,
  isSoftQualityEligible,
  officialVideoWorkIds,
} from "./xGrowthEligibility";
import {
  buildXGrowthVideoWorkStages,
  countXGrowthVideoQualityFailures,
  type XGrowthVideoWorkStage,
} from "./xGrowthVideoWorkStages";

export type XGrowthPipelineCounts = {
  rawCandidates: number;
  afterPosted: number;
  afterStale: number;
  afterMedia: number;
  realMediaEligible: number;
  videoEligible: number;
  imageEligible: number;
  hardGatePassed: number;
  softQualityEligible: number;
  videoCandidateWorks: number;
  videoExpandedWorks: number;
  videoScoreWindowWorks: number;
  videoAfterMediaWorks: number;
  videoPrefilterWorks: number;
  videoQualityEvaluatedWorks: number;
  videoHardGatePassedWorks: number;
  videoFivePickCapacity: number;
  videoFivePickShortage: number;
  videoTenWorkShortage: number;
  videoHardGateSelectedWorks: number;
  videoMinimumShortage: number;
  videoNormalShortage: number;
  videoQualityEvaluationReserve: number;
  afterSemantic: number;
  slotEligible: number;
  finalSelected: number;
};

type PipelineOpportunity = Pick<
  XGrowthOpportunity,
  | "workId"
  | "canNativeVideo"
  | "mediaAsset"
  | "sampleMovieUrl"
  | "mediaType"
  | "recommendedMediaUrl"
  | "imageUrl"
  | "freshness"
  | "creativeVariants"
>;

type PipelineCandidate = Pick<XPostCandidate, "workId" | "title" | "score" | "discountRate" | "saleEndAt" | "sampleMovieUrl">;

type PipelinePick = Pick<XDailyTopPick, "workId" | "mediaType" | "creativeVariantId" | "creativeVariants">;

type PipelineReportInput = {
  candidates: readonly PipelineCandidate[];
  expandedCandidates: readonly PipelineCandidate[];
  scored: readonly PipelineOpportunity[];
  rankedOpportunities: readonly PipelineOpportunity[];
  prefilterOpportunities: readonly PipelineOpportunity[];
  opportunities: readonly PipelineOpportunity[];
  selectedPicks: readonly PipelinePick[];
  slotEligibleCount: number;
  finalSelectedCount: number;
};

export function buildXGrowthPipelineReport(input: PipelineReportInput): {
  pipeline: XGrowthPipelineCounts;
  videoQualityFailureCounts: Record<string, number>;
  videoWorkStages: XGrowthVideoWorkStage[];
} {
  const candidateVideoIds = candidateVideoWorkIds(input.candidates);
  const expandedVideoIds = candidateVideoWorkIds(input.expandedCandidates);
  const scoreWindowVideoIds = officialVideoWorkIds(input.scored);
  const afterMediaVideoIds = officialVideoWorkIds(input.rankedOpportunities);
  const prefilterVideoIds = officialVideoWorkIds(input.prefilterOpportunities);
  const qualityVideoWorkIds = officialVideoWorkIds(input.opportunities);
  const hardGateVideoIds = hardGatePassedVideoWorkIds(input.opportunities);
  const selectedHardGateVideoIds = selectedHardGateVideoWorkIds(input.selectedPicks);

  const videoWorkStages = buildXGrowthVideoWorkStages({
    candidateVideoIds,
    expandedVideoIds,
    scoreWindowVideoIds,
    afterMediaVideoIds,
    prefilterVideoIds,
    qualityVideoWorkIds,
    hardGateVideoIds,
    selectedHardGateVideoIds,
    candidateByVideoWorkId: new Map(input.candidates.map((item) => [item.workId, item])),
    opportunityByVideoWorkId: new Map(input.opportunities.map((item) => [item.workId, item])),
  });

  return {
    pipeline: pipelineCountsFor(input, {
      candidateVideoIds,
      expandedVideoIds,
      scoreWindowVideoIds,
      afterMediaVideoIds,
      prefilterVideoIds,
      qualityVideoWorkIds,
      hardGateVideoIds,
      selectedHardGateVideoIds,
    }),
    videoQualityFailureCounts: countXGrowthVideoQualityFailures(input.opportunities, qualityVideoWorkIds),
    videoWorkStages,
  };
}

function candidateVideoWorkIds(candidates: readonly PipelineCandidate[]) {
  return new Set(candidates
    .filter((item) => isOfficialFanzaDmmSampleUrl(item.sampleMovieUrl))
    .map((item) => item.workId));
}

function hardGatePassedVideoWorkIds(opportunities: readonly PipelineOpportunity[]) {
  return new Set(opportunities
    .filter((item) => isOfficialEligibleVideoCandidate(item) && item.creativeVariants.some((variant) => variant.mediaType === "sample_movie" && variant.quality.passed))
    .map((item) => item.workId));
}

function selectedHardGateVideoWorkIds(picks: readonly PipelinePick[]) {
  return new Set(picks
    .filter((pick) => pick.mediaType === "sample_movie")
    .filter((pick) => pick.creativeVariants.find((variant) => variant.id === pick.creativeVariantId)?.quality.passed)
    .map((pick) => pick.workId));
}

function countWhere<TItem>(items: readonly TItem[], predicate: (item: TItem) => boolean) {
  return items.filter(predicate).length;
}

function pipelineCountsFor(
  input: PipelineReportInput,
  videoWorkIds: {
    candidateVideoIds: ReadonlySet<number>;
    expandedVideoIds: ReadonlySet<number>;
    scoreWindowVideoIds: ReadonlySet<number>;
    afterMediaVideoIds: ReadonlySet<number>;
    prefilterVideoIds: ReadonlySet<number>;
    qualityVideoWorkIds: ReadonlySet<number>;
    hardGateVideoIds: ReadonlySet<number>;
    selectedHardGateVideoIds: ReadonlySet<number>;
  },
): XGrowthPipelineCounts {
  const opportunities = input.opportunities;
  const hardGatePassedVideoWorks = videoWorkIds.hardGateVideoIds.size;
  const selectedVideoWorks = videoWorkIds.selectedHardGateVideoIds.size;

  return {
    rawCandidates: input.candidates.length,
    afterPosted: input.candidates.length,
    afterStale: countWhere(input.rankedOpportunities, (item) => item.freshness.status !== "expired"),
    afterMedia: countWhere(input.rankedOpportunities, hasImageOrSampleUrl),
    realMediaEligible: countWhere(opportunities, (item) => isAllowedXGrowthMediaType(item.mediaType)),
    videoEligible: countWhere(opportunities, (item) => item.mediaType === "sample_movie"),
    imageEligible: countWhere(opportunities, (item) => item.mediaType === "existing_link_image"),
    hardGatePassed: countWhere(opportunities, hasPassedCreativeVariant),
    softQualityEligible: countWhere(opportunities, hasSoftQualityVariant),
    videoCandidateWorks: videoWorkIds.candidateVideoIds.size,
    videoExpandedWorks: videoWorkIds.expandedVideoIds.size,
    videoScoreWindowWorks: videoWorkIds.scoreWindowVideoIds.size,
    videoAfterMediaWorks: videoWorkIds.afterMediaVideoIds.size,
    videoPrefilterWorks: videoWorkIds.prefilterVideoIds.size,
    videoQualityEvaluatedWorks: videoWorkIds.qualityVideoWorkIds.size,
    videoHardGatePassedWorks: hardGatePassedVideoWorks,
    videoFivePickCapacity: Math.min(5, hardGatePassedVideoWorks),
    videoFivePickShortage: Math.max(0, 5 - hardGatePassedVideoWorks),
    videoTenWorkShortage: Math.max(0, 10 - hardGatePassedVideoWorks),
    videoHardGateSelectedWorks: selectedVideoWorks,
    videoMinimumShortage: Math.max(0, 2 - selectedVideoWorks),
    videoNormalShortage: Math.max(0, 3 - selectedVideoWorks),
    videoQualityEvaluationReserve: VIDEO_QUALITY_EVALUATION_WORK_LIMIT,
    afterSemantic: input.slotEligibleCount,
    slotEligible: input.slotEligibleCount,
    finalSelected: input.finalSelectedCount,
  };
}

function hasImageOrSampleUrl(item: PipelineOpportunity) {
  return Boolean(item.sampleMovieUrl || item.imageUrl);
}

function hasPassedCreativeVariant(item: PipelineOpportunity) {
  return item.creativeVariants.some((variant) => variant.quality.passed);
}

function hasSoftQualityVariant(item: PipelineOpportunity) {
  return item.creativeVariants.some(isSoftQualityEligible);
}
