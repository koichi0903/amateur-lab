import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "../myfansAnalytics";
import { buildMyfansLearning } from "./myfansLearning";
import { buildMyfansCandidatePoolContext } from "./myfansCandidatePool";
import { buildPermanentExclusionSets, isPermanentlyExcluded } from "../myfansPermanentExclusions";
import { buildPastUsageIndex, buildMyfansQuotePool, currentPlanDate, normalizeSourceUrl } from "./myfansQuotePool";
import { buildTopicBaselines, evaluateMyfansTopicValue } from "./myfansTopicValue";
import { hasVerifiedVisualAnalysis } from "./myfansCreativeEvidence";
import { getGrowthStage, getOperationDay, ROTATION } from "./myfansGrowthStrategy";
import { adjustRotationByLearning } from "./myfansGrowthSummary";
import { isValidRevenueProduct, roleFor } from "./myfansCopyHelpers";

type MyfansExecutionPreparationOptions = {
  planDate?: string;
  operationDay?: number;
  generationVersion?: string;
};

export function prepareMyfansExecution(
  analytics: MyfansAnalytics,
  options: MyfansExecutionPreparationOptions,
  defaultGenerationVersion: string,
  isRevenueTargetProduct: (product: MyfansProduct) => boolean,
) {
  const day = options.operationDay ?? getOperationDay();
  const planDate = options.planDate ?? currentPlanDate();
  const stage = getGrowthStage(day);
  const generationVersion = options.generationVersion ?? defaultGenerationVersion;
  const permanentExclusionSets = buildPermanentExclusionSets(analytics.permanentExclusions ?? []);
  analytics = {
    ...analytics,
    products: analytics.products.filter((product) => !permanentExclusionSets.productIds.has(product.id)),
    quoteCandidates: analytics.quoteCandidates.filter((quote) => !isPermanentlyExcluded({
      productId: quote.product_id,
      quoteCandidateId: quote.id,
      quoteXUrl: quote.x_post_url,
      sourceXUrl: quote.x_post_url,
      sets: permanentExclusionSets,
    })),
  };
  const planKey = `${analytics.selectedMediaId ?? "all"}:${planDate}:day-${day}:${stage}:${generationVersion}`;
  const learning = buildMyfansLearning(analytics);
  const rotation = adjustRotationByLearning(ROTATION[stage], stage, learning);
  const pastUsage = buildPastUsageIndex(analytics, planDate);
  const quotePool = buildMyfansQuotePool(analytics, planDate);
  // quotePool.global already contains the source-value, freshness, media/
  // public-signal, score, and cooldown gates. Do not apply a second
  // browser_visible-only gate here: eligible video/image quotes can still
  // have a render status of unknown while carrying usable media evidence.
  const growthQuotePool = quotePool.global
    .sort((a, b) =>
      Number(hasVerifiedVisualAnalysis(b.candidate)) - Number(hasVerifiedVisualAnalysis(a.candidate)) ||
      b.globalScore - a.globalScore ||
      (b.candidate.views ?? 0) - (a.candidate.views ?? 0)
    );
  const productionLinkageEvidence = analytics.productLinkageEvidence.filter((evidence) => evidence.diagnostic_mode !== true);
  const resolverExactQuotes = productionLinkageEvidence
    .filter((evidence) => evidence.confidence === "exact" && evidence.product_id)
    .sort((a, b) => Number(a.evidence_source === "db_existing") - Number(b.evidence_source === "db_existing") || String(b.verified_at).localeCompare(String(a.verified_at)))
    .map((evidence) => analytics.quoteCandidates.find((quote) => normalizeSourceUrl(quote.x_post_url) === normalizeSourceUrl(evidence.source_status_url)))
    .filter((quote): quote is MyfansQuoteCandidate => Boolean(quote));
  const topicBaselines = buildTopicBaselines(analytics);
  const quoteBySlot = new Map<string, MyfansQuoteCandidate>();
  if (stage === "day_1_7") {
    const first = quotePool.selected[0]?.candidate;
    const second = quotePool.selected[1]?.candidate;
    if (first) quoteBySlot.set("discovery_interest:0", first);
    if (second) quoteBySlot.set("profile_cta:2", second);
  }
  const candidatePoolContext = buildMyfansCandidatePoolContext(analytics, {
    planDate,
    planKey,
    topicBaselines,
    quotePool,
    productionLinkageEvidence,
    evaluateTopicValue: evaluateMyfansTopicValue,
    isValidRevenueProduct,
    isRevenueTargetProduct,
    roleForPostType: (postType) => roleFor(postType, "no_link", "text_only"),
  });
  return {
    analytics,
    day,
    planDate,
    stage,
    permanentExclusionSets,
    planKey,
    learning,
    rotation,
    pastUsage,
    quotePool,
    growthQuotePool,
    productionLinkageEvidence,
    resolverExactQuotes,
    topicBaselines,
    quoteBySlot,
    candidatePoolContext,
  };
}
