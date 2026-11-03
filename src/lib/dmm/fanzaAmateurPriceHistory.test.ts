import assert from "node:assert/strict";
import test from "node:test";
import { expandFanzaAmateurPriceSnapshotRows } from "./fanzaAmateurPriceHistoryRows.ts";

test("weekly price snapshots expand into summary and delivery history rows", () => {
  const rows = expandFanzaAmateurPriceSnapshotRows({
    source_run_id: "run-1",
    content_id: "content-1",
    observed_at: "2026-10-01T00:00:00.000Z",
    prices: {
      price: "1980",
      list_price: "3980",
      deliveries: {
        delivery: [
          { type: "download", price: "1980", list_price: "3980" },
          { type: "stream", price: "1480", list_price: "2980" },
        ],
      },
    },
  });

  assert.deepEqual(rows.map(({ content_id, source_run_id, observed_at, price_type, price, list_price }) => ({
    content_id,
    source_run_id,
    observed_at,
    price_type,
    price,
    list_price,
  })), [
    {
      content_id: "content-1",
      source_run_id: "run-1",
      observed_at: "2026-10-01T00:00:00.000Z",
      price_type: "summary",
      price: "1980",
      list_price: "3980",
    },
    {
      content_id: "content-1",
      source_run_id: "run-1",
      observed_at: "2026-10-01T00:00:00.000Z",
      price_type: "download",
      price: "1980",
      list_price: "3980",
    },
    {
      content_id: "content-1",
      source_run_id: "run-1",
      observed_at: "2026-10-01T00:00:00.000Z",
      price_type: "stream",
      price: "1480",
      list_price: "2980",
    },
  ]);
});

test("malformed snapshot prices still produce a nullable summary row", () => {
  const rows = expandFanzaAmateurPriceSnapshotRows({
    source_run_id: "run-2",
    content_id: "content-2",
    observed_at: "2026-10-02T00:00:00.000Z",
    prices: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_type, "summary");
  assert.equal(rows[0].price, null);
  assert.equal(rows[0].list_price, null);
});
