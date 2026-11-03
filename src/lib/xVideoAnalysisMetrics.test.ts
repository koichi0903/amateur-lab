import assert from "node:assert/strict";
import test from "node:test";
import { buildVideoEvidence, summarizeVideoFrames, type PixelStats } from "./xVideoAnalysisMetrics";

function pixelStats(brightness: number, color: number): PixelStats {
  return {
    brightness,
    red: color,
    green: color,
    blue: color,
    histogram: [],
    detail: 0.1,
    colorVariance: 0.1,
  };
}

test("frame summary preserves motion, pacing, and first-change thresholds", () => {
  const summary = summarizeVideoFrames([
    pixelStats(0.2, 0.2),
    pixelStats(0.3, 0.3),
    pixelStats(0.5, 0.5),
  ], [0, 3, 6]);

  assert.equal(summary.motion, "high");
  assert.equal(summary.pacing, "medium");
  assert.equal(summary.firstChangeSec, 3);
  assert.equal(summary.changes.length, 2);
  assert.ok(summary.openingMotionDelta >= 0.18);
});

test("visual evidence combines color, opening, and blank-intro findings", () => {
  const frames = [pixelStats(0.4, 0.2), pixelStats(0.4, 0.4), pixelStats(0.4, 0.4)];
  const times = [0, 3, 6];
  const summary = summarizeVideoFrames(frames, times);
  const evidence = buildVideoEvidence(frames, times, summary, { endSec: 0.5, kind: "white" });

  assert.deepEqual(evidence.map(({ kind }) => kind), [
    "motion_level",
    "pacing",
    "visual_style",
    "first_visual_change_sec",
    "title_card_duration_sec",
  ]);
  assert.equal(evidence.at(-1)?.safePhrase, "明るい無内容イントロが終わるのは冒頭0.5秒付近。");
});
