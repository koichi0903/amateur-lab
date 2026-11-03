import assert from "node:assert/strict";
import test from "node:test";
import { buildXGrowthVideoWorkStages, countXGrowthVideoQualityFailures } from "./xGrowthVideoWorkStages";

test("video work stages preserve the first drop and final selection reasons", () => {
  const result = buildXGrowthVideoWorkStages({
    candidateVideoIds: new Set([101, 102, 103]),
    expandedVideoIds: new Set([101, 103]),
    scoreWindowVideoIds: new Set([101, 103]),
    afterMediaVideoIds: new Set([101, 103]),
    prefilterVideoIds: new Set([101, 103]),
    qualityVideoWorkIds: new Set([101, 103]),
    hardGateVideoIds: new Set([101, 103]),
    selectedHardGateVideoIds: new Set([101]),
    candidateByVideoWorkId: new Map([
      [101, { title: "selected", score: 90, discountRate: 0.2, saleEndAt: null }],
      [102, { title: "not expanded", score: 80, discountRate: 0, saleEndAt: null }],
      [103, { title: "not selected", score: 70, discountRate: 0.1, saleEndAt: "2026-11-01" }],
    ]),
    opportunityByVideoWorkId: new Map([
      [101, { freshness: { total: 12 }, creativeVariants: [{ mediaType: "sample_movie", quality: { passed: true, total: 84 } }] }],
      [103, { freshness: { total: 8 }, creativeVariants: [{ mediaType: "sample_movie", quality: { passed: true, total: 76 } }] }],
    ]),
  });

  assert.deepEqual(result.map((stage) => stage.firstDropReason), [
    null,
    "creative_supply_expansion",
    "final_slot_diversity_or_ranking",
  ]);
  assert.equal(result[0].creativeQualityScore, 84);
  assert.equal(result[1].title, "not expanded");
  assert.equal(result[2].freshnessScore, 8);
  assert.equal(result[2].saleEndAt, "2026-11-01");
});

test("video quality failure counts ignore non-video and out-of-pipeline works", () => {
  const result = countXGrowthVideoQualityFailures([
    {
      workId: 201,
      creativeVariants: [
        {
          mediaType: "sample_movie",
          quality: { passed: false, gate: { failed: ["duration", "rights"] }, lastMile: { reasons: ["trim_not_reviewed"] } },
        },
        {
          mediaType: "existing_link_image",
          quality: { passed: false, gate: { failed: ["image_quality"] }, lastMile: { reasons: ["url_unchecked"] } },
        },
      ],
    },
    {
      workId: 202,
      creativeVariants: [
        {
          mediaType: "sample_movie",
          quality: { passed: false, gate: { failed: ["not_counted"] }, lastMile: { reasons: ["not_counted"] } },
        },
      ],
    },
  ], new Set([201]));

  assert.deepEqual(result, {
    "axis:duration": 1,
    "axis:rights": 1,
    "last-mile:trim_not_reviewed": 1,
  });
});
