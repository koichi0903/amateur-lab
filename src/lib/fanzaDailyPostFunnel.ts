import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFanzaDailyPostFunnelRows, readFanzaDailyPostFunnelRowsForKeys } from "@/lib/fanzaDailyPostFunnelPagination";
import {
  canRecordFanzaPostImpressions,
  collectFanzaDailyPostFunnelCounts,
  collectFanzaDailyPostFunnelSnapshots,
  type FanzaDailyPostFunnelPostReference,
  type FanzaDailyPostFunnelSnapshotRow,
} from "@/lib/fanzaDailyPostFunnelAggregation";

const ACCOUNTS = ["hakkutsu_lab", "bijyo1010"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
export type FanzaDailyPostFunnelRow = {
  account: (typeof ACCOUNTS)[number];
  postKey: string;
  workId: number;
  title: string;
  postedAt: string;
  xPostId: string | null;
  impressionsAtCapture: number | null;
  impressionCapturedAt: string | null;
  impressionSource: "manual" | "x_api" | null;
  impressionCaptureAgeHours: number | null;
  canRecordImpressions: boolean;
  siteViews24h: number;
  fanzaClicks24h: number;
  siteViewsAtImpressionCapture: number;
  fanzaClicksAtImpressionCapture: number;
  siteViews7d: number;
  fanzaClicks7d: number;
};

export async function getFanzaDailyPostFunnel(days = 30) {
  const evaluatedAt = new Date().toISOString();
  const now = Date.parse(evaluatedAt);
  const since = new Date(now - days * DAY_MS).toISOString();
  const postsResult = await readFanzaDailyPostFunnelRows<{
    account_handle: string;
    post_key: string;
    work_id: number;
    title: string;
    posted_at: string;
    x_post_id: string | null;
  }>((from, to) => supabaseAdmin
    .from("x_post_logs")
    .select("account_handle,post_key,work_id,title,posted_at,x_post_id")
    .in("account_handle", [...ACCOUNTS])
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .order("post_key", { ascending: true })
    .range(from, to));

  if (postsResult.error) {
    return { rows: [] as FanzaDailyPostFunnelRow[], error: postsResult.error, evaluatedAt };
  }

  const posts = postsResult.rows;
  const keys = posts.map((post) => post.post_key);
  if (new Set(keys).size !== keys.length) {
    return { rows: [] as FanzaDailyPostFunnelRow[], error: "投稿計測キーが重複しているため、アカウント別の表示数を安全に照合できません。", evaluatedAt };
  }
  if (!posts.length) return { rows: [] as FanzaDailyPostFunnelRow[], error: null, evaluatedAt };

  const postByKey = new Map<string, FanzaDailyPostFunnelPostReference>(posts.map((post) => [post.post_key, post]));
  const [viewsResult, clicksResult, snapshotsResult] = await Promise.all([
    readFanzaDailyPostFunnelRowsForKeys<{ id: number; x_post_key: string | null; viewed_at: string }>(keys, (keyBatch, from, to) => supabaseAdmin
      .from("work_page_views")
      .select("id,x_post_key,viewed_at")
      .in("x_post_key", [...keyBatch])
      .gte("viewed_at", since)
      .order("id", { ascending: true })
      .range(from, to)),
    readFanzaDailyPostFunnelRowsForKeys<{ id: number; x_post_key: string | null; clicked_at: string }>(keys, (keyBatch, from, to) => supabaseAdmin
      .from("affiliate_clicks")
      .select("id,x_post_key,clicked_at")
      .eq("source_page", "x")
      .in("x_post_key", [...keyBatch])
      .gte("clicked_at", since)
      .order("id", { ascending: true })
      .range(from, to)),
    readFanzaDailyPostFunnelRowsForKeys<{
      post_key: string;
      impressions: number | null;
      captured_at: string;
      notes: string | null;
      source: string | null;
      site_visits: number | null;
      affiliate_clicks: number | null;
    }>(keys, (keyBatch, from, to) => supabaseAdmin
      .from("x_metric_snapshots")
      .select("post_key,impressions,captured_at,notes,source,site_visits,affiliate_clicks")
      .eq("snapshot_age", "24h")
      .in("post_key", [...keyBatch])
      .order("captured_at", { ascending: true })
      .order("post_key", { ascending: true })
      .range(from, to)),
  ]);
  const error = viewsResult.error ?? clicksResult.error ?? snapshotsResult.error;
  if (error) return { rows: [] as FanzaDailyPostFunnelRow[], error, evaluatedAt };

  const views = collectFanzaDailyPostFunnelCounts(viewsResult.rows, postByKey, (row) => row.viewed_at);
  const clicks = collectFanzaDailyPostFunnelCounts(clicksResult.rows, postByKey, (row) => row.clicked_at);
  const snapshots = collectFanzaDailyPostFunnelSnapshots(
    snapshotsResult.rows as FanzaDailyPostFunnelSnapshotRow[],
    postByKey,
  );

  return {
    rows: posts.map((post) => {
      const snapshot = snapshots.get(post.post_key);
      return {
        account: post.account_handle as (typeof ACCOUNTS)[number],
        postKey: post.post_key,
        workId: post.work_id,
        title: post.title,
        postedAt: post.posted_at,
        xPostId: post.x_post_id,
        impressionsAtCapture: snapshot?.impressions ?? null,
        impressionCapturedAt: snapshot?.capturedAt ?? null,
        impressionSource: snapshot?.source ?? null,
        impressionCaptureAgeHours: snapshot?.captureAgeHours ?? null,
        canRecordImpressions: canRecordFanzaPostImpressions(Boolean(snapshot), post.x_post_id, post.posted_at, now),
        siteViews24h: views.within24h.get(post.post_key) ?? 0,
        fanzaClicks24h: clicks.within24h.get(post.post_key) ?? 0,
        siteViewsAtImpressionCapture: snapshot?.siteVisits ?? views.within24h.get(post.post_key) ?? 0,
        fanzaClicksAtImpressionCapture: snapshot?.affiliateClicks ?? clicks.within24h.get(post.post_key) ?? 0,
        siteViews7d: views.within7d.get(post.post_key) ?? 0,
        fanzaClicks7d: clicks.within7d.get(post.post_key) ?? 0,
      };
    }),
    error: null,
    evaluatedAt,
  };
}
