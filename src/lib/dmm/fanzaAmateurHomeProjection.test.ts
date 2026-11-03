import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import {
  applyStoredMediaToHomeEntries,
  buildAmateurHomePriceHistoryIndex,
  buildFanzaAmateurHomeEntries,
  withAmateurHomePriceChart,
} from "./fanzaAmateurHomeProjection.ts";

function item(id: number, overrides: Record<string, unknown> = {}) {
  return {
    content_id: `C${id}`,
    imageURL: { large: `api-large-${id}`, small: `api-small-${id}`, list: `api-list-${id}` },
    sampleImageURL: { sample_l: { image: [`api-sample-l-${id}`] }, sample_s: { image: [`api-sample-s-${id}`] } },
    currentPrice: 1500,
    ...overrides,
  } as unknown as FanzaAmateurCatalogItem;
}

test("home entries keep popular ranks, campaign order, latest limits and unique media lookup IDs", () => {
  const ranked = Array.from({ length: 14 }, (_, index) => item(index + 1));
  const latest = Array.from({ length: 14 }, (_, index) => item(index + 10));
  const sections = buildFanzaAmateurHomeEntries(ranked, latest, (entry) => Number(entry.content_id.slice(1)) % 2 === 0);

  assert.deepEqual(sections.popular.map((entry) => entry.rank), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.deepEqual(sections.campaign.map((entry) => entry.item.content_id), ["C2", "C4", "C6", "C8", "C10", "C12", "C14"]);
  assert.equal(sections.latest.length, 12);
  assert.equal(sections.all.length, 31);
  assert.equal(sections.contentIds.length, 21);
});

test("stored media overrides valid fields and keeps API media where stored fields are empty", () => {
  const selected = item(1);
  applyStoredMediaToHomeEntries([{ item: selected }], [{
    content_id: "C1",
    image_url: { large: "", small: "stored-small", list: null },
    sample_image_url: {
      sample_l: { image: ["stored-large-sample", 7] },
      sample_s: { image: [] },
    },
  }]);

  assert.deepEqual(selected.imageURL, { large: "api-large-1", small: "stored-small", list: "api-list-1" });
  assert.deepEqual(selected.sampleImageURL, {
    sample_l: { image: ["stored-large-sample"] },
    sample_s: { image: ["api-sample-s-1"] },
  });
});

test("price history sorts valid prices, appends current price and preserves the low watermark", () => {
  const historyByContentId = buildAmateurHomePriceHistoryIndex([
    { content_id: "C1", observed_at: "2026-10-02T00:00:00Z", price: "2000" },
    { content_id: "C1", observed_at: "2026-10-01T00:00:00Z", price: "980" },
    { content_id: "C1", observed_at: "2026-10-03T00:00:00Z", price: null },
  ]);
  const card = withAmateurHomePriceChart(
    { item: item(1, { currentPrice: 1500 }), rank: 1 },
    historyByContentId,
    "2026-07-04T00:00:00Z",
    "2026-10-02T00:00:00Z",
  );

  assert.deepEqual(card.priceHistory.map((point) => [point.price, point.changedAt, point.isCurrent ?? false]), [
    [980, "2026-10-01T00:00:00Z", false],
    [2000, "2026-10-02T00:00:00Z", false],
    [1500, "2026-10-02T00:00:00Z", true],
  ]);
  assert.equal(card.lowestObservedPrice, 980);
  assert.equal(card.priceWindowStartAt, "2026-07-04T00:00:00Z");
  assert.equal(card.priceWindowEndAt, "2026-10-02T00:00:00Z");
});
