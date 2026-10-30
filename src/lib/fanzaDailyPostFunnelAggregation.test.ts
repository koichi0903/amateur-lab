import assert from "node:assert/strict";
import test from "node:test";
import {
  canRecordFanzaPostImpressions,
  collectFanzaDailyPostFunnelCounts,
  collectFanzaDailyPostFunnelSnapshots,
  type FanzaDailyPostFunnelSnapshotRow,
} from "./fanzaDailyPostFunnelAggregation.ts";

const postedAt = "2026-10-01T00:00:00.000Z";
const postByKey = new Map([["post-a", { post_key: "post-a", posted_at: postedAt }]]);

test("allows manual impression capture only from 24 hours until 30 days after posting", () => {
  const atHours = (hours: number) => Date.parse(postedAt) + hours * 60 * 60 * 1000;
  assert.equal(canRecordFanzaPostImpressions(false, "x-post", postedAt, atHours(23.99)), false);
  assert.equal(canRecordFanzaPostImpressions(false, "x-post", postedAt, atHours(24)), true);
  assert.equal(canRecordFanzaPostImpressions(false, "x-post", postedAt, atHours(29 * 24)), true);
  assert.equal(canRecordFanzaPostImpressions(false, "x-post", postedAt, atHours(30 * 24)), false);
  assert.equal(canRecordFanzaPostImpressions(true, "x-post", postedAt, atHours(24)), false);
  assert.equal(canRecordFanzaPostImpressions(false, null, postedAt, atHours(24)), false);
});

test("counts post-linked views and clicks within inclusive 24-hour and 7-day windows", () => {
  const counts = collectFanzaDailyPostFunnelCounts([
    { x_post_key: "post-a", at: "2026-09-30T23:59:59.999Z" },
    { x_post_key: "post-a", at: postedAt },
    { x_post_key: "post-a", at: "2026-10-02T00:00:00.000Z" },
    { x_post_key: "post-a", at: "2026-10-08T00:00:00.000Z" },
    { x_post_key: "post-a", at: "2026-10-08T00:00:00.001Z" },
    { x_post_key: "unknown", at: postedAt },
    { x_post_key: null, at: postedAt },
  ], postByKey, (row) => row.at);

  assert.equal(counts.within24h.get("post-a"), 2);
  assert.equal(counts.within7d.get("post-a"), 3);
});

test("keeps the latest snapshot at least 24 hours old and preserves interpretation rules", () => {
  const row = (overrides: Partial<FanzaDailyPostFunnelSnapshotRow>): FanzaDailyPostFunnelSnapshotRow => ({
    post_key: "post-a",
    impressions: 10,
    captured_at: "2026-10-02T00:00:00.000Z",
    notes: null,
    source: "x_api",
    site_visits: 4,
    affiliate_clicks: 2,
    ...overrides,
  });
  const snapshots = collectFanzaDailyPostFunnelSnapshots([
    row({ captured_at: "2026-10-01T23:59:59.999Z", impressions: 1 }),
    row({ captured_at: "2026-10-02T00:00:00.000Z", impressions: 10 }),
    row({ captured_at: "2026-10-03T00:00:00.000Z", impressions: 20, notes: "needs review" }),
    row({ captured_at: "2026-10-04T00:00:00.000Z", impressions: 30, source: "manual", notes: "manual note" }),
  ], postByKey);

  assert.deepEqual(snapshots.get("post-a"), {
    impressions: 30,
    capturedAt: "2026-10-04T00:00:00.000Z",
    source: "manual",
    captureAgeHours: 72,
    siteVisits: 4,
    affiliateClicks: 2,
  });
});

test("uses the newest eligible snapshot when non-manual notes invalidate impressions", () => {
  const snapshots = collectFanzaDailyPostFunnelSnapshots([
    {
      post_key: "post-a", impressions: 50, captured_at: "2026-10-02T00:00:00.000Z",
      notes: null, source: "x_api", site_visits: 1, affiliate_clicks: 0,
    },
    {
      post_key: "post-a", impressions: 60, captured_at: "2026-10-03T00:00:00.000Z",
      notes: "review", source: "x_api", site_visits: 2, affiliate_clicks: 1,
    },
  ], postByKey);

  assert.equal(snapshots.get("post-a")?.impressions, null);
  assert.equal(snapshots.get("post-a")?.siteVisits, 2);
});
