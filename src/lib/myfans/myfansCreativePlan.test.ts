import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct } from "@/lib/myfansAnalytics";
import { cardPayloadFor, decideCreativeStrategy } from "./myfansCreativePlan";

function product(overrides: Partial<MyfansProduct> = {}): MyfansProduct {
  return {
    id: 1,
    creator_id: 1,
    title: "素人作品",
    product_url: "https://myfans.jp/products/1",
    genre: "素人",
    product_type: "video",
    status: "active",
    price: 1000,
    reward_rate: 80,
    estimated_reward: 800,
    plan_signup_reward: 0,
    recurring_reward_rate: 0,
    popularity_rank: 1,
    likes_count: 200,
    saves_count: 30,
    is_new: true,
    source_x_url: "",
    affiliate_url: "https://mfco.link/example",
    selection_reason: "",
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("creator quote takes precedence over permitted media and affiliate cards", () => {
  const decision = decideCreativeStrategy(product({ media_permission_status: "permitted_video" }), "discovery_interest", "reply_link", "https://x.com/creator/status/1");
  assert.deepEqual(decision, {
    strategy: "quote_post",
    reason: "creator本人のX投稿を独立したGrowth Topicとして使うため。",
    instruction: "creator本人のX投稿を引用します。本文に元投稿本文は再掲しません。",
    ogpCheckRequired: false,
    quoteXUrl: "https://x.com/creator/status/1",
  });
});

test("permitted media takes precedence over affiliate OGP", () => {
  const decision = decideCreativeStrategy(product({ media_permission_status: "permitted_image" }), "revenue", "reply_link");
  assert.equal(decision.strategy, "permitted_media");
  assert.equal(decision.ogpCheckRequired, false);
  assert.equal(decision.quoteXUrl, "");
});

test("affiliate reply and body links both require their existing OGP check", () => {
  const reply = decideCreativeStrategy(product(), "revenue", "reply_link");
  const body = decideCreativeStrategy(product(), "revenue", "body_link");
  assert.equal(reply.strategy, "myfans_ogp");
  assert.equal(reply.ogpCheckRequired, true);
  assert.equal(reply.instruction, "本投稿はフックだけ出し、自己リプに#PRとmfco.linkを貼ります。X上でOGP表示を確認します。");
  assert.equal(body.strategy, "myfans_ogp");
  assert.equal(body.ogpCheckRequired, true);
  assert.equal(body.instruction, "X投稿画面でOGPが出ることを確認し、出ない場合は自己リプ型へ切り替えます。");
});

test("ranking and discovery use their established data-story card threshold", () => {
  const ranking = decideCreativeStrategy(product(), "ranking_note", "no_link");
  const discovery = decideCreativeStrategy(product(), "discovery_interest", "no_link");
  const insufficient = decideCreativeStrategy(product({ popularity_rank: null, likes_count: 0, saves_count: 0, is_new: false, price: 0, reward_rate: 0 }), "ranking_note", "no_link");
  assert.equal(ranking.strategy, "ranking_card");
  assert.equal(ranking.reason, "CARD RECOMMENDED: Data Story Score 88/100。人気1位 / 新着 / 保存30 / いいね200 / 低価格¥1,000 / 収益条件ありを1枚で見せられるため。");
  assert.equal(discovery.strategy, "discovery_card");
  assert.equal(insufficient.strategy, "text_only");
  assert.match(insufficient.reason, /^CARD NOT RECOMMENDED: Data Story Score 0\/100。/);
});

test("comparison cards and conservative text fallback stay distinct", () => {
  const comparison = decideCreativeStrategy(product(), "comparison_review", "no_link");
  const fallback = decideCreativeStrategy(product({ affiliate_url: "" }), "unknown", "no_link");
  assert.equal(comparison.strategy, "comparison_card");
  assert.equal(fallback.strategy, "text_only");
  assert.equal(fallback.ogpCheckRequired, false);
});

test("ranking card payload preserves its title, evidence chips, audience, and footer", () => {
  assert.deepEqual(cardPayloadFor(product(), "ranking_note", "ranking_card"), {
    kind: "ranking_card",
    title: "素人作品",
    creator: "",
    cardKind: "ranking",
    headline: "人気 1位",
    primary: "作り込みより近さで刺さるか、数字と並べて見る",
    subtitle: "数字で先に見る",
    price: "¥1,000",
    reward: "",
    rank: "人気 1位",
    likes: "いいね 200",
    saves: "保存 30",
    chip1: "新着",
    chip2: "¥1,000",
    chip3: "人気1位",
    angle: "距離感の近さ",
    audience: "作り込みより距離感を重視する人",
    audienceLine: "向いてる人: 作り込みより距離感を重視する人",
    check: "数字は入口。保存理由まで見る",
    footer: "@lumi_reviw / myfans発掘・比較",
  });
});
