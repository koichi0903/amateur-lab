import assert from "node:assert/strict";
import test from "node:test";
import { collectSaleWorks } from "./saleWorkQuery.ts";

test("sale work pages preserve the 1,000-row range and filter only after collection", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ product_id: `p-${index}` }));
  const ranges: Array<[number, number]> = [];
  const result = await collectSaleWorks(new Set(["p-0", "p-1000"]), async (from, to) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  });

  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
  assert.equal(result.allWorks.length, 1001);
  assert.deepEqual(result.works.map((work) => work.product_id), ["p-0", "p-1000"]);
});

test("sale work paging stops on empty data and propagates query errors", async () => {
  const empty = await collectSaleWorks(new Set(), async () => ({ data: null, error: null }));
  assert.deepEqual(empty, { allWorks: [], works: [] });

  await assert.rejects(
    () => collectSaleWorks(new Set(), async () => ({ data: null, error: new Error("query failed") })),
    /query failed/,
  );
});
