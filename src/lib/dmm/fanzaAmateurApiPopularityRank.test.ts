import assert from "node:assert/strict";
import test from "node:test";
import { buildFanzaAmateurApiPopularityPagePlan } from "./fanzaAmateurApiPopularityRank.ts";

const run = {
  rank_next_offset: 1,
  rank_fetched_item_count: 0,
  rank_total_count: null as number | null,
  rank_snapshot_at: null as string | null,
};

test("builds contiguous rank rows and records the observed total", () => {
  const plan = buildFanzaAmateurApiPopularityPagePlan({
    run,
    items: [{ content_id: " id-1 " }, { content_id: "id-2" }],
    totalCount: 12,
    rankLimit: 5,
    capturedAtFallback: "2026-10-30T00:00:00.000Z",
  });

  assert.deepEqual(plan.rankRows, [{ rank: 1, content_id: "id-1" }, { rank: 2, content_id: "id-2" }]);
  assert.equal(plan.expectedTotalCount, 12);
  assert.equal(plan.targetCount, 5);
  assert.equal(plan.nextOffset, 3);
  assert.equal(plan.fetchedCount, 2);
  assert.equal(plan.complete, false);
  assert.equal(plan.capturedAt, "2026-10-30T00:00:00.000Z");
});

test("caps the final page at the configured rank limit", () => {
  const plan = buildFanzaAmateurApiPopularityPagePlan({
    run: { ...run, rank_next_offset: 4, rank_fetched_item_count: 3, rank_total_count: 9, rank_snapshot_at: "snapshot" },
    items: [{ content_id: "id-4" }, { content_id: "id-5" }, { content_id: "id-6" }],
    totalCount: 9,
    rankLimit: 5,
    capturedAtFallback: "fallback",
  });

  assert.deepEqual(plan.rankRows, [{ rank: 4, content_id: "id-4" }, { rank: 5, content_id: "id-5" }]);
  assert.equal(plan.nextOffset, 6);
  assert.equal(plan.fetchedCount, 5);
  assert.equal(plan.complete, true);
  assert.equal(plan.capturedAt, "snapshot");
});

test("rejects missing, changed, or regressing rank data", () => {
  const input = {
    run: { ...run, rank_next_offset: 3, rank_total_count: 8 },
    items: [{ content_id: "id-3" }],
    totalCount: 9,
    rankLimit: 5,
    capturedAtFallback: "fallback",
  };

  assert.throws(() => buildFanzaAmateurApiPopularityPagePlan({ ...input, totalCount: null }), /total_count/);
  assert.throws(() => buildFanzaAmateurApiPopularityPagePlan(input), /総件数が取得中に変わりました/);
  assert.throws(() => buildFanzaAmateurApiPopularityPagePlan({ ...input, totalCount: 8, items: [{ title: "missing id" }] }), /content_idがなく/);
  assert.throws(() => buildFanzaAmateurApiPopularityPagePlan({ ...input, totalCount: 8, items: [] }), /返さず/);
});
