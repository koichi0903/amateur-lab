import assert from "node:assert/strict";
import test from "node:test";
import { loadFanzaListPageWithRetry } from "./fanzaListRetry";

test("retries repeated timeouts and succeeds after page recovery", async () => {
  let loads = 0;
  let recoveries = 0;
  const sleeps: number[] = [];

  await loadFanzaListPageWithRetry({
    attempts: 3,
    backoffMs: [2_000, 6_000],
    pageNumber: 414,
    url: "https://video.dmm.co.jp/av/list/?page=414",
    load: async () => {
      loads += 1;
      if (loads < 3) throw new Error("page.waitForFunction: Timeout 30000ms exceeded");
    },
    recover: async () => {
      recoveries += 1;
    },
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
  });

  assert.equal(loads, 3);
  assert.equal(recoveries, 2);
  assert.deepEqual(sleeps, [2_000, 6_000]);
});

test("records every failure and remains fatal after the final attempt", async () => {
  const failures: string[] = [];
  let loads = 0;

  await assert.rejects(
    loadFanzaListPageWithRetry({
      attempts: 3,
      backoffMs: [2_000, 6_000],
      pageNumber: 414,
      url: "https://video.dmm.co.jp/av/list/?page=414",
      load: async () => {
        loads += 1;
        throw new Error("page.waitForFunction: Timeout 30000ms exceeded");
      },
      recover: async () => undefined,
      sleep: async () => undefined,
      onFailure: (detail) => failures.push(detail),
    }),
    (error: Error) =>
      error.message.includes("page=414") &&
      error.message.includes("attempt=3/3") &&
      error.message.includes("kind=timeout"),
  );

  assert.equal(loads, 3);
  assert.equal(failures.length, 3);
});

test("does not turn an empty or final page into success", async () => {
  await assert.rejects(
    loadFanzaListPageWithRetry({
      attempts: 2,
      backoffMs: [0],
      pageNumber: 415,
      url: "https://video.dmm.co.jp/av/list/?page=415",
      load: async () => {
        throw new Error("expected at least 1 elements but found 0");
      },
      recover: async () => undefined,
      sleep: async () => undefined,
    }),
    /page=415.*attempt=2\/2/,
  );
});
