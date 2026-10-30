import { decideCreativeStrategy, mediaPlanFor } from "@/lib/myfansCreativePlan";
import type { buildMyfansLearning } from "@/lib/myfansLearning";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { isUsableQuoteMedia, normalizeSourceUrl, quoteOpportunityBody, topicIdentityFor, topicSemanticKeyFor } from "@/lib/myfansQuotePool";
import type { buildMyfansQuotePool } from "@/lib/myfansQuotePool";
import type { buildMyfansCandidatePoolContext } from "@/lib/myfansCandidatePool";
import { resolveMyfansCandidateProduct } from "./myfansCandidateResolution";
import { attentionScoreFor, bodyFor, hookIntelligence, sourceSpecificityScore } from "@/lib/myfansCandidateCopy";
import { topicThresholdFor } from "@/lib/myfansTopicValue";
import type { buildTopicBaselines } from "@/lib/myfansTopicValue";
import { publicCopyFactsFor, publicCopyInputHash } from "@/lib/myfansPublicCopyFacts";
import { roleFor } from "@/lib/myfansCopyHelpers";
import { copySearchAngleFor, reactionTypeFor, roleFitsReasonToCare, visualUnderstandingFor } from "@/lib/myfansCreativeEvidence";
import type { MyfansCreativeStrategy, MyfansGrowthStage, MyfansLinkStrategy, RotationItem } from "./myfansGrowthStrategy";
import { evaluateMyfansCandidateTopicValue, qualityForMyfansCandidate } from "./myfansCandidateEvaluation";
import { buildMyfansCandidateRecord } from "./myfansCandidateRecord";
import { resolveMyfansAttemptRequest, resolveMyfansPostingRoute } from "./myfansAttemptRequest";

export { fallbackMyfansPostTypes } from "./myfansAttemptRequest";



export const MYFANS_PUBLIC_COPY_GENERATOR_VERSION = "public-copy-v16-complete-source-phrases";

export const MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC = 6;

function angleVariantSeed(slotIndex: number, attempt: number) {
  const topicRound = Math.floor(attempt / MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC);
  const angleIndex = attempt % MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC;
  return slotIndex * 17 + topicRound * 11 + angleIndex;
}

export type MyfansCandidateBuildContext = {
  analytics: MyfansAnalytics;
  day: number;
  growthQuotePool: ReturnType<typeof buildMyfansQuotePool>["global"];
  learning: ReturnType<typeof buildMyfansLearning>;
  planDate: string;
  pickProduct: ReturnType<typeof buildMyfansCandidatePoolContext>["pickProduct"];
  productForQuote: ReturnType<typeof buildMyfansCandidatePoolContext>["productForQuote"];
  productionLinkageEvidence: MyfansAnalytics["productLinkageEvidence"];
  quoteBySlot: Map<string, MyfansQuoteCandidate>;
  quoteForAttempt: (product: MyfansProduct | null, postType: string, index: number, attempt: number) => MyfansQuoteCandidate | null;
  resolverExactQuotes: MyfansQuoteCandidate[];
  stage: MyfansGrowthStage;
  topicBaselines: ReturnType<typeof buildTopicBaselines>;
};

function selectMyfansAttemptProduct(
  context: MyfansCandidateBuildContext,
  input: {
    directGrowthQuote: MyfansQuoteCandidate | null;
    needsAffiliateUrl: boolean;
    requestedPostType: string;
    index: number;
    attempt: number;
    excludedProducts: Set<number>;
  },
) {
  const { directGrowthQuote, needsAffiliateUrl, requestedPostType, index, attempt, excludedProducts } = input;
  const { productionLinkageEvidence, productForQuote, pickProduct } = context;
  const hasExactQuoteProductLink = Boolean(directGrowthQuote && (
    directGrowthQuote.product_id ||
    productionLinkageEvidence.some((evidence) =>
      evidence.confidence === "exact" &&
      Boolean(evidence.product_id) &&
      normalizeSourceUrl(evidence.source_status_url) === normalizeSourceUrl(directGrowthQuote.x_post_url),
    )
  ));
  // A creator/account match is not a product linkage. Keep a quote with
  // product_id=null as a productless discovery candidate unless an exact
  // product relation is already recorded in DB or resolver evidence.
  const linkedQuoteProduct = directGrowthQuote && hasExactQuoteProductLink ? productForQuote(directGrowthQuote) : null;
  // Keep an eligible but not-yet-linked quote as a discovery opportunity.
  // Do not silently attach it to an unrelated product.
  const scored = linkedQuoteProduct ?? (directGrowthQuote && !needsAffiliateUrl
    ? null
    : pickProduct(needsAffiliateUrl, index + attempt, requestedPostType, excludedProducts));
  return {
    scored,
    product: scored?.product ?? null,
    quoteProductMatched: Boolean(directGrowthQuote && linkedQuoteProduct),
  };
}

