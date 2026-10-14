import assert from "node:assert/strict";
import { buildXGrowthSalesEvaluation, calculateXGrowthSalesSignal, type XGrowthSaleHistoryRow } from "./xGrowthSalesSignal";

const row = (reportMonth: string, workId: number, salesCount: number, sourceFile = "scope:990|report.csv", productId = `pid-${workId}`): XGrowthSaleHistoryRow => ({
  report_month: `${reportMonth}-01`, work_id: workId, product_id: productId, sales_count: salesCount, source_file: sourceFile,
});

const evaluated = buildXGrowthSalesEvaluation([
  row("2026-10", 1, 1),
  row("2026-09", 1, 4, "scope:990|first.csv", "alias-a"),
  row("2026-09", 1, 7, "scope:990|second.csv", "alias-b"),
  row("2026-08", 1, 2),
  row("2026-09", 2, 100, "legacy.csv"),
  row("2026-11", 3, 100),
  row("2026-06", 4, 100),
], new Date("2026-10-01T16:00:00.000Z"));

assert.equal(evaluated.evaluation.currentMonth, "2026-10", "calendar period follows Tokyo time");
assert.equal(evaluated.evaluation.prior90DayFromMonth, "2026-07");
assert.equal(evaluated.evaluation.currentMonthRows, 1);
assert.equal(evaluated.evaluation.prior90DayRows, 3);
assert.equal(evaluated.evaluation.unscopedPrior90DayRows, 1);
assert.equal(evaluated.evaluation.futureRowsExcluded, 1);
assert.equal(evaluated.evaluation.dedupedWorkMonthEntries, 3);
assert.deepEqual(evaluated.byWork.get(1), { currentMonthSalesCount: 1, prior90DaySalesCount: 9 });
assert.equal(evaluated.byWork.has(2), false, "unscoped rows cannot affect an account-specific score");
assert.equal(evaluated.byWork.has(3), false, "future report months are excluded");
assert.equal(evaluated.byWork.has(4), false, "older report months are outside the 90-day support window");

assert.equal(calculateXGrowthSalesSignal(0, 0).scoreBonus, 0, "missing sales data is neutral");
assert.equal(calculateXGrowthSalesSignal(0, 1).scoreBonus, 0, "one historical sale is shrunk to zero");
assert.equal(calculateXGrowthSalesSignal(0, 6).scoreBonus, 3, "historical support is capped at three points");
assert.equal(calculateXGrowthSalesSignal(2, 30).scoreBonus, 6, "prior sales stop contributing when current-month evidence is sufficient");
assert.equal(calculateXGrowthSalesSignal(20, 0).scoreBonus, 12, "current-month contribution is capped");

console.log("xGrowth sales signal regression tests passed");
