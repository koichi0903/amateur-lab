import assert from "node:assert/strict";
import test from "node:test";
import { classifyVideoAnalysisAsset } from "./xGrowthVideoAnalysisEligibility.ts";

test("skips records without a work, source URL, or supported video type", () => {
  assert.equal(classifyVideoAnalysisAsset({ source_url: "https://example.test/a.mp4", media_type: "video" }, "v1", "hash"), "skip");
  assert.equal(classifyVideoAnalysisAsset({ work_id: 1, media_type: "video" }, "v1", null), "skip");
  assert.equal(classifyVideoAnalysisAsset({ work_id: 1, source_url: "https://example.test/a.mp4", media_type: "image" }, "v1", "hash"), "skip");
});

test("reuses facts only when version, source fingerprint, and facts all match", () => {
  const asset = {
    work_id: 1,
    source_url: "https://example.test/a.mp4",
    media_type: "video",
    video_analysis_version: "v1",
    video_analysis_source_fingerprint: "hash",
    visual_video_facts: { durationSeconds: 10 },
  } as const;
  assert.equal(classifyVideoAnalysisAsset(asset, "v1", "hash"), "reuse");
  assert.equal(classifyVideoAnalysisAsset(asset, "v2", "hash"), "analyze");
  assert.equal(classifyVideoAnalysisAsset(asset, "v1", "changed-hash"), "analyze");
  assert.equal(classifyVideoAnalysisAsset({ ...asset, visual_video_facts: null }, "v1", "hash"), "analyze");
});
