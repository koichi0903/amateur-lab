import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { XPostCandidate } from "@/lib/xPostPlanner";

export type XPostLog = {
  id: number;
  post_key: string;
  work_id: number;
  category: XPostCandidate["category"];
  title: string;
  post_text: string;
  post_date: string;
  posted_at: string;
  creative_variant_id?: string | null;
  hook_type?: XPostCandidate["hookType"] | null;
  image_strategy?: XPostCandidate["imageStrategy"] | null;
  link_strategy?: XPostCandidate["linkStrategy"] | null;
  cta_strategy?: XPostCandidate["ctaStrategy"] | null;
};

export type XPostLogInput = {
  postKey: string;
  workId: number;
  category: XPostCandidate["category"];
  title: string;
  postText: string;
  postDate: string;
  creativeVariantId?: string | null;
  hookType?: XPostCandidate["hookType"] | null;
  imageStrategy?: XPostCandidate["imageStrategy"] | null;
  linkStrategy?: XPostCandidate["linkStrategy"] | null;
  ctaStrategy?: XPostCandidate["ctaStrategy"] | null;
};

export type XPostOutcomeStatus = "winner" | "testing" | "replace";

export type XPostOutcome = XPostLog & {
  clicksSevenDays: number;
  daysSincePost: number;
  status: XPostOutcomeStatus;
  recommendation: string;
};

export type XCreativeLearningRow = {
  dimension: "hook_type" | "image_strategy" | "link_strategy" | "cta_strategy";
  value: string;
  label: string;
  posts: number;
  xPageViews: number;
  xFanzaClicks: number;
  rawCtr: number;
  adjustedCtr: number;
  clicksPerPost: number;
  confidence: "low" | "medium" | "high";
  recommendation: string;
};

