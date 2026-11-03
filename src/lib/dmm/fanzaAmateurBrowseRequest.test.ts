import assert from "node:assert/strict";
import test from "node:test";
import { parseFanzaAmateurBrowsePageRequest } from "./fanzaAmateurBrowseRequest.ts";

test("browse request trims and caps text, deduplicates genres, and validates page filters", () => {
  const request = parseFanzaAmateurBrowsePageRequest("search", {
    q: `  ${"作品".repeat(60)}  `,
    performer: " 女優 ",
    genres: " 素人,人妻,素人,,女子校生 ",
    maker: " メーカー ",
    page: "0",
    minPrice: "2500000",
    maxPrice: "500",
    minRating: "4.5",
    releaseFrom: "2026-01-01",
    releaseTo: "invalid",
    sort: "price",
  });

  assert.equal(request.query, "作品".repeat(50));
  assert.equal(request.performer, "女優");
  assert.deepEqual(request.genres, ["素人", "人妻", "女子校生"]);
  assert.equal(request.page, 1);
  assert.equal(request.minPrice, 1_000_000);
  assert.equal(request.maxPrice, 500);
  assert.equal(request.minRating, 4.5);
  assert.equal(request.releaseFrom, "2026-01-01");
  assert.equal(request.releaseTo, undefined);
  assert.equal(request.sort, "price");
  assert.equal(request.showCompactSearchHeader, true);
});

test("sale requests enforce the sale sort and price allowlists", () => {
  const request = parseFanzaAmateurBrowsePageRequest("sale", { sort: "date_asc", maxPrice: "400" });
  assert.equal(request.sort, "rank");
  assert.equal(request.maxPrice, undefined);
  assert.equal(request.action, "/amateur/sale");
  assert.equal(request.title, "素人作品のセール");
});

test("personal browse keeps an empty genre for the prompt state", () => {
  const request = parseFanzaAmateurBrowsePageRequest("personal", { genre: "  ", sort: "ending" });
  assert.equal(request.genre, "");
  assert.equal(request.sort, "date_desc");
  assert.equal(request.action, "/amateur/personal-pick");
  assert.equal(request.showCompactSearchHeader, false);
});
