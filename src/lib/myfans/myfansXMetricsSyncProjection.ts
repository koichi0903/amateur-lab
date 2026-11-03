export type XMetricPost = {
  id: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    impression_count?: number;
  };
  non_public_metrics?: {
    impression_count?: number;
    user_profile_clicks?: number;
    url_link_clicks?: number;
  };
  organic_metrics?: {
    impression_count?: number;
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    user_profile_clicks?: number;
    url_link_clicks?: number;
  };
};

export type MyfansXPostMetricValues = {
  impressions: number;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  clicks: number;
};

function metricNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? 0;
}

export function projectMyfansXPostMetrics(metric: XMetricPost): MyfansXPostMetricValues {
  const organic = metric.organic_metrics ?? {};
  const nonPublic = metric.non_public_metrics ?? {};
  const publicMetrics = metric.public_metrics ?? {};

  return {
    impressions: metricNumber(
      organic.impression_count,
      nonPublic.impression_count,
      publicMetrics.impression_count,
    ),
    likes_count: metricNumber(organic.like_count, publicMetrics.like_count),
    reposts_count: metricNumber(organic.retweet_count, publicMetrics.retweet_count),
    replies_count: metricNumber(organic.reply_count, publicMetrics.reply_count),
    clicks: metricNumber(organic.url_link_clicks, nonPublic.url_link_clicks),
  };
}
