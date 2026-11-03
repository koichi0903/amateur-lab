import assert from "node:assert/strict";
import test from "node:test";
import {
  collectionOutcomeForResult,
  buildCreatorCollectionStatePatch,
  resolveTerminalCollectionCursorAdvance,
  selectCollectionAccounts,
} from "./myfansCollectionRotation.ts";

const accounts = Array.from({ length: 12 }, (_, index) => ({ creatorId: index + 1, rotationOrder: index + 1, collectionEnabled: true }));

test("advances the persistent cursor only after a later terminal creator", () => {
  assert.deepEqual(
    resolveTerminalCollectionCursorAdvance({ cursorOrder: 5, cycleNo: 2 }, 4, 10),
    { cursorOrder: 5, cycleNo: 2, cycleCompleted: false, shouldAdvance: false },
  );
  assert.deepEqual(
    resolveTerminalCollectionCursorAdvance({ cursorOrder: 5, cycleNo: 2 }, 8, 10),
    { cursorOrder: 8, cycleNo: 2, cycleCompleted: false, shouldAdvance: true },
  );
});

test("wraps the cursor and increments the cycle at the last eligible creator", () => {
  assert.deepEqual(
    resolveTerminalCollectionCursorAdvance({ cursorOrder: 8, cycleNo: 2 }, 10, 10),
    { cursorOrder: 0, cycleNo: 3, cycleCompleted: true, shouldAdvance: true },
  );
});

test("builds a permanent exclusion patch only for creators without posts or with private profiles", () => {
  const timestamps = ["2026-11-01T00:00:00.000Z", "2026-11-01T00:00:01.000Z", "2026-11-01T00:00:02.000Z"];
  let index = 0;
  assert.deepEqual(buildCreatorCollectionStatePatch({
    jobId: 12,
    creatorId: 34,
    rotationOrder: 8,
    collectionState: "PRIVATE",
    collectorMethod: "collector-v2",
    error: "PRIVATE: profile hidden",
    collectedCount: 0,
    evidence: { observed: true },
    now: () => timestamps[index++],
  }), {
    creator_id: 34,
    rotation_order: 8,
    collection_enabled: false,
    state: "PRIVATE",
    exclusion_reason: "private",
    excluded_at: timestamps[0],
    last_processed_at: timestamps[1],
    last_run_id: 12,
    evidence: { collectorMethod: "collector-v2", error: "PRIVATE: profile hidden", collectedCount: 0, observed: true },
    updated_at: timestamps[2],
  });
});

test("keeps eligible creators enabled and preserves evidence overrides", () => {
  const timestamps = ["2026-11-01T00:00:00.000Z", "2026-11-01T00:00:01.000Z"];
  let index = 0;
  const patch = buildCreatorCollectionStatePatch({
    jobId: 13,
    creatorId: 35,
    rotationOrder: 9,
    collectionState: "ELIGIBLE",
    collectorMethod: "collector-v2",
    collectedCount: 2,
    evidence: { collectorMethod: "captured-method", collectedCount: 99 },
    now: () => timestamps[index++],
  });

  assert.equal(patch.collection_enabled, true);
  assert.equal(patch.exclusion_reason, null);
  assert.equal(patch.excluded_at, null);
  assert.deepEqual(patch.evidence, { collectorMethod: "captured-method", error: null, collectedCount: 99 });
  assert.equal(patch.last_processed_at, timestamps[0]);
  assert.equal(patch.updated_at, timestamps[1]);
});

test("caps one low-load run at five and continues after the cursor", () => {
  const manyAccounts = Array.from({ length: 30 }, (_, index) => ({ creatorId: index + 1, rotationOrder: index + 1, collectionEnabled: true }));
  const first = selectCollectionAccounts(manyAccounts, { cursorOrder: 0, cycleNo: 1 }, 50);
  assert.equal(first.selected.length, 5);
  assert.equal(first.nextCursor.cursorOrder, 5);
  const second = selectCollectionAccounts(manyAccounts, first.nextCursor, 10);
  assert.deepEqual(second.selected.map((row) => row.creatorId), [6, 7, 8, 9, 10]);
});

test("day changes do not reset the cursor", () => {
  const next = selectCollectionAccounts(accounts, { cursorOrder: 10, cycleNo: 1 }, 10);
  assert.deepEqual(next.selected.map((row) => row.creatorId), [11, 12]);
});

test("disabled accounts are skipped while low-load rotation stays bounded", () => {
  const next = selectCollectionAccounts(accounts.map((row) => row.creatorId === 11 ? { ...row, collectionEnabled: false } : row), { cursorOrder: 12, cycleNo: 3 }, 10);
  assert.deepEqual(next.selected.map((row) => row.creatorId), [1, 2, 3, 4, 5]);
  assert.equal(next.nextCursor.cycleNo, 4);
});

test("no match is not a permanent exclusion", () => {
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0 }), "NO_MATCH_THIS_RUN");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, errorCode: "NO_POSTS" }), "NO_POSTS");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, errorCode: "PRIVATE" }), "PRIVATE");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, threadIncomplete: true }), "THREAD_INCOMPLETE");
  assert.equal(collectionOutcomeForResult({ candidatesCount: 0, errorCode: "THREAD_OBSERVATION_FAILED" }), "THREAD_INCOMPLETE");
});

test("mixed low-load fixture preserves rotation, terminal counts, and exact source linkage", () => {
  const selected = selectCollectionAccounts(accounts.slice(0, 10), { cursorOrder: 0, cycleNo: 7 }, 5);
  assert.deepEqual(selected.selected.map((row) => row.creatorId), Array.from({ length: 5 }, (_, index) => index + 1));
  assert.equal(selected.nextCursor.cursorOrder, 5);
  assert.equal(selected.nextCursor.cycleNo, 7);

  const outcomes = [
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 1 }),
    collectionOutcomeForResult({ candidatesCount: 0 }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "NO_POSTS" }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "PRIVATE" }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "X_TEMPORARY_ERROR" }),
    collectionOutcomeForResult({ candidatesCount: 0, errorCode: "THREAD_OBSERVATION_FAILED" }),
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
