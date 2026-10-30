import assert from "node:assert/strict";
import test from "node:test";
import { attentionScoreFor, bodyFor, hookIntelligence } from "./myfansCandidateCopy.ts";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "./myfansAnalytics.ts";
import type { MyfansTopicValue } from "./myfansQuotePool.ts";

function product(overrides: Partial<MyfansProduct> = {}): MyfansProduct {
  return {
    id: 1,
    creator_id: null,
    title: "作品タイトル",
    product_url: "",
    genre: "",
    product_type: "video",
    status: "active",
    price: 2000,
    reward_rate: 0,
    estimated_reward: 0,
    plan_signup_reward: 0,
    recurring_reward_rate: 0,
    popularity_rank: null,
    likes_count: 0,
    saves_count: 0,
    is_new: false,
    source_x_url: "",
    affiliate_url: "",
    selection_reason: "",
    created_at: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function quote(overrides: Partial<MyfansQuoteCandidate> = {}): MyfansQuoteCandidate {
  return {
    id: 1,
    approved_media_id: null,
    creator_id: null,
    product_id: null,
    creator_x_url: "",
    source_x_handle: "",
    x_post_url: "https://x.com/creator/status/1",
    media_permalink: null,
    media_type: "none",
    media_count: 0,
    quote_visual_ready: false,
    media_permalink_validation_status: null,
    visual_render_status: "unknown",
    posted_at: null,
    text_excerpt: "",
    views: 0,
    likes: 0,
    reposts: 0,
    replies: 0,
    bookmarks: 0,
    has_image: false,
    has_video: false,
    is_pinned: false,
    is_reply: false,
    is_repost: false,
    is_quote: false,
    collected_at: "2026-10-29T00:00:00.000Z",
    score: 0,
    score_reason: "",
    selected: true,
    ...overrides,
  };
}

function analytics(posts: unknown[], products: MyfansProduct[]): MyfansAnalytics {
  return { posts, products } as unknown as MyfansAnalytics;
}

function topicValue(): MyfansTopicValue {
  return {
    score: 90,
    verdict: "PASS",
    reasonToCare: "conversation_worthy",
    evidence: ["新作の表情が気になる"],
    baseline: [],
    whyRejected: [],
    breakdown: {
      surprise: 0,
      concreteDifference: 0,
      humanCuriosity: 0,
      socialProofMomentum: 0,
      visualStoryValue: 0,
      explainability: 0,
    },
  };
}

test("hook classification keeps visual and social proof ahead of product signals", () => {
  const verifiedVisual = hookIntelligence(
    product({ is_new: true, popularity_rank: 1 }),
    quote({
      media_type: "image",
      media_permalink: "https://pbs.twimg.com/media/example.jpg",
      quote_visual_ready: true,
      visual_render_status: "browser_visible",
    }),
  );
  assert.equal(verifiedVisual.hook, "STRONG_VISUAL");
  assert.equal(verifiedVisual.label, "ブラウザ表示済みvisual");

  const socialProof = hookIntelligence(
    product({ is_new: true, popularity_rank: 1 }),
    quote({ likes: 1000 }),
  );
  assert.equal(socialProof.hook, "SOCIAL_PROOF");
  assert.equal(socialProof.evidence.likes, 1000);
});

test("product hook precedence stays newcomer, ranking, anomaly, scarcity, price, comparison", () => {
  assert.equal(hookIntelligence(product({ is_new: true, popularity_rank: 1, saves_count: 100 }), null).hook, "NEWCOMER");
  assert.equal(hookIntelligence(product({ popularity_rank: 1, saves_count: 100 }), null).hook, "RANKING_SURGE");
  assert.equal(hookIntelligence(product({ saves_count: 20, likes_count: 0 }), null).hook, "DATA_ANOMALY");
  assert.equal(hookIntelligence(product({ title: "明日まで限定", price: 800, estimated_reward: 100 }), null).hook, "SCARCITY_DEADLINE");
  assert.equal(hookIntelligence(product({ price: 800, estimated_reward: 100 }), null).hook, "PRICE_ANOMALY");
  assert.equal(hookIntelligence(product(), null).hook, "COMPARISON");
});

test("discovery copy keeps quote grounding and deterministic fallback lines", () => {
  const fallback = bodyFor(
    product(),
    "ranking_note",
    "no_link",
    "discovery_card",
    quote({ media_type: "image", has_image: true }),
    topicValue(),
    0,
  );
  assert.equal(fallback, "画像だけで見せ切る感じ、けっこうずるい。\n\n一回開いてしまうタイプ。");

  const grounded = bodyFor(
    product(),
    "ranking_note",
    "no_link",
    "discovery_card",
    quote({
      media_type: "image",
      has_image: true,
      text_excerpt: "作品の表情が変わる瞬間に、思ったより距離感の違いが見える。",
    }),
    topicValue(),
    0,
  );
  assert.equal(
    grounded,
    "「作品の表情が変わる瞬間に、思ったより距離感の違いが見える。」の出し方が気になってしまう。\n\nこの人、他の投稿も少し気になる。",
  );
});

test("attention scoring exposes visual, engagement, story, and cooldown components", () => {
  const item = product({
    id: 7,
    creator_id: 42,
    popularity_rank: 1,
    is_new: true,
    saves_count: 100,
    likes_count: 500,
    price: 800,
    reward_rate: 100,
  });
  const source = quote({
    likes: 1000,
    has_image: true,
    collected_at: new Date().toISOString(),
  });

  const withoutHistory = attentionScoreFor(item, source, analytics([], []));
  assert.equal(withoutHistory.visualStrength, 6);
  assert.equal(withoutHistory.visualVerified, false);
  assert.equal(withoutHistory.engagementStrength, 24);
  assert.equal(withoutHistory.dataStoryScore, 100);
  assert.deepEqual(withoutHistory.penalties, { creatorCooldown: 0, productCooldown: 0, quoteUsed: 0 });

  const recentDate = new Date(Date.now() - 60_000).toISOString();
  const postedQuote = {
    id: 1,
    product_id: item.id,
    status: "posted",
    creative_strategy: "quote_post",
    quote_x_url: source.x_post_url,
    posted_at: recentDate,
    created_at: recentDate,
  };
  const withHistory = attentionScoreFor(item, source, analytics([postedQuote], [item]));
  assert.deepEqual(withHistory.penalties, { creatorCooldown: 14, productCooldown: 24, quoteUsed: 30 });
  assert.equal(withHistory.score, withoutHistory.score - 68);
  assert.ok(withHistory.reasons.includes("creator cooldown"));
  assert.ok(withHistory.reasons.includes("product cooldown"));
  assert.ok(withHistory.reasons.includes("quote reuse禁止"));
});
