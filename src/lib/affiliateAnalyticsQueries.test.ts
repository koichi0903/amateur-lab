import assert from "node:assert/strict";
import test from "node:test";
import { readXPostLogMap } from "./affiliateAnalyticsQueries.ts";

const row = (id: number, postKey: string) => ({
  id,
  post_key: postKey,
  work_id: id,
  category: "sales",
  posted_at: new Date(Date.UTC(2026, 9, id)).toISOString(),
  account_handle: "hakkutsu_lab",
});

test("pages through the full X post log window and keeps the latest row for a repeated key", async () => {
  const rows = [row(1, "same"), row(2, "other"), row(3, "same")];
  const ranges: Array<[number, number]> = [];
  const result = await readXPostLogMap((from, to) => {
    ranges.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  }, 2, 4);

  assert.equal(result.enabled, true);
  assert.equal(result.error, null);
  assert.deepEqual([...result.logs.keys()], ["same", "other"]);
  assert.equal(result.logs.get("same")?.workId, 3);
  assert.deepEqual(ranges, [[0, 1], [2, 3]]);
});

test("returns an explicit error instead of a partial map when rows exceed the cap", async () => {
  const rows = [row(1, "a"), row(2, "b"), row(3, "c"), row(4, "d"), row(5, "e")];
  const ranges: Array<[number, number]> = [];
  const result = await readXPostLogMap((from, to) => {
    ranges.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  }, 2, 4);

  assert.equal(result.enabled, false);
  assert.equal(result.logs.size, 0);
  assert.equal(result.error, "X投稿別ファネルの対象ログが4件を超えたため、完全な集計を出せません。");
  assert.deepEqual(ranges, [[0, 1], [2, 3], [4, 4]]);
});

test("discards partial rows if a later X post log page fails", async () => {
  const result = await readXPostLogMap((from) => Promise.resolve({
    data: from === 0 ? [row(1, "a"), row(2, "b")] : null,
    error: from === 0 ? null : { message: "page failed" },
  }), 2, 4);

  assert.equal(result.enabled, false);
  assert.equal(result.logs.size, 0);
  assert.equal(result.error, "page failed");
});
