import assert from "node:assert/strict";
import { isFanzaXGrowthTechnicalSampleMovie } from "./xMediaAssets";
import { isOfficialEligibleVideoCandidate } from "./xGrowthOS";

const officialSampleWithRightsMetadataDisabled = {
  mediaType: "sample_movie" as const,
  sampleMovieUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/regression/regression_dmb_w.mp4",
  recommendedMediaUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/regression/regression_dmb_w.mp4",
  canNativeVideo: false,
  mediaAsset: {
    source_url: "https://cc3001.dmm.co.jp/litevideo/freepv/regression/regression_dmb_w.mp4",
    source_kind: "official_sample",
    fetch_status: "forbidden" as const,
    fetch_status_code: 403,
    mime_type: "text/html",
    content_length: 919,
    rights_status: "unknown" as const,
    x_usage_allowed: false,
    can_reupload: false,
    commercial_use_allowed: false,
  },
};

assert.equal(
  isFanzaXGrowthTechnicalSampleMovie(officialSampleWithRightsMetadataDisabled.mediaAsset, officialSampleWithRightsMetadataDisabled.sampleMovieUrl).usable,
  true,
);
assert.equal(isOfficialEligibleVideoCandidate(officialSampleWithRightsMetadataDisabled), true);
assert.equal(isFanzaXGrowthTechnicalSampleMovie({ source_url: officialSampleWithRightsMetadataDisabled.sampleMovieUrl, source_kind: "official_sample", fetch_status: null }, officialSampleWithRightsMetadataDisabled.sampleMovieUrl).usable, true);

assert.equal(isOfficialEligibleVideoCandidate({
  ...officialSampleWithRightsMetadataDisabled,
  mediaAsset: { ...officialSampleWithRightsMetadataDisabled.mediaAsset, rights_status: "allowed", x_usage_allowed: true, can_reupload: true, commercial_use_allowed: true },
}), true);

assert.equal(isOfficialEligibleVideoCandidate({
  ...officialSampleWithRightsMetadataDisabled,
  mediaAsset: { ...officialSampleWithRightsMetadataDisabled.mediaAsset, fetch_status: "dead" },
}), true);

assert.equal(isFanzaXGrowthTechnicalSampleMovie(null, null).usable, false);
assert.equal(isFanzaXGrowthTechnicalSampleMovie(null, "not a URL").usable, false);
assert.equal(isFanzaXGrowthTechnicalSampleMovie(null, "http://cc3001.dmm.co.jp/sample.mp4").usable, false);
assert.equal(isFanzaXGrowthTechnicalSampleMovie(null, "https://dmm.co.jp.evil.test/sample.mp4").usable, false);
assert.equal(isFanzaXGrowthTechnicalSampleMovie(null, "https://evildmm.co.jp/sample.mp4").usable, false);

assert.equal(isOfficialEligibleVideoCandidate({
  ...officialSampleWithRightsMetadataDisabled,
  sampleMovieUrl: "https://example.com/not-official.mp4",
  recommendedMediaUrl: "https://example.com/not-official.mp4",
  mediaAsset: { ...officialSampleWithRightsMetadataDisabled.mediaAsset, source_url: "https://example.com/not-official.mp4", source_kind: "unknown_external" },
}), false);

console.log("rights metadata must not gate FANZA X Growth official sample movie: regression tests passed");
