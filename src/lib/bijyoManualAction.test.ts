import assert from "node:assert/strict";
import test from "node:test";
import { executeBijyoManualAction } from "./bijyoManualAction";

test("manual add registers the job without starting video preparation", async () => {
  let registered: number | null = null;
  let preparations = 0;
  const result = await executeBijyoManualAction("manual", { workId: 42 }, {
    createManualJob: async (workId) => { registered = workId; return { ok: true, jobId: 7 }; },
    prepareVideo: async () => { preparations += 1; return { ok: true }; },
  });
  assert.deepEqual(result, { ok: true, jobId: 7 });
  assert.equal(registered, 42);
  assert.equal(preparations, 0);
});

test("video processing starts only for an explicit prepare action", async () => {
  const calls: Array<[number, number | undefined]> = [];
  await executeBijyoManualAction("prepareVideo", { jobId: 7, workId: 42 }, {
    createManualJob: async () => { throw new Error("unexpected registration"); },
    prepareVideo: async (jobId, workId) => { calls.push([jobId, workId]); return { ok: true }; },
  });
  assert.deepEqual(calls, [[7, 42]]);
});
