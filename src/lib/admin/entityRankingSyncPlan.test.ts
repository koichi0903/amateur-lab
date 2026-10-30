import assert from "node:assert/strict";
import test from "node:test";
import { buildEntityRankingSyncPlan } from "./entityRankingSyncPlan.ts";

test("updates every existing duplicate name, inserts new names, and identifies stale ids", () => {
  const plan = buildEntityRankingSyncPlan(
    [{ name: "Alice", rank: 1 }, { name: "Bob", rank: 2 }],
    [
      { id: 10, name: "Alice" },
      { id: 11, name: "Stale" },
      { id: 12, name: "Alice" },
    ],
  );

  assert.deepEqual(plan, {
    rowsToUpdate: [
      { id: 10, name: "Alice", rank: 1 },
      { id: 12, name: "Alice", rank: 1 },
    ],
    rowsToInsert: [{ name: "Bob", rank: 2 }],
    staleIds: [11],
  });
});
