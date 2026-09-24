import assert from "node:assert/strict";
import test from "node:test";
import { restorePersistedDailySnapshot } from "./myfansDailySnapshotView";

function snapshot(planDate = "2026-09-25") {
  return restorePersistedDailySnapshot({
    id: 61,
    planDate,
    revision: 1,
    evaluatedAt: "2026-09-25T01:30:00.000Z",
    strategyJson: {
      daily_option_selection: { "1": "A", "3": "B" },
      candidate_options: [
        { post_order: 1, slot: "12:10", recommended_option: "A", candidates: [{ id: "s1a", option_label: "A", body: "slot one", product_id: null, monetizable_status: "unlinked" }] },
        { post_order: 2, slot: "17:40", recommended_option: "A", candidates: [{ id: "s2a", option_label: "A", body: "slot two", product_id: null, monetizable_status: "unlinked" }] },
        { post_order: 3, slot: "20:10", recommended_option: "A", candidates: [{ id: "s3a", option_label: "A", body: "slot three", product_id: null, monetizable_status: "unlinked" }, { id: "s3b", option_label: "B", body: "selected three", product_id: null, monetizable_status: "unlinked" }] },
        { post_order: 4, slot: "23:00", recommended_option: "A", candidates: [] },
      ],
    },
  });
}

test("persisted plan wins over a zero-result live calculation", () => {
  const view = snapshot();
  assert.equal(view.planId, 61);
  assert.equal(view.revision, 1);
  assert.equal(view.optionCount, 4);
  assert.equal(view.selectedCount, 2);
  assert.deepEqual(view.selectedOptions, { "1": "A", "3": "B" });
  assert.deepEqual(view.slots.map((slot) => slot.postOrder), [1, 2, 3, 4]);
  assert.equal(view.slots[3]?.candidates.length, 0);
});

test("reload restores the same plan, revision, slots, and selection", () => {
  const first = snapshot();
  const afterReload = snapshot();
  assert.deepEqual(afterReload, first);
  assert.deepEqual(afterReload.slots.map((slot) => slot.postOrder), [1, 2, 3, 4]);
  assert.equal(afterReload.slots.find((slot) => slot.postOrder === 3)?.candidates[1]?.optionLabel, "B");
});

test("JST day selection remains an exact persisted plan date", () => {
  assert.equal(snapshot("2026-09-25").planDate, "2026-09-25");
  assert.notEqual(snapshot("2026-09-26").planDate, snapshot("2026-09-25").planDate);
});
