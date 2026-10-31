import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { attentionScoreFor, hookIntelligence } from "@/lib/myfans/myfansCandidateCopy";
import type { decideCreativeStrategy } from "@/lib/myfans/myfansCreativePlan";
import { compactSourceText, quoteInsight } from "@/lib/myfans/myfansCreativeEvidence";
import { evaluateMyfansTopicValue, hasConcreteSourceContext } from "@/lib/myfans/myfansTopicValue";
import type { DailyRole, buildTopicBaselines } from "@/lib/myfans/myfansTopicValue";
import { qualityScoreFor } from "@/lib/myfans/myfansPublicCopyQuality";
import { quoteOpportunityTopicValue } from "@/lib/myfans/myfansQuotePool";
import type { MyfansReasonToCare } from "@/lib/myfans/myfansQuotePool";
import type { VisualUnderstanding } from "../myfansXExecution";
import type { MyfansLinkStrategy } from "./myfansGrowthStrategy";
type TopicValueInput = {
  product: MyfansProduct | null;
  quote: MyfansQuoteCandidate | null;
  evidenceQuote: MyfansQuoteCandidate | null;
  role: DailyRole;
  baselines: ReturnType<typeof buildTopicBaselines>;
  visualUnderstanding: VisualUnderstanding | null;
};

function rawTopicValueFor(input: TopicValueInput) {
  const { product, quote, evidenceQuote, role, baselines } = input;
  const rawTopicValue = product
    ? evaluateMyfansTopicValue({ product, quote: evidenceQuote, role, baselines })
    : quote
      ? quoteOpportunityTopicValue(quote)
      : null;
  return rawTopicValue;
}

function hasTopicEvidence(input: TopicValueInput) {
  const { product, quote, evidenceQuote, visualUnderstanding } = input;
  const visualStatus = visualUnderstanding?.visualAnalysisStatus ?? "unavailable";
  return !product && quote
    ? true
    : Boolean(evidenceQuote && (visualStatus === "verified" || hasConcreteSourceContext(evidenceQuote)));
}

function guardTopicValue(rawTopicValue: ReturnType<typeof evaluateMyfansTopicValue> | null, topicEvidencePresent: boolean) {
  return rawTopicValue && !topicEvidencePresent
    ? {
      ...rawTopicValue,
      verdict: "LOW_TOPIC_VALUE" as const,
      reasonToCare: null,
      evidence: [],
      whyRejected: ["metrics-only/price-only: source本文・verified visual・具体的文脈がありません"],
    }
    : rawTopicValue;
}

function promotionEvidence(input: TopicValueInput, visualStatus: string) {
  const { evidenceQuote, visualUnderstanding } = input;
  return [
    visualStatus === "verified" ? (visualUnderstanding?.humanObservation || visualUnderstanding?.rawVisualEvidence || "") : "",
    evidenceQuote?.text_excerpt ? compactSourceText(evidenceQuote.text_excerpt, 28) : "",
    hasConcreteSourceContext(evidenceQuote) ? quoteInsight(evidenceQuote) : "",
  ].filter(Boolean);
}

function promotionReasonToCare(role: DailyRole, visualStatus: string) {
  return (role === "AUTHORITY" ? "clear_comparison" : visualStatus === "verified" ? "rare_visual_moment" : "conversation_worthy") as MyfansReasonToCare;
}

function promotionBreakdown(breakdown: NonNullable<ReturnType<typeof evaluateMyfansTopicValue>>["breakdown"], visualStatus: string) {
  const visualFloor = visualStatus === "verified" ? 20 : visualStatus === "partial" ? 14 : 8;
  return {
    ...breakdown,
    humanCuriosity: Math.max(breakdown.humanCuriosity, 16),
    visualStoryValue: Math.max(breakdown.visualStoryValue, visualFloor),
    explainability: Math.max(breakdown.explainability, 14),
  };
}

function promoteEvidenceBackedTopic(guardedTopicValue: ReturnType<typeof evaluateMyfansTopicValue> | null, input: TopicValueInput, topicEvidencePresent: boolean) {
  if (guardedTopicValue?.verdict !== "LOW_TOPIC_VALUE" || !topicEvidencePresent) return guardedTopicValue;
  const { role, visualUnderstanding } = input;
  const visualStatus = visualUnderstanding?.visualAnalysisStatus ?? "unavailable";
  return {
    ...guardedTopicValue,
    score: Math.max(guardedTopicValue.score, visualStatus === "verified" ? 86 : 80),
    verdict: "PASS" as const,
    reasonToCare: promotionReasonToCare(role, visualStatus),
    evidence: promotionEvidence(input, visualStatus),
    whyRejected: [],
    breakdown: promotionBreakdown(guardedTopicValue.breakdown, visualStatus),
  };
}

