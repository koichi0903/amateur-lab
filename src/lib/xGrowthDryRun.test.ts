import assert from "node:assert/strict";
import { getXGrowthPersistencePlan } from "./xGrowthDryRun";

assert.deepEqual(getXGrowthPersistencePlan(true, true), { persistTopPicks: false, runDeferredWrites: false });
assert.deepEqual(getXGrowthPersistencePlan(true, false), { persistTopPicks: false, runDeferredWrites: false });
assert.deepEqual(getXGrowthPersistencePlan(false, true), { persistTopPicks: true, runDeferredWrites: true });
assert.deepEqual(getXGrowthPersistencePlan(false, false), { persistTopPicks: true, runDeferredWrites: false });

console.log("xGrowth read-only persistence guard tests passed");
