import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVisualVerificationSaveInput,
  deriveVisualVerificationProgress,
} from "./myfansVisualVerificationPayload.ts";

test("visual evidenceのcamelCaseを優先し、text・status・countを正規化する", () => {
  const input = buildVisualVerificationSaveInput({
    id: "42",
    status: "verified",
    queueJobId: "8",
    queueItemId: 19,
    claimToken: " claim-1 ",
    visualRenderStatus: "browser_visible",
    evidence: {
      sceneSummary: "  Ａ   close-up  ",
      scene_summary: "fallback",
      confidence: "high",
      frameOrImageCount: "1.6",
      concreteObservation: "noticed movement",
      failureReason: "",
      inspectedUrl: " https://x.com/post/1 ",
    },
    reason: "fallback reason",
  });

  assert.equal(input.id, 42);
  assert.equal(input.status, "verified");
  assert.equal(input.queueJobId, 8);
  assert.equal(input.claimToken, "claim-1");
  assert.equal(input.analysis.scene_summary, "A close-up");
  assert.equal(input.analysis.confidence, "high");
  assert.equal(input.analysis.frame_or_image_count, 2);
  assert.equal(input.analysis.concrete_observation, "noticed movement");
  assert.equal(input.analysis.failure_reason, "fallback reason");
  assert.equal(input.analysis.evidence_source, "x_logged_in_chrome_visual");
});

test("無効な入力の従来fallbackと下限を維持する", () => {
  const input = buildVisualVerificationSaveInput({
    id: "bad",
    status: "unknown",
    visualRenderStatus: "not-a-status",
    evidence: { confidence: "HIGH", frameOrImageCount: -3 },
  });

  assert.equal(input.id, 0);
  assert.equal(input.status, "partial");
  assert.equal(input.visualRenderStatus, "unknown");
  assert.equal(input.analysis.confidence, "low");
  assert.equal(input.analysis.frame_or_image_count, 0);
});

test("2回連続のgate失敗では一時停止し、batch完了扱いにしない", () => {
  const timestamps = ["paused-at", "updated-at"];
  const result = deriveVisualVerificationProgress({
    job: { consecutive_gate_failures: 1, batch_size: 5, total_sources: 10 },
    count: 5,
    status: "partial",
    reason: "LOGIN challenge",
    now: () => timestamps.shift() ?? "later",
  });

  assert.equal(result.gateFailures, 2);
  assert.equal(result.queuePaused, true);
  assert.equal(result.batchComplete, false);
  assert.equal(result.jobUpdate.status, "paused");
  assert.equal(result.jobUpdate.partial_count, 1);
  assert.equal(result.jobUpdate.paused_at, "paused-at");
  assert.match(String(result.jobUpdate.stopped_reason), /2件連続/);
});

test("通常batch完了とjob全件完了のstatus・counterを決める", () => {
  const batch = deriveVisualVerificationProgress({
    job: { batch_size: 5, total_sources: 12, verified_count: 3 },
    count: 5,
    status: "verified",
    reason: "",
    now: () => "now",
  });
  const complete = deriveVisualVerificationProgress({
    job: { batch_size: 5, total_sources: 6, unavailable_count: 1 },
    count: 6,
    status: "unavailable",
    reason: "",
    now: () => "now",
  });

  assert.equal(batch.batchComplete, true);
  assert.equal(batch.jobUpdate.status, "paused");
  assert.equal(batch.jobUpdate.verified_count, 4);
  assert.equal(complete.jobUpdate.status, "completed");
  assert.equal(complete.jobUpdate.unavailable_count, 2);
  assert.equal(complete.jobUpdate.completed_at, "now");
});
