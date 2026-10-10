import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACCOUNTS = ["hakkutsu_lab", "bijyo1010"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type FanzaDailyPostFunnelRow = {
  account: (typeof ACCOUNTS)[number];
  postKey: string;
  workId: number;
  title: string;
  postedAt: string;
  xPostId: string | null;
  impressions24h: number | null;
  impressionCapturedAt: string | null;
  siteViews24h: number;
  fanzaClicks24h: number;
  siteViews7d: number;
  fanzaClicks7d: number;
};

export async function getFanzaDailyPostFunnel(days = 30) {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const postsResult = await supabaseAdmin
    .from("x_post_logs")
    .select("account_handle,post_key,work_id,title,posted_at,x_post_id")
    .in("account_handle", [...ACCOUNTS])
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (postsResult.error) {
    return { rows: [] as FanzaDailyPostFunnelRow[], error: postsResult.error.message };
  }

  const posts = (postsResult.data ?? []) as Array<{
    account_handle: string;
    post_key: string;
    work_id: number;
    title: string;
    posted_at: string;
    x_post_id: string | null;
  }>;
  if (!posts.length) return { rows: [] as FanzaDailyPostFunnelRow[], error: null };

  const keys = posts.map((post) => post.post_key);
  const postByKey = new Map(posts.map((post) => [post.post_key, post]));
  const [viewsResult, clicksResult, snapshotsResult] = await Promise.all([
    supabaseAdmin
      .from("work_page_views")
      .select("x_post_key,viewed_at")
      .in("x_post_key", keys)
      .gte("viewed_at", since)
      .limit(50_000),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("x_post_key,clicked_at")
      .eq("source_page", "x")
      .in("x_post_key", keys)
      .gte("clicked_at", since)
      .limit(50_000),
    supabaseAdmin
      .from("x_metric_snapshots")
      .select("post_key,impressions,captured_at,notes")
      .eq("snapshot_age", "24h")
      .in("post_key", keys)
      .order("captured_at", { ascending: false }),
  ]);
  const error = viewsResult.error ?? clicksResult.error ?? snapshotsResult.error;
  if (error) return { rows: [] as FanzaDailyPostFunnelRow[], error: error.message };

  const views = new Map<string, number>();
  const clicks = new Map<string, number>();
  const views24h = new Map<string, number>();
  const clicks24h = new Map<string, number>();
  for (const row of viewsResult.data ?? []) {
    const key = row.x_post_key as string | null;
    const post = key ? postByKey.get(key) : null;
    const viewedAt = Date.parse(row.viewed_at as string);
    if (key && post && viewedAt >= Date.parse(post.posted_at) && viewedAt <= Date.parse(post.posted_at) + 7 * DAY_MS) {
      views.set(key, (views.get(key) ?? 0) + 1);
      if (viewedAt <= Date.parse(post.posted_at) + DAY_MS) views24h.set(key, (views24h.get(key) ?? 0) + 1);
    }
  }
  for (const row of clicksResult.data ?? []) {
    const key = row.x_post_key as string | null;
    const post = key ? postByKey.get(key) : null;
    const clickedAt = Date.parse(row.clicked_at as string);
    if (key && post && clickedAt >= Date.parse(post.posted_at) && clickedAt <= Date.parse(post.posted_at) + 7 * DAY_MS) {
      clicks.set(key, (clicks.get(key) ?? 0) + 1);
      if (clickedAt <= Date.parse(post.posted_at) + DAY_MS) clicks24h.set(key, (clicks24h.get(key) ?? 0) + 1);
    }
  }

  const snapshots = new Map<string, { impressions: number | null; capturedAt: string }>();
  for (const snapshot of snapshotsResult.data ?? []) {
    const key = snapshot.post_key as string;
    if (snapshots.has(key)) continue;
    const post = postByKey.get(key);
    const capturedAt = String(snapshot.captured_at);
    const captureAgeHours = post
      ? (Date.parse(capturedAt) - Date.parse(post.posted_at)) / (60 * 60 * 1000)
      : Number.NaN;
    if (captureAgeHours < 24 || captureAgeHours >= 27) continue;
    const notes = String(snapshot.notes ?? "");
    snapshots.set(key, {
      impressions: notes ? null : Number(snapshot.impressions ?? 0),
      capturedAt,
    });
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
        impressions24h: snapshot?.impressions ?? null,
        impressionCapturedAt: snapshot?.capturedAt ?? null,
        siteViews24h: views24h.get(post.post_key) ?? 0,
        fanzaClicks24h: clicks24h.get(post.post_key) ?? 0,
        siteViews7d: views.get(post.post_key) ?? 0,
        fanzaClicks7d: clicks.get(post.post_key) ?? 0,
      };
    }),
    error: null,
  };
}
