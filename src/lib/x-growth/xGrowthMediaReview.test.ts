import assert from "node:assert/strict";
import test from "node:test";
import { buildXMediaAssetReviewPlan } from "./xGrowthMediaReview.ts";

test("allowed review requires a rights basis type and a URL or note", () => {
  assert.deepEqual(buildXMediaAssetReviewPlan({ id: 1, status: "allowed" }, "now"), {
    ok: false,
    error: "allowedには権利根拠の種類とURLまたはメモが必要です。",
  });
  assert.equal(buildXMediaAssetReviewPlan({ id: 1, status: "allowed", rightsBasisType: "permission" }, "now").ok, false);
  assert.equal(buildXMediaAssetReviewPlan({ id: 1, status: "allowed", rightsBasisUrl: "https://example.test/proof" }, "now").ok, false);
  assert.equal(buildXMediaAssetReviewPlan({ id: 1, status: "allowed", rightsBasisType: "permission", rightsBasisNote: "approved" }, "now").ok, true);
});

test("review update mirrors rights and audit defaults for allowed and blocked states", () => {
  const allowed = buildXMediaAssetReviewPlan({
    id: 2,
    status: "allowed",
    rightsBasisType: "permission",
    rightsBasisUrl: "https://example.test/proof",
    mediaQuality: "strong",
    manualTags: ["first_seconds_strong"],
  }, "2026-10-30T00:00:00.000Z");
  assert.equal(allowed.ok, true);
  if (allowed.ok) {
    assert.deepEqual(allowed.update, {
      rights_status: "allowed",
      rights_basis_type: "permission",
      rights_basis_url: "https://example.test/proof",
      evidence_ref: "https://example.test/proof",
      rights_basis_note: "",
      reviewed_at: "2026-10-30T00:00:00.000Z",
      reviewed_by: "admin_x_growth",
      review_source: "admin",
      x_usage_allowed: true,
      can_reupload: true,
      can_modify: false,
      quote_only: false,
      commercial_use_allowed: true,
      media_quality: "strong",
      manual_tags: ["first_seconds_strong"],
    });
  }

  const blocked = buildXMediaAssetReviewPlan({ id: 3, status: "blocked" }, "now");
  assert.equal(blocked.ok, true);
  if (blocked.ok) {
    assert.equal(blocked.update.rights_basis_type, "insufficient_evidence");
    assert.equal(blocked.update.x_usage_allowed, false);
    assert.equal(blocked.update.can_reupload, false);
    assert.equal(blocked.update.quote_only, true);
    assert.equal(blocked.update.commercial_use_allowed, false);
  }
});

test("review update preserves explicit empty metadata while applying permission flags", () => {
  const review = buildXMediaAssetReviewPlan({
    id: 4,
    status: "review",
    rightsBasisType: "",
    rightsBasisUrl: "",
    rightsBasisNote: "",
    reviewedBy: "",
    reviewSource: "",
    mediaQuality: "weak",
    manualTags: ["manual"],
  }, "reviewed-at");

  assert.deepEqual(review, {
    ok: true,
    update: {
      rights_status: "review",
      rights_basis_type: "",
      rights_basis_url: "",
      evidence_ref: "",
      rights_basis_note: "",
      reviewed_at: "reviewed-at",
      reviewed_by: "",
      review_source: "",
      x_usage_allowed: false,
      can_reupload: false,
      can_modify: false,
      quote_only: true,
      commercial_use_allowed: false,
      media_quality: "weak",
      manual_tags: ["manual"],
    },
  });
});
