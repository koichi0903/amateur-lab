export type FanzaXAccountMetric = {
  id: number;
  metric_date: string;
  account_handle: string;
  followers_count: number;
  following_count: number | null;
  profile_visits: number;
  total_impressions: number;
  posts_count: number;
  likes: number;
  reposts: number;
  replies: number;
  fanza_clicks: number;
  sales_count: number;
  commission_amount: number;
  notes: string;
};

export type FanzaXGrowth = {
  error: string | null;
  diagnosis: "露出不足" | "露出あり/クリック不足" | "クリックあり/売上不足" | "売上発生・最適化段階";
  currentFollowers: number;
  followersDelta30d: number;
  newFollows30d: number;
  profileVisits30d: number;
  impressions30d: number;
  posts30d: number;
  avgImpressionsPerPost: number | null;
  xPageViews30d: number;
  fanzaClicks30d: number;
  salesCount30d: number;
  commission30d: number;
  ctr30d: number | null;
  cvr30d: number | null;
  epc30d: number | null;
  weeklyRows: Array<{
    metric_date: string;
    followers_count: number;
    posts_count: number;
    impressions: number;
    profile_visits: number;
    fanza_clicks: number;
    sales_count: number;
    commission_amount: number;
    epc: number | null;
  }>;
};

export type FanzaXGrowthSalesRow = { sales_count: number; commission_amount: number };

export function diagnoseFanzaXGrowth(impressions: number, clicks: number, sales: number): FanzaXGrowth["diagnosis"] {
  if (sales > 0) return "売上発生・最適化段階";
  if (clicks > 0) return "クリックあり/売上不足";
  if (impressions >= 1000) return "露出あり/クリック不足";
  return "露出不足";
}

function projectFollowerMetrics(metrics: FanzaXAccountMetric[]) {
  const firstMetric = metrics[0] ?? null;
  const latestMetric = metrics[metrics.length - 1] ?? null;
  const followersDelta30d = latestMetric && firstMetric
    ? latestMetric.followers_count - firstMetric.followers_count
    : 0;

  return {
    currentFollowers: latestMetric?.followers_count ?? 0,
    followersDelta30d,
    newFollows30d: latestMetric && firstMetric ? Math.max(0, followersDelta30d) : 0,
  };
}

function projectGrowthRates({
  impressions30d,
  posts30d,
  fanzaClicks30d,
  salesCount30d,
  commission30d,
}: {
  impressions30d: number;
  posts30d: number;
  fanzaClicks30d: number;
  salesCount30d: number;
  commission30d: number;
}) {
  return {
    avgImpressionsPerPost: posts30d > 0 ? Math.round(impressions30d / posts30d) : null,
    ctr30d: impressions30d > 0 ? fanzaClicks30d / impressions30d : null,
    cvr30d: fanzaClicks30d > 0 ? salesCount30d / fanzaClicks30d : null,
    epc30d: fanzaClicks30d > 0 ? Math.round(commission30d / fanzaClicks30d) : null,
  };
}

function projectWeeklyMetrics(metrics: FanzaXAccountMetric[]) {
  return metrics.map((row) => ({
    metric_date: row.metric_date,
    followers_count: row.followers_count,
    posts_count: row.posts_count,
    impressions: row.total_impressions,
    profile_visits: row.profile_visits,
    fanza_clicks: row.fanza_clicks,
    sales_count: row.sales_count,
    commission_amount: row.commission_amount,
    epc: row.fanza_clicks > 0 ? Math.round(row.commission_amount / row.fanza_clicks) : null,
  }));
}

export function projectFanzaXGrowth(input: {
  metrics: FanzaXAccountMetric[];
  xPostsCount: number;
  xPageViewsCount: number;
  xClicksCount: number;
  salesRows: FanzaXGrowthSalesRow[];
}): FanzaXGrowth {
  const { metrics, xPostsCount, xPageViewsCount, xClicksCount, salesRows } = input;
  const impressions30d = metrics.reduce((sum, row) => sum + row.total_impressions, 0);
  const metricPosts = metrics.reduce((sum, row) => sum + row.posts_count, 0);
  const metricClicks = metrics.reduce((sum, row) => sum + row.fanza_clicks, 0);
  const metricSales = metrics.reduce((sum, row) => sum + row.sales_count, 0);
  const metricCommission = metrics.reduce((sum, row) => sum + row.commission_amount, 0);
  const importedSales = salesRows.reduce((sum, row) => sum + row.sales_count, 0);
  const importedCommission = salesRows.reduce((sum, row) => sum + row.commission_amount, 0);
  const posts30d = Math.max(xPostsCount, metricPosts);
  const fanzaClicks30d = Math.max(xClicksCount, metricClicks);
  const salesCount30d = Math.max(importedSales, metricSales);
  const commission30d = Math.max(importedCommission, metricCommission);
  const followerMetrics = projectFollowerMetrics(metrics);
  const growthRates = projectGrowthRates({
    impressions30d,
    posts30d,
    fanzaClicks30d,
    salesCount30d,
    commission30d,
  });

  return {
    error: null,
    diagnosis: diagnoseFanzaXGrowth(impressions30d, fanzaClicks30d, salesCount30d),
    ...followerMetrics,
    profileVisits30d: metrics.reduce((sum, row) => sum + row.profile_visits, 0),
    impressions30d,
    posts30d,
    ...growthRates,
    xPageViews30d: xPageViewsCount,
    fanzaClicks30d,
    salesCount30d,
    commission30d,
    weeklyRows: projectWeeklyMetrics(metrics),
  };
}
