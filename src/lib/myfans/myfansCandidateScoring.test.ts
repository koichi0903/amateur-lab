import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansAnalytics, MyfansProduct } from "../myfansAnalytics";
import { calculateMyfansOpportunityScores } from "../myfansScore";
import { stableHash } from "./myfansHash";
import { buildMyfansScoredProductPool } from "./myfansCandidateScoring";

function product(id: number, overrides: Partial<MyfansProduct> = {}): MyfansProduct {
  return {
    id,
    creator_id: 7,
    title: `作品${id}`,
    product_url: `https://myfans.jp/posts/${id}`,
    genre: "",
    product_type: "video",
    status: "active",
    price: 1200,
    reward_rate: 30,
    estimated_reward: 360,
    plan_signup_reward: 1500,
    recurring_reward_rate: 10,
    popularity_rank: 5,
    likes_count: 40,
    saves_count: 8,
    is_new: false,
    source_x_url: "https://x.com/creator/status/123",
    affiliate_url: "https://myfans.jp/affiliate/1",
    selection_reason: "fixture",
    created_at: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function post(input: {
  productId: number;
  impressions: number;
  clicks: number;
  createdAt: string;
  quote?: boolean;
}): MyfansAnalytics["posts"][number] {
  return {
    product_id: input.productId,
    impressions: input.impressions,
    clicks: input.clicks,
    created_at: input.createdAt,
    posted_at: null,
    creative_strategy: input.quote ? "quote_post" : "source_post",
    quote_x_url: input.quote ? "https://x.com/creator/status/123" : "",
  } as MyfansAnalytics["posts"][number];
}

function conversion(productId: number, conversionType: string, rewardAmount: number): MyfansAnalytics["conversions"][number] {
  return { product_id: productId, conversion_type: conversionType, reward_amount: rewardAmount } as MyfansAnalytics["conversions"][number];
}

function analytics(
  products: MyfansProduct[],
  posts: MyfansAnalytics["posts"] = [],
  conversions: MyfansAnalytics["conversions"] = [],
): MyfansAnalytics {
  return { products, posts, conversions } as MyfansAnalytics;
}

test("scores active products from aggregate post and conversion evidence and excludes paused or rejected products", () => {
  const selectedProduct = product(1);
  const pool = buildMyfansScoredProductPool(analytics([
    selectedProduct,
    product(2, { status: "paused" }),
    product(3, { status: "rejected" }),
  ], [
    post({ productId: 1, impressions: 1000, clicks: 20, createdAt: "2020-01-01T00:00:00.000Z" }),
    post({ productId: 1, impressions: 500, clicks: 10, createdAt: "2020-01-02T00:00:00.000Z" }),
  ], [
    conversion(1, "sale", 300),
    conversion(1, "plan_signup", 1000),
  ]), "plan-2026-11-03");

  assert.deepEqual(pool.map(({ product: row }) => row.id), [1]);
  assert.deepEqual(pool[0].scores, calculateMyfansOpportunityScores({
    price: selectedProduct.price,
    rewardRate: selectedProduct.reward_rate,
    planSignupReward: selectedProduct.plan_signup_reward,
    recurringRewardRate: selectedProduct.recurring_reward_rate,
    popularityRank: selectedProduct.popularity_rank,
    likesCount: selectedProduct.likes_count,
    savesCount: selectedProduct.saves_count,
    isNew: selectedProduct.is_new,
    hasAffiliateUrl: true,
    hasApprovedMedia: false,
    source_x_url: selectedProduct.source_x_url,
    createdAt: selectedProduct.created_at,
    creatorProductCount: 3,
    pastImpressions: 1500,
    pastClicks: 30,
    pastConversions: 2,
    pastReward: 1300,
    observedUpdateCount30d: 0,
    planSignupEvidenceCount: 1,
  }));
  assert.equal(
    pool[0].plannerScore,
    pool[0].scores.growthScore + pool[0].scores.revenueScore + pool[0].scores.creatorLtvScore + stableHash("plan-2026-11-03:1") % 17,
  );
});

test("applies the recent product and quote creator penalties without changing evidence scores", () => {
  const selectedProduct = product(1);
  const olderPost = post({ productId: 1, impressions: 1000, clicks: 20, createdAt: "2020-01-01T00:00:00.000Z", quote: true });
  const recentPost = post({ productId: 1, impressions: 1000, clicks: 20, createdAt: "2999-01-01T00:00:00.000Z", quote: true });
  const planKey = "plan-2026-11-03";
  const older = buildMyfansScoredProductPool(analytics([selectedProduct], [olderPost]), planKey)[0];
  const recent = buildMyfansScoredProductPool(analytics([selectedProduct], [recentPost]), planKey)[0];

  assert.deepEqual(recent.scores, older.scores);
  assert.equal(older.plannerScore - recent.plannerScore, 55);
});
