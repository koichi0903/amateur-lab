import assert from "node:assert/strict";
import test from "node:test";
import { buildFanzaAmateurBrowsePageHref, requiresFullFanzaAmateurBrowseScan, sortStandardFanzaAmateurBrowseItems } from "./fanzaAmateurBrowseProjection.ts";
import type { FanzaAmateurBrowseCriteria } from "./fanzaAmateurCatalogBrowseRules.ts";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize.ts";

function item(input: Partial<FanzaAmateurCatalogItem> & Pick<FanzaAmateurCatalogItem, "content_id">) {
  return input as FanzaAmateurCatalogItem;
}

test("full price filtering and price ordering request a complete scan", () => {
  type BrowseScanCriteria = Pick<FanzaAmateurBrowseCriteria, "minPrice" | "sort">;
  assert.equal(requiresFullFanzaAmateurBrowseScan({ minPrice: 100, sort: "date_desc" } as BrowseScanCriteria), true);
  assert.equal(requiresFullFanzaAmateurBrowseScan({ minPrice: undefined, sort: "price" }), true);
  assert.equal(requiresFullFanzaAmateurBrowseScan({ minPrice: undefined, sort: "date_desc" }), false);
});

test("browse pagination retains active filters and changes only the page", () => {
  const href = buildFanzaAmateurBrowsePageHref("/amateur/search", {
    query: "作品名",
    performer: "女優名",
    genre: "素人",
    genres: ["女子校生", "人妻"],
    maker: "メーカー",
    releaseFrom: "2026-01-01",
    releaseTo: "2026-10-30",
    minPrice: 500,
    maxPrice: 1000,
    minRating: 4.5,
    sort: "rank",
    page: 2,
  });

  assert.equal(href, "/amateur/search?q=%E4%BD%9C%E5%93%81%E5%90%8D&performer=%E5%A5%B3%E5%84%AA%E5%90%8D&genre=%E7%B4%A0%E4%BA%BA&genres=%E5%A5%B3%E5%AD%90%E6%A0%A1%E7%94%9F%2C%E4%BA%BA%E5%A6%BB&maker=%E3%83%A1%E3%83%BC%E3%82%AB%E3%83%BC&releaseFrom=2026-01-01&releaseTo=2026-10-30&minPrice=500&maxPrice=1000&minRating=4.5&sort=rank&page=2");
});

test("price sort preserves missing-price ordering and content-id tie breaks", () => {
  const rows = [
    item({ content_id: "missing" }),
    item({ content_id: "b", currentPrice: 500 }),
    item({ content_id: "a", currentPrice: 500 }),
  ];
  assert.deepEqual(sortStandardFanzaAmateurBrowseItems(rows, "price").map((row) => row.content_id), ["a", "b", "missing"]);
});

test("review and date sorts retain their established secondary ordering", () => {
  const rows = [
    item({ content_id: "older", date: "2024-01-01", reviewAverage: 4.5, review: { count: 10 } as never }),
    item({ content_id: "more-reviews", date: "2024-02-01", reviewAverage: 4.5, review: { count: 20 } as never }),
    item({ content_id: "highest", date: "2024-01-15", reviewAverage: 4.8, review: { count: 1 } as never }),
  ];
  assert.deepEqual(sortStandardFanzaAmateurBrowseItems([...rows], "review").map((row) => row.content_id), ["highest", "more-reviews", "older"]);
  assert.deepEqual(sortStandardFanzaAmateurBrowseItems([...rows], "date_asc").map((row) => row.content_id), ["older", "highest", "more-reviews"]);
});
