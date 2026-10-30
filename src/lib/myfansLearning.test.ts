import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics } from "./myfansAnalytics";
import { buildMyfansLearning } from "./myfansLearning";

function analyticsFixture(): MyfansAnalytics {
  const now = new Date().toISOString();
  return {
    products: [{ id: 21, title: "作品A", creator_id: 5 }],
    creators: [{ id: 5, display_name: "作者A" }],
    posts: [
      { id: 1, posted_at: now, created_at: now, post_type: "discovery", link_strategy: "reply_link", creative_strategy: "text_only", objective: "conversion", growth_stage: "day_1_7", product_id: 21, impressions: 100, clicks: 5 },
      { id: 2, posted_at: now, created_at: now, post_type: "discovery", link_strategy: "reply_link", creative_strategy: "text_only", objective: "conversion", growth_stage: "day_1_7", product_id: 999, impressions: 80, clicks: 2 },
      { id: 3, posted_at: now, created_at: now, post_type: "discovery", link_strategy: "reply_link", creative_strategy: "text_only", objective: "conversion", growth_stage: "day_1_7", product_id: null, impressions: 60, clicks: 1 },
    ],
    conversions: [],
    xAccountMetrics: [],
  } as unknown as MyfansAnalytics;
}

test("learning labels product and creator axes and keeps missing-link fallbacks", () => {
  const learning = buildMyfansLearning(analyticsFixture());

  assert.deepEqual(new Set(learning.seven.product.map((row) => row.key)), new Set(["作品A", "商品未紐付け"]));
  assert.deepEqual(new Set(learning.seven.creator.map((row) => row.key)), new Set(["作者A", "クリエイター未紐付け"]));
  assert.deepEqual(new Set(learning.thirty.product.map((row) => row.key)), new Set(["作品A", "商品未紐付け"]));
  assert.deepEqual(new Set(learning.thirty.creator.map((row) => row.key)), new Set(["作者A", "クリエイター未紐付け"]));
});
