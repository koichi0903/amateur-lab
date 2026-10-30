import assert from "node:assert/strict";
import test from "node:test";
import { resolveBijyoTrimPlan, type BijyoTrimPlanDependencies } from "./bijyoVideoPreparation.ts";
import type { VideoAnalysisResult } from "./xVideoAnalysis.ts";

const analysis = {} as never;

function dependencies(): BijyoTrimPlanDependencies & { calls: { validated?: unknown; analyzed?: unknown; calculatedFrom?: number } } {
  const calls: { validated?: unknown; analyzed?: unknown; calculatedFrom?: number } = {};
  return {
    calls,
    validate(value: unknown) {
      calls.validated = value;
      return { ok: true as const, value: 12.3 };
    },
    async analyze(input: { sourceUrl: string; jacketUrl: null }) {
      calls.analyzed = input;
      return analysis as VideoAnalysisResult;
    },
    calculate(_analysis: VideoAnalysisResult, existingTrimStartSeconds = 0) {
      calls.calculatedFrom = existingTrimStartSeconds;
      return { trimStartSeconds: 4.5, reason: "intro_plus_2s" };
    },
  };
}

const input = { mode: undefined, trimStartSeconds: 3, trimReason: "none", sourceUrl: "https://example.test/sample.mp4" } as const;

test("manual trim validates the requested point without analyzing the video", async () => {
  const deps = dependencies();
  const result = await resolveBijyoTrimPlan({ ...input, mode: "manual", requestedTrimStartSeconds: 12 }, deps);

  assert.deepEqual(result, { trimStartSeconds: 12.3, reason: "manual_override" });
  assert.equal(deps.calls.validated, 12);
  assert.equal(deps.calls.analyzed, undefined);
});

test("manual validation errors are surfaced for the caller to record", async () => {
  const deps = dependencies();
  deps.validate = () => ({ ok: false, error: "開始秒が不正です。" });

  await assert.rejects(resolveBijyoTrimPlan({ ...input, mode: "manual" }, deps), /開始秒が不正です/);
  assert.equal(deps.calls.analyzed, undefined);
});

test("a previously selected manual override is reused unless auto mode was requested", async () => {
  const deps = dependencies();
  const result = await resolveBijyoTrimPlan({ ...input, trimReason: "manual_override", trimStartSeconds: 7.5 }, deps);

  assert.deepEqual(result, { trimStartSeconds: 7.5, reason: "manual_override" });
  assert.equal(deps.calls.analyzed, undefined);
});

test("auto mode analyzes the sample and resets the prior trim point", async () => {
  const deps = dependencies();
  const result = await resolveBijyoTrimPlan({ ...input, mode: "auto", trimReason: "manual_override", trimStartSeconds: 7.5 }, deps);

  assert.deepEqual(result, { trimStartSeconds: 4.5, reason: "intro_plus_2s" });
  assert.deepEqual(deps.calls.analyzed, { sourceUrl: input.sourceUrl, jacketUrl: null });
  assert.equal(deps.calls.calculatedFrom, 0);
});

test("default analysis preserves the existing trim point as a calculation floor", async () => {
  const deps = dependencies();
  await resolveBijyoTrimPlan({ ...input, trimStartSeconds: 6 }, deps);

  assert.equal(deps.calls.calculatedFrom, 6);
});
