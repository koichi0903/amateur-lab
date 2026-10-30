import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteCandidate } from "./myfansAnalytics";
import { evaluateMyfansCandidateTopicValue, qualityForMyfansCandidate } from "./myfansCandidateEvaluation";
import { buildTopicBaselines } from "./myfansTopicValue";

const baselines = {
  creatorMedianLikes: new Map(),
  creatorMedianSaves: new Map(),
  priceBucketMedianLikes: new Map(),
  genreMedianLikes: new Map(),
  allLikes: [],
  allQuoteViews: [],
  allQuoteLikes: [],
} as ReturnType<typeof buildTopicBaselines>;

const quote = {
  id: 12,
  creator_id: 5,
  x_post_url: "https://x.com/creator/status/12",
  text_excerpt: "公開後の反応が急に伸びていて気になる",
  score: 90,
  views: 60_000,
  likes: 1_200,
  media_type: "image",
  media_permalink: "https://pbs.twimg.com/media/sample.jpg",
  quote_visual_ready: true,
  media_permalink_validation_status: "verified",
  visual_render_status: "browser_visible",
  visual_analysis_status: "verified",
  has_image: true,
  has_video: false,
  is_repost: false,
  is_reply: false,
  is_quote: false,
} as MyfansQuoteCandidate;

function qualityInput(evaluated: ReturnType<typeof evaluateMyfansCandidateTopicValue>) {
  return {
    body: "発見した投稿を短く紹介",
    product: null,
    postType: "discovery_interest",
    linkStrategy: "no_link" as const,
    creative: null,
    quote,
    topicValue: evaluated.topicValue,
    guardedTopicValue: evaluated.guardedTopicValue,
    topicCopyFitFailed: false,
    dailyRole: "DISCOVERY" as const,
    sourceSpecificity: 80,
    attention: null,
    hook: null,
  };
}

test("eligible quote-only source remains a discovery candidate with the established quality score", () => {
  const evaluated = evaluateMyfansCandidateTopicValue({
    product: null,
    quote,
    evidenceQuote: quote,
    role: "DISCOVERY",
    baselines,
    visualUnderstanding: null,
  });

  assert.equal(evaluated.topicValue?.verdict, "PASS");
  const quality = qualityForMyfansCandidate(qualityInput(evaluated));
  assert.equal(quality.total, 86);
  assert.equal(quality.verdict, "PASS");
  assert.deepEqual(quality.reasons, ["eligible quote sourceを発見候補として採用", "商品未紐付けのため収益導線なし"]);
});

test("missing candidate data stays on HOLD", () => {
  const evaluated = evaluateMyfansCandidateTopicValue({
    product: null,
    quote: null,
    evidenceQuote: null,
    role: "DISCOVERY",
    baselines,
    visualUnderstanding: null,
  });

  assert.equal(evaluated.guardedTopicValue, null);
  assert.equal(evaluated.topicValue, null);
  const quality = qualityForMyfansCandidate({ ...qualityInput(evaluated), quote: null });
  assert.equal(quality.total, 0);
  assert.equal(quality.verdict, "HOLD");
  assert.deepEqual(quality.reasons, ["商品候補がありません"]);
});
