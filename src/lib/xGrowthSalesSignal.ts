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

type SalesReportPeriod = "invalid" | "future" | "current" | "prior" | "outside";
type SalesRowCounts = Pick<XGrowthSalesEvaluation,
  "currentMonthRows" | "prior90DayRows" | "unscopedCurrentMonthRows" | "unscopedPrior90DayRows" | "futureRowsExcluded">;
type WorkMonthSales = Map<string, number>;
type WorkSales = Map<number, { currentMonthSalesCount: number; prior90DaySalesCount: number }>;

function classifySalesReportMonth(month: string, currentMonth: string, priorFromMonth: string, priorThroughMonth: string): SalesReportPeriod {
  if (!/^\d{4}-\d{2}$/.test(month)) return "invalid";
  if (month > currentMonth) return "future";
  if (month === currentMonth) return "current";
  if (month >= priorFromMonth && month <= priorThroughMonth) return "prior";
  return "outside";
}

function countSalesReportRow(counts: SalesRowCounts, period: SalesReportPeriod, scoped: boolean) {
  if (period === "current") {
    if (scoped) counts.currentMonthRows++;
    else counts.unscopedCurrentMonthRows++;
    return;
  }
  if (period === "prior") {
    if (scoped) counts.prior90DayRows++;
    else counts.unscopedPrior90DayRows++;
  }
}

function hasValidScopedWorkId(row: XGrowthSaleHistoryRow, scoped: boolean) {
  return scoped && row.work_id !== null && Number.isSafeInteger(row.work_id) && row.work_id > 0;
}

function collectSalesHistoryRow(
  row: XGrowthSaleHistoryRow,
  currentMonth: string,
  priorFromMonth: string,
  priorThroughMonth: string,
  counts: SalesRowCounts,
  workMonthSales: WorkMonthSales,
) {
  const month = row.report_month.slice(0, 7);
  const period = classifySalesReportMonth(month, currentMonth, priorFromMonth, priorThroughMonth);
  if (period === "invalid" || period === "outside") return;
  if (period === "future") {
    counts.futureRowsExcluded++;
    return;
  }

  const scoped = is990(row);
  countSalesReportRow(counts, period, scoped);
  if (!hasValidScopedWorkId(row, scoped)) return;

  const key = `${month}:${row.work_id}`;
  // Product aliases and duplicate imports must not multiply a work's score.
  // Keep the largest row count per work and report month as a conservative cap.
  workMonthSales.set(key, Math.max(workMonthSales.get(key) ?? 0, Math.max(0, row.sales_count)));
}

function collectWorkMonthSales(
  rows: readonly XGrowthSaleHistoryRow[],
  currentMonth: string,
  priorFromMonth: string,
  priorThroughMonth: string,
) {
  const counts: SalesRowCounts = {
    currentMonthRows: 0,
    prior90DayRows: 0,
    unscopedCurrentMonthRows: 0,
    unscopedPrior90DayRows: 0,
    futureRowsExcluded: 0,
  };
  const workMonthSales: WorkMonthSales = new Map();
  for (const row of rows) {
    collectSalesHistoryRow(row, currentMonth, priorFromMonth, priorThroughMonth, counts, workMonthSales);
  }
  return { counts, workMonthSales };
}

function aggregateWorkSales(workMonthSales: WorkMonthSales, currentMonth: string): WorkSales {
  const byWork: WorkSales = new Map();
  for (const [key, salesCount] of workMonthSales) {
    const separator = key.indexOf(":");
    const month = key.slice(0, separator);
    const workId = Number(key.slice(separator + 1));
    const value = byWork.get(workId) ?? { currentMonthSalesCount: 0, prior90DaySalesCount: 0 };
    if (month === currentMonth) value.currentMonthSalesCount += salesCount;
    else value.prior90DaySalesCount += salesCount;
    byWork.set(workId, value);
  }
  return byWork;
}

function sumSalesForMonthPeriod(workMonthSales: WorkMonthSales, currentMonth: string, current: boolean) {
  return [...workMonthSales.entries()]
    .filter(([key]) => current ? key.startsWith(`${currentMonth}:`) : key.slice(0, 7) !== currentMonth)
    .reduce((sum, [, count]) => sum + count, 0);
}

function buildSalesEvaluation(
  currentMonth: string,
  prior90DayFromMonth: string,
  prior90DayThroughMonth: string,
  counts: SalesRowCounts,
  workMonthSales: WorkMonthSales,
  byWork: WorkSales,
): XGrowthSalesEvaluation {
  const workValues = [...byWork.values()];
  return {
    currentMonth,
    prior90DayFromMonth,
    prior90DayThroughMonth,
    ...counts,
    currentMonthSalesCount: sumSalesForMonthPeriod(workMonthSales, currentMonth, true),
    prior90DaySalesCount: sumSalesForMonthPeriod(workMonthSales, currentMonth, false),
    currentMonthWorks: workValues.filter((value) => value.currentMonthSalesCount > 0).length,
    prior90DayWorks: workValues.filter((value) => value.prior90DaySalesCount > 0).length,
    dedupedWorkMonthEntries: workMonthSales.size,
    signalsAppliedWorks: workValues.filter((value) => calculateXGrowthSalesSignal(value.currentMonthSalesCount, value.prior90DaySalesCount).scoreBonus > 0).length,
  };
}

export function buildXGrowthSalesEvaluation(rows: readonly XGrowthSaleHistoryRow[], now = new Date()) {
  const currentMonth = tokyoMonth(now);
  const prior90DayFromMonth = shiftMonth(currentMonth, -3);
  const prior90DayThroughMonth = shiftMonth(currentMonth, -1);
  const { counts, workMonthSales } = collectWorkMonthSales(
    rows,
    currentMonth,
    prior90DayFromMonth,
    prior90DayThroughMonth,
  );
  const byWork = aggregateWorkSales(workMonthSales, currentMonth);
  const evaluation = buildSalesEvaluation(
    currentMonth,
    prior90DayFromMonth,
    prior90DayThroughMonth,
    counts,
    workMonthSales,
    byWork,
  );
  return { byWork, evaluation };
}
