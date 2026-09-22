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

test("mixed ten-account fixture preserves rotation, terminal counts, and exact source linkage", () => {
  const selected = selectCollectionAccounts(accounts.slice(0, 10), { cursorOrder: 0, cycleNo: 7 }, 10);
  assert.deepEqual(selected.selected.map((row) => row.creatorId), Array.from({ length: 10 }, (_, index) => index + 1));
  assert.equal(selected.nextCursor.cursorOrder, 10);
  assert.equal(selected.nextCursor.cycleNo, 7);

  const outcomes = [
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 0 }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "NO_POSTS" }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "PRIVATE" }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "X_TEMPORARY_ERROR" }),
    collectionOutcomeForResult({ candidatesCount: 0, threadIncomplete: true }),
    "CANCELLED",
    collectionOutcomeForResult({ candidatesCount: 1 }),
  ];
  assert.deepEqual(outcomes, [
    "FOUND_COMPLETE_THREAD", "FOUND_COMPLETE_THREAD", "FOUND_COMPLETE_THREAD", "NO_MATCH_THIS_RUN",
    "NO_POSTS", "PRIVATE", "TEMP_ERROR", "THREAD_INCOMPLETE", "CANCELLED", "FOUND_COMPLETE_THREAD",
  ]);
  assert.equal(outcomes.filter((outcome) => outcome === "FOUND_COMPLETE_THREAD").length, 4);
  assert.equal(outcomes.filter((outcome) => outcome === "NO_MATCH_THIS_RUN").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome === "NO_POSTS" || outcome === "PRIVATE").length, 2);
  assert.equal(outcomes.filter((outcome) => outcome === "TEMP_ERROR" || outcome === "THREAD_INCOMPLETE").length, 2);
  assert.equal(outcomes.filter((outcome) => outcome === "CANCELLED").length, 1);

  const products = new Map([["https://myfans.jp/posts/existing", 17]]);
  const candidates = new Map([["https://x.com/creator/status/existing", { id: 127, productId: 17 }]]);
  const saveExact = (sourceUrl: string, finalUrl: string, productId: number) => {
    const existing = candidates.get(sourceUrl);
    candidates.set(sourceUrl, { id: existing?.id ?? candidates.size + 200, productId });
    products.set(finalUrl, productId);
    return { candidateId: candidates.get(sourceUrl)?.id, productId };
  };
  assert.deepEqual(saveExact("https://x.com/creator/status/existing", "https://myfans.jp/posts/existing", 17), { candidateId: 127, productId: 17 });
  assert.deepEqual(saveExact("https://x.com/creator/status/imported", "https://myfans.jp/posts/imported", 18), { candidateId: 201, productId: 18 });
  assert.deepEqual(saveExact("https://x.com/creator/status/existing", "https://myfans.jp/posts/existing", 17), { candidateId: 127, productId: 17 });
  assert.equal(candidates.size, 2);
  assert.equal(products.size, 2);
});
