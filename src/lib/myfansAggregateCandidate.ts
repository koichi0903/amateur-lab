import { fitXBody } from "@/lib/myfansCandidateCopy";
import type { evaluateMyfansCandidateDiversity } from "@/lib/myfansCandidateDiversity";
import { topicThresholdFor, type DailyRole } from "@/lib/myfansTopicValue";
import { qualityScoreFor } from "@/lib/myfansPublicCopyQuality";
import type { MyfansTopicValue } from "@/lib/myfansQuotePool";
import type { MyfansCreativeStrategy, MyfansGrowthStage, MyfansLinkStrategy, MyfansObjective } from "@/lib/myfansGrowthStrategy";
export function buildMyfansAggregateCandidate(input: {
  base: ReturnType<typeof evaluateMyfansCandidateDiversity>;
  aggregateTopics: Array<ReturnType<typeof evaluateMyfansCandidateDiversity>>;
  plannedSlot: string;
  publishableCount: number;
  planDate: string;
  stage: MyfansGrowthStage;
}) {
  const { base, aggregateTopics, plannedSlot, publishableCount, planDate, stage } = input;
  const second = aggregateTopics.find((candidate) => candidate.id !== base.id) ?? aggregateTopics[1];
  const product = base.product;
  const aggregateScore = Math.min(100, Math.round(aggregateTopics.reduce((sum, candidate) => sum + (candidate.topicValue?.score ?? 0), 0) / Math.max(1, aggregateTopics.length)) + 4);
  const aggregateTopic: MyfansTopicValue | null = aggregateTopics.length >= 2
    ? {
      score: aggregateScore,
      verdict: "PASS",
      reasonToCare: "clear_comparison",
      evidence: aggregateTopics.flatMap((candidate) => candidate.topicValue?.evidence.slice(0, 1) ?? []),
      baseline: aggregateTopics.flatMap((candidate) => candidate.topicValue?.baseline.slice(0, 1) ?? []),
      whyRejected: [],
      breakdown: {
        surprise: 18,
        concreteDifference: 20,
        humanCuriosity: 18,
        socialProofMomentum: 12,
        visualStoryValue: 12,
        explainability: 10,
      },
    }
    : null;
  if (!product || !second || aggregateTopic?.verdict !== "PASS" || aggregateTopic.score < topicThresholdFor("DISCOVERY")) return null;

  const aggregateBody = fitXBody([
    "今日の2つ、引っかかる場所が全然違う。",
    "一方は見た瞬間の違い、もう一方は反応の残り方で気になる。",
  ], 210);
  const quality = qualityScoreFor({
    body: aggregateBody,
    product,
    postType: "ranking_note",
    linkStrategy: "no_link",
    creativeStrategy: "discovery_card",
    quote: null,
    topicValue: aggregateTopic,
  });
  const candidate = {
    ...base,
    id: `${planDate}-${stage}-authority-aggregate-topic-${publishableCount + 1}`,
    body: aggregateBody,
    selfReply: "",
    affiliateUrl: "",
    quoteXUrl: "",
    creativeStrategy: "discovery_card" as MyfansCreativeStrategy,
    dailyRole: "DISCOVERY" as DailyRole,
    postType: "ranking_note",
    linkStrategy: "no_link" as MyfansLinkStrategy,
    creativeVariantId: `${planDate}-${stage}-authority-aggregate-topic-${publishableCount + 1}`,
    plannedSlot,
    objective: "follow" as MyfansObjective,
    role: "Discovery aggregate / Topic通過候補を束ねる",
    reason: "Topic通過候補が同一の強い根拠に偏ったため、単独投稿の水増しではなく発見枠と選別枠の差を束ねます。",
    topicValue: aggregateTopic,
    topicIdentity: `aggregate:${aggregateTopics.map((candidate) => candidate.topicIdentity).join("|")}`,
    topicSemanticKey: `aggregate:${aggregateTopics.map((candidate) => candidate.topicSemanticKey).join("|")}`,
    topicThreshold: topicThresholdFor("DISCOVERY"),
    copyAngle: "editorial_insight" as typeof base.copyAngle,
    multiAngleAttempt: 1,
    reasonToCare: aggregateTopic.reasonToCare,
    quality,
    qualityReasons: quality.reasons,
  };
  return { aggregateTopic, candidate };
}

