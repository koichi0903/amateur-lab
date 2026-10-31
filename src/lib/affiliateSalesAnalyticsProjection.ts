import type { AffiliateClickRow } from "./affiliateAnalyticsQueries";
import { calculateXGrowthSalesSignal, type XGrowthSalesEvaluation } from "./xGrowthSalesSignal";

export type AffiliateSaleRow = {
  id: number;
  report_month: string;
  work_id: number | null;
  product_id: string;
  title: string;
  sales_count: number;
  sales_amount: number;
  commission_amount: number;
  source_file: string;
  imported_at: string;
};

export type RevenueAction = "scale" | "improve" | "observe" | "reduce";

export type AffiliatePerformanceRow = {
  workId: number;
  title: string;
  clicks: number;
  salesCount: number;
  currentMonthSalesCount: number;
  prior90DaySalesCount: number;
  salesScoreBonus: number;
  salesReason: string;
  salesAmount: number;
  commissionAmount: number;
  conversionRate: number | null;
  earningsPerClick: number | null;
  action: RevenueAction;
  actionReason: string;
};

type AffiliateSalesScope = "990" | "026" | "account-wide" | "unassigned";
type XGrowthSalesByWork = ReadonlyMap<number, Pick<AffiliatePerformanceRow, "currentMonthSalesCount" | "prior90DaySalesCount">>;
type MutableAffiliatePerformanceRow = Pick<
  AffiliatePerformanceRow,
  "workId" | "title" | "clicks" | "salesCount" | "salesAmount" | "commissionAmount"
>;

type AffiliateSalesAnalyticsProjectionInput = {
  rows: readonly AffiliateSaleRow[];
  currentMonth: string;
  monthKeys: readonly string[];
  clickCountByWork: ReadonlyMap<number, number>;
  clickedTitles: ReadonlyMap<number, string>;
  xGrowthSalesByWork: XGrowthSalesByWork;
  salesEvaluation: XGrowthSalesEvaluation;
  performanceClickError: string | null;
};

export function affiliateMonthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

export function addAffiliateMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function rowScope(row: Pick<AffiliateSaleRow, "source_file">): AffiliateSalesScope {
  const match = row.source_file.match(/^scope:(990|026|account-wide)\|/);
  return (match?.[1] as AffiliateSalesScope | undefined) ?? "unassigned";
}

export function buildAffiliateClickCountsByWork(clicks: readonly AffiliateClickRow[], currentMonth: string) {
  const currentMonthClicks = clicks.filter(
    (row) => affiliateMonthKey(new Date(row.clicked_at)) === currentMonth,
  );
  const clickCountByWork = new Map<number, number>();
  for (const click of currentMonthClicks) {
    clickCountByWork.set(
      click.work_id,
      (clickCountByWork.get(click.work_id) ?? 0) + 1,
    );
  }
  return clickCountByWork;
}

function classifyPerformance(row: {
  clicks: number;
  salesCount: number;
  commissionAmount: number;
}): Pick<AffiliatePerformanceRow, "action" | "actionReason"> {
  if (row.salesCount > 0) {
    return {
      action: "scale",
      actionReason: `${row.salesCount}件の販売・報酬¥${row.commissionAmount.toLocaleString("ja-JP")}を確認`,
    };
  }
  if (row.clicks >= 20) {
    return {
      action: "reduce",
      actionReason: `${row.clicks}クリックで販売0件。露出先と訴求を再評価`,
    };
  }
  if (row.clicks >= 5) {
    return {
      action: "improve",
      actionReason: `${row.clicks}クリックで販売0件。説明・価格訴求を改善`,
    };
  }
  return {
    action: "observe",
    actionReason: `判定に必要なクリックが不足（現在${row.clicks}件）`,
  };
}

function createClickedPerformanceRows(
  clickCountByWork: ReadonlyMap<number, number>,
  clickedTitles: ReadonlyMap<number, string>,
) {
  const performanceByWork = new Map<number, MutableAffiliatePerformanceRow>();
  for (const [workId, clicks] of clickCountByWork) {
    performanceByWork.set(workId, {
      workId,
      title: clickedTitles.get(workId) ?? `作品ID ${workId}`,
      clicks,
      salesCount: 0,
      salesAmount: 0,
      commissionAmount: 0,
    });
  }
  return performanceByWork;
}

function addCurrentMonthSaleRows(
  performanceByWork: Map<number, MutableAffiliatePerformanceRow>,
  currentRows: readonly AffiliateSaleRow[],
  clickCountByWork: ReadonlyMap<number, number>,
) {
  for (const row of currentRows) {
    if (row.work_id === null) continue;
    const current = performanceByWork.get(row.work_id) ?? {
      workId: row.work_id,
      title: row.title,
      clicks: clickCountByWork.get(row.work_id) ?? 0,
      salesCount: 0,
      salesAmount: 0,
      commissionAmount: 0,
    };
    current.salesCount += row.sales_count;
    current.salesAmount += row.sales_amount;
    current.commissionAmount += row.commission_amount;
    performanceByWork.set(row.work_id, current);
  }
}

