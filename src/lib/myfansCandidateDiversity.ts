import { daysBetweenDates } from "./myfansTime";
import { isPermanentlyExcluded } from "./myfansPermanentExclusions";
import { detectPublicCopyLeak, hasPublicCopyDiversityIssue } from "./myfansPublicCopyRules";
import { qualityScoreFor } from "./myfansPublicCopyQuality";
import { myfansBodySimilarity } from "./myfansCandidateNovelty";
import { POSTED_SOURCE_COOLDOWN_DAYS, SELECTED_SOURCE_SOFT_COOLDOWN_DAYS, TOPIC_COOLDOWN_DAYS, creatorKeyFromProduct, creatorKeyFromQuote, normalizeSourceUrl, quoteUrlFromCandidate, semanticTopicSimilarity } from "./myfansQuotePool";
import type { MyfansCandidateDiversityContext, MyfansCandidateForDiversity } from "./myfansXExecution";

export function holdQuality(quality: ReturnType<typeof qualityScoreFor>, reason: string) {
  return {
    ...quality,
    verdict: "HOLD",
    total: Math.min(quality.total, 84),
    reasons: [...quality.reasons.filter((item) => item !== "公開可能な具体性と根拠があります"), reason],
  };
}

type Candidate = MyfansCandidateForDiversity;
type Context = MyfansCandidateDiversityContext;
type PastUsage = Context["pastUsage"];
type SourceUsage = ReturnType<PastUsage["latestSource"]> | null | undefined;
type CreatorUsage = ReturnType<PastUsage["latestCreator"]> | null | undefined;
type TopicUsage = ReturnType<PastUsage["latestTopic"]> | null | undefined;
type BodyUsage = ReturnType<PastUsage["latestBody"]> | null | undefined;

function exclusionHoldReasons(candidate: Candidate, context: Context, leak: ReturnType<typeof detectPublicCopyLeak>) {
  const reasons: string[] = [];
  if (isPermanentlyExcluded({
    productId: candidate.product?.id,
    quoteCandidateId: candidate.quoteCandidateId,
    quoteXUrl: candidate.quoteXUrl,
    sourceXUrl: candidate.sourceXUrl,
    sets: context.permanentExclusionSets,
  })) reasons.push("恒久除外済みのproduct/sourceです");
  if (leak.hasLeak) reasons.push(`Public Copy leak: ${leak.matches.join(" / ")}`);
  return reasons;
}

function postedSourceCooldownReason(usage: SourceUsage, age: number | null) {
  if (usage?.actualPosted && age !== null && age < POSTED_SOURCE_COOLDOWN_DAYS) {
    return `実投稿済みsourceは${POSTED_SOURCE_COOLDOWN_DAYS}日cooldown: last ${usage.date}`;
  }
  return "";
}

function selectedSourceCooldownReason(usage: SourceUsage, age: number | null) {
  if (usage && age !== null && age < SELECTED_SOURCE_SOFT_COOLDOWN_DAYS) {
    return `前日までに選択済みsourceはsoft cooldown: last ${usage.date}`;
  }
  return "";
}

function topicCooldownReason(usage: TopicUsage, age: number | null) {
  if (usage && age !== null && age < TOPIC_COOLDOWN_DAYS) {
    return `同じtopic_semantic_keyは${TOPIC_COOLDOWN_DAYS}日cooldown: last ${usage.date}`;
  }
  return "";
}

function bodyCooldownReason(usage: BodyUsage, age: number | null) {
  if (usage && (usage.actualPosted || (age !== null && age < POSTED_SOURCE_COOLDOWN_DAYS))) {
    return `過去本文と近すぎます: last ${usage.date}`;
  }
  return "";
}

function creatorCooldownReason(usage: CreatorUsage, age: number | null) {
  if (usage && age !== null && age < 1) return `同じcreatorの翌日連続採用を回避: last ${usage.date}`;
  return "";
}

function usageCooldownHoldReasons(input: {
  sourceUsage: SourceUsage;
  sourceAge: number | null;
  topicUsage: TopicUsage;
  topicAge: number | null;
  bodyUsage: BodyUsage;
  bodyAge: number | null;
  creatorUsage: CreatorUsage;
  creatorAge: number | null;
}) {
  return [
    postedSourceCooldownReason(input.sourceUsage, input.sourceAge),
    selectedSourceCooldownReason(input.sourceUsage, input.sourceAge),
    topicCooldownReason(input.topicUsage, input.topicAge),
    bodyCooldownReason(input.bodyUsage, input.bodyAge),
    creatorCooldownReason(input.creatorUsage, input.creatorAge),
  ].filter(Boolean);
}

