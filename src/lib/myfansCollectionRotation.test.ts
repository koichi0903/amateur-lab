import assert from "node:assert/strict";
import test from "node:test";
import { collectionOutcomeForResult, selectCollectionAccounts } from "./myfansCollectionRotation.ts";

const accounts = Array.from({ length: 12 }, (_, index) => ({ creatorId: index + 1, rotationOrder: index + 1, collectionEnabled: true }));

test("caps one run at ten and continues after the cursor", () => {
  const first = selectCollectionAccounts(accounts, { cursorOrder: 0, cycleNo: 1 }, 50);
  assert.equal(first.selected.length, 10);
  assert.equal(first.nextCursor.cursorOrder, 10);
  const second = selectCollectionAccounts(accounts, first.nextCursor, 10);
  assert.deepEqual(second.selected.map((row) => row.creatorId), [11, 12]);
});

test("day changes do not reset the cursor", () => {
  const next = selectCollectionAccounts(accounts, { cursorOrder: 10, cycleNo: 1 }, 10);
  assert.deepEqual(next.selected.map((row) => row.creatorId), [11, 12]);
});

test("disabled accounts are skipped and a full cycle wraps", () => {
  const next = selectCollectionAccounts(accounts.map((row) => row.creatorId === 11 ? { ...row, collectionEnabled: false } : row), { cursorOrder: 12, cycleNo: 3 }, 10);
  assert.deepEqual(next.selected.map((row) => row.creatorId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].slice(0, 10));
  assert.equal(next.nextCursor.cycleNo, 4);
});

test("no match is not a permanent exclusion", () => {
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0 }), "NO_MATCH_THIS_RUN");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, errorCode: "NO_POSTS" }), "NO_POSTS");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, errorCode: "PRIVATE" }), "PRIVATE");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, threadIncomplete: true }), "THREAD_INCOMPLETE");
});
