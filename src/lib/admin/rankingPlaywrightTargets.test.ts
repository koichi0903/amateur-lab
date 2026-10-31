import assert from "node:assert/strict";
import { test } from "node:test";
import type { DmmItem } from "@/types/dmm";
import type { RankingProduct } from "@/lib/playwright/getRankingProducts";
import {
  selectRankingPlaywrightTargets,
  type RankingWorkSnapshot,
} from "./rankingPlaywrightTargets";

const NOW = Date.parse("2026-10-30T00:00:00.000Z");

function item(contentId: string): DmmItem {
  return { content_id: contentId, title: "sample", date: "2026-10-30" } as DmmItem;
}

function work(overrides: Partial<RankingWorkSnapshot> = {}): RankingWorkSnapshot {
  return {
    product_id: "cid001",
    price: 100,
    list_price: 150,
    sale_price: 100,
    url: "https://example.test/work",
    playwright_status: "SUCCESS",
    updated_at: "2026-10-29T00:00:00.000Z",
    stage: "OLD",
    sample_movie_url: "https://example.test/sample.mp4",
    sample_movie_checked_at: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

const listing: RankingProduct = {
  productId: "cid001",
  ranking: 1,
  listPrice: 150,
  salePrice: 100,
};

test("keeps the missing-work repair fallback and carries the listing price", () => {
  const currentItem = item("cid001");
  const targets = selectRankingPlaywrightTargets(
    [currentItem],
    new Map(),
    new Map([["cid001", listing]]),
    NOW,
  );

  assert.deepEqual(targets, [
    { item: currentItem, listPrice: 150, reasons: ["MISSING_DATA"] },
  ]);
});

test("preserves reason order when unavailable work also needs price and weekly refresh", () => {
  const currentItem = item("cid001");
  const targets = selectRankingPlaywrightTargets(
    [currentItem],
    new Map([
      [
        "cid001",
        work({
          playwright_status: "UNAVAILABLE_1_20261029_RESERVED",
          updated_at: "2026-10-20T00:00:00.000Z",
          stage: "NEW",
          sample_movie_url: null,
          sample_movie_checked_at: null,
        }),
      ],
    ]),
    new Map([["cid001", { ...listing, listPrice: 200, salePrice: 120 }]]),
    NOW,
  );

  assert.deepEqual(targets[0]?.reasons, [
    "UNAVAILABLE",
    "PRICE_CHANGED",
    "WEEKLY_REFRESH",
    "SAMPLE_MOVIE_UNCHECKED",
  ]);
});

test("skips complete and recently refreshed work", () => {
  const targets = selectRankingPlaywrightTargets(
    [item("cid001")],
    new Map([["cid001", work()]]),
    new Map([["cid001", listing]]),
    NOW,
  );

  assert.deepEqual(targets, []);
});
