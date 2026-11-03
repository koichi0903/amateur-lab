import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequiredFanzaAmateurPriceHistoryKeys,
  reconstructChangedFanzaAmateurPriceHistoryRows,
  rememberNewestFanzaAmateurPriceHistoryValues,
  selectDailyFanzaAmateurPriceHistoryRows,
  type FanzaAmateurPriceHistoryBackfillSourceRow,
} from "./fanzaAmateurPriceHistoryBackfill.ts";
import type { FanzaAmateurPriceHistoryRow } from "./fanzaAmateurPriceHistoryRows.ts";

function sourceRow(runId: string, fetchedAt: string, price: string, contentId = "content-1"):
FanzaAmateurPriceHistoryBackfillSourceRow {
  return {
    run_id: runId,
    content_id: contentId,
    fetched_at: fetchedAt,
    raw_item: { prices: { price } },
  };
}

function historyRow(runId: string, observedAt: string, price: string): FanzaAmateurPriceHistoryRow {
  return {
    content_id: "content-1",
    source_run_id: runId,
    observed_at: observedAt,
    price_type: "summary",
    price,
    list_price: null,
    price_data: { price },
  };
}

test("required prior-value keys cover only product and price types in the source batch", () => {
  const keys = getRequiredFanzaAmateurPriceHistoryKeys([
    sourceRow("run-1", "2026-10-01T00:00:00.000Z", "1980"),
    sourceRow("run-2", "2026-10-02T00:00:00.000Z", "1480", "content-2"),
  ]);

  assert.deepEqual([...keys], ["content-1\u0000summary", "content-2\u0000summary"]);
});

test("prior-history pages remember only the newest relevant value once", () => {
  const requiredKeys = new Set(["content-1\u0000summary", "content-1\u0000stream"]);
  const seenKeys = new Set<string>();
  const previousByWork = new Map();

  rememberNewestFanzaAmateurPriceHistoryValues([
    { content_id: "content-1", price_type: "summary", price: "1200", list_price: null },
    { content_id: "unrelated", price_type: "summary", price: "900", list_price: null },
  ], requiredKeys, seenKeys, previousByWork);
  rememberNewestFanzaAmateurPriceHistoryValues([
    { content_id: "content-1", price_type: "summary", price: "1000", list_price: null },
    { content_id: "content-1", price_type: "stream", price: "800", list_price: null },
  ], requiredKeys, seenKeys, previousByWork);

  assert.deepEqual([...previousByWork.get("content-1")], [
    ["summary", { price: "1200", list_price: null }],
    ["stream", { price: "800", list_price: null }],
  ]);
  assert.equal(previousByWork.has("unrelated"), false);
});

test("batch reconstruction sorts oldest first and emits only price changes", () => {
  const previousByWork = new Map([[
    "content-1",
    new Map([["summary", { price: "1000", list_price: null }]]),
  ]]);

  const changed = reconstructChangedFanzaAmateurPriceHistoryRows([
    sourceRow("run-3", "2026-10-03T00:00:00.000Z", "1200"),
    sourceRow("run-1", "2026-10-01T00:00:00.000Z", "1000"),
    sourceRow("run-2", "2026-10-02T00:00:00.000Z", "1000"),
  ], previousByWork);

  assert.deepEqual(changed.map(({ source_run_id, price }) => ({ source_run_id, price })), [
    { source_run_id: "run-3", price: "1200" },
  ]);
  assert.equal(previousByWork.get("content-1")?.get("summary")?.price, "1200");
});

test("daily deduplication uses JST dates and keeps the last changed row per product and type", () => {
  const selected = selectDailyFanzaAmateurPriceHistoryRows([
    historyRow("before", "2026-10-01T14:59:00.000Z", "1000"),
    historyRow("same-day-latest", "2026-10-01T14:59:30.000Z", "1100"),
    historyRow("next-jst-day", "2026-10-01T15:00:00.000Z", "1200"),
  ]);

  assert.deepEqual(selected.map(({ source_run_id }) => source_run_id), ["same-day-latest", "next-jst-day"]);
});

test("daily deduplication rejects invalid observation timestamps", () => {
  assert.throws(
    () => selectDailyFanzaAmateurPriceHistoryRows([historyRow("bad", "not-a-date", "1000")]),
    /価格履歴の取得日時が不正です/u,
  );
});
