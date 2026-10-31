import assert from "node:assert/strict";
import test from "node:test";
import { calculateNewReleasePoint } from "./scoreReleasePoint.ts";

test("release point keeps every 15-day score boundary", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  const pointsByAge = [
    [0, 10], [15, 10], [16, 9], [30, 9], [31, 8], [45, 8],
    [46, 7], [60, 7], [61, 6], [75, 6], [76, 5], [90, 5],
    [91, 4], [105, 4], [106, 3], [120, 3], [121, 2], [135, 2],
    [136, 1], [150, 1], [151, 0],
  ] as const;

  for (const [ageDays, expected] of pointsByAge) {
    const releaseDate = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(calculateNewReleasePoint(releaseDate, now), expected, `${ageDays} days old`);
  }
});

test("future, invalid, and missing release dates receive no new-release points", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");

  assert.equal(calculateNewReleasePoint("2026-11-01T12:00:00.000Z", now), 0);
  assert.equal(calculateNewReleasePoint("not-a-date", now), 0);
  assert.equal(calculateNewReleasePoint(null, now), 0);
});