function acceptedCopyHoldReasons(candidate: Candidate, context: Context) {
  const reasons: string[] = [];
  const diversityIssue = hasPublicCopyDiversityIssue(candidate.body, context.acceptedBodies);
  if (diversityIssue) reasons.push(diversityIssue);
  if (candidate.topicIdentity && context.acceptedTopicIdentities.has(candidate.topicIdentity)) {
    reasons.push(`同じtopic_identityは日次planで1回までです: ${candidate.topicIdentity}`);
  }
  const topicSimilarity = Math.max(0, ...context.acceptedTopicSemanticKeys.map((key) => semanticTopicSimilarity(candidate.topicSemanticKey, key)));
  if (topicSimilarity >= 0.75) reasons.push(`同じsource metric/eventに見えるためHOLDします: similarity ${topicSimilarity.toFixed(2)}`);
  return reasons;
}

function productPlanHoldReasons(candidate: Candidate, context: Context) {
  const reasons: string[] = [];
  const quoteSourcedTopic = Boolean(candidate.sourceXUrl && candidate.topicIdentity.startsWith("quote:"));
  const productScopedPost = candidate.dailyRole === "REVENUE" || (candidate.creativeStrategy !== "quote_post" && !quoteSourcedTopic);
  if (productScopedPost && candidate.product?.id && context.publishableCandidates.some((item) => item.product?.id === candidate.product?.id && (item.dailyRole === "REVENUE" || item.creativeStrategy !== "quote_post"))) {
    reasons.push("同じproductは日次planで1回までです");
  }
  const creatorKeyForCandidate = context.creatorKeyForCandidateSource(candidate);
  if (creatorKeyForCandidate && (context.acceptedCreatorCounts.get(creatorKeyForCandidate) ?? 0) >= 4) {
    reasons.push("同じcreatorは日次planで最大4本までです");
  }
  if (candidate.reasonToCare && (context.acceptedReasonCounts.get(candidate.reasonToCare) ?? 0) >= 3) {
    reasons.push(`同じreason_to_care ${candidate.reasonToCare} は最大3本までです`);
  }
  return reasons;
}

function roleHoldReasons(candidate: Candidate, context: Context) {
  const reasons: string[] = [];
  if (candidate.dailyRole === "AUTHORITY" && !candidate.topicIdentity.startsWith("aggregate:")) {
    reasons.push("AUTHORITYは単一source/topicの言い換えでは採用しません");
  }
  if (candidate.creativeStrategy === "quote_post" && candidate.sourceSpecificityScore < 35) {
    reasons.push(`source_specificity_score ${candidate.sourceSpecificityScore}/100: 元投稿固有要素が不足しています`);
  }
  if (candidate.creativeStrategy === "quote_post" && !candidate.sourceXUrl) {
    reasons.push("sourceXUrlがないquote candidateはHard failです");
  }
  if (candidate.creativeStrategy === "quote_post" && candidate.quoteXUrl && candidate.product) {
    const quote = context.analytics.quoteCandidates.find((item) => quoteUrlFromCandidate(item) === candidate.quoteXUrl || item.x_post_url === candidate.quoteXUrl);
    const creatorKey = quote ? creatorKeyFromQuote(quote) : creatorKeyFromProduct(candidate.product);
    if (context.acceptedQuoteCreators.has(creatorKey)) reasons.push("同日の公開planでは同一creator quoteを1件までに制限しています");
    if (candidate.reactionType && context.acceptedReactionTypes.has(candidate.reactionType)) reasons.push("同日のquote reaction typeが重複しています");
  }
  const sameRoleCount = context.publishableCandidates.filter((item) => item.dailyRole === candidate.dailyRole).length;
  if (sameRoleCount >= 4) reasons.push(`同じrole ${candidate.dailyRole} は1日4本までです`);
  return reasons;
}

