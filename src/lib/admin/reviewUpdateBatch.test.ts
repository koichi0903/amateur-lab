import assert from "node:assert/strict";
import test from "node:test";
import { processReviewBatch } from "./reviewUpdateBatch";

test("review batches retry every non-success and count only the final outcome", async () => {
  const outcomes: Record<string, string[]> = {
    A: ["success"],
    B: ["skip", "skip"],
    C: ["failed", "success"],
    D: ["skip", "success"],
    E: ["failed", "failed"],
  };
  const attempts: string[] = [];
  const summary = await processReviewBatch(
    ["A", "B", "C", "D", "E"].map((product_id) => ({ product_id })),
    async ({ product_id }) => {
      attempts.push(product_id);
      return outcomes[product_id].shift() as "success" | "skip" | "failed";
    },
  );

  assert.deepEqual(attempts, ["A", "B", "C", "D", "E", "B", "C", "D", "E"]);
  assert.deepEqual(summary, {
    success: 3,
    skip: 1,
    failed: 1,
    workIds: ["A", "C", "D"],
    skippedWorkIds: ["B"],
    unresolvedFailures: ["E"],
  });
});

test("review batches do not retry when all first attempts succeed", async () => {
  let calls = 0;
  const summary = await processReviewBatch(
    [{ product_id: "A" }, { product_id: "B" }],
    async () => {
      calls++;
      return "success";
    },
  );

  assert.equal(calls, 2);
  assert.deepEqual(summary, {
    success: 2,
    skip: 0,
    failed: 0,
    workIds: ["A", "B"],
    skippedWorkIds: [],
    unresolvedFailures: [],
  });
});
