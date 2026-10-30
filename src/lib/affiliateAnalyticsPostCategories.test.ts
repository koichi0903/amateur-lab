import assert from "node:assert/strict";
import test from "node:test";
import { buildXPostCategoryRevenue } from "./affiliateAnalyticsPostCategories.ts";

test("groups X post views and clicks, infers a post for nearby clicks, and preserves unknown traffic", async () => {
  const cutoff = Date.parse("2026-10-01T00:00:00.000Z");
  const fetchedWorkIds: number[][] = [];
  const result = await buildXPostCategoryRevenue({
    categoryCutoff: cutoff,
    pageViews: [
      { id: 1, work_id: 10, source_page: "x", price: null, discount_rate: null, discovery_score: null, ranking: null, x_post_key: "post-a", viewed_at: "2026-10-02T00:00:00.000Z" },
      { id: 2, work_id: 10, source_page: "x", price: null, discount_rate: null, discovery_score: null, ranking: null, x_post_key: "post-a", viewed_at: "2026-10-02T00:01:00.000Z" },
      { id: 3, work_id: 20, source_page: "x", price: null, discount_rate: null, discovery_score: null, ranking: null, x_post_key: null, viewed_at: "2026-10-02T00:00:00.000Z" },
      { id: 4, work_id: 99, source_page: "home", price: null, discount_rate: null, discovery_score: null, ranking: null, x_post_key: "post-a", viewed_at: "2026-10-02T00:00:00.000Z" },
    ],
    clicks: [
      { id: 1, work_id: 10, placement: "detail-sidebar", source_page: "x", cta_variant: null, x_post_key: "post-a", external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-02T00:02:00.000Z" },
      { id: 2, work_id: 10, placement: "detail-sidebar", source_page: "x", cta_variant: null, x_post_key: null, external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-02T00:03:00.000Z" },
      { id: 3, work_id: 20, placement: "detail-sidebar", source_page: "x", cta_variant: null, x_post_key: null, external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-02T00:04:00.000Z" },
      { id: 4, work_id: 30, placement: "detail-sidebar", source_page: "home", cta_variant: null, x_post_key: null, external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-02T00:04:00.000Z" },
    ],
    logs: new Map([
      ["post-a", { postKey: "post-a", category: "today_buy" }],
      ["post-b", { postKey: "post-b", category: "deal" }],
    ]),
    works: new Map([[10, { title: "手元作品" }]]),
    fetchWorks: async (ids) => {
      fetchedWorkIds.push(ids);
      return new Map([[10, { title: "DB作品" }]]);
    },
  });

  assert.deepEqual(result, [
    {
      category: "today_buy",
      label: "今日の買い時",
      posts: 1,
      xPageViews: 2,
      xFanzaClicks: 2,
      xCtr: 100,
      pvPerPost: 2,
      clicksPerPost: 2,
      topWorks: [{ workId: 10, title: "DB作品", xPageViews: 2, xFanzaClicks: 2, xCtr: 100 }],
    },
    {
      category: "unknown",
      label: "未分類",
      posts: 0,
      xPageViews: 1,
      xFanzaClicks: 1,
      xCtr: 100,
      pvPerPost: 0,
      clicksPerPost: 0,
      topWorks: [{ workId: 20, title: "作品ID 20", xPageViews: 1, xFanzaClicks: 1, xCtr: 100 }],
    },
    {
      category: "deal",
      label: "値下げ・セール",
      posts: 1,
      xPageViews: 0,
      xFanzaClicks: 0,
      xCtr: 0,
      pvPerPost: 0,
      clicksPerPost: 0,
      topWorks: [],
    },
  ]);
  assert.deepEqual(fetchedWorkIds, [[10, 20]]);
});
