import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkFunnelRows } from "./affiliateAnalyticsFunnels.ts";

test("builds work and source funnels with matching clicks, latest post, and fallback title", () => {
  const rows = buildWorkFunnelRows({
    clicks: [
      { id: 1, work_id: 10, placement: "detail-sidebar", source_page: "x", cta_variant: null, x_post_key: "post-a", external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-28T01:00:00.000Z" },
      { id: 2, work_id: 10, placement: "mobile-sticky", source_page: "x", cta_variant: null, x_post_key: "post-b", external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-28T02:00:00.000Z" },
      { id: 3, work_id: 10, placement: "detail-sidebar", source_page: "home", cta_variant: null, x_post_key: null, external_channel: null, external_source: null, landing_path: null, clicked_at: "2026-10-28T03:00:00.000Z" },
    ],
    pageViews: [
      { id: 1, work_id: 10, source_page: "x", price: null, discount_rate: null, discovery_score: null, ranking: null, x_post_key: "post-a", viewed_at: "2026-10-28T00:00:00.000Z" },
      { id: 2, work_id: 10, source_page: "x", price: 500, discount_rate: 50, discovery_score: 7, ranking: 2, x_post_key: "post-b", viewed_at: "2026-10-28T01:00:00.000Z" },
      { id: 3, work_id: 20, source_page: "home", price: 1000, discount_rate: null, discovery_score: null, ranking: null, x_post_key: null, viewed_at: "2026-10-28T03:00:00.000Z" },
    ],
    works: new Map([[10, { title: "X作品" }]]),
    xPostTimes: new Map([
      ["post-a", "2026-10-27T00:00:00.000Z"],
      ["post-b", "2026-10-28T00:00:00.000Z"],
    ]),
  });

  assert.deepEqual(rows, [
    {
      workId: 10,
      sourcePage: "x",
      pageViews: 2,
      price: 500,
      discountRate: 50,
      discoveryScore: 7,
      ranking: 2,
      latestPostedAt: "2026-10-28T00:00:00.000Z",
      title: "X作品",
      fanzaClicks: 2,
      ctr: 100,
    },
    {
      workId: 20,
      sourcePage: "home",
      pageViews: 1,
      price: 1000,
      discountRate: null,
      discoveryScore: null,
      ranking: null,
      latestPostedAt: null,
      title: "作品ID 20",
      fanzaClicks: 0,
      ctr: 0,
    },
  ]);
});
