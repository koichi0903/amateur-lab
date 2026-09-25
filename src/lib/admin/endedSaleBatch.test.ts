import test from "node:test";
import assert from "node:assert/strict";
import {
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  processEndedSaleBatches,
  selectEndedSaleBatch,
} from "./endedSaleBatch.ts";
import {
  classifyEndedSaleRemaining,
  isDeferredUnavailableStatus,
  summarizeEndedSaleOutcomes,
} from "./endedSaleOutcome.ts";
import { advanceUnavailableStatus } from "../playwright/unavailableStatus.ts";

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
    async (page) => {
      seen.push(...page.map((target) => target.product_id));
    },
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

test("classifies only processed UNAVAILABLE_1/2 rows as non-fatal deferred work", () => {
  assert.equal(isDeferredUnavailableStatus("UNAVAILABLE_1_20260924_OLD"), true);
  assert.equal(isDeferredUnavailableStatus("UNAVAILABLE_2_20260924_NEW"), true);
  assert.equal(isDeferredUnavailableStatus("UNAVAILABLE_3_20260924_OLD"), false);
  assert.equal(isDeferredUnavailableStatus("SALE"), false);

  const result = classifyEndedSaleRemaining(
    [
      { product_id: "deferred-1", playwright_status: "UNAVAILABLE_1_20260924_OLD" },
      { product_id: "deferred-2", playwright_status: "UNAVAILABLE_2_20260924_NEW" },
      { product_id: "unprocessed", playwright_status: "UNAVAILABLE_1_20260924_OLD" },
      { product_id: "failed", playwright_status: "SALE" },
    ],
    new Set(["deferred-1", "deferred-2", "failed"]),
  );

  assert.deepEqual(result.deferred.map((target) => target.product_id), ["deferred-1", "deferred-2"]);
  assert.deepEqual(result.fatal.map((target) => target.product_id), ["unprocessed", "failed"]);
});

test("keeps deferred classification safe for a paged backlog larger than 1,000", () => {
  const processed = new Set(Array.from({ length: 1001 }, (_, index) => `p-${index}`));
  const remaining = Array.from({ length: 1001 }, (_, index) => ({
    product_id: `p-${index}`,
    playwright_status: "UNAVAILABLE_1_20260924_OLD",
  }));
  const result = classifyEndedSaleRemaining(remaining, processed);
  assert.equal(result.deferred.length, 1001);
  assert.equal(result.fatal.length, 0);
});

test("keeps ended-sale counters semantically separate", () => {
  const result = summarizeEndedSaleOutcomes([
    "updated",
    ...Array.from({ length: 25 }, () => "unavailable_deferred" as const),
    "unchanged",
  ]);
  assert.deepEqual(result, { updated: 1, deferred: 25, unchanged: 1 });
});

test("advances SALE to UNAVAILABLE_1 without clearing sale fields", () => {
  assert.deepEqual(
    advanceUnavailableStatus("SALE", "OLD", "20260925"),
    {
      nextStatus: "UNAVAILABLE_1_20260925_OLD",
      nextCount: 1,
      discontinued: false,
    },
  );
});

test("advances unavailable confirmations only on a later day", () => {
  assert.equal(
    advanceUnavailableStatus(
      "UNAVAILABLE_1_20260925_OLD",
      "OLD",
      "20260925",
    ).nextStatus,
    "UNAVAILABLE_1_20260925_OLD",
  );
  assert.equal(
    advanceUnavailableStatus(
      "UNAVAILABLE_1_20260925_OLD",
      "OLD",
      "20260926",
    ).nextStatus,
    "UNAVAILABLE_2_20260926_OLD",
  );
  assert.equal(
    advanceUnavailableStatus(
      "UNAVAILABLE_2_20260926_OLD",
      "OLD",
      "20260927",
    ).nextStatus,
    "DISCONTINUED_20260927_OLD",
  );
});