type MyfansCandidateCopyInput = {
  analytics: MyfansAnalytics;
  attempt: number;
  directGrowthQuote: MyfansQuoteCandidate | null;
  index: number;
  linkStrategy: MyfansLinkStrategy;
  postType: string;
  product: MyfansProduct | null;
  quoteForAttempt: MyfansCandidateBuildContext["quoteForAttempt"];
  topicBaselines: ReturnType<typeof buildTopicBaselines>;
};

function buildMyfansCandidateCopy(input: MyfansCandidateCopyInput) {
  const angleVariant = angleVariantSeed(input.index, input.attempt);
  const quoteForSlot = selectCandidateQuote(input);
  const evidence = buildCandidateCopyEvidence(input, angleVariant, quoteForSlot);
  const topic = buildCandidateCopyTopic(input, angleVariant, quoteForSlot, evidence);
  return {
    attention: evidence.attention,
    body: topic.body,
    copyAngle: topic.copyAngle,
    copyInputHash: evidence.copyInputHash,
    creative: evidence.creative,
    dailyRole: evidence.dailyRole,
    hook: evidence.hook,
    mediaPlan: evidence.mediaPlan,
    publicCopyFacts: evidence.publicCopyFacts,
    quality: topic.quality,
    quoteForSlot,
    reactionType: evidence.reactionType,
    sourceSpecificity: topic.sourceSpecificity,
    topicIdentity: topic.topicIdentity,
    topicSemanticKey: topic.topicSemanticKey,
    topicValue: topic.topicValue,
    visualUnderstanding: evidence.visualUnderstanding,
  };
}

function selectCandidateQuote(input: MyfansCandidateCopyInput) {
  if (input.directGrowthQuote && input.postType === "discovery_interest") return input.directGrowthQuote;
  return input.quoteForAttempt(input.product, input.postType, input.index, input.attempt);
}

function quoteXUrlForCandidate(quote: MyfansQuoteCandidate | null, postType: string) {
  const quotePostType = postType === "discovery_interest" || postType === "profile_cta" || postType === "comparison_review";
  return quote && isUsableQuoteMedia(quote) && quote.visual_analysis_status === "verified" && quotePostType
    ? quote.x_post_url
    : "";
}

function buildCandidateCopyEvidence(
  input: MyfansCandidateCopyInput,
  angleVariant: number,
  quoteForSlot: MyfansQuoteCandidate | null,
) {
  const quoteXUrl = quoteXUrlForCandidate(quoteForSlot, input.postType);
  const creative = candidateCreativeEvidence(input, quoteForSlot, quoteXUrl);
  const observed = candidateObservedEvidence(input, angleVariant, quoteForSlot, creative.evidenceQuote);
  return { angleVariant, ...creative, ...observed };
}

function candidateCreativeEvidence(
  input: MyfansCandidateCopyInput,
  quoteForSlot: MyfansQuoteCandidate | null,
  quoteXUrl: string,
) {
  const creative = input.product
    ? decideCreativeStrategy(input.product, input.postType, input.linkStrategy, quoteXUrl)
    : null;
  const evidenceQuote = quoteForSlot ?? null;
  const dailyRole = roleFor(input.postType, input.linkStrategy, creative?.strategy ?? "text_only");
  const mediaPlan = input.product && creative
    ? mediaPlanFor(input.product, input.postType, input.linkStrategy)
    : null;
  return { creative, dailyRole, evidenceQuote, mediaPlan };
}

function candidateObservedEvidence(
  input: MyfansCandidateCopyInput,
  angleVariant: number,
  quoteForSlot: MyfansQuoteCandidate | null,
  evidenceQuote: MyfansQuoteCandidate | null,
) {
  const hook = input.product ? hookIntelligence(input.product, quoteForSlot) : null;
  const attention = input.product ? attentionScoreFor(input.product, quoteForSlot, input.analytics) : null;
  const publicCopyFacts = input.product ? publicCopyFactsFor(input.product, evidenceQuote) : null;
  const visualUnderstanding = publicCopyFacts ? visualUnderstandingFor(publicCopyFacts) : null;
  const reactionType = publicCopyFacts ? reactionTypeFor(publicCopyFacts, angleVariant) : null;
  const copyInputHash = publicCopyFacts ? publicCopyInputHash(publicCopyFacts) : "";
  return { attention, copyInputHash, hook, publicCopyFacts, reactionType, visualUnderstanding };
}

function candidateBodyForTopic(input: {
  product: MyfansProduct | null;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creativeStrategy: MyfansCreativeStrategy;
  evidenceQuote: MyfansQuoteCandidate | null;
  quoteForSlot: MyfansQuoteCandidate | null;
  topicValue: ReturnType<typeof evaluateMyfansCandidateTopicValue>["topicValue"];
  topicCopyFitFailed: boolean;
  angleVariant: number;
}) {
  const { product, postType, linkStrategy, creativeStrategy, evidenceQuote, quoteForSlot, topicValue, topicCopyFitFailed, angleVariant } = input;
  if (product && topicValue?.verdict === "PASS" && !topicCopyFitFailed) {
    return bodyFor(product, postType, linkStrategy, creativeStrategy, evidenceQuote, topicValue, angleVariant);
  }
  if (!product && quoteForSlot && topicValue?.verdict === "PASS") {
    return quoteOpportunityBody(quoteForSlot, angleVariant);
  }
  return "";
}

