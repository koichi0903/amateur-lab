import type { MyfansAnalytics, MyfansXPost } from "@/lib/myfansAnalytics";
import { inPeriod } from "@/lib/myfansTime";

export const MYFANS_DIAGNOSIS_THRESHOLDS = {
  minimumSamplePosts: 7,
  exposureImpressions: 1000,
  profileVisitRate: 0.01,
  followRate: 0.08,
  clickRate: 0.003,
  conversionRate: 0.02,
};

const PERIOD_DAYS = { seven: 7, thirty: 30 } as const;

export type MyfansLearningAxis = "post_type" | "link_strategy" | "objective" | "growth_stage" | "creator" | "product";
export type MyfansCreativeLearningAxis = MyfansLearningAxis | "creative_strategy";

export function compareByStrategy(posts: MyfansXPost[], conversions: MyfansAnalytics["conversions"]) {
  const groups = new Map<string, { key: string; posts: number; impressions: number; clicks: number; conversions: number; reward: number }>();
  for (const post of posts) {
    const key = `${post.link_strategy ?? "未設定"} / ${post.post_type}`;
    const current = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    current.posts += 1;
    current.impressions += post.impressions;
    current.clicks += post.clicks ?? 0;
    groups.set(key, current);
  }
  for (const conversion of conversions) {
    const post = posts.find((item) => item.id === conversion.x_post_id);
    const key = `${post?.link_strategy ?? "未設定"} / ${post?.post_type ?? "未紐付け"}`;
    const current = groups.get(key) ?? { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
    current.conversions += 1;
    current.reward += conversion.reward_amount;
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((row) => ({
    ...row,
    impressionsPerPost: row.posts > 0 ? Math.round(row.impressions / row.posts) : 0,
    clicksPerPost: row.posts > 0 ? Number((row.clicks / row.posts).toFixed(2)) : 0,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    cvr: row.clicks > 0 ? row.conversions / row.clicks : null,
    rewardPerPost: row.posts > 0 ? Math.round(row.reward / row.posts) : 0,
    expectedRewardPer1000Impressions: row.impressions > 0 ? Math.round((row.reward / row.impressions) * 1000) : 0,
    verdict: row.posts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts ? "サンプル不足" : row.reward > 0 || row.clicks / Math.max(1, row.impressions) >= MYFANS_DIAGNOSIS_THRESHOLDS.clickRate ? "勝ち型" : "負け型",
  }));
}

function directAxisLabel(axis: Exclude<MyfansCreativeLearningAxis, "creator" | "product">, post: MyfansXPost) {
  switch (axis) {
    case "post_type": return post.post_type || "未設定";
    case "link_strategy": return post.link_strategy || "未設定";
    case "creative_strategy": return post.creative_strategy || "未設定";
    case "objective": return post.objective || "未設定";
    case "growth_stage": return post.growth_stage || "未設定";
  }
}

function linkedEntityAxisLabel(axis: "creator" | "product", post: MyfansXPost, analytics: MyfansAnalytics) {
  const product = analytics.products.find((item) => item.id === post.product_id);
  if (axis === "product") return product?.title ?? "商品未紐付け";
  const creator = analytics.creators.find((item) => item.id === product?.creator_id);
  return creator?.display_name ?? "クリエイター未紐付け";
}

function labelForAxis(axis: MyfansCreativeLearningAxis, post: MyfansXPost, analytics: MyfansAnalytics) {
  if (axis === "creator" || axis === "product") return linkedEntityAxisLabel(axis, post, analytics);
  return directAxisLabel(axis, post);
}

type LearningGroup = { key: string; posts: number; impressions: number; clicks: number; conversions: number; reward: number };

function createLearningGroup(key: string): LearningGroup {
  return { key, posts: 0, impressions: 0, clicks: 0, conversions: 0, reward: 0 };
}

function groupAxisRows(
  periodPosts: MyfansXPost[],
  periodConversions: MyfansAnalytics["conversions"],
  axis: MyfansCreativeLearningAxis,
  analytics: MyfansAnalytics,
) {
  const groups = new Map<string, LearningGroup>();
  for (const post of periodPosts) {
    const key = labelForAxis(axis, post, analytics);
    const row = groups.get(key) ?? createLearningGroup(key);
    row.posts += 1;
    row.impressions += post.impressions;
    row.clicks += post.clicks ?? 0;
    groups.set(key, row);
  }
  for (const conversion of periodConversions) {
    const post = periodPosts.find((item) => item.id === conversion.x_post_id);
    const key = post ? labelForAxis(axis, post, analytics) : "投稿未紐付け";
    const row = groups.get(key) ?? createLearningGroup(key);
    row.conversions += 1;
    row.reward += conversion.reward_amount;
    groups.set(key, row);
  }
  return Array.from(groups.values());
}

function getLearningVerdict(confidence: number, reward: number, ctr: number | null, estimatedFollowsPerPost: number) {
  if (confidence < 0.55) return "サンプル不足";
  const winner = confidence >= 0.55 && (
    reward > 0
    || (ctr ?? 0) >= MYFANS_DIAGNOSIS_THRESHOLDS.clickRate
    || estimatedFollowsPerPost >= 0.2
  );
  return winner ? "勝ち型" : "負け型";
}

function buildAxisLearningRow(
  row: LearningGroup,
  estimatedProfileVisitsPerPost: number,
  estimatedFollowsPerPost: number,
) {
  const ctr = row.impressions > 0 ? row.clicks / row.impressions : null;
  const cvr = row.clicks > 0 ? row.conversions / row.clicks : null;
  const rewardPerPost = row.posts > 0 ? row.reward / row.posts : 0;
  const realizedRewardPer1000Impressions = row.impressions > 0 ? Math.round((row.reward / row.impressions) * 1000) : 0;
  const confidence = Math.min(1, row.posts / MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts * 0.55 + row.clicks / 20 * 0.45);
  return {
    ...row,
    impressionsPerPost: row.posts > 0 ? Math.round(row.impressions / row.posts) : 0,
    profileVisitsPerPostEstimate: Number(estimatedProfileVisitsPerPost.toFixed(2)),
    followsDeltaPerPostEstimate: Number(estimatedFollowsPerPost.toFixed(2)),
    clicksPerPost: row.posts > 0 ? Number((row.clicks / row.posts).toFixed(2)) : 0,
    ctr,
    cvr,
    rewardPerPost: Math.round(rewardPerPost),
    realizedRewardPer1000Impressions,
    confidence: Number(confidence.toFixed(2)),
    verdict: getLearningVerdict(confidence, row.reward, ctr, estimatedFollowsPerPost),
    attributionNote: "profile visits/followsは投稿へ厳密帰属できないため account-level estimate",
  };
}

function compareByAxis(analytics: MyfansAnalytics, axis: MyfansCreativeLearningAxis, days: number) {
  const periodPosts = analytics.posts.filter((post) => inPeriod(post.posted_at ?? post.created_at, days));
  const periodConversions = analytics.conversions.filter((conversion) => inPeriod(conversion.occurred_at, days));
  const accountRows = (analytics.xAccountMetrics ?? []).filter((row) => inPeriod(row.metric_date, days));
  const accountProfileVisits = accountRows.reduce((sum, row) => sum + row.profile_visits, 0);
  const firstFollowers = accountRows[0]?.followers_count ?? 0;
  const latestFollowers = accountRows[accountRows.length - 1]?.followers_count ?? firstFollowers;
  const estimatedProfileVisitsPerPost = periodPosts.length > 0 ? accountProfileVisits / periodPosts.length : 0;
  const estimatedFollowsPerPost = periodPosts.length > 0 ? Math.max(0, latestFollowers - firstFollowers) / periodPosts.length : 0;
  return groupAxisRows(periodPosts, periodConversions, axis, analytics)
    .map((row) => buildAxisLearningRow(row, estimatedProfileVisitsPerPost, estimatedFollowsPerPost))
    .sort((a, b) => b.confidence - a.confidence || b.realizedRewardPer1000Impressions - a.realizedRewardPer1000Impressions || b.clicksPerPost - a.clicksPerPost);
}

export function buildMyfansLearning(analytics: MyfansAnalytics) {
  const axes: MyfansCreativeLearningAxis[] = ["post_type", "link_strategy", "creative_strategy", "objective", "growth_stage", "creator", "product"];
  const buildPeriod = (days: number) => Object.fromEntries(axes.map((axis) => [axis, compareByAxis(analytics, axis, days)])) as Record<MyfansCreativeLearningAxis, ReturnType<typeof compareByAxis>>;
  return {
    seven: buildPeriod(PERIOD_DAYS.seven),
    thirty: buildPeriod(PERIOD_DAYS.thirty),
  };
}
