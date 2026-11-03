import assert from "node:assert/strict";
import test from "node:test";
import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";
import { buildManualXGrowthPostLogInput, buildXGrowthPostLogInput } from "./xGrowthPostExecutionData";

test("post log metadata preserves the selected daily-pick identity and intent", () => {
  const persistedPick = {
    candidateId: "candidate-7",
    slotId: "slot_2",
    slotRole: "FOLLOW_OR_AUTHORITY",
    candidateRank: "A",
    selectedVariant: { hookType: "rating_anomaly", linkStrategy: "reply_link", ctaStrategy: "reason_cta" },
  } as unknown as SerializedTopPick;
  const result = buildXGrowthPostLogInput({
    opportunity: {
      post_text: "採用した投稿文",
      opportunity_key: "opportunity-7",
      work_id: 707,
      topic: "日次候補",
    },
    persistedPick,
    accountHandle: "hakkutsu_lab",
    postDate: "2026-10-29",
  });

  assert.equal(result.postKey, "opportunity-7");
  assert.equal(result.workId, 707);
  assert.equal(result.accountHandle, "hakkutsu_lab");
  assert.equal(result.postIntent, "work_link");
  assert.equal(result.scheduledSlot, "slot_2");
  assert.equal(result.creativeVariantId, "candidate-7");
  assert.equal(result.hookType, "rating_anomaly");
  assert.deepEqual(result.creativeGenome, {
    persisted_top_pick: persistedPick,
    candidate_id: "candidate-7",
    slot_role: "FOLLOW_OR_AUTHORITY",
    candidate_rank: "A",
  });
});

test("post log metadata supplies stable fallbacks when the opportunity has no persisted pick", () => {
  const result = buildXGrowthPostLogInput({
    opportunity: { post_text: "投稿文", opportunity_key: "opportunity-fallback", work_id: 12, topic: "候補" },
    persistedPick: null,
    accountHandle: "hakkutsu_lab",
    postDate: "2026-10-29",
  });

  assert.equal(result.postKey, "opportunity-fallback");
  assert.equal(result.creativeVariantId, "opportunity-fallback");
  assert.equal(result.scheduledSlot, null);
  assert.equal(result.hookType, null);
  assert.equal(result.linkStrategy, null);
  assert.equal(result.ctaStrategy, null);
  assert.equal(result.creativeGenome, null);
});

test("manual post log preserves the registered identity and normalizes the stored title", () => {
  const result = buildManualXGrowthPostLogInput({
    accountHandle: "hakkutsu_lab",
    candidateId: "candidate-manual-8",
    candidateRank: "B",
    intent: "work_link",
    linkStrategy: "reply_link",
    mediaAssetId: 83,
    postDate: "2026-10-31",
    postKey: "existing-x-post-key",
    postText: "手動投稿文",
    slotId: "slot_2",
    slotRole: "FOLLOW_OR_AUTHORITY",
    title: "作品タイトル".repeat(60),
    workId: 84,
    xPostId: "123456789012345678",
  });

  assert.equal(result.postKey, "existing-x-post-key");
  assert.equal(result.workId, 84);
  assert.equal(result.accountHandle, "hakkutsu_lab");
  assert.equal(result.postIntent, "work_link");
  assert.equal(result.scheduledSlot, "slot_2");
  assert.equal(result.mediaAssetId, 83);
  assert.equal(result.creativeVariantId, "candidate-manual-8");
  assert.equal(result.linkStrategy, "reply_link");
  assert.equal(result.title.length, 300);
  assert.deepEqual(result.creativeGenome, {
    candidate_id: "candidate-manual-8",
    slot_id: "slot_2",
    slot_role: "FOLLOW_OR_AUTHORITY",
    candidate_rank: "B",
    intent: "work_link",
    completion_source: "admin_manual_posted_button",
  });
});

test("manual post log preserves the date-and-candidate fallback and nullable fields", () => {
  const result = buildManualXGrowthPostLogInput({
    accountHandle: "second_account",
    candidateId: "manual-12",
    linkStrategy: null,
    postDate: "2026-10-31",
    postKey: "manual-2026-10-31-manual-12",
    postText: "手動投稿文",
    title: "候補",
    workId: 12,
    xPostId: "987654321012345678",
  });

  assert.equal(result.postKey, "manual-2026-10-31-manual-12");
  assert.equal(result.scheduledSlot, null);
  assert.equal(result.mediaAssetId, null);
  assert.deepEqual(result.creativeGenome, {
    candidate_id: "manual-12",
    slot_id: null,
    slot_role: null,
    candidate_rank: null,
    intent: null,
    completion_source: "admin_manual_posted_button",
  });
});
