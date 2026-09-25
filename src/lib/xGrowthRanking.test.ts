import assert from "node:assert/strict";
import { selectRankedMediaMix, type RankedMediaMixCandidate } from "./xGrowthOS";
import type { DecisionType } from "./domain/decisionFacts";

const candidate = (workId: number, score: number, mediaType: "sample_movie" | "existing_link_image", decisionTypes: DecisionType[] = []): RankedMediaMixCandidate => ({
  workId,
  mediaKey: `${mediaType}:${workId}`,
  mediaType,
  score,
  decisionTypes,
});

const postedAndDuplicate = [
  candidate(1, 100, "sample_movie"),
  candidate(1, 99, "existing_link_image"),
  candidate(2, 98, "sample_movie"),
  candidate(3, 97, "sample_movie"),
  candidate(4, 96, "sample_movie"),
  candidate(5, 95, "sample_movie"),
  candidate(6, 94, "sample_movie"),
  candidate(7, 93, "existing_link_image"),
  candidate(8, 92, "existing_link_image"),
  candidate(9, 91, "existing_link_image"),
  candidate(10, 90, "existing_link_image"),
];
const result = selectRankedMediaMix(postedAndDuplicate, 9, new Set([1]));
assert.deepEqual(result.selected.map((item) => item.workId), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(result.selected.filter((item) => item.mediaType === "sample_movie").length, 5);
assert.equal(result.selected.filter((item) => item.mediaType === "existing_link_image").length, 4);
assert.deepEqual(result.selected.slice(0, 3).map((item) => item.workId), [2, 3, 4]);

const fourVideo = selectRankedMediaMix([
  ...Array.from({ length: 4 }, (_, index) => candidate(index + 1, 100 - index, "sample_movie")),
  ...Array.from({ length: 6 }, (_, index) => candidate(index + 10, 90 - index, "existing_link_image")),
]);
assert.equal(fourVideo.targetVideos, 4);
assert.equal(fourVideo.selected.filter((item) => item.mediaType === "sample_movie").length, 4);
assert.equal(fourVideo.selected.length, 9);

const coverage = selectRankedMediaMix([
  candidate(1, 100, "sample_movie", ["RECORD_LOW"]),
  candidate(2, 99, "sample_movie", ["RECORD_LOW"]),
  candidate(3, 98, "sample_movie", ["RECORD_LOW"]),
  candidate(4, 97, "sample_movie", ["RECORD_LOW"]),
  candidate(5, 96, "sample_movie", ["RECORD_LOW"]),
  candidate(6, 95, "existing_link_image", ["RECORD_LOW"]),
  candidate(7, 94, "existing_link_image", ["RECORD_LOW"]),
  candidate(8, 93, "existing_link_image", ["RECORD_LOW"]),
  candidate(9, 92, "existing_link_image", ["RECORD_LOW"]),
  candidate(10, 50, "existing_link_image", ["HIGH_DISCOUNT_NOT_LOW"]),
  candidate(11, 49, "existing_link_image", ["HIDDEN_VALUE"]),
]);
assert.equal(coverage.selected.some((item) => item.decisionTypes.includes("HIGH_DISCOUNT_NOT_LOW")), true);
assert.equal(coverage.selected.some((item) => item.decisionTypes.includes("HIDDEN_VALUE")), true);
assert.equal(coverage.coverageAdjustments, 2);

const fallback = selectRankedMediaMix([
  { ...candidate(1, 100, "sample_movie"), mediaKey: "shared", mediaKeys: ["shared", "body:first"] },
  { ...candidate(2, 99, "sample_movie"), mediaKey: "shared", mediaKeys: ["shared", "body:second"] },
  { ...candidate(2, 98, "existing_link_image"), mediaKey: "image-2", mediaKeys: ["image-2", "body:second-image"] },
  candidate(3, 97, "existing_link_image"),
]);
assert.deepEqual(fallback.rankedPool.map((item) => item.workId), [1, 2, 3]);
assert.equal(fallback.rankedPool.find((item) => item.workId === 2)?.mediaKeys?.includes("body:second-image"), true);
assert.equal(new Set(fallback.rankedPool.map((item) => item.workId)).size, fallback.rankedPool.length);

console.log("xGrowth ranking regression tests passed");
