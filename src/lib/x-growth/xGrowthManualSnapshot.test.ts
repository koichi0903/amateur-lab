import assert from "node:assert/strict";
import test from "node:test";
import { buildManualSnapshotInsert } from "./xGrowthManualSnapshot.ts";

test("keeps manually observed X views separate from site visits and affiliate clicks", () => {
  const row = buildManualSnapshotInsert({
    account: "example_account",
    postId: 21,
    postKey: "post-21",
    capturedAt: new Date("2026-11-01T03:00:00.000Z"),
    impressions: 12345,
    siteVisits: 11,
    affiliateClicks: 2,
    ageHours: 23.5,
  });

  assert.deepEqual(row, {
    account_handle: "example_account",
    x_post_log_id: 21,
    post_key: "post-21",
    snapshot_age: "24h",
    captured_at: "2026-11-01T03:00:00.000Z",
    source: "manual",
    impressions: 12345,
    site_visits: 11,
    affiliate_clicks: 2,
    notes: "X画面の閲覧数を手入力。投稿から23.50時間後に取得。X APIは使用していません。",
  });
});

test("stores missing site-side event counts as zero", () => {
  const row = buildManualSnapshotInsert({
    account: "example_account",
    postId: 21,
    postKey: "post-21",
    capturedAt: new Date("2026-11-01T03:00:00.000Z"),
    impressions: 0,
    siteVisits: null,
    affiliateClicks: null,
    ageHours: 24,
  });

  assert.equal(row.site_visits, 0);
  assert.equal(row.affiliate_clicks, 0);
});
