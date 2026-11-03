import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";
import {
  buildFanzaAmateurBrowseCriteria,
  getFanzaAmateurCampaignEnd,
  hasActiveCampaign,
  isAllFanzaAmateurEntityWorksBrowse,
  matchesFanzaAmateurAdvancedFilters,
  matchesFanzaAmateurRankedFilters,
  sortFanzaAmateurCampaignItems,
  type RankedFanzaAmateurItem,
} from "./fanzaAmateurCatalogBrowseRules";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    content_id: "cid-1",
    product_id: "product-1",
    title: "作品名",
    date: "2026-10-10",
    affiliateURL: "https://affiliate.example.test/",
    imageUrl: null,
    currentPrice: 90,
    reviewAverage: 4.5,
    campaigns: [{ title: "sale", dateBegin: "2026-10-01 00:00:00", dateEnd: "2026-10-31 23:59:59" }],
    prices: { list_price: "100" },
    review: { count: 10 },
    iteminfo: {
      genre: [{ id: "g1", name: "genre-1" }, { id: "g2", name: "genre-2" }],
      maker: [{ id: "m1", name: "maker-1" }],
    },
    ...overrides,
  } as unknown as FanzaAmateurCatalogItem;
}

test("browse criteria trims and caps text and combines distinct genres", () => {
  const criteria = buildFanzaAmateurBrowseCriteria({
    query: "  keyword  ",
    performer: " performer ",
    genre: " genre-1 ",
    genres: ["genre-1", " genre-2 ", "", "genre-3"],
  }, []);

  assert.equal(criteria.safeQuery, "keyword");
  assert.equal(criteria.safePerformer, "performer");
  assert.deepEqual(criteria.selectedGenres, ["genre-1", "genre-2", "genre-3"]);
  assert.deepEqual(criteria.performerContentIdSet, new Set());
  assert.equal(buildFanzaAmateurBrowseCriteria({ query: "x".repeat(120) }, null).safeQuery?.length, 100);
});

test("advanced browse filters retain release, all-genre, and minimum-price rules", () => {
  const criteria = buildFanzaAmateurBrowseCriteria({
    genres: ["genre-1", "genre-2"],
    minPrice: 80,
    releaseFrom: "2026-10-01",
    releaseTo: "2026-10-31",
  }, null);
  assert.equal(matchesFanzaAmateurAdvancedFilters(makeItem(), criteria), true);
  assert.equal(matchesFanzaAmateurAdvancedFilters(makeItem({ currentPrice: 79 }), criteria), false);
  assert.equal(matchesFanzaAmateurAdvancedFilters(makeItem({ date: "2026-09-30" }), criteria), false);
  assert.equal(matchesFanzaAmateurAdvancedFilters(makeItem({ iteminfo: { genre: [{ id: "g1", name: "genre-1" }] } }), criteria), false);
  assert.equal(matchesFanzaAmateurAdvancedFilters(makeItem({ date: "" }), criteria), true);
});

test("ranked browse filters preserve performer, text, maker, campaign, price, rating, and release gates", () => {
  const criteria = buildFanzaAmateurBrowseCriteria({
    query: "作品",
    performer: "performer",
    genre: "genre-1",
    maker: "maker-1",
    campaignOnly: true,
    maxPrice: 100,
    minRating: 4,
    minPrice: 80,
    releaseFrom: "2026-10-01",
    releaseTo: "2026-10-31",
  }, ["cid-1"]);
  const now = Date.parse("2026-10-10T12:00:00+09:00");
  const item = makeItem();

  assert.equal(matchesFanzaAmateurRankedFilters(item, criteria, now), true);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ content_id: "other" }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ title: "別名" }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ iteminfo: { genre: [{ id: "g3", name: "genre-3" }] } }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ iteminfo: { maker: [{ id: "m2", name: "maker-2" }] } }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ currentPrice: 101 }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ reviewAverage: 3.9 }), criteria, now), false);
  assert.equal(matchesFanzaAmateurRankedFilters(makeItem({ campaigns: [{ title: "expired", dateBegin: "2026-09-01 00:00:00", dateEnd: "2026-09-30 23:59:59" }] }), criteria, now), false);
});

test("campaign activity keeps JST date boundaries inclusive", () => {
  const now = Date.parse("2026-10-01T00:00:00+09:00");
  assert.equal(hasActiveCampaign(makeItem(), now), true);
  assert.equal(hasActiveCampaign(makeItem({ campaigns: [{ title: "expired", dateBegin: "", dateEnd: "2026-09-30 23:59:59" }] }), now), false);
  assert.equal(getFanzaAmateurCampaignEnd(makeItem({ campaigns: [{ title: "unknown", dateBegin: "", dateEnd: "" }] })), Number.POSITIVE_INFINITY);
});

test("entity browse shortcut applies only to an unfiltered rank query", () => {
  assert.equal(isAllFanzaAmateurEntityWorksBrowse(buildFanzaAmateurBrowseCriteria({ sort: "rank", genre: "genre-1" }, null)), true);
  assert.equal(isAllFanzaAmateurEntityWorksBrowse(buildFanzaAmateurBrowseCriteria({ sort: "rank", genre: "genre-1", genres: ["genre-2"] }, null)), false);
  assert.equal(isAllFanzaAmateurEntityWorksBrowse(buildFanzaAmateurBrowseCriteria({ sort: "rank", maker: "maker-1", query: "text" }, null)), false);
  assert.equal(isAllFanzaAmateurEntityWorksBrowse(buildFanzaAmateurBrowseCriteria({ sort: "rank", genre: "genre-1", maker: "maker-1" }, null)), false);
  assert.equal(isAllFanzaAmateurEntityWorksBrowse(buildFanzaAmateurBrowseCriteria({ sort: "rank" }, null)), false);
});

test("campaign sort orders retain rank, discount, price, review, and ending tie-breakers", () => {
  const items: RankedFanzaAmateurItem[] = [
    { item: makeItem({ content_id: "A", currentPrice: 20, reviewAverage: 4.5, review: { count: 10 }, prices: { list_price: "100" }, campaigns: [{ title: "sale", dateBegin: "", dateEnd: "2026-10-20 23:59:59" }] }), rank: null },
    { item: makeItem({ content_id: "B", currentPrice: 30, reviewAverage: 4.9, review: { count: 30 }, prices: { list_price: "60" }, campaigns: [{ title: "sale", dateBegin: "", dateEnd: "2026-10-10 23:59:59" }] }), rank: 2 },
    { item: makeItem({ content_id: "C", currentPrice: 10, reviewAverage: 4.0, review: { count: 100 }, prices: { list_price: "20" }, campaigns: [{ title: "sale", dateBegin: "", dateEnd: "2026-10-15 23:59:59" }] }), rank: 1 },
  ];

  const idsFor = (sort: "rank" | "discount" | "price" | "review" | "ending") => {
    const sorted = items.map((entry) => ({ ...entry }));
    sortFanzaAmateurCampaignItems(sorted, sort);
    return sorted.map(({ item }) => item.content_id);
  };
  assert.deepEqual(idsFor("rank"), ["C", "B", "A"]);
  assert.deepEqual(idsFor("discount"), ["A", "C", "B"]);
  assert.deepEqual(idsFor("price"), ["C", "A", "B"]);
  assert.deepEqual(idsFor("review"), ["B", "A", "C"]);
  assert.deepEqual(idsFor("ending"), ["B", "C", "A"]);
});
