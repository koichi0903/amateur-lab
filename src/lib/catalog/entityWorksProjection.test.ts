import assert from "node:assert/strict";
import test from "node:test";
import { preserveWorkOrderByIds } from "./entityWorksProjection";

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
