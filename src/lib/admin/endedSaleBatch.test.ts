import test from "node:test";
import assert from "node:assert/strict";
import {
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  processEndedSaleBatches,
  selectEndedSaleBatch,
} from "./endedSaleBatch.ts";

test("partitions a large ended-sale backlog instead of exceeding the scheduler limit", () => {
  const targets = Array.from({ length: ENDED_SALE_MAX_TARGETS_PER_RUN + 25 }, (_, index) => index);
  const result = selectEndedSaleBatch(targets);
  assert.equal(result.batch.length, ENDED_SALE_MAX_TARGETS_PER_RUN);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.batch.slice(0, 2), [0, 1]);
});

function targets(count: number, start = 1) {
  return Array.from({ length: count }, (_, index) => ({
    product_id: String(start + index).padStart(5, "0"),
  }));
}

async function collectPages(allTargets: ReturnType<typeof targets>) {
  const seen: string[] = [];
  const result = await processEndedSaleBatches(
    async (afterProductId) =>
      allTargets
        .filter((target) => afterProductId === null || target.product_id > afterProductId)
        .slice(0, ENDED_SALE_MAX_TARGETS_PER_RUN),
    async (page) => seen.push(...page.map((target) => target.product_id)),
  );
  return { seen, result };
}

test("walks exactly 1,000 rows and stops on the following empty page", async () => {
  const { seen } = await collectPages(targets(1000));
  assert.equal(seen.length, 1000);
});

test("walks the 1,001st row and more despite a 1,000-row response cap", async () => {
  const { seen } = await collectPages(targets(2001));
  assert.equal(seen.length, 2001);
  assert.equal(seen[1000], "01001");
  assert.equal(seen.at(-1), "02001");
});

test("uses a keyset cursor when the target set shrinks while processing", async () => {
  const remaining = targets(2000);
  const seen: string[] = [];
  const result = await processEndedSaleBatches(
    async (afterProductId) => remaining
      .filter((target) => afterProductId === null || target.product_id > afterProductId)
      .slice(0, ENDED_SALE_MAX_TARGETS_PER_RUN),
    async (page) => {
      seen.push(...page.map((target) => target.product_id));
      for (const target of page) {
        const index = remaining.findIndex((item) => item.product_id === target.product_id);
        if (index >= 0) remaining.splice(index, 1);
      }
    },
  );
  assert.equal(result.processedCount, 2000);
  assert.equal(new Set(seen).size, 2000);
});

test("propagates a page failure instead of treating it as completed", async () => {
  await assert.rejects(
    () => processEndedSaleBatches(
      async () => targets(1),
      async () => { throw new Error("work failed"); },
    ),
    /work failed/,
  );
});

test("stops on the run time budget and handles an empty target set", async () => {
  const empty = await collectPages([]);
  assert.equal(empty.result.processedCount, 0);

  let now = 0;
  await assert.rejects(
    () => processEndedSaleBatches(
      async () => targets(1),
      async () => { now = 10; },
      { now: () => now, timeBudgetMs: 5 },
    ),
    /実行時間上限/,
  );
});
