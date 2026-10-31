import assert from "node:assert/strict";
import test from "node:test";
import { buildRankingSnapshotHistories } from "./xGrowthRankingSnapshotHistory";

test("uses the latest capture per date and the prior distinct date", () => {
  const histories = buildRankingSnapshotHistories([
    { work_id: 42, ranking: 18, captured_date: "2026-10-29", captured_at: "2026-10-29T08:00:00.000Z" },
    { work_id: 42, ranking: 12, captured_date: "2026-10-31", captured_at: "2026-10-31T08:00:00.000Z" },
    { work_id: 42, ranking: 9, captured_date: "2026-10-31", captured_at: "2026-10-31T10:00:00.000Z" },
    { work_id: 42, ranking: 15, captured_date: "2026-10-30", captured_at: "2026-10-30T09:00:00.000Z" },
  ]);

  assert.deepEqual(histories.get(42), { observations: 3, previousRanking: 15 });
});

test("ignores rows without a usable work id or ranking", () => {
  const histories = buildRankingSnapshotHistories([
    { work_id: 0, ranking: 4, captured_date: "2026-10-31", captured_at: "2026-10-31T10:00:00.000Z" },
    { work_id: 42, ranking: 0, captured_date: "2026-10-31", captured_at: "2026-10-31T10:00:00.000Z" },
  ]);

  assert.deepEqual([...histories], []);
});
