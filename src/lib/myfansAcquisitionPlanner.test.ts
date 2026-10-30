import assert from "node:assert/strict";
import { buildMyfansAcquisitionPlanner } from "./myfansAcquisitionPlanner";
import type { MyfansAnalytics, MyfansProduct } from "./myfansAnalytics";

function product(overrides: Partial<MyfansProduct> = {}): MyfansProduct {
  return {
    id: 1,
    creator_id: null,
    title: "sample",
    product_url: "https://myfans.jp/post/1",
    genre: "",
    product_type: "video",
    status: "active",
    price: 1200,
    reward_rate: 30,
    estimated_reward: 1000,
    plan_signup_reward: 1,
    recurring_reward_rate: 0,
    popularity_rank: null,
    likes_count: 0,
    saves_count: 0,
    is_new: true,
    source_x_url: "",
    affiliate_url: "https://mfco.link/r/sample",
    selection_reason: "",
    created_at: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

function plannerFor(products: MyfansProduct[]) {
  return buildMyfansAcquisitionPlanner({ products } as unknown as MyfansAnalytics);
}

const qualifying = plannerFor([product()]);
assert.deepEqual({
  growth: qualifying.poolCounts.growth,
  revenue: qualifying.poolCounts.revenue,
  ltv: qualifying.poolCounts.ltv,
  affiliateReady: qualifying.poolCounts.affiliateReady,
}, { growth: 1, revenue: 1, ltv: 1, affiliateReady: 1 });

const invalidAffiliate = plannerFor([product({ affiliate_url: "https://example.com/redirect", reward_rate: 100, estimated_reward: 2000 })]);
assert.equal(invalidAffiliate.poolCounts.revenue, 0);
assert.equal(invalidAffiliate.poolCounts.affiliateReady, 0);

console.log("myfans Acquisition Planner tests passed");
