import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { auditCandidateUniqueness, candidateMediaDedupeKey, isDistinctCandidate, isOfficialEligibleVideoCandidate, isStrongSafeVideoCandidate, selectRankedMediaMix, videoEligibilityReasons } from "./xGrowthOS";
import type { DecisionType } from "./domain/decisionFacts";
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
assert.equal(isOfficialEligibleVideoCandidate({ ...item, mediaAsset: { ...item.mediaAsset, rights_status: "unknown", x_usage_allowed: false, can_reupload: false, commercial_use_allowed: false }, mediaType: "sample_movie" }), true);
assert.equal(isStrongSafeVideoCandidate({ ...item, sampleMovieUrl: "https://example.com/video.mp4", recommendedMediaUrl: "https://example.com/video.mp4", mediaAsset: { ...item.mediaAsset, source_url: "https://example.com/video.mp4", source_kind: "unknown_external" }, mediaType: "sample_movie" }, variant), false);
assert.equal(isOfficialEligibleVideoCandidate({ ...item, sampleMovieUrl: "https://example.com/video.mp4", recommendedMediaUrl: "https://example.com/video.mp4", mediaAsset: { ...item.mediaAsset, source_url: "https://example.com/video.mp4", source_kind: "unknown_external" }, mediaType: "sample_movie" }), false);

const rankedCandidate = (workId: number, mediaType: "sample_movie" | "existing_link_image", score: number, decisionTypes: DecisionType[] = ["RECORD_LOW"]) => ({
  workId,
  mediaKey: `${mediaType}:${workId}`,
  mediaType,
  score,
  decisionTypes,
});
const fiveVideoSupply = Array.from({ length: 5 }, (_, index) => [
  rankedCandidate(index + 1, "existing_link_image", 100),
  rankedCandidate(index + 1, "sample_movie", 1),
]).flat();
assert.equal(selectRankedMediaMix(fiveVideoSupply, 9).selected.filter((candidate) => candidate.mediaType === "sample_movie").length, 5);
const fourVideoSupply = Array.from({ length: 4 }, (_, index) => [
  rankedCandidate(index + 20, "existing_link_image", 100),
  rankedCandidate(index + 20, "sample_movie", 1),
]).flat();
assert.equal(selectRankedMediaMix(fourVideoSupply, 9).selected.filter((candidate) => candidate.mediaType === "sample_movie").length, 4);
assert.equal(selectRankedMediaMix([
  rankedCandidate(99, "existing_link_image", 100),
  rankedCandidate(99, "sample_movie", 1),
  rankedCandidate(100, "sample_movie", 2),
  rankedCandidate(101, "sample_movie", 2),
  rankedCandidate(102, "sample_movie", 2),
], 5).selected.some((candidate) => candidate.workId === 99 && candidate.mediaType === "sample_movie"), true);

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

const repairedSet = [
  { workId: 21, productId: "unique-a", sampleMovieUrl: "https://movie/unique-a", mediaAsset: { id: 201 } },
  { workId: 22, productId: "duplicate", sampleMovieUrl: "https://movie/duplicate", mediaAsset: { id: 202 } },
  { workId: 22, productId: "duplicate", sampleMovieUrl: "https://movie/duplicate", mediaAsset: { id: 202 } },
];
assert.equal(auditCandidateUniqueness(repairedSet).passed, false);
assert.equal(auditCandidateUniqueness(repairedSet.filter((candidate, index) => index !== 2)).passed, true);

console.log("xMediaMix tests passed");
