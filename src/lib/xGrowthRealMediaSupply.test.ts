import assert from "node:assert/strict";
import { auditCandidateUniqueness, isAllowedXGrowthMediaType, isSoftQualityEligible } from "./xGrowthOS";

assert.equal(isAllowedXGrowthMediaType("sample_movie"), true);
assert.equal(isAllowedXGrowthMediaType("existing_link_image"), true);
assert.equal(isAllowedXGrowthMediaType("data_card"), false);
assert.equal(isAllowedXGrowthMediaType("text"), false);

const softVariant = {
  mediaType: "existing_link_image" as const,
  quality: {
    passed: false,
    recommendation: "revise" as const,
    lastMile: {
      passed: true,
      humanVoice: { passed: true },
      nativeXVoice: { passed: true },
    },
  },
};
assert.equal(isSoftQualityEligible(softVariant as never), true);
assert.equal(isSoftQualityEligible({ ...softVariant, quality: { ...softVariant.quality, lastMile: { ...softVariant.quality.lastMile, nativeXVoice: { passed: false } } } } as never), false);

const picks = Array.from({ length: 9 }, (_, index) => ({
  workId: index + 1,
  productId: `product-${index + 1}`,
  sampleMovieUrl: index < 2 ? `https://video/${index + 1}.mp4` : null,
  mediaAsset: null,
  imageUrl: index >= 2 ? `https://image/${index + 1}.jpg` : null,
}));
assert.equal(auditCandidateUniqueness(picks).passed, true);
assert.equal(auditCandidateUniqueness(picks).workDuplicateCount, 0);
assert.equal(auditCandidateUniqueness(picks).urlDuplicateCount, 0);

console.log("xGrowth real-media supply tests passed");
