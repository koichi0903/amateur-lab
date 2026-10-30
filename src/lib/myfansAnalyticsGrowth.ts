import type { MyfansDailyMetric, MyfansXAccountMetric, MyfansXPost } from "./myfansAnalyticsTypes";

function diagnoseXGrowth(impressions: number, profileVisits: number, followersDelta: number, clicks: number, conversions: number) {
  if (conversions > 0) return "成果発生・最適化段階" as const;
  if (clicks > 0) return "クリックあり/CV不足" as const;
  if (followersDelta > 0) return "フォローは増えるがクリック不足" as const;
  if (profileVisits > 0) return "プロフィール遷移はあるがフォロー不足" as const;
  if (impressions >= 1000) return "露出はあるがプロフィール遷移不足" as const;
  return "露出不足" as const;
}

type GrowthAccountMetric = Pick<
  MyfansXAccountMetric,
  "metric_date" | "followers_count" | "posts_count" | "total_impressions" | "profile_visits" | "affiliate_clicks" | "conversions" | "reward_amount"
>;

function buildXAccountGrowth<TPost extends Pick<MyfansXPost, "created_at" | "posted_at" | "impressions" | "clicks">>({
  xAccountMetrics,
  postedPosts30d,
  highestPost,
  accountImpressions30d,
  profileVisits30d,
  accountPosts30d,
  accountClicks30d,
  accountConversions30d,
  accountReward30d,
}: {
  xAccountMetrics: GrowthAccountMetric[];
  postedPosts30d: TPost[];
  highestPost: TPost | null;
  accountImpressions30d: number;
  profileVisits30d: number;
  accountPosts30d: number;
  accountClicks30d: number;
  accountConversions30d: number;
  accountReward30d: number;
}) {
  const firstAccountMetric = xAccountMetrics[0] ?? null;
  const latestAccountMetric = xAccountMetrics[xAccountMetrics.length - 1] ?? null;
  const followersDelta30d = latestAccountMetric && firstAccountMetric
    ? latestAccountMetric.followers_count - firstAccountMetric.followers_count
    : 0;
  const posts30d = accountPosts30d || postedPosts30d.length;
  const dailyRows = xAccountMetrics.map((row) => ({
    metric_date: row.metric_date,
    followers_count: row.followers_count,
    posts_count: row.posts_count,
    impressions: row.total_impressions,
    profile_visits: row.profile_visits,
    affiliate_clicks: row.affiliate_clicks,
    conversions: row.conversions,
    reward_amount: row.reward_amount,
    epc: row.affiliate_clicks > 0 ? Math.round(row.reward_amount / row.affiliate_clicks) : null,
  }));

  return {
    diagnosis: diagnoseXGrowth(accountImpressions30d, profileVisits30d, followersDelta30d, accountClicks30d, accountConversions30d),
    currentFollowers: latestAccountMetric?.followers_count ?? 0,
    followersDelta30d,
    newFollows30d: Math.max(0, followersDelta30d),
    profileVisits30d,
    impressions30d: accountImpressions30d,
    posts30d,
    avgImpressionsPerPost: posts30d > 0 ? Math.round(accountImpressions30d / posts30d) : null,
    highestPost,
    clicks30d: accountClicks30d,
    conversions30d: accountConversions30d,
    reward30d: accountReward30d,
    ctr30d: accountImpressions30d > 0 ? accountClicks30d / accountImpressions30d : null,
    cvr30d: accountClicks30d > 0 ? accountConversions30d / accountClicks30d : null,
    epc30d: accountClicks30d > 0 ? Math.round(accountReward30d / accountClicks30d) : null,
    dailyRows,
  };
}

export function buildMyfansXAccountGrowthSummary<TPost extends Pick<MyfansXPost, "created_at" | "posted_at" | "impressions" | "clicks">>({
  posts,
  daily,
  xAccountMetrics,
  cutoff,
  clicks30d,
  conversions30d,
  reward30d,
}: {
  posts: TPost[];
  daily: Pick<MyfansDailyMetric, "impressions">[];
  xAccountMetrics: GrowthAccountMetric[];
  cutoff: string;
  clicks30d: number;
  conversions30d: number;
  reward30d: number;
}) {
  const postImpressions30d = posts
    .filter((post) => post.created_at >= cutoff || (post.posted_at && post.posted_at >= cutoff))
    .reduce((sum, post) => sum + post.impressions, 0);
  const dailyImpressions30d = daily.reduce((sum, row) => sum + row.impressions, 0);
  const impressions30d = Math.max(postImpressions30d, dailyImpressions30d);
  const postedPosts30d = posts.filter((post) => post.posted_at && post.posted_at >= cutoff);
  const highestPost = postedPosts30d.reduce<TPost | null>(
    (best, post) => (!best || post.impressions > best.impressions ? post : best),
    null,
  );
  const profileVisits30d = xAccountMetrics.reduce((sum, row) => sum + row.profile_visits, 0);
  const accountPosts30d = xAccountMetrics.reduce((sum, row) => sum + row.posts_count, 0);
  const accountImpressions30d = Math.max(
    postImpressions30d,
    xAccountMetrics.reduce((sum, row) => sum + row.total_impressions, 0),
  );
  const accountMetricClicks30d = xAccountMetrics.reduce((sum, row) => sum + row.affiliate_clicks, 0);
  const accountMetricConversions30d = xAccountMetrics.reduce((sum, row) => sum + row.conversions, 0);
  const accountMetricReward30d = xAccountMetrics.reduce((sum, row) => sum + row.reward_amount, 0);
  const accountClicks30d = Math.max(
    clicks30d,
    postedPosts30d.reduce((sum, post) => sum + (post.clicks ?? 0), 0),
    accountMetricClicks30d,
  );
  const accountConversions30d = Math.max(conversions30d, accountMetricConversions30d);
  const accountReward30d = Math.max(reward30d, accountMetricReward30d);

  return {
    impressions30d,
    xAccountGrowth: buildXAccountGrowth({
      xAccountMetrics,
      postedPosts30d,
      highestPost,
      accountImpressions30d,
      profileVisits30d,
      accountPosts30d,
      accountClicks30d,
      accountConversions30d,
      accountReward30d,
    }),
  };
}
