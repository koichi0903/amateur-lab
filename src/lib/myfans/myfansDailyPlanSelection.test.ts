import assert from "node:assert/strict";
import test from "node:test";
import {
  readMyfansDailyPlanSelectionInput,
  requireMyfansDailyPlanSelectionPlan,
  selectDailyPlanOption,
} from "./myfansDailyPlanSelection";

test("daily plan selection input preserves normalized form values", () => {
  const formData = new FormData();
  formData.set("approved_media_id", "12");
  formData.set("plan_date", "2026-10-30");
  formData.set("post_order", "2");
  formData.set("option_label", "b");
  assert.deepEqual(readMyfansDailyPlanSelectionInput(formData), {
    approvedMediaId: 12,
    planDate: "2026-10-30",
    postOrder: 2,
    optionLabel: "B",
  });
});

test("daily plan selection input retains field-specific validation errors", () => {
  const formData = new FormData();
  formData.set("plan_date", "invalid");
  formData.set("post_order", "0");
  formData.set("option_label", "D");
  assert.throws(() => readMyfansDailyPlanSelectionInput(formData), /対象日が不正です。/);
  formData.set("plan_date", "2026-10-30");
  assert.throws(() => readMyfansDailyPlanSelectionInput(formData), /投稿枠が不正です。/);
  formData.set("post_order", "1");
  assert.throws(() => readMyfansDailyPlanSelectionInput(formData), /候補はA\/B\/Cから選んでください。/);
});

test("daily plan selection preserves lookup errors and missing-plan message", () => {
  const databaseError = new Error("read failed");
  assert.throws(() => requireMyfansDailyPlanSelectionPlan(null, databaseError), databaseError);
  assert.throws(() => requireMyfansDailyPlanSelectionPlan(null, null), /今日のDaily Planが見つかりません。先に候補を生成してください。/);
  assert.deepEqual(requireMyfansDailyPlanSelectionPlan({ id: 1 }, null), { id: 1 });
});

test("selecting an option preserves the plan strategy and existing slots", () => {
  assert.deepEqual(
    selectDailyPlanOption({ objective: "reach", daily_option_selection: { "1": "A" } }, 2, "C"),
    { objective: "reach", daily_option_selection: { "1": "A", "2": "C" } },
  );
});

test("reselecting an existing slot is allowed at the selection limit", () => {
  assert.deepEqual(
    selectDailyPlanOption({ daily_option_selection: { "1": "A", "2": "B", "3": "A" } }, 2, "C"),
    { daily_option_selection: { "1": "A", "2": "C", "3": "A" } },
  );
});

test("adding a new slot is rejected after reaching the selection limit", () => {
  assert.throws(
    () => selectDailyPlanOption({ daily_option_selection: { "1": "A", "2": "B", "3": "A" } }, 4, "A"),
    /selectedは3件までです。4枠目を選ぶには、既存のselectedを見直してください。/,
  );
});
