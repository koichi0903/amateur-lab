import type { MyfansAnalytics, MyfansProduct } from "@/lib/myfansAnalytics";
import { daysBetweenDates } from "@/lib/myfansTime";
import { myfansTextBigrams } from "@/lib/myfansTextBigrams";

export type MyfansNoveltyCandidate = {
  body: string;
  quoteXUrl: string;
  sourceXUrl: string;
  topicIdentity: string;
  topicSemanticKey: string;
  product: MyfansProduct | null;
  postType: string;
  creativeStrategy: string;
};

type MyfansPastUsageRecord = { date: string };

type MyfansPostedHistorySummary = {
  maxPastSimilarity: number;
  nearestPastPostId: number | null;
  sameSourcePastCount: number;
  sameTopicPastCount: number;
};

export type MyfansCandidateNoveltyInput = {
  posts: MyfansAnalytics["posts"];
  pastUsage: {
    latestSource: (source: string) => MyfansPastUsageRecord | null;
    latestCreator: (creatorKey: string) => MyfansPastUsageRecord | null;
    latestTopic: (topicIdentity: string, topicSemanticKey: string) => MyfansPastUsageRecord | null;
  };
  planDate: string;
  postedSourceCooldownDays: number;
  creatorKeyForCandidateSource: (candidate: MyfansNoveltyCandidate) => string;
};

function normalizeMyfansCopyForSimilarity(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{Letter}\p{Number}ぁ-んァ-ヶー一-龠]+/gu, "")
    .trim();
}

export function myfansBodySimilarity(left: string, right: string) {
  const a = normalizeMyfansCopyForSimilarity(left);
  const b = normalizeMyfansCopyForSimilarity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = myfansTextBigrams(a);
  const gb = myfansTextBigrams(b);
  const intersection = [...ga].filter((gram) => gb.has(gram)).length;
  return intersection / Math.max(1, Math.min(ga.size, gb.size));
}

function summarizePostedHistory(
  candidate: MyfansNoveltyCandidate,
  posts: MyfansCandidateNoveltyInput["posts"],
): MyfansPostedHistorySummary {
  const posted = posts.filter(isPostedMyfansPost);
  let maxPastSimilarity = 0;
  let nearestPastPostId: number | null = null;
  let sameSourcePastCount = 0;
  let sameTopicPastCount = 0;
  for (const post of posted) {
    const similarity = myfansBodySimilarity(candidate.body, post.body);
    if (similarity > maxPastSimilarity) {
      maxPastSimilarity = similarity;
      nearestPastPostId = post.id;
    }
    const postSource = post.quote_x_url || post.source_x_url || "";
    if (postSource && candidate.quoteXUrl && postSource === candidate.quoteXUrl) sameSourcePastCount += 1;
    const postTopic = `${post.product_id ?? ""}:${post.post_type ?? ""}:${post.creative_strategy ?? ""}`;
    const candidateTopic = `${candidate.product?.id ?? ""}:${candidate.postType}:${candidate.creativeStrategy}`;
    if (postTopic === candidateTopic) sameTopicPastCount += 1;
  }
  return { maxPastSimilarity, nearestPastPostId, sameSourcePastCount, sameTopicPastCount };
}

function isPostedMyfansPost(post: MyfansCandidateNoveltyInput["posts"][number]) {
  return post.status === "posted" || Boolean(post.posted_at) || Boolean(post.x_post_url);
}

function getPastUsage(candidate: MyfansNoveltyCandidate, input: MyfansCandidateNoveltyInput) {
  return {
    source: input.pastUsage.latestSource(candidate.quoteXUrl || candidate.sourceXUrl),
    creator: input.pastUsage.latestCreator(input.creatorKeyForCandidateSource(candidate)),
    topic: input.pastUsage.latestTopic(candidate.topicIdentity, candidate.topicSemanticKey),
  };
}

function wasSourceUsedRecently(
  sourceUsage: MyfansPastUsageRecord | null,
  planDate: string,
  cooldownDays: number,
) {
  const sourceAge = sourceUsage ? daysBetweenDates(planDate, sourceUsage.date) : null;
  return sourceAge !== null && sourceAge < cooldownDays;
}

function decideNoveltyVerdict(
  history: MyfansPostedHistorySummary,
  sourceUsedRecently: boolean,
  topicUsage: MyfansPastUsageRecord | null,
) {
  return history.maxPastSimilarity >= 0.92 || history.sameSourcePastCount > 0 || sourceUsedRecently
    ? "blocked" as const
    : history.maxPastSimilarity >= 0.72 || history.sameTopicPastCount > 0 || topicUsage
      ? "near" as const
      : "fresh" as const;
}

function buildNoveltyLabels(
  verdict: "blocked" | "near" | "fresh",
  sourceUsage: MyfansPastUsageRecord | null,
  postedSourceCooldownDays: number,
  maxPastSimilarity: number,
) {
  return {
    label: verdict === "fresh" ? "高" as const : verdict === "near" ? "中" as const : "低" as const,
    sameSourceLabel: sourceUsage ? `${postedSourceCooldownDays}日以内使用済み` : "未使用",
    lastSameSourceDate: sourceUsage?.date ?? null,
    pastBodySimilarityLabel: maxPastSimilarity >= 0.72 ? "高" as const : maxPastSimilarity >= 0.45 ? "中" as const : "低" as const,
  };
}

export function evaluateMyfansCandidateNovelty(
  candidate: MyfansNoveltyCandidate,
  input: MyfansCandidateNoveltyInput,
) {
  const history = summarizePostedHistory(candidate, input.posts);
  const usage = getPastUsage(candidate, input);
  const sourceUsedRecently = wasSourceUsedRecently(
    usage.source,
    input.planDate,
    input.postedSourceCooldownDays,
  );
  const verdict = decideNoveltyVerdict(history, sourceUsedRecently, usage.topic);
  const labels = buildNoveltyLabels(
    verdict,
    usage.source,
    input.postedSourceCooldownDays,
    history.maxPastSimilarity,
  );
  return {
    ...history,
    maxPastSimilarity: Number(history.maxPastSimilarity.toFixed(2)),
    verdict,
    ...labels,
    lastSameCreatorDate: usage.creator?.date ?? null,
  };
}
