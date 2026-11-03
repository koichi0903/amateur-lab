import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuoteRefreshCollectionSelection,
  buildQuoteRefreshCreatorStates,
  orderQuoteRefreshCreators,
} from "./myfansQuoteRefreshPreparation.ts";

test("normalizes X profile URLs, filters invalid profiles and preserves targeted creator ordering", () => {
  const creators = orderQuoteRefreshCreators([
    { id: 3, creator_x_url: "not-a-profile" },
    { id: 2, creator_x_url: "https://twitter.com/second/" },
    { id: 1, creator_x_url: "https://x.com/first" },
  ], [2, 1]);

  assert.deepEqual(creators.map((creator) => [creator.id, creator.creator_x_url]), [
    [1, "https://x.com/first"],
    [2, "https://x.com/second"],
  ]);
});

test("creates missing rotation state in creator order and preserves disabled and cursor rules", () => {
  const creators = orderQuoteRefreshCreators([
    { id: 1, creator_x_url: "https://x.com/first" },
    { id: 2, creator_x_url: "https://x.com/second" },
    { id: 3, creator_x_url: "https://x.com/third" },
  ], []);
  const { stateByCreator, missingStates } = buildQuoteRefreshCreatorStates(creators, [
    { creator_id: 1, rotation_order: 1, collection_enabled: true },
    { creator_id: 2, rotation_order: 2, collection_enabled: false },
  ]);

  assert.deepEqual(missingStates, [{ creator_id: 3, rotation_order: 3, collection_enabled: true, state: "ELIGIBLE" }]);
  for (const state of missingStates) stateByCreator.set(state.creator_id, state);

  const selection = buildQuoteRefreshCollectionSelection({
    creators,
    stateByCreator,
    cursor: { cursor_order: 1, cycle_no: 4 },
    targetedCreatorCount: 0,
    queueLimit: 2,
  });
  assert.deepEqual(selection.collectionRotation.selected.map((creator) => creator.creatorId), [3]);
  assert.deepEqual(selection.prioritized.map((creator) => creator.id), [3]);
  assert.equal(selection.collectionRotation.nextCursor.cycleNo, 4);
});

test("targeted selections stay bounded by the per-run account cap", () => {
  const creators = orderQuoteRefreshCreators(Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    creator_x_url: `https://x.com/creator${index + 1}`,
  })), []);
  const selection = buildQuoteRefreshCollectionSelection({
    creators,
    stateByCreator: new Map(),
    cursor: { cursor_order: 0, cycle_no: 1 },
    targetedCreatorCount: 7,
    queueLimit: 50,
  });

  assert.equal(selection.prioritized.length, 5);
  assert.deepEqual(selection.prioritized.map((creator) => creator.id), [1, 2, 3, 4, 5]);
});
