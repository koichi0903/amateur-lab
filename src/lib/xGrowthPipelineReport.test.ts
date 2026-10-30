import assert from "node:assert/strict";
import test from "node:test";
import type { XGrowthOpportunity } from "./xGrowthTypes";
import type { XPostCandidate } from "./xPostPlanner";
import { buildXGrowthPipelineReport } from "./xGrowthPipelineReport";

const officialUrl = "https://cc3001.dmm.co.jp/litevideo/freepv/example/example_dmb_w.mp4";

function opportunity(workId: number, freshnessStatus: "fresh" | "expired", qualityPassed: boolean) {
  return {
    workId,
    title: `work-${workId}`,
    canNativeVideo: true,
    mediaAsset: {
      source_url: officialUrl,
      source_kind: "official_sample",
      fetch_status: "ok",
      fetch_status_code: 200,
      mime_type: "video/mp4",
      content_length: 123456,
    },
    sampleMovieUrl: officialUrl,
    mediaType: "sample_movie",
    recommendedMediaUrl: null,
    imageUrl: null,
    freshness: { status: freshnessStatus, total: 50 },
    creativeVariants: [{
      id: `variant-${workId}`,
      mediaType: "sample_movie",
      quality: {
        passed: qualityPassed,
        total: qualityPassed ? 90 : 35,
        gate: { failed: qualityPassed ? [] : ["duration"] },
        lastMile: { reasons: qualityPassed ? [] : ["trim_review"] },
      },
    }],
  } as unknown as XGrowthOpportunity;
}

test("pipeline report preserves stage counts, hard-gate capacity, and first-drop reasons", () => {
  const selected = opportunity(101, "fresh", true);
  const expiredAndRejected = opportunity(102, "expired", false);
  const candidates = [
    { workId: 101, title: "selected", score: 90, discountRate: 0.2, saleEndAt: null, sampleMovieUrl: officialUrl },
    { workId: 102, title: "filtered later", score: 80, discountRate: 0.1, saleEndAt: null, sampleMovieUrl: officialUrl },
    { workId: 103, title: "no official video", score: 70, discountRate: 0, saleEndAt: null, sampleMovieUrl: null },
  ] as unknown as XPostCandidate[];
  const report = buildXGrowthPipelineReport({
    candidates,
    expandedCandidates: candidates.slice(0, 2),
    scored: [selected, expiredAndRejected],
    rankedOpportunities: [selected, expiredAndRejected],
    prefilterOpportunities: [selected],
    opportunities: [selected, expiredAndRejected],
    selectedPicks: [{
      ...selected,
      pickOrder: 1,
      creativeVariantId: "variant-101",
      mediaType: "sample_movie",
    } as never],
    slotEligibleCount: 1,
    finalSelectedCount: 1,
  });

  assert.equal(report.pipeline.videoCandidateWorks, 2);
  assert.equal(report.pipeline.videoExpandedWorks, 2);
  assert.equal(report.pipeline.afterStale, 1);
  assert.equal(report.pipeline.afterMedia, 2);
  assert.equal(report.pipeline.videoHardGatePassedWorks, 1);
  assert.equal(report.pipeline.videoFivePickCapacity, 1);
  assert.equal(report.pipeline.videoMinimumShortage, 1);
  assert.deepEqual(report.videoQualityFailureCounts, {
    "axis:duration": 1,
    "last-mile:trim_review": 1,
  });
  assert.deepEqual(report.videoWorkStages.map((stage) => stage.firstDropReason), [
    null,
    "shared_quality_prefilter",
  ]);
});
