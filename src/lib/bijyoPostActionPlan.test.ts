import assert from "node:assert/strict";
import test from "node:test";
import { buildBijyoPostActionPlan } from "./bijyoPostActionPlan.ts";

test("bijyo posted action keeps the accepted X URL format and extracts the post id", () => {
  assert.deepEqual(buildBijyoPostActionPlan({ action: "posted", jobId: 7, xPostUrl: " https://www.x.com/sample/status/12345?ref=post " }), {
    kind: "posted", jobId: 7, postId: "12345",
  });
  assert.deepEqual(buildBijyoPostActionPlan({ action: "posted", jobId: "bad", xPostUrl: "https://x.com/sample/status/12345" }), {
    kind: "invalid", error: "jobIdが不正です。",
  });
  assert.deepEqual(buildBijyoPostActionPlan({ action: "posted", jobId: 7, xPostUrl: "https://example.com/sample/status/12345" }), {
    kind: "invalid", error: "X投稿URLを入力してください（例: https://x.com/アカウント/status/投稿ID）。",
  });
});

test("bijyo skip prefers a valid job id, then falls back to a valid work id", () => {
  assert.deepEqual(buildBijyoPostActionPlan({ action: "skip", jobId: 7, workId: 12 }), { kind: "skipJob", jobId: 7 });
  assert.deepEqual(buildBijyoPostActionPlan({ action: "skip", jobId: 0, workId: 12 }), { kind: "skipWork", workId: 12 });
  assert.deepEqual(buildBijyoPostActionPlan({ action: "skip", jobId: 0, workId: -1 }), { kind: "skipInvalid" });
});

test("bijyo manual actions keep raw ids for their existing handlers", () => {
  const body = { action: "manualTrim", jobId: "bad", workId: "0", mode: "resetAuto" };
  const plan = buildBijyoPostActionPlan(body);
  assert.equal(plan.kind, "manualTrim");
  if (plan.kind === "manualTrim") {
    assert.equal(Number.isNaN(plan.jobId), true);
    assert.equal(plan.workId, 0);
    assert.equal(plan.body, body);
  }
});

test("bijyo exclude validates job id only as a safe integer and blocks unknown actions", () => {
  assert.deepEqual(buildBijyoPostActionPlan({ action: "exclude", jobId: -1 }), { kind: "exclude", jobId: -1 });
  assert.deepEqual(buildBijyoPostActionPlan({ action: "disablePosting", jobId: 1 }), {
    kind: "invalid", error: "この画面ではX API自動投稿を利用しません。",
  });
});
