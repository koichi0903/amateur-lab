import assert from "node:assert/strict";
import test from "node:test";
import { preserveWorkOrderByIds, priceSortedWorkIds } from "./entityWorksProjection";

test("preserves the database page order after hydrating full work rows", () => {
  const rows = [
    { id: 3, title: "third" },
    { id: 1, title: "first" },
    { id: 2, title: "second" },
  ];

  assert.deepEqual(preserveWorkOrderByIds([1, 2, 3], rows), [rows[1], rows[2], rows[0]]);
});

test("omits IDs that were not returned during hydration", () => {
  const rows = [{ id: 2, title: "second" }];

  assert.deepEqual(preserveWorkOrderByIds([1, 2], rows), [rows[0]]);
});

test("sorts price pages by the active sale price and uses descending IDs to break ties", () => {
  const rows = [
    { id: 1, price: 100, sale_price: 50 },
    { id: 2, price: 70, sale_price: null },
    { id: 3, price: 40, sale_price: 0 },
    { id: 4, price: 100, sale_price: 50 },
  ];

  assert.deepEqual(priceSortedWorkIds(rows, "price-asc", 0, 10), [3, 4, 1, 2]);
  assert.deepEqual(priceSortedWorkIds(rows, "price-desc", 0, 10), [2, 4, 1, 3]);
});

test("applies pagination after the stable price ordering", () => {
  const rows = [
    { id: 1, price: 100, sale_price: 50 },
    { id: 2, price: 70, sale_price: null },
    { id: 3, price: 40, sale_price: 0 },
    { id: 4, price: 100, sale_price: 50 },
  ];

  assert.deepEqual(priceSortedWorkIds(rows, "price-asc", 1, 2), [4, 1]);
});
