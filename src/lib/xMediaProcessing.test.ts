import assert from "node:assert/strict";
import test from "node:test";
import { waitForXMediaProcessing } from "./xMediaProcessing.ts";

test("media processing skips polling without state and stops when succeeded", async () => {
  let requests = 0;
  await waitForXMediaProcessing(undefined, async () => { requests += 1; return undefined; }, async () => {});
  await waitForXMediaProcessing({ state: "succeeded" }, async () => { requests += 1; return undefined; }, async () => {});
  assert.equal(requests, 0);
});

test("media processing honors the minimum wait and polls until success", async () => {
  const waits: number[] = [];
  const states = [{ state: "in_progress", check_after_secs: 0 }, { state: "succeeded" }];
  await waitForXMediaProcessing(
    { state: "pending", check_after_secs: 0 },
    async () => states.shift(),
    async (milliseconds) => { waits.push(milliseconds); },
  );
  assert.deepEqual(waits, [1000, 1000]);
});

test("media processing failure is immediate and pending work times out after twelve polls", async () => {
  let failurePolls = 0;
  await assert.rejects(
    () => waitForXMediaProcessing({ state: "failed" }, async () => { failurePolls += 1; return undefined; }, async () => {}),
    /X media processing failed/,
  );
  assert.equal(failurePolls, 0);

  let polls = 0;
  let waits = 0;
  await assert.rejects(
    () => waitForXMediaProcessing(
      { state: "pending" },
      async () => { polls += 1; return { state: "pending" }; },
      async () => { waits += 1; },
    ),
    /did not finish in time/,
  );
  assert.equal(polls, 12);
  assert.equal(waits, 12);
});
