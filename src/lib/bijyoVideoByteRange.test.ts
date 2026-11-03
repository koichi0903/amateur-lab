import assert from "node:assert/strict";
import test from "node:test";
import { parseBijyoVideoQueryParams, parseByteRange, projectByteRangeBody } from "./bijyoVideoByteRange.ts";

test("parses explicit, open-ended, and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=10-20", 100), { start: 10, end: 20 });
  assert.deepEqual(parseByteRange("bytes=10-", 100), { start: 10, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
});

test("clamps ranges to the available file and keeps the first requested range", () => {
  assert.deepEqual(parseByteRange("bytes=95-120", 100), { start: 95, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-120", 100), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=1-2,4-5", 100), { start: 1, end: 2 });
});

test("rejects malformed, unsafe, reversed, and unsatisfiable ranges", () => {
  for (const value of [null, "items=0-1", "bytes=", "bytes=-0", "bytes=100-", "bytes=3-2", "bytes=999999999999999999999-", "bytes=0-"]) {
    assert.equal(parseByteRange(value, value === "bytes=0-" ? 0 : 100), null, value ?? "null header");
  }
});

test("parses video request parameters without changing optional work id behavior", () => {
  assert.deepEqual(parseBijyoVideoQueryParams(new URLSearchParams("jobId=42&preview=1")), {
    ok: true,
    jobId: 42,
    workId: undefined,
    inline: true,
  });
  assert.deepEqual(parseBijyoVideoQueryParams(new URLSearchParams("jobId=0")), {
    ok: false,
    error: "jobIdが不正です。",
  });
  assert.deepEqual(parseBijyoVideoQueryParams(new URLSearchParams("jobId=42&workId=bad")), {
    ok: false,
    error: "workIdが不正です。",
  });
});

test("projects full, partial, and unsatisfiable byte-range response bodies", () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4]);
  assert.deepEqual(projectByteRangeBody(bytes, null), {
    body: bytes,
    status: 200,
    contentRange: null,
  });
  const partial = projectByteRangeBody(bytes, "bytes=1-2");
  assert.deepEqual([...partial.body], [1, 2]);
  assert.equal(partial.status, 206);
  assert.equal(partial.contentRange, "bytes 1-2/5");
  const unsatisfiable = projectByteRangeBody(bytes, "bytes=99-");
  assert.deepEqual([...unsatisfiable.body], [0, 1, 2, 3, 4]);
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.contentRange, "bytes */5");
});
