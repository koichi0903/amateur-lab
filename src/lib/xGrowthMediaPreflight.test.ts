import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { syncCandidateMediaAssets } from "./xGrowthMediaPreflight";

const calls: Array<{ step: string; workIds: number[] }> = [];
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => {
  fetchCalls += 1;
  throw new Error("Candidate media sync must not fetch official URLs");
}) as typeof fetch;

const result = await syncCandidateMediaAssets(
  [101, 101, 0, 202],
  async (workIds) => {
    calls.push({ step: "sync", workIds });
    return { error: null, created: workIds.length };
  },
);

assert.deepEqual(calls, [{ step: "sync", workIds: [101, 202] }]);
assert.equal(result.sync.error, null);
assert.equal(fetchCalls, 0);

const generationSource = await readFile(new URL("./xGrowthOS.ts", import.meta.url), "utf8");
const regenerationSource = await readFile(new URL("../app/api/admin/x-growth/regenerate/route.ts", import.meta.url), "utf8");
assert.match(generationSource, /syncCandidateMediaAssets/);
assert.doesNotMatch(generationSource, /checkMediaAssetUrls|analyzeUncachedVideoFacts|\bfetch\s*\(/);
assert.doesNotMatch(regenerationSource, /checkMediaAssetUrls|\bfetch\s*\(/);

const largePoolCalls: number[][] = [];
const largePoolIds = Array.from({ length: 351 }, (_, index) => index + 1);
const largePoolResult = await syncCandidateMediaAssets(largePoolIds, async (workIds) => {
  largePoolCalls.push(workIds);
  return { error: null, synced: workIds.length };
});
assert.deepEqual(largePoolCalls, [largePoolIds]);
assert.equal(largePoolResult.sync.synced, 351);

const failedSync = await syncCandidateMediaAssets([303], async () => ({ error: "sync failed" }));
assert.equal(failedSync.sync.error, "sync failed");
assert.equal(fetchCalls, 0);
globalThis.fetch = originalFetch;
