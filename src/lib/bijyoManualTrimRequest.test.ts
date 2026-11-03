import assert from "node:assert/strict";
import test from "node:test";
import { bijyoManualTrimErrorStatus, bijyoTrimSecondsFromFilename, parseBijyoManualTrimRequest } from "./bijyoManualTrimRequest.ts";

test("manual trim request validates identifiers and preserves reset mode inputs", () => {
  assert.deepEqual(parseBijyoManualTrimRequest({ mode: "resetAuto", trimStartSeconds: "12.5" }, 7, 42), {
    ok: true,
    value: { jobId: 7, workId: 42, mode: "auto", trimStartSeconds: "12.5" },
  });
  assert.deepEqual(parseBijyoManualTrimRequest({ mode: "other" }, 7, 0), {
    ok: true,
    value: { jobId: 7, workId: undefined, mode: "manual", trimStartSeconds: undefined },
  });
  assert.deepEqual(parseBijyoManualTrimRequest({}, 0, 42), { ok: false, error: "jobIdが不正です。" });
  assert.deepEqual(parseBijyoManualTrimRequest({}, 7, -1), { ok: false, error: "workIdが不正です。" });
});

test("manual trim error and filename results preserve status mapping", () => {
  assert.equal(bijyoManualTrimErrorStatus({ status: "400" }), 400);
  assert.equal(bijyoManualTrimErrorStatus({ status: 403 }), 500);
  assert.equal(bijyoManualTrimErrorStatus(new Error("failed")), 500);
  assert.equal(bijyoTrimSecondsFromFilename("work-trim-12.5s.mp4"), 12.5);
  assert.equal(bijyoTrimSecondsFromFilename("work.mp4"), 0);
});
