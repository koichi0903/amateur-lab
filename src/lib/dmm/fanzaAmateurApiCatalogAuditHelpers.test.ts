import assert from "node:assert/strict";
import test from "node:test";
import { buildFanzaAmateurApiCatalogPageProgress, recoverFanzaAmateurApiEmptyRange, splitFanzaAmateurApiDateRange } from "./fanzaAmateurApiCatalogRange.ts";
import { buildFanzaAmateurWeeklyPriceSnapshotRows } from "./fanzaAmateurWeeklyPriceSnapshots.ts";

test("date range splitting covers both halves without gaps", () => {
  assert.deepEqual(splitFanzaAmateurApiDateRange({ fromDate: "2026-10-01", toDate: "2026-10-04" }), [
    { fromDate: "2026-10-01", toDate: "2026-10-02" },
    { fromDate: "2026-10-03", toDate: "2026-10-04" },
  ]);
  assert.equal(splitFanzaAmateurApiDateRange({ fromDate: "2026-10-01", toDate: "2026-10-01" }), null);
});

test("unexpected empty pages replace the incomplete range with smaller ranges", () => {
  const result = recoverFanzaAmateurApiEmptyRange(
    { expected_item_count: 5, range_count: 2 },
    { fromDate: "2026-10-01", toDate: "2026-10-04", offset: 5, expectedCount: 5 },
    [{ fromDate: "2026-10-10", toDate: "2026-10-11" }],
    0,
  );
  assert.equal(result.kind, "split");
  assert.deepEqual(result.updates.pending_ranges, [
    { fromDate: "2026-10-01", toDate: "2026-10-02" },
    { fromDate: "2026-10-03", toDate: "2026-10-04" },
    { fromDate: "2026-10-10", toDate: "2026-10-11" },
  ]);
  assert.equal(result.updates.expected_item_count, 0);
  assert.equal(result.updates.range_count, 1);
});

test("an empty single-day range stops for attention rather than completing", () => {
  const result = recoverFanzaAmateurApiEmptyRange(
    { expected_item_count: 8, range_count: 1 },
    { fromDate: "2026-10-01", toDate: "2026-10-01", offset: 4, expectedCount: 8 },
    [],
    0,
  );
  assert.equal(result.kind, "needs_attention");
  assert.equal(result.updates.status, "needs_attention");
  assert.match(result.updates.last_error, /欠落の可能性/);
});

test("catalog page progress advances offsets and adds initial range counts once", () => {
  const progress = buildFanzaAmateurApiCatalogPageProgress({
    run: { expected_item_count: 0, range_count: 0, fetched_item_count: 0, completed_range_count: 0 },
    activeRange: { fromDate: "2026-10-01", toDate: "2026-10-31", offset: 1, expectedCount: null },
    pendingRanges: [],
    rawItemCount: 100,
    observedItemKeyPaths: ["content_id"],
    totalCount: 200,
  });

  assert.equal(progress.kind, "advance");
  if (progress.kind !== "advance") return;
  assert.equal(progress.rangeComplete, false);
  assert.deepEqual(progress.updates.current_range, {
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    offset: 101,
    expectedCount: 200,
  });
  assert.equal(progress.updates.expected_item_count, 200);
  assert.equal(progress.updates.range_count, 1);
  assert.equal(progress.updates.fetched_item_count, 100);
});

test("unexpected empty catalog pages recover before a range can be completed", () => {
  const progress = buildFanzaAmateurApiCatalogPageProgress({
    run: { expected_item_count: 8, range_count: 1, fetched_item_count: 3, completed_range_count: 0 },
    activeRange: { fromDate: "2026-10-01", toDate: "2026-10-04", offset: 4, expectedCount: 8 },
    pendingRanges: [],
    rawItemCount: 0,
    observedItemKeyPaths: [],
    totalCount: 8,
  });

  assert.equal(progress.kind, "recovery");
  assert.equal(progress.updates.current_range, null);
  assert.equal(progress.updates.expected_item_count, 0);
  assert.equal(progress.updates.range_count, 0);
  assert.match(String(progress.updates.last_error), /範囲を分割/);
});

test("weekly snapshot rows skip recent IDs and collapse duplicate content IDs", () => {
  const rows = buildFanzaAmateurWeeklyPriceSnapshotRows(
    [
      { content_id: " recent ", prices: { price: 100 } },
      { content_id: "new", prices: { price: 200 } },
      { content_id: "new", prices: { price: 250 } },
      { content_id: "invalid", prices: [1, 2] },
      { content_id: " " },
    ],
    new Set(["recent"]),
    "run-id",
    "2026-10-28T00:00:00.000Z",
  );
  assert.deepEqual(rows, [
    { source_run_id: "run-id", content_id: "new", observed_at: "2026-10-28T00:00:00.000Z", prices: { price: 250 } },
    { source_run_id: "run-id", content_id: "invalid", observed_at: "2026-10-28T00:00:00.000Z", prices: {} },
  ]);
});
