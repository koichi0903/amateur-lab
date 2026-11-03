import assert from "node:assert/strict";
import test from "node:test";
import { processSaleWorkBatch, type SaleWorkTarget } from "./saleWorkBatch.ts";

test("sale batches skip complete prices and isolate update results and failures", async () => {
  const batch: SaleWorkTarget[] = [
    { product_id: "complete", url: null, price: 1000, sale_price: 800, sale_end_at: "2026-11-02" },
    { product_id: "updated", url: null, price: 1000, sale_price: null, sale_end_at: "2026-11-02" },
    { product_id: "unchanged", url: null, price: 1000, sale_price: 800, sale_end_at: null },
    { product_id: "failed", url: null, price: 1000, sale_price: null, sale_end_at: null },
  ];
  const attempted: string[] = [];
  const updated: string[] = [];
  const failures: string[] = [];

  const result = await processSaleWorkBatch(
    batch,
    async (work) => {
      attempted.push(work.product_id);
      if (work.product_id === "failed") throw new Error("temporary failure");
      return work.product_id === "updated" ? "updated" : "unchanged";
    },
    (productId) => updated.push(productId),
    (work, error) => failures.push(`${work.product_id}:${String(error)}`),
  );

  assert.deepEqual(result, [true, true, true, false]);
  assert.deepEqual(attempted, ["updated", "unchanged", "failed"]);
  assert.deepEqual(updated, ["updated"]);
  assert.deepEqual(failures, ["failed:Error: temporary failure"]);
});