export function evaluateMyfansCandidateDiversity(candidate: MyfansCandidateForDiversity, context: MyfansCandidateDiversityContext) {
  let quality = candidate.quality;
  const publicText = [candidate.body, candidate.selfReply].filter(Boolean).join("\n");
  const sourceUsage = context.pastUsage.latestSource(candidate.quoteXUrl || candidate.sourceXUrl);
  const sourceAge = sourceUsage ? daysBetweenDates(context.planDate, sourceUsage.date) : null;
  const candidateCreatorKey = context.creatorKeyForCandidateSource(candidate);
  const creatorUsage = candidateCreatorKey ? context.pastUsage.latestCreator(candidateCreatorKey) : null;
  const creatorAge = creatorUsage ? daysBetweenDates(context.planDate, creatorUsage.date) : null;
  const topicUsage = context.pastUsage.latestTopic(candidate.topicIdentity, candidate.topicSemanticKey);
  const topicAge = topicUsage ? daysBetweenDates(context.planDate, topicUsage.date) : null;
  const bodyUsage = context.pastUsage.latestBody(candidate.body);
  const bodyAge = bodyUsage ? daysBetweenDates(context.planDate, bodyUsage.date) : null;
  const leak = detectPublicCopyLeak(publicText);
  const holdReasons = [
    ...exclusionHoldReasons(candidate, context, leak),
    ...usageCooldownHoldReasons({ sourceUsage, sourceAge, topicUsage, topicAge, bodyUsage, bodyAge, creatorUsage, creatorAge }),
    ...acceptedCopyHoldReasons(candidate, context),
    ...productPlanHoldReasons(candidate, context),
    ...roleHoldReasons(candidate, context),
  ];
  quality = holdReasons.reduce(holdQuality, quality);
  const projected = [...context.publishableCandidates.map((item) => item.quality.total), quality.total];
  const projectedAverage = projected.reduce((sum, score) => sum + score, 0) / projected.length;
  // Two individually passing candidates are the minimum safe operating day.
  // Apply the higher daily-average target only when attempting a third post;
  // otherwise a valid two-post discovery fallback is incorrectly reduced to
  // one post whenever its fixed discovery quality is below 90.
  if (quality.verdict === "PASS" && projected.length > context.minimumSelectedCount && projectedAverage < context.minimumDailyAverageQuality) {
    quality = holdQuality(quality, `日次平均Quality ${context.minimumDailyAverageQuality}未満になるためHOLD`);
  }
  return { ...candidate, quality };
}
export function recordAcceptedMyfansCandidate(
  candidate: ReturnType<typeof evaluateMyfansCandidateDiversity>,
  context: MyfansCandidateDiversityContext,
  usedProductIds: Set<number>,
  allowSameProductAcrossDistinctRoles: boolean,
) {
  if (!allowSameProductAcrossDistinctRoles) usedProductIds.add(candidate.product?.id ?? -1);
  context.acceptedBodies.push(candidate.body);
  if (candidate.topicIdentity) context.acceptedTopicIdentities.add(candidate.topicIdentity);
  if (candidate.topicSemanticKey) context.acceptedTopicSemanticKeys.push(candidate.topicSemanticKey);
  if (candidate.reasonToCare) context.acceptedReasonCounts.set(candidate.reasonToCare, (context.acceptedReasonCounts.get(candidate.reasonToCare) ?? 0) + 1);
  if (candidate.product) {
    const creatorKey = context.creatorKeyForCandidateSource(candidate);
    context.acceptedCreatorCounts.set(creatorKey, (context.acceptedCreatorCounts.get(creatorKey) ?? 0) + 1);
  }
  if (candidate.creativeStrategy === "quote_post" && candidate.quoteXUrl && candidate.product) {
    const quote = context.analytics.quoteCandidates.find((item) => quoteUrlFromCandidate(item) === candidate.quoteXUrl || item.x_post_url === candidate.quoteXUrl);
    context.acceptedQuoteCreators.add(quote ? creatorKeyFromQuote(quote) : creatorKeyFromProduct(candidate.product));
    if (candidate.reactionType) context.acceptedReactionTypes.add(candidate.reactionType);
  }
}
export type MyfansDailyOptionDiversityCandidate = Pick<
  ReturnType<typeof evaluateMyfansCandidateDiversity>,
  "id" | "body" | "topicIdentity" | "topicSemanticKey" | "quoteXUrl" | "sourceXUrl" | "product"
>;
export function isMyfansDailyOptionDiverseEnough(
  candidate: MyfansDailyOptionDiversityCandidate,
  options: readonly MyfansDailyOptionDiversityCandidate[],
) {
  if (options.some((option) => option.id === candidate.id || option.body === candidate.body)) return false;
  if (options.some((option) => myfansBodySimilarity(option.body, candidate.body) >= 0.9)) return false;
  if (candidate.topicIdentity && options.some((option) => option.topicIdentity === candidate.topicIdentity)) return false;
  if (candidate.topicSemanticKey && options.some((option) => semanticTopicSimilarity(option.topicSemanticKey, candidate.topicSemanticKey) >= 0.75)) return false;
  if (candidate.quoteXUrl && options.some((option) => normalizeSourceUrl(option.quoteXUrl || option.sourceXUrl) === normalizeSourceUrl(candidate.quoteXUrl || candidate.sourceXUrl))) return false;
  return true;
}
