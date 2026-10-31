import assert from "node:assert/strict";
import test from "node:test";
import { shouldFlushScoreBatch } from "./scoreBatchPolicy.ts";

test("score updates flush full batches and final partial batches only", () => {
  assert.equal(shouldFlushScoreBatch(500, 500, false), true);
  assert.equal(shouldFlushScoreBatch(3, 500, true), true);
  assert.equal(shouldFlushScoreBatch(3, 500, false), false);
  assert.equal(shouldFlushScoreBatch(0, 500, true), false);
});
