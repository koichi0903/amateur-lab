import assert from "node:assert/strict";
import test from "node:test";
import type { XPostCandidate } from "./xPostPlanner.ts";
import { accumulateXWorkFunnelEvents, buildFunnelScore, type CandidateWork, type FunnelStat } from "./xPostPlannerData.ts";

const work = { score: 50, review_count: 0 } as CandidateWork;
const noTraffic: FunnelStat = { pageViews: 0, fanzaClicks: 0, ctr: 0 };

test("keeps each candidate category's established score weight", () => {
  const weights: Array<[XPostCandidate["category"], number]> = [
    ["sales", 18], ["hidden_gem", 14], ["today_discovery", 14], ["deal", 12], ["today_buy", 12],
    ["score", 8], ["actress_best", 8], ["genre_best", 8], ["new", 5], ["market_scan", 5],
    ["comparison_pick", 5], ["judgment_pick", 5], ["review_gap", 5], ["discovery_gap", 5],
    ["maker_best", 5], ["series_best", 5],
  ];

  for (const [category, weight] of weights) {
    assert.equal(buildFunnelScore(work, category, null, noTraffic), 50 + weight + 6, category);
  }
});

test("retains review, price-drop, click, CTR, and exploration contributions", () => {
  const funnel = { pageViews: 4, fanzaClicks: 2, ctr: 10 };
  assert.equal(buildFunnelScore({ ...work, review_count: 40 }, "sales", { hadPriceDrop: true }, funnel), 118);
  assert.equal(buildFunnelScore(work, "new", null, { pageViews: 1, fanzaClicks: 0, ctr: 0 }), 58);
});

test("counts event rows only for requested works and preserves duplicates", () => {
  const stats = new Map<number, FunnelStat>([
    [1, { pageViews: 0, fanzaClicks: 0, ctr: 0 }],
    [2, { pageViews: 0, fanzaClicks: 0, ctr: 0 }],
  ]);

  accumulateXWorkFunnelEvents(stats, [{ work_id: 1 }, { work_id: 1 }, { work_id: 3 }], "pageViews");
  accumulateXWorkFunnelEvents(stats, [{ work_id: 2 }, { work_id: 2 }], "fanzaClicks");

  assert.deepEqual(stats.get(1), { pageViews: 2, fanzaClicks: 0, ctr: 0 });
  assert.deepEqual(stats.get(2), { pageViews: 0, fanzaClicks: 2, ctr: 0 });
});
