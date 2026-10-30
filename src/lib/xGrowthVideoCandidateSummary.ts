import type { XGrowthOpportunity } from "./xGrowthTypes";
import type { XPostCandidate } from "./xPostPlanner";

type CandidateSignalSource = Pick<XPostCandidate, "workId" | "title" | "score" | "discountRate" | "saleEndAt">;

export type VideoCandidateStageSets = {
  expandedVideoIds: ReadonlySet<number>;
  scoreWindowVideoIds: ReadonlySet<number>;
  afterMediaVideoIds: ReadonlySet<number>;
  prefilterVideoIds: ReadonlySet<number>;
  hardGateVideoIds: ReadonlySet<number>;
};

function maxPassingSampleMovieQuality(opportunity: XGrowthOpportunity | undefined) {
  return Math.max(0, ...(opportunity?.creativeVariants
    .filter((variant) => variant.mediaType === "sample_movie" && variant.quality.passed)
    .map((variant) => variant.quality.total) ?? []));
}

export function collectVideoQualityFailureCounts(opportunities: XGrowthOpportunity[]) {
  const counts: Record<string, number> = {};
  const increment = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  for (const opportunity of opportunities) {
    const failedVideoVariants = opportunity.creativeVariants.filter((variant) =>
      variant.mediaType === "sample_movie" && !variant.quality.passed);
    for (const variant of failedVideoVariants) {
      for (const axis of variant.quality.gate.failed) increment(`axis:${axis}`);
      for (const reason of variant.quality.lastMile.reasons) increment(`last-mile:${reason}`);
    }
  }
  return counts;
}

export function collectHardGatePassedVideoIds(opportunities: XGrowthOpportunity[]) {
  return new Set(opportunities
    .filter((opportunity) => opportunity.creativeVariants.some((variant) =>
      variant.mediaType === "sample_movie" && variant.quality.passed))
    .map((opportunity) => opportunity.workId));
}

export function selectBestVideoOpportunityByWorkId(opportunities: XGrowthOpportunity[]) {
  const bestByWorkId = new Map<number, XGrowthOpportunity>();
  for (const opportunity of opportunities) {
    const current = bestByWorkId.get(opportunity.workId);
    if (!current || maxPassingSampleMovieQuality(opportunity) > maxPassingSampleMovieQuality(current)) {
      bestByWorkId.set(opportunity.workId, opportunity);
    }
  }
  return bestByWorkId;
}

function getFirstDropReason(workId: number, stages: VideoCandidateStageSets) {
  if (!stages.expandedVideoIds.has(workId)) return "creative_supply_expansion";
  if (!stages.scoreWindowVideoIds.has(workId)) return "shared_score_window";
  if (!stages.afterMediaVideoIds.has(workId)) return "current_url_media_eligibility";
  if (!stages.prefilterVideoIds.has(workId)) return "shared_quality_prefilter";
  if (!stages.hardGateVideoIds.has(workId)) return "creative_quality_gate";
  return null;
}

export function buildXGrowthVideoCandidateSignals(
  candidateVideoIds: ReadonlySet<number>,
  candidateByWorkId: ReadonlyMap<number, CandidateSignalSource>,
  opportunityByWorkId: ReadonlyMap<number, XGrowthOpportunity>,
  stages: VideoCandidateStageSets,
) {
  return [...candidateVideoIds].map((workId) => {
    const candidate = candidateByWorkId.get(workId);
    const opportunity = opportunityByWorkId.get(workId);
    return {
      workId,
      title: candidate?.title ?? `作品 ${workId}`,
      sampleUrlOfficial: true,
      hardGatePassed: stages.hardGateVideoIds.has(workId),
      firstDropReason: getFirstDropReason(workId, stages),
      rankingScore: candidate?.score ?? 0,
      freshnessScore: opportunity?.freshness.total ?? 0,
      discountRate: candidate?.discountRate ?? 0,
      saleEndAt: candidate?.saleEndAt ?? null,
      creativeQualityScore: maxPassingSampleMovieQuality(opportunity),
    };
  });
}
