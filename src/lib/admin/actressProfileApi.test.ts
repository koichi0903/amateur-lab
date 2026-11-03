import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchDmmActressProfiles,
  getNextDmmActressProfileOffset,
} from "./actressProfileApi.ts";

test("advances to a next actress page only when the current page has processed profiles", () => {
  assert.equal(getNextDmmActressProfileOffset({
    processedCount: 100,
    offset: 1,
    pageSize: 100,
    totalCount: 101,
  }), 101);
  assert.equal(getNextDmmActressProfileOffset({
    processedCount: 100,
    offset: 1,
    pageSize: 100,
    totalCount: 100,
  }), null);
  assert.equal(getNextDmmActressProfileOffset({
    processedCount: 0,
    offset: 1,
    pageSize: 100,
    totalCount: 500,
  }), null);
});

test("retries a failed DMM response before returning profiles", async () => {
  const statuses = [500, 200];
  const delays: number[] = [];
  const result = await fetchDmmActressProfiles("https://example.test/actress", {
    fetch: async () => {
      const status = statuses.shift() ?? 200;
      return new Response(JSON.stringify({ result: { status: "200", total_count: "1", actress: [{ actress_id: 7, name: "テスト" }] } }), { status });
    },
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  });

  assert.deepEqual(delays, [1000]);
  assert.equal(result.actress?.[0]?.name, "テスト");
  assert.equal(result.total_count, "1");
});

test("fails after the existing retry limit and preserves the final HTTP status", async () => {
  let calls = 0;
  const delays: number[] = [];

  await assert.rejects(fetchDmmActressProfiles("https://example.test/actress", {
    fetch: async () => {
      calls += 1;
      return new Response("{}", { status: 429 });
    },
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  }), /HTTP 429/);

  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("rejects an invalid successful API payload", async () => {
  await assert.rejects(fetchDmmActressProfiles("https://example.test/actress", {
    fetch: async () => new Response(JSON.stringify({ result: { status: "503" } }), { status: 200 }),
    sleep: async () => {},
  }), /応答が不正/);
});
