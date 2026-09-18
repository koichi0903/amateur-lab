import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { candidateMediaDedupeKey, isDistinctCandidate, isStrongSafeVideoCandidate } from "./xGrowthOS";

const variant = {
  mediaType: "sample_movie" as const,
  quality: {
    passed: true,
    lastMile: { humanVoice: { passed: true }, nativeXVoice: { passed: true } },
  },
} as Parameters<typeof isStrongSafeVideoCandidate>[1];

const item = {
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

const first = { workId: 1, productId: "p1", sampleMovieUrl: item.sampleMovieUrl, mediaAsset: { id: 101 } };
const sameUrlDifferentWork = { workId: 2, productId: "p2", sampleMovieUrl: item.sampleMovieUrl, mediaAsset: { id: 102 } };
const sameAssetDifferentUrl = { workId: 3, productId: "p3", sampleMovieUrl: "https://cc3001.dmm.co.jp/other.mp4", mediaAsset: { id: 101 } };
assert.equal(candidateMediaDedupeKey(first), "media_asset:101");
assert.equal(isDistinctCandidate(sameUrlDifferentWork, [first]), false);
assert.equal(isDistinctCandidate(sameAssetDifferentUrl, [first]), false);

console.log("xMediaMix tests passed");
