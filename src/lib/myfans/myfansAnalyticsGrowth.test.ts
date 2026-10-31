import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansXAccountGrowthSummary } from "./myfansAnalyticsGrowth";

test("combines recent post and daily totals while using the strongest click and conversion evidence", () => {
  const result = buildMyfansXAccountGrowthSummary({
    cutoff: "2026-10-01T00:00:00.000Z",
    clicks30d: 6,
    conversions30d: 1,
    reward30d: 70,
    posts: [
      { created_at: "2026-10-02T00:00:00.000Z", posted_at: "2026-10-02T00:00:00.000Z", impressions: 100, clicks: 4 },
      { created_at: "2026-09-20T00:00:00.000Z", posted_at: "2026-10-03T00:00:00.000Z", impressions: 50, clicks: 3 },
      { created_at: "2026-09-20T00:00:00.000Z", posted_at: null, impressions: 500, clicks: 100 },
    ],
    daily: [{ impressions: 130 }],
    xAccountMetrics: [
      { metric_date: "2026-10-01", followers_count: 10, posts_count: 2, total_impressions: 80, profile_visits: 3, affiliate_clicks: 5, conversions: 1, reward_amount: 50 },
      { metric_date: "2026-10-02", followers_count: 15, posts_count: 2, total_impressions: 90, profile_visits: 4, affiliate_clicks: 6, conversions: 2, reward_amount: 80 },
    ],
  });

  assert.equal(result.impressions30d, 150);
  assert.equal(result.xAccountGrowth.impressions30d, 170);
  assert.equal(result.xAccountGrowth.clicks30d, 11);
  assert.equal(result.xAccountGrowth.conversions30d, 3);
  assert.equal(result.xAccountGrowth.reward30d, 130);
  assert.equal(result.xAccountGrowth.followersDelta30d, 5);
  assert.equal(result.xAccountGrowth.posts30d, 4);
  assert.equal(result.xAccountGrowth.avgImpressionsPerPost, 43);
  assert.equal(result.xAccountGrowth.highestPost?.impressions, 100);
  assert.equal(result.xAccountGrowth.diagnosis, "成果発生・最適化段階");
  assert.deepEqual(result.xAccountGrowth.dailyRows.map((row) => row.epc), [10, 13]);
});
