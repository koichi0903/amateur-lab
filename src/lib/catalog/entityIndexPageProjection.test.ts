import assert from "node:assert/strict";
import test from "node:test";
import type { EntityIndexSummary } from "./entityIndexSummaries";
import {
  buildEntityIndexPageHref,
  buildEntityIndexPageProjection,
  parseEntityIndexPageParams,
} from "./entityIndexPageProjection.ts";

test("entity index controls trim queries and normalize invalid pages", () => {
  assert.deepEqual(
    parseEntityIndexPageParams({ q: "  maker  ", page: "0", sort: "count-asc" }),
    { query: "maker", page: 1, sort: "count-asc" },
  );
  assert.deepEqual(parseEntityIndexPageParams({ page: "invalid" }), {
    query: "",
    page: 1,
    sort: "count-desc",
  });
});

test("entity index projection preserves quality filtering, sort order, and page clamping", () => {
  const summaries: EntityIndexSummary[] = Array.from({ length: 26 }, (_, index) => ({
    name: `Genre ${String(index + 1).padStart(2, "0")}`,
    count: index + 20,
    maxScore: 80,
    imageUrl: "https://example.test/image.jpg",
  }));
  summaries.push(
    { name: "Too few", count: 9, maxScore: 80, imageUrl: "https://example.test/image.jpg" },
    { name: "No image", count: 30, maxScore: 80, imageUrl: null },
  );

  const projection = buildEntityIndexPageProjection(summaries, "genre", {
    query: "genre",
    page: 9,
    sort: "count-asc",
  });

  assert.equal(projection.totalPages, 2);
  assert.equal(projection.currentPage, 2);
  assert.deepEqual(projection.visible.map((item) => item.name), ["Genre 25", "Genre 26"]);
  assert.deepEqual(projection.paginationItems, [1, 2]);
});

test("entity index links preserve query and omit default sort and first page", () => {
  assert.equal(
    buildEntityIndexPageHref("/genre", "two words", "count-asc", 2),
    "/genre?q=two+words&sort=count-asc&page=2",
  );
  assert.equal(
    buildEntityIndexPageHref("/maker", "two words", "count-desc", 1),
    "/maker?q=two+words",
  );
});
