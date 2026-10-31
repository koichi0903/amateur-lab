import assert from "node:assert/strict";
import test from "node:test";
import { projectXGrowthMediaEligibility } from "./xGrowthMediaEligibility.ts";
import type { XGrowthOpportunity } from "../xGrowthOS.ts";
import type { XMediaAsset } from "../xMediaAssets.ts";

const officialSampleUrl = "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4";

function opportunity(overrides: Partial<XGrowthOpportunity> = {}) {
  return {
    workId: 1,
    productId: "sample-1",
    mediaType: "sample_movie",
    sampleMovieUrl: null,
    recommendedMediaUrl: officialSampleUrl,
    ...overrides,
  } as XGrowthOpportunity;
}

test("keeps the official recommended URL fallback when no stored or sample URL exists", () => {
  const result = projectXGrowthMediaEligibility(opportunity(), new Map());
  assert.equal(result.mediaUsage, "allowed");
  assert.equal(result.canNativeVideo, true);
  assert.equal(result.mediaAsset, null);
  assert.equal(result.mediaDecision, "公式recommendedMediaUrlのフォールバック（HTTP/MIME未確認）");
});

test("rejects a nonofficial recommended URL fallback", () => {
  const result = projectXGrowthMediaEligibility(
    opportunity({ recommendedMediaUrl: "https://example.test/sample.mp4" }),
    new Map(),
  );
  assert.equal(result.mediaUsage, "not_available");
  assert.equal(result.canNativeVideo, false);
  assert.notEqual(result.mediaDecision, "公式recommendedMediaUrlのフォールバック（HTTP/MIME未確認）");
});

test("does not use the fallback when a stored asset exists", () => {
  const storedAsset = {
    id: 9,
    account_handle: "hakkutsu_lab",
    work_id: 1,
    product_id: "sample-1",
    media_type: "video",
    source_url: officialSampleUrl,
  } as XMediaAsset;
  const result = projectXGrowthMediaEligibility(opportunity(), new Map([[1, storedAsset]]));
  assert.equal(result.mediaAsset, storedAsset);
  assert.notEqual(result.mediaDecision, "公式recommendedMediaUrlのフォールバック（HTTP/MIME未確認）");
});

test("keeps non-sample media usage allowed while reporting its native-video usability", () => {
  const result = projectXGrowthMediaEligibility(
    opportunity({ mediaType: "existing_link_image", sampleMovieUrl: null }),
    new Map(),
  );
  assert.equal(result.mediaUsage, "allowed");
  assert.equal(result.canNativeVideo, false);
  assert.equal("mediaDecision" in result, false);
});