export function evaluateMyfansCandidateTopicValue(input: TopicValueInput) {
  const rawTopicValue = rawTopicValueFor(input);
  const topicEvidencePresent = hasTopicEvidence(input);
  const guardedTopicValue = guardTopicValue(rawTopicValue, topicEvidencePresent);
  const topicValue = promoteEvidenceBackedTopic(guardedTopicValue, input, topicEvidencePresent);
  return { guardedTopicValue, topicValue };
}

type CandidateQualityInput = {
  body: string;
  product: MyfansProduct | null;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creative: ReturnType<typeof decideCreativeStrategy> | null;
  quote: MyfansQuoteCandidate | null;
  topicValue: ReturnType<typeof evaluateMyfansCandidateTopicValue>["topicValue"];
  guardedTopicValue: ReturnType<typeof evaluateMyfansCandidateTopicValue>["guardedTopicValue"];
  topicCopyFitFailed: boolean;
  dailyRole: DailyRole;
  sourceSpecificity: number;
  attention: ReturnType<typeof attentionScoreFor> | null;
  hook: ReturnType<typeof hookIntelligence> | null;
};

function lowTopicQualityFor(input: CandidateQualityInput) {
  const { guardedTopicValue, topicValue, attention } = input;
  if (guardedTopicValue?.verdict !== "LOW_TOPIC_VALUE" || topicValue?.verdict === "PASS") return null;
  return {
      total: Math.min(74, guardedTopicValue.score),
      verdict: "HOLD",
      breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: guardedTopicValue.breakdown.visualStoryValue, specificity: guardedTopicValue.breakdown.concreteDifference, proof: guardedTopicValue.breakdown.socialProofMomentum, broadCuriosity: guardedTopicValue.breakdown.humanCuriosity, audience: 0, followReason: 0, attentionValue: attention?.score ?? 0, naturalUserReaction: 0, analystCommentaryRisk: 100, sourceSpecificity: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
      reasons: [`LOW_TOPIC_VALUE: ${guardedTopicValue.whyRejected.join(" / ")}`],
  };
}

function topicFitQualityFor(input: CandidateQualityInput) {
  const { topicCopyFitFailed, topicValue, dailyRole, attention } = input;
  if (!topicCopyFitFailed) return null;
  return {
      total: Math.min(84, topicValue?.score ?? 0),
      verdict: "HOLD",
      breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: attention?.score ?? 0, naturalUserReaction: 0, analystCommentaryRisk: 100, sourceSpecificity: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
      reasons: [`Topic-to-Copy Fit不一致: ${topicValue?.reasonToCare ?? "unknown"}は${dailyRole}向きではありません`],
  };
}

function quoteOnlyQualityFor(input: CandidateQualityInput) {
  const { product, quote, topicValue, sourceSpecificity } = input;
  if (product || !quote || topicValue?.verdict !== "PASS") return null;
  return {
    total: 86,
    verdict: "PASS",
    breakdown: { stopPower: 18, firstLineStop: 18, visualLeverage: 16, visual: 16, specificity: sourceSpecificity, proof: 10, broadCuriosity: 16, audience: 12, followReason: 12, attentionValue: 86, naturalUserReaction: 18, analystCommentaryRisk: 0, sourceSpecificity, roleDifferentiation: 12, spamSalesSmell: 0, repetitionPenalty: 0 },
    reasons: ["eligible quote sourceを発見候補として採用", "商品未紐付けのため収益導線なし"],
  };
}

function productQualityFor(input: CandidateQualityInput) {
  const { body, product, postType, linkStrategy, creative, quote, topicValue, hook, attention } = input;
  if (!product || !creative || !hook || !attention) return null;
  return qualityScoreFor({ body, product, postType, linkStrategy, creativeStrategy: creative.strategy, quote, topicValue });
}

function missingProductQuality() {
  return {
    total: 0,
    verdict: "HOLD",
    breakdown: { stopPower: 0, firstLineStop: 0, visualLeverage: 0, visual: 0, specificity: 0, proof: 0, broadCuriosity: 0, audience: 0, followReason: 0, attentionValue: 0, naturalUserReaction: 0, analystCommentaryRisk: 100, sourceSpecificity: 0, roleDifferentiation: 0, spamSalesSmell: 0, repetitionPenalty: 0 },
    reasons: ["商品候補がありません"],
  };
}

export function qualityForMyfansCandidate(input: CandidateQualityInput) {
  const lowTopicQuality = lowTopicQualityFor(input);
  if (lowTopicQuality) return lowTopicQuality;
  const topicFitQuality = topicFitQualityFor(input);
  if (topicFitQuality) return topicFitQuality;
  const quoteQuality = quoteOnlyQualityFor(input);
  if (quoteQuality) return quoteQuality;
  return productQualityFor(input) ?? missingProductQuality();
}
