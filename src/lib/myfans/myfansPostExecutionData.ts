import { intValue, text } from "../formDataValues";

export type MyfansPostExecutionRecord =
  | { status: "posted"; posted_at: string; updated_at: string }
  | { x_post_url: string; status: "posted"; posted_at: string; updated_at: string }
  | {
      impressions: number;
      likes_count: number;
      reposts_count: number;
      replies_count: number;
      clicks: number;
      external_metrics_checked_at: string;
      metrics_recorded_at: string;
      updated_at: string;
    };

export function buildMyfansPostExecutionRecord(mode: string, formData: FormData): MyfansPostExecutionRecord | null {
  if (mode === "posted") {
    return {
      status: "posted",
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  if (mode === "url") {
    return {
      x_post_url: text(formData, "x_post_url"),
      status: "posted",
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  if (mode === "metrics") {
    return {
      impressions: intValue(formData, "impressions"),
      likes_count: intValue(formData, "likes_count"),
      reposts_count: intValue(formData, "reposts_count"),
      replies_count: intValue(formData, "replies_count"),
      clicks: intValue(formData, "clicks"),
      external_metrics_checked_at: new Date().toISOString(),
      metrics_recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return null;
}

export type MyfansAttributedPostMetrics = {
  approved_media_id: number;
  pattern_id: number;
  creator_id: number | null;
  product_id: number | null;
  quote_candidate_id: number | null;
  impressions: number | null;
  likes_count: number | null;
  reposts_count: number | null;
  replies_count: number | null;
  clicks: number | null;
};

export type MyfansPatternLearningRow = {
  id?: number | null;
  impressions?: number | null;
  engagements?: number | null;
  clicks?: number | null;
  posts_count?: number | null;
  posterior_weight?: number | null;
};

function patternLearningIdentity(post: MyfansAttributedPostMetrics) {
  return {
    approved_media_id: post.approved_media_id,
    pattern_id: post.pattern_id,
    creator_id: post.creator_id ?? null,
    product_id: post.product_id ?? null,
    quote_candidate_id: post.quote_candidate_id ?? null,
  };
}

function sumNullableMetrics(...values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function patternLearningCounts(post: MyfansAttributedPostMetrics, learning: MyfansPatternLearningRow | null) {
  return {
    impressions: sumNullableMetrics(learning?.impressions, post.impressions),
    engagements: sumNullableMetrics(learning?.engagements, post.likes_count, post.reposts_count, post.replies_count),
    clicks: sumNullableMetrics(learning?.clicks, post.clicks),
    posts_count: sumNullableMetrics(learning?.posts_count, 1),
  };
}

function patternLearningPosteriorWeight(post: MyfansAttributedPostMetrics, learning: MyfansPatternLearningRow | null) {
  const previousWeight = Number(learning?.posterior_weight ?? 1);
  const clickSignal = ((post.clicks ?? 0) / Math.max(1, post.impressions ?? 0)) * 10;
  return Math.max(1, previousWeight + Math.min(2, clickSignal));
}

export function buildMyfansPatternLearningValues(
  post: MyfansAttributedPostMetrics,
  learning: MyfansPatternLearningRow | null,
  postId: number,
  timestamps?: { lastObservedAt: string; updatedAt: string },
) {
  const lastObservedAt = timestamps?.lastObservedAt ?? new Date().toISOString();
  const updatedAt = timestamps?.updatedAt ?? new Date().toISOString();
  return {
    ...patternLearningIdentity(post),
    ...patternLearningCounts(post, learning),
    posterior_weight: patternLearningPosteriorWeight(post, learning),
    last_observed_at: lastObservedAt,
    metadata: { feedback_source: "myfans_x_posts_metrics", post_id: postId },
    updated_at: updatedAt,
  };
}
