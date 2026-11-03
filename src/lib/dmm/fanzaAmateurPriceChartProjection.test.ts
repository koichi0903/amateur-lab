import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { indexFanzaAmateurPriceHistory, projectFanzaAmateurPriceChart } from "./fanzaAmateurPriceChartProjection.ts";

const item = { content_id: "work-1", currentPrice: 650 } as FanzaAmateurCatalogItem;

test("indexes valid summary prices and projects ordered history with the current price", () => {
  const histories = indexFanzaAmateurPriceHistory([
    { content_id: "work-1", observed_at: "2026-01-02", price: "700円" },
    { content_id: "work-1", observed_at: "2026-01-01", price: "800" },
    { content_id: "work-1", observed_at: "2026-01-03", price: "unknown" },
    { content_id: "other", observed_at: "2026-01-01", price: "100" },
  ]);
  const card = projectFanzaAmateurPriceChart(item, histories, "start", "end", 3);

  assert.deepEqual(card.priceHistory, [
    { price: 800, changedAt: "2026-01-01", priceKind: null },
    { price: 700, changedAt: "2026-01-02", priceKind: null },
    { price: 650, changedAt: "end", priceKind: null, isCurrent: true },
  ]);
  assert.equal(card.rank, 3);
  assert.equal(card.lowestObservedPrice, 650);
  assert.equal(card.priceWindowStartAt, "start");
});

test("returns null lowest price when there is no history or current price", () => {
  const card = projectFanzaAmateurPriceChart({ content_id: "empty", currentPrice: null }, new Map(), "start", "end");
  assert.deepEqual(card.priceHistory, []);
  assert.equal(card.lowestObservedPrice, null);
});
