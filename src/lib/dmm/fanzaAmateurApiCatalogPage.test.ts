import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogContentIds,
  catalogItemChangeIds,
  collectCatalogItemKeyPaths,
  countInvalidCatalogContentIds,
  observedCatalogItemKeyPaths,
} from "./fanzaAmateurApiCatalogPage.ts";

test("catalog page IDs are trimmed and invalid IDs are counted before persistence", () => {
  const items = [
    { content_id: " valid " },
    { content_id: " " },
    { content_id: 42 },
  ];

  assert.equal(countInvalidCatalogContentIds(items), 2);
  assert.deepEqual(catalogContentIds(items), ["valid", "", "42"]);
});

test("catalog page change classification keeps only new works and comparable price changes", () => {
  const items = [
    { content_id: "new-work", price: 300 },
    { content_id: "same-price", price: 500 },
    { content_id: "changed-price", price: 700 },
    { content_id: "unknown-price", price: null },
  ];
  const existing = new Map<string, unknown>([
    ["same-price", { price: 500 }],
    ["changed-price", { price: 600 }],
    ["unknown-price", { price: null }],
  ]);
  const normalize = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const price = (value as { price?: unknown }).price;
    return { currentPrice: typeof price === "number" ? price : null };
  };

  assert.deepEqual(catalogItemChangeIds(items, existing, normalize), {
    newContentIds: ["new-work"],
    changedPriceContentIds: ["changed-price"],
  });
});

test("catalog key-path collection retains nested arrays and scalar keys", () => {
  const paths = collectCatalogItemKeyPaths({ iteminfo: [{ actress: { name: "A" } }], price: 100 });

  assert.deepEqual([...paths].sort(), [
    "iteminfo[]",
    "iteminfo[].actress",
    "iteminfo[].actress.name",
    "price",
  ]);
});

test("observed key paths merge prior fields with the complete page shape", () => {
  assert.deepEqual(observedCatalogItemKeyPaths(["existing.path"], [{ content_id: "a", title: "A" }]), [
    "content_id",
    "existing.path",
    "title",
  ]);
});
