import assert from "node:assert/strict";
import test from "node:test";
import { runBijyoPreparationOnce } from "./bijyoPreparationGate";

test("overlapping preparation requests for a job share one operation", async () => {
  let calls = 0;
  let resolveOperation!: (value: string) => void;
  const prepare = () => { calls += 1; return new Promise<string>((resolve) => { resolveOperation = resolve; }); };
  const first = runBijyoPreparationOnce(7, prepare);
  const second = runBijyoPreparationOnce(7, prepare);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveOperation("ready");
  assert.deepEqual(await Promise.all([first, second]), ["ready", "ready"]);
});

test("failed preparation releases the job for retry", async () => {
  let attempts = 0;
  await assert.rejects(runBijyoPreparationOnce(8, async () => { attempts += 1; throw new Error("trim failed"); }), /trim failed/);
  assert.equal(await runBijyoPreparationOnce(8, async () => { attempts += 1; return "ready"; }), "ready");
  assert.equal(attempts, 2);
});