function addXGrowthSalesRows(
  performanceByWork: Map<number, MutableAffiliatePerformanceRow>,
  rows: readonly AffiliateSaleRow[],
  xGrowthSalesByWork: XGrowthSalesByWork,
  clickCountByWork: ReadonlyMap<number, number>,
) {
  for (const [workId, signal] of xGrowthSalesByWork) {
    if (performanceByWork.has(workId)) continue;
    const title = rows.find((row) => row.work_id === workId && rowScope(row) === "990")?.title ?? `作品ID ${workId}`;
    performanceByWork.set(workId, {
      workId,
      title,
      clicks: clickCountByWork.get(workId) ?? 0,
      salesCount: signal.currentMonthSalesCount,
      salesAmount: 0,
      commissionAmount: 0,
    });
  }
}

function buildPerformanceRows(
  rows: readonly MutableAffiliatePerformanceRow[],
  xGrowthSalesByWork: XGrowthSalesByWork,
) {
  return rows
    .map((row) => {
      const metrics = {
        conversionRate: row.clicks > 0
          ? Math.round((row.salesCount / row.clicks) * 10_000) / 100
          : null,
        earningsPerClick: row.clicks > 0
          ? Math.round(row.commissionAmount / row.clicks)
          : null,
      };
      const salesSignal = xGrowthSalesByWork.get(row.workId) ?? { currentMonthSalesCount: 0, prior90DaySalesCount: 0 };
      const evaluatedSignal = calculateXGrowthSalesSignal(salesSignal.currentMonthSalesCount, salesSignal.prior90DaySalesCount);
      return {
        ...row,
        ...metrics,
        ...classifyPerformance(row),
        currentMonthSalesCount: evaluatedSignal.currentMonthSalesCount,
        prior90DaySalesCount: evaluatedSignal.prior90DaySalesCount,
        salesScoreBonus: evaluatedSignal.scoreBonus,
        salesReason: evaluatedSignal.reason,
      };
    })
    .sort((a, b) => b.salesScoreBonus - a.salesScoreBonus || b.commissionAmount - a.commissionAmount || b.clicks - a.clicks)
    .slice(0, 500);
}

function sumAffiliateSaleRows(rows: readonly AffiliateSaleRow[]) {
  return rows.reduce(
    (sum, row) => ({
      salesCount: sum.salesCount + row.sales_count,
      salesAmount: sum.salesAmount + row.sales_amount,
      commissionAmount: sum.commissionAmount + row.commission_amount,
    }),
    { salesCount: 0, salesAmount: 0, commissionAmount: 0 },
  );
}

function sumNon990AffiliateSaleRows(rows: readonly AffiliateSaleRow[]) {
  return rows.reduce(
    (sum, row) => ({
      salesCount: sum.salesCount + row.sales_count,
      salesAmount: sum.salesAmount + row.sales_amount,
      commissionAmount: sum.commissionAmount + row.commission_amount,
      rows: sum.rows + 1,
    }),
    { salesCount: 0, salesAmount: 0, commissionAmount: 0, rows: 0 },
  );
}

function buildMonthlyAffiliateTotals(rows: readonly AffiliateSaleRow[], monthKeys: readonly string[]) {
  return monthKeys.map((key) => {
    const monthRows = rows.filter((row) => row.report_month.slice(0, 7) === key && rowScope(row) === "990");
    return monthRows.reduce(
      (sum, row) => ({
        key,
        salesCount: sum.salesCount + row.sales_count,
        salesAmount: sum.salesAmount + row.sales_amount,
        commissionAmount: sum.commissionAmount + row.commission_amount,
      }),
      { key, salesCount: 0, salesAmount: 0, commissionAmount: 0 },
    );
  });
}

export function buildAffiliateSalesAnalyticsProjection(input: AffiliateSalesAnalyticsProjectionInput) {
  const currentMonthRows = input.rows.filter((row) => row.report_month.slice(0, 7) === input.currentMonth);
  const currentRows = currentMonthRows.filter((row) => rowScope(row) === "990");
  const non990Rows = currentMonthRows.filter((row) => rowScope(row) !== "990");
  const performanceByWork = createClickedPerformanceRows(input.clickCountByWork, input.clickedTitles);
  addCurrentMonthSaleRows(performanceByWork, currentRows, input.clickCountByWork);
  addXGrowthSalesRows(performanceByWork, input.rows, input.xGrowthSalesByWork, input.clickCountByWork);
  const latest = [...input.rows].sort(
    (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime(),
  )[0];

  return {
    error: null as string | null,
    currentMonth: input.currentMonth,
    currentMonthHasRows: currentRows.length > 0,
    totals: sumAffiliateSaleRows(currentRows),
    non990Totals: sumNon990AffiliateSaleRows(non990Rows),
    monthly: buildMonthlyAffiliateTotals(input.rows, input.monthKeys),
    topProducts: [...currentRows]
      .sort((a, b) => b.commission_amount - a.commission_amount)
      .slice(0, 10)
      .map((row, index) => ({ ...row, rank: index + 1 })),
    performance: buildPerformanceRows([...performanceByWork.values()], input.xGrowthSalesByWork),
    salesEvaluation: input.salesEvaluation,
    performanceClickError: input.performanceClickError,
    latestImport: latest
      ? { file: latest.source_file, importedAt: latest.imported_at }
      : null,
  };
}
