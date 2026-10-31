import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansDailyBoardSummary, buildMyfansSupplyEvidenceStatus, parseMyfansDailyPageParams, selectCurrentMyfansDailyPlan } from "./myfansDailyPageProjection.ts";

test("daily page params accept only the existing date shape and preserve numeric media parsing", () => {
  assert.deepEqual(parseMyfansDailyPageParams({ media: "5", date: "2026-10-30" }), {
    selectedMediaId: 5,
    planDate: "2026-10-30",
  });
  assert.deepEqual(parseMyfansDailyPageParams({ media: "not-a-number", date: "2026-2-03" }), {
    selectedMediaId: Number.NaN,
    planDate: undefined,
  });
  assert.deepEqual(parseMyfansDailyPageParams(undefined), { selectedMediaId: null, planDate: undefined });
});

test("current daily plan stays scoped and prefers revision, then timestamp, then id", () => {
  const plans = [
    { id: 9, plan_date: "2026-10-30", approved_media_id: 4, revision: 2, evaluated_at: "2026-10-30T09:00:00Z" },
    { id: 10, plan_date: "2026-10-30", approved_media_id: 4, revision: 2, evaluated_at: "2026-10-30T10:00:00Z" },
    { id: 11, plan_date: "2026-10-30", approved_media_id: 5, revision: 9, evaluated_at: "2026-10-30T11:00:00Z" },
    { id: 12, plan_date: "2026-10-29", approved_media_id: 4, revision: 9, evaluated_at: "2026-10-30T12:00:00Z" },
  ];

  assert.equal(selectCurrentMyfansDailyPlan(plans, "2026-10-30", 4)?.id, 10);
  assert.equal(selectCurrentMyfansDailyPlan([], "2026-10-30", 4), null);
});

test("supply evidence buckets preserve exact, linked, strong, and unresolved classifications", () => {
  const status = buildMyfansSupplyEvidenceStatus([{ id: 1 }], [
    { product_id: 1, confidence: "exact" },
    { product_id: 1, confidence: "strong" },
    { product_id: null, confidence: "strong" },
    { product_id: 99, confidence: "weak" },
  ]);

  assert.deepEqual(status, {
    exact_ready: 1,
    registered_no_exact: 1,
    resolved_unregistered: 1,
    unresolved: 1,
  });
});

test("daily board metrics prefer persisted selections and fall back to live recovery counts", () => {
  const board = {
    candidateOptions: [{ candidates: [1, 2] }, { candidates: [3] }],
    recovery: { passCount: 2, selectedMinimum: 3 },
    candidates: [1, 2],
  };
  assert.deepEqual(buildMyfansDailyBoardSummary({ persistedSelectedCount: 4, ...board }), {
    optionCount: 3,
    selectedCount: 4,
    selectedStatus: "READY",
    postCount: 4,
  });
  assert.deepEqual(buildMyfansDailyBoardSummary({ persistedSelectedCount: null, ...board }), {
    optionCount: 3,
    selectedCount: 2,
    selectedStatus: "SUPPLY_INSUFFICIENT",
    postCount: 2,
  });
});
