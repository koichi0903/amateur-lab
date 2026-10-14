import assert from "node:assert/strict";
import { auditCandidateUniqueness, cheapCandidatePrefilter, isAllowedXGrowthMediaType, isMediaVariantSelectionEligible, isSoftQualityEligible, preserveDecisionLanesBeforeLimit, VIDEO_QUALITY_EVALUATION_WORK_LIMIT } from "./xGrowthOS";

assert.equal(isAllowedXGrowthMediaType("sample_movie"), true);
assert.equal(isAllowedXGrowthMediaType("existing_link_image"), true);
assert.equal(isAllowedXGrowthMediaType("data_card"), true);
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
assert.equal(isMediaVariantSelectionEligible(softVariant as never), true);
assert.equal(isMediaVariantSelectionEligible({ ...softVariant, mediaType: "sample_movie" } as never), false);
assert.equal(isMediaVariantSelectionEligible({ ...softVariant, mediaType: "sample_movie", quality: { ...softVariant.quality, passed: true } } as never), true);
assert.equal(isSoftQualityEligible({ ...softVariant, quality: { ...softVariant.quality, lastMile: { ...softVariant.quality.lastMile, nativeXVoice: { passed: false } } } } as never), false);

const imageLane = Array.from({ length: 120 }, (_, index) => ({
  key: `image-${index}`,
  workId: index + 1,
  sourceType: "WORK",
  mediaType: "existing_link_image",
  sampleMovieUrl: null,
  visualScoring: { videoHookStrength: 0, visualSpecificity: 0 },
  reachScore: 100,
  followScore: 100,
  authorityScore: 100,
  revenueScore: 100,
}));
const videoLane = Array.from({ length: 120 }, (_, index) => ({
  key: `video-${index}`,
  workId: index + 1001,
  sourceType: "WORK",
  mediaType: "sample_movie",
  sampleMovieUrl: `https://cc3001.dmm.co.jp/litevideo/freepv/example/${index}.mp4`,
  mediaAsset: null,
  visualScoring: { videoHookStrength: 0, visualSpecificity: 0 },
  reachScore: 1,
  followScore: 1,
  authorityScore: 1,
  revenueScore: 1,
}));
const prefiltered = cheapCandidatePrefilter([...imageLane, ...videoLane] as never, 120);
assert.equal(prefiltered.length, 120);
assert.equal(prefiltered.filter((item) => item.mediaType === "sample_movie").length, 120);
const scoredWindow = preserveDecisionLanesBeforeLimit([...imageLane, ...videoLane] as never, 120);
assert.equal(scoredWindow.length, 120);
assert.equal(scoredWindow.filter((item) => item.mediaType === "sample_movie").length, 120);

assert.equal(VIDEO_QUALITY_EVALUATION_WORK_LIMIT, 500);
const largeVideoLane = Array.from({ length: 520 }, (_, index) => ({
  ...videoLane[index % videoLane.length],
  key: `large-video-${index}`,
  workId: index + 3000,
  sampleMovieUrl: `https://cc3001.dmm.co.jp/litevideo/freepv/large/${index}.mp4`,
}));
const largeInput = [...imageLane, ...largeVideoLane] as never;
const largePrefilter = cheapCandidatePrefilter(largeInput, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
assert.equal(largePrefilter.length, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
assert.equal(largePrefilter.filter((item) => item.mediaType === "sample_movie").length, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
const largeScoredWindow = preserveDecisionLanesBeforeLimit(largeInput, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
assert.equal(largeScoredWindow.length, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);
assert.equal(largeScoredWindow.filter((item) => item.mediaType === "sample_movie").length, VIDEO_QUALITY_EVALUATION_WORK_LIMIT);

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
