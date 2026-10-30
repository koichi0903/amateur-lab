import assert from "node:assert/strict";
import test from "node:test";
import { finalNativeXVoiceGate, lastMileGate, qualityFor } from "./xCreativeQuality";
import type { XCreativeInput, XLinkPlan } from "./xCreativeTypes";

const input: XCreativeInput = {
  key: "quality-test",
  title: "品質確認作品",
  url: "https://example.com/work",
  category: "作品",
  actress: "女優A",
  genre: "ジャンルA",
  currentPrice: null,
  previousPrice: null,
  discountRate: 0,
  reviewAverage: null,
  reviewCount: 0,
  ranking: null,
  score: 0,
  discoveryScore: null,
  buyTimingScore: null,
  isNinetyDayLow: false,
};

function makeVariant(intent: "REACH" | "MONEY", linkPlan: XLinkPlan, text: string) {
  return { intent, mediaType: "text" as const, linkPlan, text };
}

test("last-mile gate keeps a concrete, native REACH post eligible", () => {
  const result = lastMileGate(
    input,
    makeVariant("REACH", "profile_only", "今日、女優Aの冒頭が気になって、ちょっと止まった"),
    0,
  );

  assert.equal(result.verdict, "post_ok");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.humanVoice.passed, true);
  assert.equal(result.nativeXVoice.passed, true);
});

test("MONEY body-link strategy requires a URL in the post text", () => {
  const result = lastMileGate(
    input,
    makeVariant("MONEY", "body_link", "女優Aの冒頭が気になる。今日、ちょっと止まった"),
    1,
  );

  assert.ok(result.reasons.includes("MONEYなのに本文リンクがない"));
  assert.ok(!result.reasons.includes("MONEYのリンク戦略が不正"));
});

test("MONEY rejects a profile-only link plan", () => {
  const result = lastMileGate(
    input,
    makeVariant("MONEY", "profile_only", "女優Aの冒頭が気になる。今日、ちょっと止まった"),
    0,
  );

  assert.ok(result.reasons.includes("MONEYのリンク戦略が不正"));
});

test("REACH does not allow a direct post link", () => {
  const result = lastMileGate(
    input,
    makeVariant("REACH", "body_link", "今日、女優Aの冒頭が気になって止まった。\nhttps://example.com/work"),
    0,
  );

  assert.ok(result.reasons.includes("認知投稿に直リンクが強すぎる"));
});

test("quality dimension extraction preserves the calibrated scores and result", () => {
  const result = qualityFor(input, {
    ...makeVariant("REACH", "profile_only", "今日、女優Aの冒頭が気になって、ちょっと止まった"),
    structure: "short",
  });

  assert.deepEqual(result.dimensions, {
    scrollStop: 58,
    curiosity: 61,
    proof: 30,
    judgment: 48,
    followValue: 42,
    specificity: 36,
    novelty: 82,
    adSmell: 0,
    ctaFit: 82,
    mediaFit: 55,
    shareability: 52,
    replyability: 38,
  });
  assert.equal(result.total, 58);
  assert.equal(result.passed, false);
  assert.equal(result.recommendation, "do_not_post");
  assert.deepEqual(result.weaknesses, ["scrollStop", "curiosity", "shareability", "mediaFit"]);
});

test("native voice gate keeps the forbidden-template reason and match visible", () => {
  const result = finalNativeXVoiceGate(input, {
    ...makeVariant("REACH", "profile_only", "今日、女優Aの冒頭が気になって、ちょっと止まった。今日は短く見て決められます"),
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["直近/禁止テンプレ重複: 今日は短く見て決められます"]);
  assert.deepEqual(result.forbiddenHits, ["今日は短く見て決められます"]);
});

test("human voice gate keeps internal-metric rejection visible", () => {
  const result = lastMileGate(
    input,
    makeVariant("REACH", "profile_only", "今日、女優Aのスコアが気になって止まった"),
    0,
  );

  assert.equal(result.humanVoice.checks.noInternalMetric, false);
  assert.ok(result.humanVoice.reasons.some((reason) => reason.startsWith("内部/運用者語が残っている")));
});