type XClickRow = {
  work_id: number;
  clicked_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRecentXPostLogs(): Promise<{
  logs: XPostLog[];
  error: string | null;
}> {
  const query = supabaseAdmin
    .from("x_post_logs")
    .select("id,post_key,work_id,category,title,post_text,post_date,posted_at,creative_variant_id,hook_type,image_strategy,link_strategy,cta_strategy")
    .order("posted_at", { ascending: false })
    .limit(200);
  let { data, error }: { data: unknown[] | null; error: { code?: string; message?: string } | null } = await query;

  if (error && (error.code === "PGRST204" || error.message?.includes("creative_variant_id"))) {
    const fallback = await supabaseAdmin
      .from("x_post_logs")
      .select("id,post_key,work_id,category,title,post_text,post_date,posted_at")
      .order("posted_at", { ascending: false })
      .limit(200);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { logs: [], error: error.message ?? "X投稿ログを取得できませんでした" };
  }

  return { logs: (data ?? []) as XPostLog[], error: null };
}

export async function saveXPostLog(input: XPostLogInput) {
  const row = {
    post_key: input.postKey,
    work_id: input.workId,
    category: input.category,
    title: input.title,
    post_text: input.postText,
    post_date: input.postDate,
    posted_at: new Date().toISOString(),
    creative_variant_id: input.creativeVariantId,
    hook_type: input.hookType,
    image_strategy: input.imageStrategy,
    link_strategy: input.linkStrategy,
    cta_strategy: input.ctaStrategy,
  };
  const result = await supabaseAdmin.from("x_post_logs").upsert(row, { onConflict: "post_key,post_date" });

  if (result.error && (result.error.code === "PGRST204" || result.error.message?.includes("creative_variant_id"))) {
    const { creative_variant_id, hook_type, image_strategy, link_strategy, cta_strategy, ...fallback } = row;
    void creative_variant_id;
    void hook_type;
    void image_strategy;
    void link_strategy;
    void cta_strategy;
    return supabaseAdmin.from("x_post_logs").upsert(fallback, { onConflict: "post_key,post_date" });
  }

  return result;
}

function creativeLabel(dimension: XCreativeLearningRow["dimension"], value: string) {
  const labels: Record<string, string> = {
    price_anomaly: "価格フック",
    rating_anomaly: "評価異常フック",
    ranking_anomaly: "異常値フック",
    review_proof: "レビュー証明",
    discovery_anomaly: "発掘指数フック",
    buy_timing: "買い時フック",
    original_work_image: "作品画像",
    branded_data_card: "データカード",
    body_link: "本文リンク",
    reply_link: "自己リプリンク",
    price_cta: "価格CTA",
    reason_cta: "理由を見るCTA",
  };
  return labels[value] ?? `${dimension}:${value}`;
}

function adjustedCtr(pageViews: number, clicks: number) {
  const priorViews = 30;
  const priorCtr = 0.06;
  return ((clicks + priorViews * priorCtr) / (pageViews + priorViews)) * 100;
}

function confidence(posts: number, pageViews: number, clicks: number): XCreativeLearningRow["confidence"] {
  if (posts >= 6 && pageViews >= 120 && clicks >= 8) return "high";
  if (posts >= 3 && pageViews >= 50 && clicks >= 3) return "medium";
  return "low";
}

export async function getXCreativeLearning(days = 30): Promise<{ rows: XCreativeLearningRow[]; error: string | null }> {
  const { logs, error } = await getRecentXPostLogs();
  if (error) return { rows: [], error };
  const cutoff = Date.now() - days * DAY_MS;
  const scopedLogs = logs.filter((log) => new Date(log.posted_at).getTime() >= cutoff);
  const keys = scopedLogs.map((log) => log.post_key);
  if (!keys.length) return { rows: [], error: null };

  const since = new Date(cutoff).toISOString();
  const [viewResult, clickResult] = await Promise.all([
    supabaseAdmin.from("work_page_views").select("x_post_key").in("x_post_key", keys).gte("viewed_at", since).limit(50_000),
    supabaseAdmin.from("affiliate_clicks").select("x_post_key").in("x_post_key", keys).gte("clicked_at", since).limit(50_000),
  ]);
  if (viewResult.error || clickResult.error) {
    return { rows: [], error: viewResult.error?.message ?? clickResult.error?.message ?? "creative learning error" };
  }

  const views = new Map<string, number>();
  const clicks = new Map<string, number>();
  for (const row of (viewResult.data ?? []) as Array<{ x_post_key: string | null }>) {
    if (row.x_post_key) views.set(row.x_post_key, (views.get(row.x_post_key) ?? 0) + 1);
  }
  for (const row of (clickResult.data ?? []) as Array<{ x_post_key: string | null }>) {
    if (row.x_post_key) clicks.set(row.x_post_key, (clicks.get(row.x_post_key) ?? 0) + 1);
  }

  const dimensions: XCreativeLearningRow["dimension"][] = ["hook_type", "image_strategy", "link_strategy", "cta_strategy"];
  const rows: XCreativeLearningRow[] = [];
  for (const dimension of dimensions) {
    const groups = new Map<string, { posts: number; pageViews: number; clicks: number }>();
    for (const log of scopedLogs) {
      const value = log[dimension] ?? "unknown";
      if (value === "unknown") continue;
      const current = groups.get(value) ?? { posts: 0, pageViews: 0, clicks: 0 };
      current.posts += 1;
      current.pageViews += views.get(log.post_key) ?? 0;
      current.clicks += clicks.get(log.post_key) ?? 0;
      groups.set(value, current);
    }
    for (const [value, stats] of groups) {
      const rawCtr = stats.pageViews ? (stats.clicks / stats.pageViews) * 100 : 0;
      const corrected = adjustedCtr(stats.pageViews, stats.clicks);
      const trust = confidence(stats.posts, stats.pageViews, stats.clicks);
      rows.push({
        dimension,
        value,
        label: creativeLabel(dimension, value),
        posts: stats.posts,
        xPageViews: stats.pageViews,
        xFanzaClicks: stats.clicks,
        rawCtr: Math.round(rawCtr * 10) / 10,
        adjustedCtr: Math.round(corrected * 10) / 10,
        clicksPerPost: Math.round((stats.clicks / Math.max(stats.posts, 1)) * 10) / 10,
        confidence: trust,
        recommendation: trust === "low"
          ? "サンプル不足。まだ断定しない"
          : corrected >= 8
            ? "勝ち寄り。配分を少し増やす"
            : corrected <= 3
              ? "弱め。別フックを試す"
              : "継続テスト",
      });
    }
  }

  return { rows: rows.sort((a, b) => b.adjustedCtr - a.adjustedCtr || b.xFanzaClicks - a.xFanzaClicks), error: null };
}

export async function deleteXPostLog(postKey: string, postDate: string) {
  return supabaseAdmin
    .from("x_post_logs")
    .delete()
    .eq("post_key", postKey)
    .eq("post_date", postDate);
}

export async function getXPostOutcomes(): Promise<{
  outcomes: XPostOutcome[];
  error: string | null;
}> {
  const { logs, error } = await getRecentXPostLogs();

  if (error) {
    return { outcomes: [], error };
  }

  if (!logs.length) {
    return { outcomes: [], error: null };
  }

  const workIds = Array.from(new Set(logs.map((log) => log.work_id)));
  const oldestPostTime = Math.min(
    ...logs.map((log) => new Date(log.posted_at).getTime()),
  );
  const clickCutoff = new Date(oldestPostTime).toISOString();
  const { data, error: clickError } = await supabaseAdmin
    .from("affiliate_clicks")
    .select("work_id,clicked_at")
    .eq("source_page", "x")
    .in("work_id", workIds)
    .gte("clicked_at", clickCutoff);

  if (clickError) {
    return { outcomes: [], error: clickError.message };
  }

  const now = Date.now();
  const clicks = (data ?? []) as XClickRow[];
  const outcomes = logs.map((log) => {
    const postedAt = new Date(log.posted_at).getTime();
    const windowEnd = postedAt + (7 * DAY_MS);
    const clicksSevenDays = clicks.filter((click) => {
      const clickedAt = new Date(click.clicked_at).getTime();
      return (
        click.work_id === log.work_id &&
        clickedAt >= postedAt &&
        clickedAt <= windowEnd
      );
    }).length;
    const daysSincePost = Math.max(0, Math.floor((now - postedAt) / DAY_MS));
    const status: XPostOutcomeStatus = daysSincePost < 7
      ? "testing"
      : clicksSevenDays > 0
        ? "winner"
        : "replace";
    const recommendation = status === "testing"
      ? "7日目まで様子を見る"
      : status === "winner"
        ? "この切り口を次の投稿でも使う"
        : "見せ方を変えて再投稿する";

    return {
      ...log,
      clicksSevenDays,
      daysSincePost,
      status,
      recommendation,
    };
  });

  return {
    outcomes: outcomes.sort((a, b) => {
      if (a.status !== b.status) {
        const order: Record<XPostOutcomeStatus, number> = {
          winner: 0,
          testing: 1,
          replace: 2,
        };
        return order[a.status] - order[b.status];
      }
      return b.clicksSevenDays - a.clicksSevenDays;
    }),
    error: null,
  };
}
