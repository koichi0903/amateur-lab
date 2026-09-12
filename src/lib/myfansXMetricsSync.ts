import { supabaseAdmin } from "@/lib/supabaseAdmin";

type XMetricPost = {
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

type XMetricsResponse = {
  data?: XMetricPost[];
  errors?: Array<{ detail?: string; title?: string; value?: string }>;
};

type MyfansPostForSync = {
  id: number;
  x_post_url: string;
  x_post_id?: string;
};

const X_POST_ID_PATTERN = /(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i;

export function extractXPostId(value: string) {
  const trimmed = value.trim();
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  return trimmed.match(X_POST_ID_PATTERN)?.[1] ?? "";
}

function bearerToken() {
  return process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";
}

function metricNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? 0;
}

async function fetchXMetrics(ids: string[]) {
  const token = bearerToken();
  if (!token) throw new Error("X_BEARER_TOKEN が未設定です。X Developer PortalでBearer Tokenを発行して.env.localに追加してください。");

  const params = new URLSearchParams({
    ids: ids.join(","),
    "tweet.fields": "public_metrics,non_public_metrics,organic_metrics",
  });
  const response = await fetch(`https://api.x.com/2/tweets?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as XMetricsResponse;
  if (!response.ok) {
    const message = payload.errors?.map((error) => error.detail || error.title || error.value).filter(Boolean).join(" / ");
    throw new Error(message || `X APIの取得に失敗しました。HTTP ${response.status}`);
  }
  return new Map((payload.data ?? []).map((post) => [post.id, post]));
}

async function audit(summary: string, metadata = {}) {
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "x_post",
    entity_id: null,
    action: "x_metrics_sync",
    summary,
    metadata,
  });
}

export async function syncMyfansXPostMetrics() {
  const { data, error } = await supabaseAdmin
    .from("myfans_x_posts")
    .select("id,x_post_url,x_post_id")
    .eq("status", "posted")
    .or("x_post_url.neq.,x_post_id.neq.")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;

  const posts = ((data ?? []) as MyfansPostForSync[])
    .map((post) => ({ ...post, resolvedXPostId: post.x_post_id || extractXPostId(post.x_post_url) }))
    .filter((post) => post.resolvedXPostId);
  if (!posts.length) return { checked: 0, updated: 0, failed: 0, message: "同期対象の投稿URLがありません。" };

  const metricsById = await fetchXMetrics([...new Set(posts.map((post) => post.resolvedXPostId))]);
  let updated = 0;
  let failed = 0;

  for (const post of posts) {
    const metric = metricsById.get(post.resolvedXPostId);
    if (!metric) {
      failed += 1;
      await supabaseAdmin
        .from("myfans_x_posts")
        .update({
          x_post_id: post.resolvedXPostId,
          metrics_sync_error: "X APIレスポンスに投稿が含まれていません。",
          external_metrics_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
      continue;
    }

    const impressions = metricNumber(
      metric.organic_metrics?.impression_count,
      metric.non_public_metrics?.impression_count,
      metric.public_metrics?.impression_count,
    );
    const clicks = metricNumber(metric.organic_metrics?.url_link_clicks, metric.non_public_metrics?.url_link_clicks);

    const { error: updateError } = await supabaseAdmin
      .from("myfans_x_posts")
      .update({
        x_post_id: post.resolvedXPostId,
        impressions,
        likes_count: metricNumber(metric.organic_metrics?.like_count, metric.public_metrics?.like_count),
        reposts_count: metricNumber(metric.organic_metrics?.retweet_count, metric.public_metrics?.retweet_count),
        replies_count: metricNumber(metric.organic_metrics?.reply_count, metric.public_metrics?.reply_count),
        clicks,
        metrics_sync_error: "",
        external_metrics_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (updateError) failed += 1;
    else updated += 1;
  }

  await audit("myfans X投稿メトリクスを同期", { checked: posts.length, updated, failed });
  return { checked: posts.length, updated, failed, message: `${updated}件の投稿成績を更新しました。` };
}
