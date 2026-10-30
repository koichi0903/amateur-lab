const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type FanzaDailyPostFunnelPostReference = {
  post_key: string;
  posted_at: string;
};

export type FanzaDailyPostFunnelCounts = {
  within24h: Map<string, number>;
  within7d: Map<string, number>;
};

export type FanzaDailyPostFunnelSnapshotRow = {
  post_key: string;
  impressions: number | null;
  captured_at: string;
  notes: string | null;
  source: string | null;
  site_visits: number | null;
  affiliate_clicks: number | null;
};

export type FanzaDailyPostFunnelSnapshot = {
  impressions: number | null;
  capturedAt: string;
  source: "manual" | "x_api";
  captureAgeHours: number;
  siteVisits: number;
  affiliateClicks: number;
};

export type FanzaDailyPostFunnelAccount = "hakkutsu_lab" | "bijyo1010";

export type FanzaDailyPostFunnelPost = FanzaDailyPostFunnelPostReference & {
  account_handle: string;
  work_id: number;
  title: string;
  x_post_id: string | null;
};

export type FanzaDailyPostFunnelRow = {
  account: FanzaDailyPostFunnelAccount;
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

function projectImpressionSnapshot(
  post: FanzaDailyPostFunnelPost,
  snapshot: FanzaDailyPostFunnelSnapshot | undefined,
  now: number,
) {
  return {
    impressionsAtCapture: snapshot?.impressions ?? null,
    impressionCapturedAt: snapshot?.capturedAt ?? null,
    impressionSource: snapshot?.source ?? null,
    impressionCaptureAgeHours: snapshot?.captureAgeHours ?? null,
    canRecordImpressions: canRecordFanzaPostImpressions(
      Boolean(snapshot),
      post.x_post_id,
      post.posted_at,
      now,
    ),
  };
}

function countForPost(counts: Map<string, number>, postKey: string) {
  return counts.get(postKey) ?? 0;
}

function projectFunnelCounts(
  postKey: string,
  snapshot: FanzaDailyPostFunnelSnapshot | undefined,
  views: FanzaDailyPostFunnelCounts,
  clicks: FanzaDailyPostFunnelCounts,
) {
  const siteViews24h = countForPost(views.within24h, postKey);
  const fanzaClicks24h = countForPost(clicks.within24h, postKey);
  return {
    siteViews24h,
    fanzaClicks24h,
    siteViewsAtImpressionCapture: snapshot?.siteVisits ?? siteViews24h,
    fanzaClicksAtImpressionCapture: snapshot?.affiliateClicks ?? fanzaClicks24h,
    siteViews7d: countForPost(views.within7d, postKey),
    fanzaClicks7d: countForPost(clicks.within7d, postKey),
  };
}

export function projectFanzaDailyPostFunnelRow(
  post: FanzaDailyPostFunnelPost,
  snapshot: FanzaDailyPostFunnelSnapshot | undefined,
  views: FanzaDailyPostFunnelCounts,
  clicks: FanzaDailyPostFunnelCounts,
  now: number,
): FanzaDailyPostFunnelRow {
  return {
    account: post.account_handle as FanzaDailyPostFunnelAccount,
    postKey: post.post_key,
    workId: post.work_id,
    title: post.title,
    postedAt: post.posted_at,
    xPostId: post.x_post_id,
    ...projectImpressionSnapshot(post, snapshot, now),
    ...projectFunnelCounts(post.post_key, snapshot, views, clicks),
  };
}

export function canRecordFanzaPostImpressions(
  hasSnapshot: boolean,
  xPostId: string | null,
  postedAt: string,
  now: number,
) {
  if (hasSnapshot || !xPostId) return false;
  const ageHours = (now - Date.parse(postedAt)) / HOUR_MS;
  return ageHours >= 24 && ageHours < 30 * 24;
}

export function collectFanzaDailyPostFunnelCounts<T extends { x_post_key: string | null }>(
  rows: T[],
  postByKey: Map<string, FanzaDailyPostFunnelPostReference>,
  getEventTimestamp: (row: T) => string,
) {
  const counts: FanzaDailyPostFunnelCounts = { within24h: new Map(), within7d: new Map() };
  for (const row of rows) {
    const key = row.x_post_key;
    const post = key ? postByKey.get(key) : null;
    if (!key || !post) continue;

    const eventAt = Date.parse(getEventTimestamp(row));
    const postedAt = Date.parse(post.posted_at);
    if (eventAt < postedAt || eventAt > postedAt + 7 * DAY_MS) continue;
    counts.within7d.set(key, (counts.within7d.get(key) ?? 0) + 1);
    if (eventAt <= postedAt + DAY_MS) {
      counts.within24h.set(key, (counts.within24h.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function isSnapshotNotNewerThanCurrent(
  row: FanzaDailyPostFunnelSnapshotRow,
  current: FanzaDailyPostFunnelSnapshot | undefined,
) {
  return Boolean(current && Date.parse(current.capturedAt) >= Date.parse(row.captured_at));
}

function getSnapshotCaptureAgeHours(
  row: FanzaDailyPostFunnelSnapshotRow,
  postByKey: Map<string, FanzaDailyPostFunnelPostReference>,
) {
  const post = postByKey.get(row.post_key);
  return post
    ? (Date.parse(row.captured_at) - Date.parse(post.posted_at)) / HOUR_MS
    : Number.NaN;
}

function buildFanzaDailyPostFunnelSnapshot(
  row: FanzaDailyPostFunnelSnapshotRow,
  captureAgeHours: number,
): FanzaDailyPostFunnelSnapshot {
  const notes = String(row.notes ?? "");
  return {
    impressions: notes && row.source !== "manual" ? null : Number(row.impressions ?? 0),
    capturedAt: String(row.captured_at),
    source: row.source === "manual" ? "manual" : "x_api",
    captureAgeHours,
    siteVisits: Number(row.site_visits ?? 0),
    affiliateClicks: Number(row.affiliate_clicks ?? 0),
  };
}

export function collectFanzaDailyPostFunnelSnapshots(
  rows: FanzaDailyPostFunnelSnapshotRow[],
  postByKey: Map<string, FanzaDailyPostFunnelPostReference>,
) {
  const snapshots = new Map<string, FanzaDailyPostFunnelSnapshot>();
  for (const row of rows) {
    const existingSnapshot = snapshots.get(row.post_key);
    if (isSnapshotNotNewerThanCurrent(row, existingSnapshot)) continue;

    const captureAgeHours = getSnapshotCaptureAgeHours(row, postByKey);
    if (captureAgeHours < 24) continue;

    snapshots.set(row.post_key, buildFanzaDailyPostFunnelSnapshot(row, captureAgeHours));
  }
  return snapshots;
}
