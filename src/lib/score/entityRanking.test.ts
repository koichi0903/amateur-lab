import assert from "node:assert/strict";
import test from "node:test";
import { getActressPoint } from "./entityRanking";

test("actress rank points preserve every band boundary", () => {
  const bands = [
    [5, 20, 19],
    [10, 19, 18],
    [15, 18, 17],
    [20, 17, 16],
    [25, 16, 15],
    [30, 15, 14],
    [35, 14, 13],
    [40, 13, 12],
    [45, 12, 11],
    [50, 11, 10],
    [60, 10, 8],
    [70, 8, 6],
    [80, 6, 4],
    [90, 4, 2],
    [100, 2, 0],
  ] as const;

  for (const [boundary, points, nextBandPoints] of bands) {
    assert.equal(getActressPoint(boundary), points);
    assert.equal(getActressPoint(boundary + 0.1), nextBandPoints);
  }
});

test("actress rank points preserve empty, non-finite, negative, and out-of-range behavior", () => {
  assert.equal(getActressPoint(null), 0);
  assert.equal(getActressPoint(0), 0);
  assert.equal(getActressPoint(Number.NaN), 0);
  assert.equal(getActressPoint(-1), 20);
  assert.equal(getActressPoint(101), 0);
  assert.equal(getActressPoint(Number.POSITIVE_INFINITY), 0);
});
