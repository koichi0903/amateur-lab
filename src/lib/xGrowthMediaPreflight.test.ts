import assert from "node:assert/strict";
import { syncAndProbeCandidateMedia } from "./xGrowthMediaPreflight";

const calls: Array<{ step: string; workIds: number[]; batchSize?: number }> = [];
const result = await syncAndProbeCandidateMedia(
  [101, 101, 0, 202],
  async (workIds) => {
    calls.push({ step: "sync", workIds });
    return { error: null, created: workIds.length };
  },
  async (workIds, batchSize) => {
    calls.push({ step: "probe", workIds, batchSize });
    return { error: null, checked: workIds.length };
  },
  100,
);

assert.deepEqual(calls, [
  { step: "sync", workIds: [101, 202] },
  { step: "probe", workIds: [101, 202], batchSize: 100 },
]);
assert.equal(result.sync.error, null);
assert.equal(result.probe.checked, 2);

const largePoolCalls: Array<{ workIds: number[]; batchSize: number }> = [];
const largePoolIds = Array.from({ length: 351 }, (_, index) => index + 1);
const largePoolResult = await syncAndProbeCandidateMedia(
  largePoolIds,
  async (workIds) => ({ error: null, synced: workIds.length }),
  async (workIds, batchSize) => {
    largePoolCalls.push({ workIds, batchSize });
    return { error: null, checked: workIds.length };
  },
  100,
);
assert.deepEqual(largePoolCalls.map(({ workIds }) => workIds.map((id) => id)), [
  largePoolIds.slice(0, 100),
  largePoolIds.slice(100, 200),
  largePoolIds.slice(200, 300),
  largePoolIds.slice(300),
]);
assert.ok(largePoolCalls.every(({ batchSize }) => batchSize === 100));
assert.equal(largePoolResult.probe.checked, 351);

const failedBatchCalls: number[][] = [];
const failedBatchResult = await syncAndProbeCandidateMedia(
  Array.from({ length: 201 }, (_, index) => index + 1),
  async () => ({ error: null }),
  async (workIds) => {
    failedBatchCalls.push(workIds);
    return { error: failedBatchCalls.length === 2 ? "probe failed" : null, checked: workIds.length };
  },
  100,
);
assert.equal(failedBatchResult.probe.error, "probe failed");
assert.equal(failedBatchResult.probe.checked, 200);
assert.equal(failedBatchCalls.length, 2);

const blockedProbeCalls: string[] = [];
await syncAndProbeCandidateMedia(
  [303],
  async () => ({ error: "sync failed" }),
  async () => {
    blockedProbeCalls.push("probe");
    return { error: null, checked: 0 };
  },
);
assert.deepEqual(blockedProbeCalls, []);
