import assert from "node:assert/strict";
import test from "node:test";
import { buildXMediaAssetTrimReviewPlan } from "./xGrowthMediaTrimReview.ts";

test("requires modify permission for external video before validating its trim", () => {
  assert.deepEqual(
    buildXMediaAssetTrimReviewPlan(
      { source_url: "https://example.test/video.mp4" },
      { trimStartSeconds: -1 },
      "reviewed-at",
    ),
    { ok: false, error: "外部動画のトリムには編集許可の確認が必要です。" },
  );
});

test("keeps official sample permission and trim metadata defaults", () => {
  const plan = buildXMediaAssetTrimReviewPlan(
    {
      source_url: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4",
      can_modify: false,
      trim_modify_confirmed: false,
    },
    { trimStartSeconds: 2.26 },
    "reviewed-at",
  );
  assert.deepEqual(plan, {
    ok: true,
    trimStartSeconds: 2.3,
    update: {
      trim_start_seconds: 2.3,
      trim_reviewed_at: "reviewed-at",
      trim_reviewed_by: "admin_x_growth",
      trim_review_source: "user_confirmed",
      trim_modify_confirmed: true,
      trim_note: "",
    },
  });
});

test("authorized external video keeps explicit trim confirmation and custom metadata", () => {
  const plan = buildXMediaAssetTrimReviewPlan(
    {
      source_url: "https://example.test/video.mp4",
      can_modify: true,
      trim_modify_confirmed: false,
    },
    {
      trimStartSeconds: 4,
      trimNote: "approved opening",
      trimModifyConfirmed: true,
      reviewedBy: "operator",
      reviewSource: "manual",
    },
    "reviewed-at",
  );
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.update.trim_modify_confirmed, true);
    assert.equal(plan.update.trim_reviewed_by, "operator");
    assert.equal(plan.update.trim_review_source, "manual");
    assert.equal(plan.update.trim_note, "approved opening");
  }
});

test("reports invalid trim after permission is confirmed", () => {
  assert.deepEqual(
    buildXMediaAssetTrimReviewPlan(
      { source_url: "https://example.test/video.mp4", can_modify: true },
      { trimStartSeconds: -0.1 },
      "reviewed-at",
    ),
    { ok: false, error: "開始秒は0以上にしてください。" },
  );
});