function buildCandidateCopyTopic(
  input: MyfansCandidateCopyInput,
  angleVariant: number,
  quoteForSlot: MyfansQuoteCandidate | null,
  evidence: ReturnType<typeof buildCandidateCopyEvidence>,
) {
  const { product, topicBaselines, postType, linkStrategy } = input;
  const { evidenceQuote, dailyRole, visualUnderstanding } = evidence;
  const { guardedTopicValue, topicValue } = evaluateMyfansCandidateTopicValue({
    product,
    quote: quoteForSlot,
    evidenceQuote,
    role: dailyRole,
    baselines: topicBaselines,
    visualUnderstanding,
  });
  const topicIdentity = product
    ? topicIdentityFor(product, evidenceQuote, topicValue?.reasonToCare)
    : quoteForSlot
      ? `quote:${quoteForSlot.id}`
      : "";
  const topicSemanticKey = product
    ? topicSemanticKeyFor(product, evidenceQuote, topicValue)
    : quoteForSlot
      ? `quote-event:${normalizeSourceUrl(quoteForSlot.x_post_url)}`
      : "";
  const copyAngle = copySearchAngleFor(topicValue?.reasonToCare, angleVariant);
  const topicCopyFitFailed = topicValue?.verdict === "PASS" && !roleFitsReasonToCare(dailyRole, topicValue.reasonToCare);
  const body = candidateBodyForTopic({
    product,
    postType,
    linkStrategy,
    creativeStrategy: evidence.creative?.strategy ?? "text_only",
    evidenceQuote,
    quoteForSlot,
    topicValue,
    topicCopyFitFailed,
    angleVariant,
  });
  const sourceSpecificity = sourceSpecificityScore(body, evidenceQuote, visualUnderstanding);
  const quality = qualityForMyfansCandidate({
    body,
    product,
    postType,
    linkStrategy,
    creative: evidence.creative,
    quote: quoteForSlot,
    topicValue,
    guardedTopicValue,
    topicCopyFitFailed,
    dailyRole,
    sourceSpecificity,
    attention: evidence.attention,
    hook: evidence.hook,
  });
  return { body, copyAngle, quality, sourceSpecificity, topicIdentity, topicSemanticKey, topicValue };
}
export type MyfansCandidateCopyResult = ReturnType<typeof buildMyfansCandidateCopy>;

export function buildMyfansCandidate(
  context: MyfansCandidateBuildContext,
  item: RotationItem,
  index: number,
  attempt: number,
  excludedProducts: Set<number>,
  forcedQuote: MyfansQuoteCandidate | null = null,
) {
  const {
    analytics,
    day,
    learning,
    planDate,
    quoteForAttempt,
    stage,
    topicBaselines,
  } = context;
    const {
      requestedPostType,
      requestedLinkStrategy,
      needsAffiliateUrl,
      directGrowthQuote,
    } = resolveMyfansAttemptRequest(context, item, index, attempt, forcedQuote);
    const { scored, product, quoteProductMatched } = selectMyfansAttemptProduct(context, {
      directGrowthQuote,
      needsAffiliateUrl,
      requestedPostType,
      index,
      attempt,
      excludedProducts,
    });
    const { hasRevenueTarget, linkStrategy, objective, postType, cta, role } = resolveMyfansPostingRoute({
      item,
      product,
      needsAffiliateUrl,
      requestedPostType,
      requestedLinkStrategy,
    });
    const creativeVariantId = `${analytics.selectedMediaId ?? "all"}-${planDate}-day-${day}-${stage}-${MYFANS_PUBLIC_COPY_GENERATOR_VERSION}-${postType}-${linkStrategy}-${index + 1}-try-${attempt + 1}`;
    const copy = buildMyfansCandidateCopy({
      analytics,
      attempt,
      directGrowthQuote,
      index,
      linkStrategy,
      postType,
      product,
      quoteForAttempt,
      topicBaselines,
    });
    const { dailyRole, quoteForSlot } = copy;
    const topicThreshold = topicThresholdFor(dailyRole);
    const resolution = resolveMyfansCandidateProduct({
      analytics,
      product,
      productionLinkageEvidence: context.productionLinkageEvidence,
      quote: quoteForSlot,
      dailyRole,
    });
    return buildMyfansCandidateRecord({
      analytics,
      attempt,
      cta,
      creativeVariantId,
      copy,
      generatorVersion: MYFANS_PUBLIC_COPY_GENERATOR_VERSION,
      hasRevenueTarget,
      index,
      item,
      learning,
      linkStrategy,
      multiAngleAttempt: attempt % MYFANS_MULTI_ANGLE_ATTEMPTS_PER_TOPIC + 1,
      needsAffiliateUrl,
      objective,
      postType,
      product,
      quoteProductMatched,
      resolution,
      role,
      scored,
      stage,
      topicThreshold,
    });

}
