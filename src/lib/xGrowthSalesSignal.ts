export type XGrowthSaleHistoryRow = {
  report_month: string;
  work_id: number | null;
  product_id: string;
  sales_count: number;
  source_file: string;
};

export type XGrowthSalesSignal = {
  currentMonthSalesCount: number;
  prior90DaySalesCount: number;
  scoreBonus: number;
  reason: string;
};

export type XGrowthSalesEvaluation = {
  currentMonth: string;
  prior90DayFromMonth: string;
  prior90DayThroughMonth: string;
  currentMonthRows: number;
  prior90DayRows: number;
  unscopedCurrentMonthRows: number;
  unscopedPrior90DayRows: number;
  futureRowsExcluded: number;
  currentMonthSalesCount: number;
  prior90DaySalesCount: number;
  currentMonthWorks: number;
  prior90DayWorks: number;
  dedupedWorkMonthEntries: number;
  signalsAppliedWorks: number;
};

function tokyoMonth(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

function is990(row: Pick<XGrowthSaleHistoryRow, "source_file">) {
  return /^scope:990\|/.test(row.source_file);
}

export function calculateXGrowthSalesSignal(currentMonthSalesCount: number, prior90DaySalesCount: number): XGrowthSalesSignal {
  const current = Math.max(0, Math.floor(Number.isFinite(currentMonthSalesCount) ? currentMonthSalesCount : 0));
  const prior = Math.max(0, Math.floor(Number.isFinite(prior90DaySalesCount) ? prior90DaySalesCount : 0));
  const currentPoints = Math.min(12, current * 3);
  // Prior completed report months are a fallback only when the current month has
  // at most one sale. Divide by three, then shrink against a four-sale prior so
  // sparse history stays small; the entire auxiliary signal is capped at one
  // current-month sale's value (+3 points).
  const reliability = prior / (prior + 4);
  const priorPoints = current <= 1 ? Math.min(3, Math.round((prior / 3) * reliability * 3)) : 0;
  const scoreBonus = currentPoints + priorPoints;
  const reason = current > 0 || priorPoints > 0
    ? `当月${current}件 (+${currentPoints})${priorPoints ? ` / 過去90日補助${prior}件 (+${priorPoints})` : prior > 0 ? ` / 過去90日${prior}件は当月実績が十分なため補助なし` : ""}`
    : "対象期間の販売実績なし";
  return { currentMonthSalesCount: current, prior90DaySalesCount: prior, scoreBonus, reason };
}

export function buildXGrowthSalesEvaluation(rows: readonly XGrowthSaleHistoryRow[], now = new Date()) {
  const currentMonth = tokyoMonth(now);
  const prior90DayFromMonth = shiftMonth(currentMonth, -3);
  const prior90DayThroughMonth = shiftMonth(currentMonth, -1);
  const byWork = new Map<number, { currentMonthSalesCount: number; prior90DaySalesCount: number }>();
  const workMonthSales = new Map<string, number>();
  let currentMonthRows = 0;
  let prior90DayRows = 0;
  let unscopedCurrentMonthRows = 0;
  let unscopedPrior90DayRows = 0;
  let futureRowsExcluded = 0;

  for (const row of rows) {
    const month = row.report_month.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (month > currentMonth) {
      futureRowsExcluded++;
      continue;
    }
    const isCurrent = month === currentMonth;
    const isPrior90Day = month >= prior90DayFromMonth && month <= prior90DayThroughMonth;
    if (!isCurrent && !isPrior90Day) continue;
    const scoped = is990(row);
    if (isCurrent) {
      if (!scoped) unscopedCurrentMonthRows++;
      else currentMonthRows++;
    } else if (isPrior90Day) {
      if (!scoped) unscopedPrior90DayRows++;
      else prior90DayRows++;
    }
    if (!scoped || row.work_id === null || !Number.isSafeInteger(row.work_id) || row.work_id <= 0) continue;
    const key = `${month}:${row.work_id}`;
    // Product aliases and duplicate imports must not multiply a work's score.
    // Keep the largest row count per work and report month as a conservative cap.
    workMonthSales.set(key, Math.max(workMonthSales.get(key) ?? 0, Math.max(0, row.sales_count)));
  }

  for (const [key, salesCount] of workMonthSales) {
    const separator = key.indexOf(":");
    const month = key.slice(0, separator);
    const workId = Number(key.slice(separator + 1));
    const value = byWork.get(workId) ?? { currentMonthSalesCount: 0, prior90DaySalesCount: 0 };
    if (month === currentMonth) value.currentMonthSalesCount += salesCount;
    else value.prior90DaySalesCount += salesCount;
    byWork.set(workId, value);
  }

  const currentMonthSalesCount = [...workMonthSales.entries()].filter(([key]) => key.startsWith(`${currentMonth}:`)).reduce((sum, [, count]) => sum + count, 0);
  const prior90DaySalesCount = [...workMonthSales.entries()].filter(([key]) => key.slice(0, 7) !== currentMonth).reduce((sum, [, count]) => sum + count, 0);
  const evaluation: XGrowthSalesEvaluation = {
    currentMonth,
    prior90DayFromMonth,
    prior90DayThroughMonth,
    currentMonthRows,
    prior90DayRows,
    unscopedCurrentMonthRows,
    unscopedPrior90DayRows,
    futureRowsExcluded,
    currentMonthSalesCount,
    prior90DaySalesCount,
    currentMonthWorks: [...byWork.values()].filter((value) => value.currentMonthSalesCount > 0).length,
    prior90DayWorks: [...byWork.values()].filter((value) => value.prior90DaySalesCount > 0).length,
    dedupedWorkMonthEntries: workMonthSales.size,
    signalsAppliedWorks: [...byWork.values()].filter((value) => calculateXGrowthSalesSignal(value.currentMonthSalesCount, value.prior90DaySalesCount).scoreBonus > 0).length,
  };
  return { byWork, evaluation };
}
