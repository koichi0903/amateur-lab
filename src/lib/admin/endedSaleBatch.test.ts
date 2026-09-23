import test from "node:test";
import assert from "node:assert/strict";
import {
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  selectEndedSaleBatch,
} from "./endedSaleBatch.ts";

test("partitions a large ended-sale backlog instead of exceeding the scheduler limit", () => {
  const targets = Array.from({ length: ENDED_SALE_MAX_TARGETS_PER_RUN + 25 }, (_, index) => index);
  const result = selectEndedSaleBatch(targets);
  assert.equal(result.batch.length, ENDED_SALE_MAX_TARGETS_PER_RUN);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.batch.slice(0, 2), [0, 1]);
});
