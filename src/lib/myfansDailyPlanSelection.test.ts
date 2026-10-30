import assert from "node:assert/strict";
import test from "node:test";
import { selectDailyPlanOption } from "./myfansDailyPlanSelection";

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
