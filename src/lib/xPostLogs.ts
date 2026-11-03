import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { XPostCandidate } from "@/lib/xPostPlanner";
import { aggregateXCreativeLearning, type XCreativeLearningRow } from "./x-growth/xCreativeLearningAggregation";
import { buildLegacyXPostLogFallback } from "./x-growth/xPostLogFallback";
export type { XCreativeLearningRow } from "./x-growth/xCreativeLearningAggregation";

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
  account_handle?: string;
  post_intent?: XPostLogIntent;
  scheduled_slot?: string | null;
  planned_at?: string | null;
  reply_posted_at?: string | null;
  evaluation_due_at?: string | null;
  impressions_24h?: number;
  engagements_24h?: number;
  profile_visits_24h?: number;
  follows_24h?: number;
  reposts_24h?: number;
  replies_24h?: number;
  learning_note?: string;
  x_post_id?: string | null;
  opportunity_id?: number | null;
  media_asset_id?: number | null;
  creative_genome?: Record<string, unknown> | null;
};

export type XPostLogIntent = "work_link" | "reply" | "quote" | "profile" | "repost" | "normal";

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
  accountHandle?: string;
  postIntent?: XPostLogIntent;
  scheduledSlot?: string | null;
  plannedAt?: string | null;
  xPostId?: string | null;
  opportunityId?: number | null;
  mediaAssetId?: number | null;
  creativeGenome?: Record<string, unknown> | null;
};

export type XPostOutcomeStatus = "winner" | "testing" | "replace";

export type XPostOutcome = XPostLog & {
  impressions24h: number;
  profileVisits24h: number;
  follows24h: number;
  clicks24h: number;
  clicksSevenDays: number;
  daysSincePost: number;
  status: XPostOutcomeStatus;
  recommendation: string;
};

type XClickRow = {
  work_id: number;
  clicked_at: string;
  x_post_key: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRecentXPostLogs(): Promise<{
  logs: XPostLog[];
  error: string | null;
}> {
  const query = supabaseAdmin
    .from("x_post_logs")
    .select("id,post_key,work_id,category,title,post_text,post_date,posted_at,creative_variant_id,hook_type,image_strategy,link_strategy,cta_strategy,account_handle,post_intent,scheduled_slot,planned_at,reply_posted_at,evaluation_due_at,impressions_24h,engagements_24h,profile_visits_24h,follows_24h,reposts_24h,replies_24h,learning_note,x_post_id,opportunity_id,media_asset_id,creative_genome")
    .eq("account_handle", "hakkutsu_lab")
    .order("posted_at", { ascending: false })
    .limit(200);
  let { data, error }: { data: unknown[] | null; error: { code?: string; message?: string } | null } = await query;

  if (error && (error.code === "PGRST204" || error.message?.includes("creative_variant_id") || error.message?.includes("account_handle"))) {
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
  const postedAt = new Date();
  const row = {
    account_handle: input.accountHandle ?? "hakkutsu_lab",
    post_key: input.postKey,
    work_id: input.workId,
    category: input.category,
    title: input.title,
    post_text: input.postText,
    post_date: input.postDate,
    posted_at: postedAt.toISOString(),
    post_intent: input.postIntent ?? "work_link",
    scheduled_slot: input.scheduledSlot,
    planned_at: input.plannedAt,
    evaluation_due_at: new Date(postedAt.getTime() + DAY_MS).toISOString(),
    creative_variant_id: input.creativeVariantId,
    hook_type: input.hookType,
    image_strategy: input.imageStrategy,
    link_strategy: input.linkStrategy,
    cta_strategy: input.ctaStrategy,
    x_post_id: input.xPostId,
    opportunity_id: input.opportunityId,
    media_asset_id: input.mediaAssetId,
    creative_genome: input.creativeGenome,
  };
  const result = await supabaseAdmin.from("x_post_logs").upsert(row, { onConflict: "post_key,post_date" });
  const fallback = buildLegacyXPostLogFallback(result.error, input.xPostId, row);
  if (fallback) return supabaseAdmin.from("x_post_logs").upsert(fallback, { onConflict: "post_key,post_date" });
  return result;
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

  const views = (viewResult.data ?? []) as Array<{ x_post_key: string | null }>;
  const clicks = (clickResult.data ?? []) as Array<{ x_post_key: string | null }>;
  return { rows: aggregateXCreativeLearning(scopedLogs, views, clicks), error: null };
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
    .select("work_id,clicked_at,x_post_key")
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
        click.x_post_key === log.post_key &&
        clickedAt >= postedAt &&
        clickedAt <= windowEnd
      );
    }).length;
    const clicks24h = clicks.filter((click) => {
      const clickedAt = new Date(click.clicked_at).getTime();
      return (
        click.x_post_key === log.post_key &&
        clickedAt >= postedAt &&
        clickedAt <= postedAt + DAY_MS
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
      impressions24h: log.impressions_24h ?? 0,
      profileVisits24h: log.profile_visits_24h ?? 0,
      follows24h: log.follows_24h ?? 0,
      clicks24h,
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
