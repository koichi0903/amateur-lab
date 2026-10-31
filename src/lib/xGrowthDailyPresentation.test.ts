import assert from "node:assert/strict";
import test from "node:test";
import { buildTopPickCandidate } from "./xGrowthDailyPresentation.ts";

function makeCandidate(
  imageUrl: string | null,
  itemOverrides: Record<string, unknown> = {},
) {
  const variant = {
    id: "comparison-card",
    intent: "FOLLOW",
    mediaType: "data_card",
    hookDirection: "comparison",
    buzzPotential: { reason: "fallback reason" },
    bodyText: "比較の本文",
    replyText: "使用しないリプ",
    url: "https://example.com/product",
  };
  const item = {
    key: "presentation-fixture",
    workId: 123,
    sourceType: "COMPARISON",
    creativeVariants: [variant],
    creativeVariantId: variant.id,
    imageUrl,
    sampleMovieUrl: null,
    recommendedMediaUrl: null,
    mediaAsset: null,
    rankingHistory: { status: "accumulating", rankingDelta: null },
    isNinetyDayLow: false,
    discountRate: 0,
    ranking: null,
    reviewAverage: null,
    freshness: { reasons: [] },
    recommendedSlot: "morning",
    ...itemOverrides,
  };
  return buildTopPickCandidate({
    item,
    role: "FOLLOW",
    variant,
    audit: { ok: true, signature: { topic: "comparison" }, reasons: [] },
    score: 70,
    pickOrder: 1,
    slotId: "slot_1",
    slotRole: "REACH",
    slotLabel: "Reach",
    candidateRank: "A",
    reason: "候補理由",
  } as never);
}

test("keeps comparison-card copy and generated card URL when no work image exists", () => {
  const candidate = makeCandidate(null);
  assert.equal(candidate.mediaType, "data_card");
  assert.equal(candidate.recommendedMediaUrl, "/api/admin/x-growth/media/download?workId=123&mediaType=data_card");
  assert.equal(candidate.mediaDecision, "比較自体が面白い場合だけデータカードを使用");
  assert.equal(candidate.whyBuzz, "一目で比較でき、迷っている人が最初の一本を決めやすい。");
  assert.equal(candidate.replyText, null);
});

test("prefers the work image over a non-price data card when available", () => {
  const imageUrl = "https://pics.dmm.co.jp/work/123.jpg";
  const candidate = makeCandidate(imageUrl);
  assert.equal(candidate.mediaType, "existing_link_image");
  assert.equal(candidate.recommendedMediaUrl, imageUrl);
  assert.equal(candidate.mediaDecision, "作品画像を優先。本文は画像説明ではなく見る理由に絞る");
});

test("keeps daily reasons in their established order", () => {
  const candidate = makeCandidate("https://pics.dmm.co.jp/work/123.jpg", {
    rankingHistory: { status: "ready", rankingDelta: 12 },
    isNinetyDayLow: true,
    discountRate: 30,
    ranking: 20,
    reviewAverage: 4.7,
    freshness: { reasons: ["セール終了まで1日"] },
  });

  assert.deepEqual(candidate.whyToday, [
    "昨日との差分で続報にできる",
    "画像で作品の雰囲気が一目で伝わる",
    "今日見る理由が価格で説明できる",
    "ランキング上位なので初見でも文脈が伝わる",
    "評価を少し添えるだけで納得感が出る",
    "毎日追うアカウントとして見せやすい",
    "セール終了まで1日",
  ]);
});
