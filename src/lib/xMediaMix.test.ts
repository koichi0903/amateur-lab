import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { auditCandidateUniqueness, candidateMediaDedupeKey, isDistinctCandidate, isOfficialEligibleVideoCandidate, isStrongSafeVideoCandidate, videoEligibilityReasons } from "./xGrowthOS";
import { isVideoCandidate } from "./xVideoCandidate";

const variant = {
  mediaType: "sample_movie" as const,
  quality: {
    passed: true,
    lastMile: { humanVoice: { passed: true }, nativeXVoice: { passed: true } },
  },
} as Parameters<typeof isStrongSafeVideoCandidate>[1];

const item = {
  mediaType: "sample_movie" as const,
  recommendedMediaUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4",
  canNativeVideo: true,
  sampleMovieUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4",
  mediaAsset: {
    id: 101,
    source_url: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4",
    source_kind: "official_sample",
    fetch_status: "ok",
    media_quality: "strong",
    manual_tags: ["first_seconds_strong"],
  },
  visualFacts: buildVisualVideoFacts({ sampleMovieUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4", manualTags: ["first_seconds_strong"] }),
  visualScoring: { videoHookStrength: 88 },
} as Parameters<typeof isStrongSafeVideoCandidate>[0];

assert.equal(isStrongSafeVideoCandidate(item, variant), true);
assert.equal(isStrongSafeVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, media_quality: "weak" } }, variant), false);
assert.equal(isStrongSafeVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, manual_tags: ["too_explicit_for_reach"] } }, variant), false);
assert.equal(isStrongSafeVideoCandidate({ ...item, canNativeVideo: false }, variant), false);
assert.equal(isVideoCandidate({ mediaType: "sample_movie", recommendedMediaUrl: item.sampleMovieUrl }), true);
assert.equal(isStrongSafeVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, media_quality: null }, mediaType: "sample_movie", recommendedMediaUrl: item.sampleMovieUrl }, variant), true);
assert.equal(videoEligibilityReasons({ ...item, mediaAsset: { ...item.mediaAsset, media_quality: null }, mediaType: "sample_movie", recommendedMediaUrl: item.sampleMovieUrl }, variant).includes("media_quality=weak"), false);
assert.equal(isOfficialEligibleVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, media_quality: null }, mediaType: "sample_movie" }), true);
assert.equal(isOfficialEligibleVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, rights_status: "blocked", x_usage_allowed: false, can_reupload: false, commercial_use_allowed: false }, mediaType: "sample_movie" }), true);
assert.equal(isStrongSafeVideoCandidate({ ...item, sampleMovieUrl: "https://example.com/video.mp4", recommendedMediaUrl: "https://example.com/video.mp4", mediaAsset: { ...item.mediaAsset, source_url: "https://example.com/video.mp4", source_kind: "unknown_external" }, mediaType: "sample_movie" }, variant), false);
assert.equal(isOfficialEligibleVideoCandidate({ ...item, sampleMovieUrl: "https://example.com/video.mp4", recommendedMediaUrl: "https://example.com/video.mp4", mediaAsset: { ...item.mediaAsset, source_url: "https://example.com/video.mp4", source_kind: "unknown_external" }, mediaType: "sample_movie" }), false);

const first = { workId: 1, productId: "p1", sampleMovieUrl: item.sampleMovieUrl, mediaAsset: { id: 101 } };
const sameUrlDifferentWork = { workId: 2, productId: "p2", sampleMovieUrl: item.sampleMovieUrl, mediaAsset: { id: 102 } };
const sameAssetDifferentUrl = { workId: 3, productId: "p3", sampleMovieUrl: "https://cc3001.dmm.co.jp/other.mp4", mediaAsset: { id: 101 } };
assert.equal(candidateMediaDedupeKey(first), "media_asset:101");
assert.equal(isDistinctCandidate(sameUrlDifferentWork, [first]), false);
assert.equal(isDistinctCandidate(sameAssetDifferentUrl, [first]), false);

const uniqueness = auditCandidateUniqueness([
  { workId: 1, productId: "a", sampleMovieUrl: "https://movie/a", mediaAsset: { id: 1 } },
  { workId: 1, productId: "b", sampleMovieUrl: "https://movie/a", mediaAsset: { id: 1 } },
]);
assert.equal(uniqueness.workDuplicateCount, 1);
assert.equal(uniqueness.mediaDuplicateCount, 1);
assert.equal(uniqueness.urlDuplicateCount, 1);
assert.equal(uniqueness.sampleMovieDuplicateCount, 1);
assert.equal(uniqueness.imageDuplicateCount, 0);

const duplicateImage = auditCandidateUniqueness([
  { workId: 10, productId: "image-a", sampleMovieUrl: null, imageUrl: "https://image/shared.jpg", mediaAsset: null },
  { workId: 11, productId: "image-b", sampleMovieUrl: null, imageUrl: "https://image/shared.jpg", mediaAsset: null },
]);
assert.equal(duplicateImage.imageDuplicateCount, 1);
assert.equal(duplicateImage.passed, false);
assert.equal(isDistinctCandidate(
  { workId: 12, productId: "image-c", sampleMovieUrl: null, imageUrl: "https://image/shared.jpg", mediaAsset: null },
  [{ workId: 13, productId: "image-d", sampleMovieUrl: null, imageUrl: "https://image/shared.jpg", mediaAsset: null }],
), false);

console.log("xMediaMix tests passed");
