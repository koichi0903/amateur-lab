import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeActressRankingRows,
  mergeSeriesRankingRows,
  projectEntityRankingItems,
  type RankedDmmItem,
} from "./entityRankingProjection.ts";

function item(rank: number, names: { actress?: string[]; genre?: string[]; maker?: string[]; series?: string[] }) {
  return {
    content_id: `item-${rank}`,
    title: "title",
    date: "2026-10-29",
    prices: { price: "100", list_price: "100" },
    rank,
    iteminfo: {
      actress: names.actress?.map((name) => ({ name })),
      genre: names.genre?.map((name) => ({ name })),
      maker: names.maker?.map((name) => ({ name })),
      series: names.series?.map((name) => ({ name })),
    },
  } satisfies RankedDmmItem;
}

test("aggregates weighted entities, trims names, excludes ignored genres, and assigns ranks", () => {
  const result = projectEntityRankingItems([
    item(1, { actress: [" Alice "], genre: ["Drama", "Ignored"], maker: ["Studio A"], series: ["Series A"] }),
    item(4, { actress: ["Alice", "Bob"], genre: ["Drama"], maker: ["Studio B"], series: ["Series B"] }),
  ], ["Ignored"]);

  assert.deepEqual(result.actressRows, [
    { name: "Alice", score: 750, rank: 1 },
    { name: "Bob", score: 250, rank: 2 },
  ]);
  assert.deepEqual(result.genreRows, [{ name: "Drama", score: 750, rank: 1 }]);
  assert.deepEqual(result.makerRows, [
    { name: "Studio A", score: 500, rank: 1 },
    { name: "Studio B", score: 250, rank: 2 },
  ]);
  assert.deepEqual(result.seriesRows, [
    { name: "Series A", score: 500, rank: 1 },
    { name: "Series B", score: 250, rank: 2 },
  ]);
});

test("merges source and FANZA actress ranks without dropping one-sided names", () => {
  assert.deepEqual(mergeActressRankingRows(
    [{ name: "Alice", score: 500, rank: 1 }],
    [{ name: "Bob", rank: 4 }, { name: "Alice", rank: 2 }],
    "2026-10-29T00:00:00.000Z",
  ), [
    { name: "Alice", original_rank: 1, fanza_rank: 2, updated_at: "2026-10-29T00:00:00.000Z" },
    { name: "Bob", original_rank: null, fanza_rank: 4, updated_at: "2026-10-29T00:00:00.000Z" },
  ]);
});

test("gives FANZA-only series a null original rank and zero score", () => {
  assert.deepEqual(mergeSeriesRankingRows(
    [{ name: "Series A", score: 500, rank: 1 }],
    [{ name: "Series B", rank: 3 }],
    "updated",
  ), [
    { name: "Series A", original_rank: 1, fanza_rank: null, score: 500, updated_at: "updated" },
    { name: "Series B", original_rank: null, fanza_rank: 3, score: 0, updated_at: "updated" },
  ]);
});
