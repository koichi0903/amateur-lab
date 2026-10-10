import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACCOUNTS = ["hakkutsu_lab", "bijyo1010"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_PAGE_SIZE = 1000;
const MAX_EVENT_ROWS = 50_000;

async function readPaginatedRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_EVENT_ROWS; from += EVENT_PAGE_SIZE) {
    const result = await readPage(from, from + EVENT_PAGE_SIZE - 1);
    if (result.error) return { rows, error: result.error.message };
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < EVENT_PAGE_SIZE) return { rows, error: null as string | null };
  }
  return { rows: [] as T[], error: `投稿別イベントが${MAX_EVENT_ROWS.toLocaleString("ja-JP")}件を超えたため、完全な集計を出せません。`, };
}

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
  siteViewsAtImpressionCapture: number;
  fanzaClicksAtImpressionCapture: number;
  canRecordImpressions: boolean;
  siteViews24h: number;
  fanzaClicks24h: number;
  siteViews7d: number;
  fanzaClicks7d: number;
};

export async function getFanzaDailyPostFunnel(days = 30) {
  const evaluatedAt = new Date().toISOString();
  const now = Date.parse(evaluatedAt);
  const since = new Date(now - days * DAY_MS).toISOString();
  const postsResult = await supabaseAdmin
    .from("x_post_logs")
    .select("account_handle,post_key,work_id,title,posted_at,x_post_id")
    .in("account_handle", [...ACCOUNTS])
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (postsResult.error) {
    return { rows: [] as FanzaDailyPostFunnelRow[], error: postsResult.error.message, evaluatedAt };
  }

  const posts = (postsResult.data ?? []) as Array<{
    account_handle: string;
    post_key: string;
    work_id: number;
    title: string;
    posted_at: string;
    x_post_id: string | null;
  }>;
  if (!posts.length) return { rows: [] as FanzaDailyPostFunnelRow[], error: null, evaluatedAt };

  const keys = posts.map((post) => post.post_key);
  const postByKey = new Map(posts.map((post) => [post.post_key, post]));
  const [viewsResult, clicksResult, snapshotsResult] = await Promise.all([
    readPaginatedRows<{ x_post_key: string | null; viewed_at: string }>((from, to) => supabaseAdmin
      .from("work_page_views")
      .select("x_post_key,viewed_at")
      .in("x_post_key", keys)
      .gte("viewed_at", since)
      .range(from, to)),
    readPaginatedRows<{ x_post_key: string | null; clicked_at: string }>((from, to) => supabaseAdmin
      .from("affiliate_clicks")
      .select("x_post_key,clicked_at")
      .eq("source_page", "x")
      .in("x_post_key", keys)
      .gte("clicked_at", since)
      .range(from, to)),
    supabaseAdmin
      .from("x_metric_snapshots")
      .select("post_key,impressions,captured_at,notes,source")
      .eq("snapshot_age", "24h")
      .in("post_key", keys)
      .order("captured_at", { ascending: false }),
  ]);
  const error = viewsResult.error ?? clicksResult.error ?? snapshotsResult.error;
  if (error) return { rows: [] as FanzaDailyPostFunnelRow[], error: typeof error === "string" ? error : error.message, evaluatedAt };

  const views = new Map<string, number>();
  const clicks = new Map<string, number>();
  const views24h = new Map<string, number>();
  const clicks24h = new Map<string, number>();
  const viewsAtCapture = new Map<string, number>();
  const clicksAtCapture = new Map<string, number>();
  const snapshots = new Map<string, { impressions: number | null; capturedAt: string; source: "manual" | "x_api"; captureAgeHours: number }>();
  for (const snapshot of snapshotsResult.data ?? []) {
    const key = snapshot.post_key;
    if (snapshots.has(key)) continue;
    const post = postByKey.get(key);
    const capturedAt = String(snapshot.captured_at);
    const captureAgeHours = post
      ? (Date.parse(capturedAt) - Date.parse(post.posted_at)) / (60 * 60 * 1000)
      : Number.NaN;
    if (captureAgeHours < 24 || captureAgeHours >= 30 * 24) continue;
    const notes = String(snapshot.notes ?? "");
    snapshots.set(key, {
      impressions: notes && snapshot.source !== "manual" ? null : Number(snapshot.impressions ?? 0),
      capturedAt,
      source: snapshot.source === "manual" ? "manual" : "x_api",
      captureAgeHours,
    });
  }
  for (const row of viewsResult.rows) {
    const key = row.x_post_key;
    const post = key ? postByKey.get(key) : null;
    const viewedAt = Date.parse(row.viewed_at);
    if (key && post && viewedAt >= Date.parse(post.posted_at) && viewedAt <= Date.parse(post.posted_at) + 7 * DAY_MS) {
      views.set(key, (views.get(key) ?? 0) + 1);
      if (viewedAt <= Date.parse(post.posted_at) + DAY_MS) views24h.set(key, (views24h.get(key) ?? 0) + 1);
      const snapshot = snapshots.get(key);
      if (snapshot && viewedAt <= Date.parse(snapshot.capturedAt)) viewsAtCapture.set(key, (viewsAtCapture.get(key) ?? 0) + 1);
    }
  }
  for (const row of clicksResult.rows) {
    const key = row.x_post_key;
    const post = key ? postByKey.get(key) : null;
    const clickedAt = Date.parse(row.clicked_at);
    if (key && post && clickedAt >= Date.parse(post.posted_at) && clickedAt <= Date.parse(post.posted_at) + 7 * DAY_MS) {
      clicks.set(key, (clicks.get(key) ?? 0) + 1);
      if (clickedAt <= Date.parse(post.posted_at) + DAY_MS) clicks24h.set(key, (clicks24h.get(key) ?? 0) + 1);
      const snapshot = snapshots.get(key);
      if (snapshot && clickedAt <= Date.parse(snapshot.capturedAt)) clicksAtCapture.set(key, (clicksAtCapture.get(key) ?? 0) + 1);
    }
  }

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
        siteViewsAtImpressionCapture: snapshot ? viewsAtCapture.get(post.post_key) ?? 0 : views24h.get(post.post_key) ?? 0,
        fanzaClicksAtImpressionCapture: snapshot ? clicksAtCapture.get(post.post_key) ?? 0 : clicks24h.get(post.post_key) ?? 0,
        canRecordImpressions: !snapshot && Boolean(post.x_post_id) && (() => {
          const ageHours = (now - Date.parse(post.posted_at)) / (60 * 60 * 1000);
          return ageHours >= 24 && ageHours < 30 * 24;
        })(),
        siteViews24h: views24h.get(post.post_key) ?? 0,
        fanzaClicks24h: clicks24h.get(post.post_key) ?? 0,
        siteViews7d: views.get(post.post_key) ?? 0,
        fanzaClicks7d: clicks.get(post.post_key) ?? 0,
      };
    }),
    error: null,
    evaluatedAt,
  };
}
