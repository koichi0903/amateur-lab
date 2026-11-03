import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuoteRefreshCreateRequest, normalizeTargetedCreatorIds } from "./myfansQuoteRefreshRequest.ts";

test("create request normalizes limits and uses provided session values", () => {
  let generatedIds = 0;
  const request = normalizeQuoteRefreshCreateRequest({
    approvedMediaId: "42",
    batchSize: 8,
    queueLimit: 1200,
    sessionId: " session-a ",
    runToken: " run-a ",
    collectorVersion: " v3 ",
  }, 5, () => `generated-${++generatedIds}`);

  assert.deepEqual(request, {
    approvedMediaId: 42,
    batchSize: 5,
    queueLimit: 5,
    sessionId: "session-a",
    runToken: "run-a",
    collectorVersion: "v3",
  });
  assert.equal(generatedIds, 0);
});

test("create request lazily generates missing identities and applies defaults", () => {
  let generatedIds = 0;
  assert.deepEqual(normalizeQuoteRefreshCreateRequest({}, 5, () => `generated-${++generatedIds}`), {
    approvedMediaId: null,
    batchSize: 5,
    queueLimit: 5,
    sessionId: "generated-1",
    runToken: "generated-2",
    collectorVersion: null,
  });
  assert.equal(generatedIds, 2);
});

test("target creator IDs are rounded, deduplicated, validated, and capped", () => {
  assert.deepEqual(normalizeTargetedCreatorIds([3.2, "3", 0, -1, "bad", 4, 5, 6, 7, 8]), [3, 4, 5, 6, 7]);
  assert.deepEqual(normalizeTargetedCreatorIds("3,4"), []);
});
