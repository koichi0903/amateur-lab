import assert from "node:assert/strict";
import test from "node:test";
import { shouldIndexCatalogMetadata } from "./catalogMetadataPolicy.ts";

const successfulPage = { error: null, works: [{}] };

test("indexes only the first page when it has works and an indexable summary", () => {
  assert.equal(shouldIndexCatalogMetadata({
    page: 1,
    result: successfulPage,
    summaryIsIndexable: true,
  }), true);
});

test("keeps pages noindex when page data is absent, failed, empty, or not indexable", () => {
  const cases = [
    { page: 2, result: successfulPage, summaryIsIndexable: true },
    { page: 1, result: null, summaryIsIndexable: true },
    { page: 1, result: { error: new Error("fetch failed"), works: [{}] }, summaryIsIndexable: true },
    { page: 1, result: { error: null, works: [] }, summaryIsIndexable: true },
    { page: 1, result: successfulPage, summaryIsIndexable: false },
  ];

  for (const input of cases) {
    assert.equal(shouldIndexCatalogMetadata(input), false);
  }
});
