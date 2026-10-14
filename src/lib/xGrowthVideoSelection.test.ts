import assert from "node:assert/strict";
import test from "node:test";
import { chooseXGrowthVideoCandidates, rankXGrowthVideoCandidates, type VideoCandidateSignals } from "./xGrowthVideoSelection.ts";

function candidate(workId: number, overrides: Partial<VideoCandidateSignals> = {}): VideoCandidateSignals {
  return {
    workId,
    title: `作品 ${workId}`,
    sampleUrlOfficial: true,
    hardGatePassed: true,
    firstDropReason: null,
    rankingScore: 50,
    freshnessScore: 50,
    discountRate: 0,
    saleEndAt: null,
    creativeQualityScore: 50,
    ...overrides,
  };
}

test("ranking is deterministic, deduplicates works, and excludes failed Hard Gates", () => {
  const ranked = rankXGrowthVideoCandidates([
    candidate(2), candidate(1), candidate(1, { rankingScore: 80 }), candidate(3, { hardGatePassed: false }),
  ], new Map(), new Date("2026-10-10T00:00:00Z"));
  assert.deepEqual(ranked.map((item) => item.workId), [1, 2]);
  assert.equal(ranked[0].rankingScore, 80);
  assert.equal(ranked[0].rankScore, rankXGrowthVideoCandidates([candidate(1, { rankingScore: 80 })], new Map(), new Date("2026-10-10T00:00:00Z"))[0].rankScore);
});

test("fresh sale urgency improves rank while recent posting history reduces it", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const ranked = rankXGrowthVideoCandidates([
    candidate(1),
    candidate(2, { saleEndAt: "2026-10-10T12:00:00Z", discountRate: 30 }),
    candidate(3),
  ], new Map([[3, "2026-10-08T00:00:00Z"]]), now);
  assert.equal(ranked[0].workId, 2);
  assert.equal(ranked[2].workId, 3);
  assert.ok(ranked[2].rankReasons.some((reason) => reason.includes("直近投稿")));
});

test("manual picks keep priority and excluded auto picks are replaced from the ranked pool", () => {
  const ranked = rankXGrowthVideoCandidates(Array.from({ length: 8 }, (_, index) => candidate(index + 1)), new Map(), new Date("2026-10-10T00:00:00Z"));
  assert.deepEqual(chooseXGrowthVideoCandidates(ranked, [8], [1]).map((item) => item.workId), [8, 2, 3, 4, 5]);
  assert.equal(chooseXGrowthVideoCandidates(ranked.slice(0, 3)).length, 3);
});
