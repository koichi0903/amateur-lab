import assert from "node:assert/strict";
import test from "node:test";
import { readFanzaDailyPostFunnelRows, readFanzaDailyPostFunnelRowsForKeys } from "./fanzaDailyPostFunnelPagination.ts";

test("accepts exactly the configured row limit and probes one row beyond it", async () => {
  const requestedRanges: Array<[number, number]> = [];
  const result = await readFanzaDailyPostFunnelRows<number>((from, to) => {
    requestedRanges.push([from, to]);
    return Promise.resolve({ data: from < 4 ? [from, from + 1] : [], error: null });
  }, 2, 4);

  assert.deepEqual(result, { rows: [0, 1, 2, 3], error: null });
  assert.deepEqual(requestedRanges, [[0, 1], [2, 3], [4, 4]]);
});

test("rejects an over-limit result without returning a partial aggregate", async () => {
  const result = await readFanzaDailyPostFunnelRows<number>((from) => Promise.resolve({
    data: from < 4 ? [from, from + 1] : [4],
    error: null,
  }), 2, 4);

  assert.deepEqual(result, {
    rows: [],
    error: "投稿別イベントが4件を超えたため、完全な集計を出せません。",
  });
});

test("returns a short final page without making the overflow probe", async () => {
  const requestedRanges: Array<[number, number]> = [];
  const result = await readFanzaDailyPostFunnelRows<number>((from, to) => {
    requestedRanges.push([from, to]);
    return Promise.resolve({ data: from === 0 ? [0, 1] : [2], error: null });
  }, 2, 4);

  assert.deepEqual(result, { rows: [0, 1, 2], error: null });
  assert.deepEqual(requestedRanges, [[0, 1], [2, 3]]);
});

test("propagates page errors without returning partial rows", async () => {
  const result = await readFanzaDailyPostFunnelRows<number>(() => Promise.resolve({
    data: null,
    error: { message: "page failed" },
  }), 2, 4);

  assert.deepEqual(result, { rows: [], error: "page failed" });
});

test("queries keys in bounded batches and enforces the row limit across batches", async () => {
  const requestedBatches: string[][] = [];
  const result = await readFanzaDailyPostFunnelRowsForKeys<string>(
    ["a", "b", "c", "d", "e"],
    (keys, from, to) => {
      if (from === 0) requestedBatches.push([...keys]);
      const data = keys.flatMap((key) => key === "e" ? [key] : [key, key]);
      return Promise.resolve({ data: data.slice(from, to + 1), error: null });
    },
    2,
    8,
    2,
  );

  assert.deepEqual(result, { rows: [], error: "投稿別イベントが8件を超えたため、完全な集計を出せません。" });
  assert.deepEqual(requestedBatches, [["a", "b"], ["c", "d"], ["e"]]);
});

test("accepts exactly the configured limit across key batches", async () => {
  const requestedBatches: string[][] = [];
  const result = await readFanzaDailyPostFunnelRowsForKeys<string>(
    ["a", "b", "c"],
    (keys, from, to) => {
      if (from === 0) requestedBatches.push([...keys]);
      const data = keys.flatMap((key) => key === "c" ? [] : [key, key]);
      return Promise.resolve({ data: data.slice(from, to + 1), error: null });
    },
    2,
    4,
    2,
  );

  assert.deepEqual(result, { rows: ["a", "a", "b", "b"], error: null });
  assert.deepEqual(requestedBatches, [["a", "b"], ["c"]]);
});
