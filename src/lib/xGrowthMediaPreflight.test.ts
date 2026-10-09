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
