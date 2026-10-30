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

export function collectFanzaDailyPostFunnelSnapshots(
  rows: FanzaDailyPostFunnelSnapshotRow[],
  postByKey: Map<string, FanzaDailyPostFunnelPostReference>,
) {
  const snapshots = new Map<string, FanzaDailyPostFunnelSnapshot>();
  for (const row of rows) {
    const existingSnapshot = snapshots.get(row.post_key);
    if (existingSnapshot && Date.parse(existingSnapshot.capturedAt) >= Date.parse(row.captured_at)) continue;

    const post = postByKey.get(row.post_key);
    const captureAgeHours = post
      ? (Date.parse(row.captured_at) - Date.parse(post.posted_at)) / (60 * 60 * 1000)
      : Number.NaN;
    if (captureAgeHours < 24) continue;

    const notes = String(row.notes ?? "");
    snapshots.set(row.post_key, {
      impressions: notes && row.source !== "manual" ? null : Number(row.impressions ?? 0),
      capturedAt: String(row.captured_at),
      source: row.source === "manual" ? "manual" : "x_api",
      captureAgeHours,
      siteVisits: Number(row.site_visits ?? 0),
      affiliateClicks: Number(row.affiliate_clicks ?? 0),
    });
  }
  return snapshots;
}
