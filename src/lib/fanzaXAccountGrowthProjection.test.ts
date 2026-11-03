import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseFanzaXGrowth, projectFanzaXGrowth, type FanzaXAccountMetric } from "./fanzaXAccountGrowthProjection.ts";

function metric(input: Partial<FanzaXAccountMetric> & Pick<FanzaXAccountMetric, "id" | "metric_date">): FanzaXAccountMetric {
  return {
    account_handle: "hakkutsu_lab",
    followers_count: 0,
    following_count: null,
    profile_visits: 0,
    total_impressions: 0,
    posts_count: 0,
    likes: 0,
    reposts: 0,
    replies: 0,
    fanza_clicks: 0,
    sales_count: 0,
    commission_amount: 0,
    notes: "",
    ...input,
  };
}

test("projects aggregate metrics using the greater imported or account-recorded totals", () => {
  const result = projectFanzaXGrowth({
    metrics: [
      metric({ id: 1, metric_date: "2026-10-01", followers_count: 100, profile_visits: 4, total_impressions: 300, posts_count: 3, fanza_clicks: 2, sales_count: 1, commission_amount: 100 }),
      metric({ id: 2, metric_date: "2026-10-29", followers_count: 120, profile_visits: 5, total_impressions: 700, posts_count: 2, fanza_clicks: 4, sales_count: 2, commission_amount: 150 }),
    ],
    xPostsCount: 4,
    xPageViewsCount: 7,
    xClicksCount: 3,
    salesRows: [{ sales_count: 8, commission_amount: 400 }],
  });
  assert.deepEqual({
    diagnosis: result.diagnosis,
    currentFollowers: result.currentFollowers,
    followersDelta30d: result.followersDelta30d,
    newFollows30d: result.newFollows30d,
    profileVisits30d: result.profileVisits30d,
    impressions30d: result.impressions30d,
    posts30d: result.posts30d,
    avgImpressionsPerPost: result.avgImpressionsPerPost,
    xPageViews30d: result.xPageViews30d,
    fanzaClicks30d: result.fanzaClicks30d,
    salesCount30d: result.salesCount30d,
    commission30d: result.commission30d,
    ctr30d: result.ctr30d,
    cvr30d: result.cvr30d,
    epc30d: result.epc30d,
  }, {
    diagnosis: "売上発生・最適化段階",
    currentFollowers: 120,
    followersDelta30d: 20,
    newFollows30d: 20,
    profileVisits30d: 9,
    impressions30d: 1000,
    posts30d: 5,
    avgImpressionsPerPost: 200,
    xPageViews30d: 7,
    fanzaClicks30d: 6,
    salesCount30d: 8,
    commission30d: 400,
    ctr30d: 0.006,
    cvr30d: 8 / 6,
    epc30d: 67,
  });
  assert.deepEqual(result.weeklyRows.map((row) => row.epc), [50, 38]);
});

test("empty metrics retain zero totals and null rate values", () => {
  const result = projectFanzaXGrowth({
    metrics: [],
    xPostsCount: 0,
    xPageViewsCount: 0,
    xClicksCount: 0,
    salesRows: [],
  });
  assert.equal(result.diagnosis, "露出不足");
  assert.equal(result.currentFollowers, 0);
  assert.equal(result.avgImpressionsPerPost, null);
  assert.equal(result.ctr30d, null);
  assert.equal(result.cvr30d, null);
  assert.equal(result.epc30d, null);
  assert.deepEqual(result.weeklyRows, []);
});

test("diagnosis prioritizes sales, then clicks, then the 1,000 impression threshold", () => {
  assert.equal(diagnoseFanzaXGrowth(1000, 0, 1), "売上発生・最適化段階");
  assert.equal(diagnoseFanzaXGrowth(1000, 1, 0), "クリックあり/売上不足");
  assert.equal(diagnoseFanzaXGrowth(1000, 0, 0), "露出あり/クリック不足");
  assert.equal(diagnoseFanzaXGrowth(999, 0, 0), "露出不足");
});
