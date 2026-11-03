import assert from "node:assert/strict";
import test from "node:test";
import { validateDailyMetricInput } from "./validateInput.ts";

const validInput = {
  reportDate: "2026-10-31",
  reportStatus: "confirmed",
  clickCount: 12,
  directRewardCount: 1,
  directRewardYen: 400,
  categoryRewardCount: 0,
  categoryRewardYen: 0,
  serviceRewardCount: 0,
  serviceRewardYen: 0,
  notes: "公式レポートから転記",
};

test("accepts a complete report for the latest completed day", () => {
  const result = validateDailyMetricInput(validInput, "2026-10-31");

  assert.deepEqual(result, { ok: true, value: validInput });
});

test("rejects malformed and impossible report dates", () => {
  assert.deepEqual(validateDailyMetricInput({ ...validInput, reportDate: "10/31/2026" }, "2026-10-31"), {
    ok: false,
    error: "対象日を正しく選択してください。",
  });
  assert.deepEqual(validateDailyMetricInput({ ...validInput, reportDate: "2026-02-30" }, "2026-10-31"), {
    ok: false,
    error: "実在する日付を選択してください。",
  });
});

test("rejects today and future report dates", () => {
  const result = validateDailyMetricInput({ ...validInput, reportDate: "2026-11-01" }, "2026-10-31");

  assert.deepEqual(result, {
    ok: false,
    error: "当日分は翌日反映のため、昨日以前の日付を選択してください。",
  });
});

test("rejects unsupported statuses, invalid counts, and oversized notes", () => {
  assert.equal(validateDailyMetricInput({ ...validInput, reportStatus: "pending" }, "2026-10-31").ok, false);
  assert.equal(validateDailyMetricInput({ ...validInput, clickCount: -1 }, "2026-10-31").ok, false);
  assert.equal(validateDailyMetricInput({ ...validInput, directRewardYen: 1.5 }, "2026-10-31").ok, false);
  assert.equal(validateDailyMetricInput({ ...validInput, notes: "x".repeat(501) }, "2026-10-31").ok, false);
});
