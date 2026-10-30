import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";
import { buildFanzaAmateurRelatedWorkFilters, rankFanzaAmateurRelatedWorks } from "./fanzaAmateurRelatedWorks";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    content_id: "source",
    title: "作品名",
    date: "2026-10-01",
    review: { count: 0 },
    reviewAverage: null,
    campaigns: [],
    iteminfo: { genre: [], maker: [], series: [] },
    ...overrides,
  } as unknown as FanzaAmateurCatalogItem;
}

function names(values: string[]) {
  return values.map((name) => ({ name }));
}

test("related-work filters deduplicate and cap series, genre, and maker terms", () => {
  const item = makeItem({
    iteminfo: {
      series: names([" Series A ", "Series A", "Series B", "Series C", "Series D"]),
      genre: names(["Genre 1", "Genre 2", "Genre 3", "Genre 4", "Genre 5", "Genre 6", "Genre 7"]),
      maker: names(["Maker 1", "Maker 2", "Maker 3", "Maker 4"]),
    },
  });

  assert.deepEqual(
    buildFanzaAmateurRelatedWorkFilters(item).map(({ kind, value }) => kind + ":" + value),
    [
      "series:Series A", "series:Series B", "series:Series C",
      "genre:Genre 1", "genre:Genre 2", "genre:Genre 3", "genre:Genre 4", "genre:Genre 5", "genre:Genre 6",
      "maker:Maker 1", "maker:Maker 2", "maker:Maker 3",
    ],
  );
});

test("related works exclude the source, keep the latest duplicate, score relevance, and retain tie-breaks", () => {
  const source = makeItem({
    iteminfo: { series: names(["S"]), genre: names(["G"]), maker: names(["M"]) },
  });
  const campaignWinner = makeItem({
    content_id: "campaign",
    iteminfo: { series: names(["S"]), genre: names(["G"]), maker: names(["M"]) },
    campaigns: [{ title: "sale", dateBegin: "2026-10-01 00:00:00", dateEnd: "2026-10-31 23:59:59" }],
    review: { count: 5 },
    reviewAverage: 5,
  });
  const newerSeries = makeItem({
    content_id: "series-new",
    title: "newer duplicate replacement",
    date: "2026-10-03",
    iteminfo: { series: names(["S"]), genre: [], maker: [] },
  });
  const olderSeries = makeItem({
    content_id: "series-old",
    date: "2026-10-01",
    iteminfo: { series: names(["S"]), genre: [], maker: [] },
  });
  const genreMaker = makeItem({
    content_id: "genre-maker",
    iteminfo: { series: [], genre: names(["G"]), maker: names(["M"]) },
  });
  const unrelated = makeItem({ content_id: "unrelated", date: "2026-10-04" });

  const results = rankFanzaAmateurRelatedWorks(
    source,
    [source, newerSeries, olderSeries, campaignWinner, genreMaker, unrelated, { ...newerSeries, title: "latest duplicate" }],
    10,
    Date.parse("2026-10-10T12:00:00+09:00"),
  );

  assert.deepEqual(results.map(({ content_id }) => content_id), ["campaign", "series-new", "series-old", "genre-maker", "unrelated"]);
  assert.equal(results[1].title, "latest duplicate");
  assert.deepEqual(rankFanzaAmateurRelatedWorks(source, [campaignWinner], -1), []);
});
