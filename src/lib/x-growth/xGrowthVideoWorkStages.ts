type CandidateStageDetails = {
  title?: string | null;
  score?: number | null;
  discountRate?: number | null;
  saleEndAt?: string | null;
};

type OpportunityStageDetails = {
  freshness?: { total?: number | null } | null;
  creativeVariants?: ReadonlyArray<{
    mediaType?: string | null;
    quality?: { passed?: boolean; total?: number | null } | null;
  }> | null;
};

export type XGrowthVideoWorkStage = {
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
};

export function buildXGrowthVideoWorkStages<TCandidate extends CandidateStageDetails, TOpportunity extends OpportunityStageDetails>({
  candidateVideoIds,
  expandedVideoIds,
  scoreWindowVideoIds,
  afterMediaVideoIds,
  prefilterVideoIds,
  qualityVideoWorkIds,
  hardGateVideoIds,
  selectedHardGateVideoIds,
  candidateByVideoWorkId,
  opportunityByVideoWorkId,
}: {
  candidateVideoIds: ReadonlySet<number>;
  expandedVideoIds: ReadonlySet<number>;
  scoreWindowVideoIds: ReadonlySet<number>;
  afterMediaVideoIds: ReadonlySet<number>;
  prefilterVideoIds: ReadonlySet<number>;
  qualityVideoWorkIds: ReadonlySet<number>;
  hardGateVideoIds: ReadonlySet<number>;
  selectedHardGateVideoIds: ReadonlySet<number>;
  candidateByVideoWorkId: ReadonlyMap<number, TCandidate>;
  opportunityByVideoWorkId: ReadonlyMap<number, TOpportunity>;
}): XGrowthVideoWorkStage[] {
  return [...candidateVideoIds].map((workId) => buildVideoWorkStage(workId, {
    expanded: expandedVideoIds.has(workId),
    scoreWindow: scoreWindowVideoIds.has(workId),
    afterMedia: afterMediaVideoIds.has(workId),
    prefilter: prefilterVideoIds.has(workId),
    qualityEvaluated: qualityVideoWorkIds.has(workId),
    hardGatePassed: hardGateVideoIds.has(workId),
    finalSelected: selectedHardGateVideoIds.has(workId),
    candidateDetails: candidateByVideoWorkId.get(workId),
    opportunityDetails: opportunityByVideoWorkId.get(workId),
  }));
}

function buildVideoWorkStage<TCandidate extends CandidateStageDetails, TOpportunity extends OpportunityStageDetails>(
  workId: number,
  stage: {
    expanded: boolean;
    scoreWindow: boolean;
    afterMedia: boolean;
    prefilter: boolean;
    qualityEvaluated: boolean;
    hardGatePassed: boolean;
    finalSelected: boolean;
    candidateDetails: TCandidate | undefined;
    opportunityDetails: TOpportunity | undefined;
  },
): XGrowthVideoWorkStage {
  const firstDropReason = firstVideoDropReason(stage);
  return {
    workId,
    title: stage.candidateDetails?.title ?? `作品 ${workId}`,
    sampleUrlOfficial: true,
    candidate: true,
    expanded: stage.expanded,
    scoreWindow: stage.scoreWindow,
    afterMedia: stage.afterMedia,
    prefilter: stage.prefilter,
    qualityEvaluated: stage.qualityEvaluated,
    hardGatePassed: stage.hardGatePassed,
    finalSelected: stage.finalSelected,
    rankingScore: stage.candidateDetails?.score ?? 0,
    freshnessScore: stage.opportunityDetails?.freshness?.total ?? 0,
    discountRate: stage.candidateDetails?.discountRate ?? 0,
    saleEndAt: stage.candidateDetails?.saleEndAt ?? null,
    creativeQualityScore: bestVideoQualityScore(stage.opportunityDetails),
    firstDropReason,
  };
}

function firstVideoDropReason(stage: {
  expanded: boolean;
  scoreWindow: boolean;
  afterMedia: boolean;
  prefilter: boolean;
  hardGatePassed: boolean;
  finalSelected: boolean;
}) {
  if (!stage.expanded) return "creative_supply_expansion";
  if (!stage.scoreWindow) return "shared_score_window";
  if (!stage.afterMedia) return "current_url_media_eligibility";
  if (!stage.prefilter) return "shared_quality_prefilter";
  if (!stage.hardGatePassed) return "creative_quality_gate";
  if (!stage.finalSelected) return "final_slot_diversity_or_ranking";
  return null;
}

function bestVideoQualityScore(opportunity: OpportunityStageDetails | undefined) {
  return Math.max(0, ...(opportunity?.creativeVariants
    ?.filter((variant) => variant.mediaType === "sample_movie" && variant.quality?.passed)
    .map((variant) => variant.quality?.total ?? 0) ?? []));
}

type QualityFailureItem = {
  workId: number;
  creativeVariants: ReadonlyArray<{
    mediaType: string;
    quality: {
      passed: boolean;
      gate: { failed: readonly string[] };
      lastMile: { reasons: readonly string[] };
    };
  }>;
};

export function countXGrowthVideoQualityFailures<TItem extends QualityFailureItem>(
  items: readonly TItem[],
  videoWorkIds: ReadonlySet<number>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (!videoWorkIds.has(item.workId)) continue;
    for (const variant of item.creativeVariants) {
      if (variant.mediaType !== "sample_movie" || variant.quality.passed) continue;
      for (const axis of variant.quality.gate.failed) {
        const key = `axis:${axis}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      for (const reason of variant.quality.lastMile.reasons) {
        const key = `last-mile:${reason}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return counts;
}
