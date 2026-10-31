import assert from "node:assert/strict";
import test from "node:test";
import { buildPersistedTopPickFallback } from "./xGrowthDailyPlanFallback";

test("fallback top pick fills display and media defaults from an opportunity row", () => {
  const pick = buildPersistedTopPickFallback({
    opportunity_key: "daily-pick-42",
    work_id: 42,
    product_id: "abc-42",
    topic: "保存済み候補",
    intent: "FOLLOW",
    post_text: "投稿文",
    media_type: "sample_movie",
    recommended_media_asset_id: 9,
  }, 2);

  assert.equal(pick.key, "daily-pick-42");
  assert.equal(pick.workId, 42);
  assert.equal(pick.pickOrder, 3);
  assert.equal(pick.url, "/works/42");
  assert.equal(pick.postText, "投稿文");
  assert.equal(pick.mediaUsage, "allowed");
  assert.equal(pick.mediaAsset?.id, 9);
  assert.equal(pick.setDiversity?.signature.intent, "FOLLOW");
  assert.equal(pick.setDiversity?.signature.mediaType, "sample_movie");
});

test("fallback top pick keeps persisted pick values over generated defaults", () => {
  const pick = buildPersistedTopPickFallback({
    opportunity_key: "daily-pick-43",
    work_id: 43,
    intent: "FOLLOW",
    media_type: "text",
    creative_genome: {
      persisted_top_pick: {
        title: "保存済みタイトル",
        url: "/custom/43",
        pickOrder: 8,
        mediaUsage: "restricted",
      },
    },
  }, 0);

  assert.equal(pick.title, "保存済みタイトル");
  assert.equal(pick.url, "/custom/43");
  assert.equal(pick.pickOrder, 8);
  assert.equal(pick.mediaUsage, "restricted");
  assert.equal(pick.mediaAsset, null);
});

test("fallback top pick preserves persisted media, decision, and evidence fields", () => {
  const persisted = {
    mediaUsage: "restricted",
    canNativeVideo: true,
    recommendedMediaUrl: "https://media.example/video.mp4",
    recommendedTimeLabel: "保存済み時間",
    whyToday: ["保存済み理由"],
    whyBuzz: "保存済み話題",
    mediaDecision: "保存済み判断",
    alternativeReason: "保存済み代替理由",
    dailyScore: 42,
    sourceEvidence: ["保存済み根拠"],
    decisionFacts: { decisionType: "HIDDEN_VALUE" } as never,
    setDiversity: { status: "NG" } as never,
    mediaAsset: { id: 99 } as never,
    selectedVariant: { id: "saved-variant" } as never,
  };
  const pick = buildPersistedTopPickFallback({
    opportunity_key: "daily-pick-44",
    work_id: 44,
    intent: "REACH",
    post_text: "保存された投稿文",
    media_type: "sample_movie",
    creative_genome: { persisted_top_pick: persisted },
  }, 0);

  assert.equal(pick.mediaUsage, persisted.mediaUsage);
  assert.equal(pick.canNativeVideo, persisted.canNativeVideo);
  assert.equal(pick.recommendedMediaUrl, persisted.recommendedMediaUrl);
  assert.equal(pick.recommendedTimeLabel, persisted.recommendedTimeLabel);
  assert.deepEqual(pick.whyToday, persisted.whyToday);
  assert.equal(pick.whyBuzz, persisted.whyBuzz);
  assert.equal(pick.mediaDecision, persisted.mediaDecision);
  assert.equal(pick.alternativeReason, persisted.alternativeReason);
  assert.equal(pick.dailyScore, persisted.dailyScore);
  assert.deepEqual(pick.sourceEvidence, persisted.sourceEvidence);
  assert.equal(pick.decisionFacts, persisted.decisionFacts);
  assert.equal(pick.setDiversity, persisted.setDiversity);
  assert.equal(pick.mediaAsset, persisted.mediaAsset);
  assert.equal(pick.selectedVariant, persisted.selectedVariant);
});
