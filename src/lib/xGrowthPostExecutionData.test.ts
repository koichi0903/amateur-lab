import assert from "node:assert/strict";
import test from "node:test";
import type { SerializedTopPick } from "./xGrowthDailyPlanSerialization";
import { buildXGrowthPostLogInput } from "./xGrowthPostExecutionData";

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
