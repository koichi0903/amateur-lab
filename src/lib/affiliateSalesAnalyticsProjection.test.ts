import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAffiliateClickCountsByWork,
  buildAffiliateSalesAnalyticsProjection,
  type AffiliateSaleRow,
} from "./affiliateSalesAnalyticsProjection.ts";
import type { AffiliateClickRow } from "./affiliateAnalyticsQueries.ts";
import { buildXGrowthSalesEvaluation } from "./xGrowthSalesSignal.ts";

function saleRow(input: {
  id: number;
  month: string;
  workId: number;
  scope: string;
  salesCount: number;
  salesAmount: number;
  commissionAmount: number;
  importedAt: string;
}): AffiliateSaleRow {
  return {
    id: input.id,
    report_month: `${input.month}-01`,
    work_id: input.workId,
    product_id: `product-${input.id}`,
    title: `作品${input.workId}`,
    sales_count: input.salesCount,
    sales_amount: input.salesAmount,
    commission_amount: input.commissionAmount,
    source_file: `scope:${input.scope}|report-${input.id}.csv`,
    imported_at: input.importedAt,
  };
}

function click(workId: number, clickedAt: string): AffiliateClickRow {
  return { work_id: workId, clicked_at: clickedAt } as unknown as AffiliateClickRow;
}

test("sales projection keeps 990 totals separate from other scopes and joins current-month clicks", () => {
  const rows = [
    saleRow({ id: 1, month: "2026-10", workId: 1, scope: "990", salesCount: 2, salesAmount: 500, commissionAmount: 100, importedAt: "2026-10-29T10:00:00Z" }),
    saleRow({ id: 2, month: "2026-10", workId: 5, scope: "990", salesCount: 1, salesAmount: 200, commissionAmount: 80, importedAt: "2026-10-30T10:00:00Z" }),
    saleRow({ id: 3, month: "2026-10", workId: 2, scope: "026", salesCount: 1, salesAmount: 300, commissionAmount: 30, importedAt: "2026-10-28T10:00:00Z" }),
    saleRow({ id: 4, month: "2026-10", workId: 3, scope: "account-wide", salesCount: 5, salesAmount: 700, commissionAmount: 70, importedAt: "2026-10-27T10:00:00Z" }),
    saleRow({ id: 5, month: "2026-10", workId: 4, scope: "legacy", salesCount: 2, salesAmount: 200, commissionAmount: 20, importedAt: "2026-10-26T10:00:00Z" }),
    saleRow({ id: 6, month: "2026-09", workId: 6, scope: "990", salesCount: 4, salesAmount: 1000, commissionAmount: 250, importedAt: "2026-09-30T10:00:00Z" }),
  ];
  const currentMonth = "2026-10";
  const now = new Date("2026-10-15T12:00:00+09:00");
  const clicks = [
    click(1, "2026-09-30T15:30:00.000Z"),
    click(2, "2026-10-15T12:00:00+09:00"),
    click(1, "2026-10-15T13:00:00+09:00"),
    click(2, "2026-09-30T23:59:00+09:00"),
  ];
  const clickCountByWork = buildAffiliateClickCountsByWork(clicks, currentMonth);
  const { byWork: xGrowthSalesByWork, evaluation: salesEvaluation } = buildXGrowthSalesEvaluation(rows, now);
  const projection = buildAffiliateSalesAnalyticsProjection({
    rows,
    currentMonth,
    monthKeys: ["2026-09", "2026-10"],
    clickCountByWork,
    clickedTitles: new Map([[1, "クリック作品1"], [2, "クリック作品2"]]),
    xGrowthSalesByWork,
    salesEvaluation,
    performanceClickError: null,
  });

  assert.deepEqual([...clickCountByWork], [[1, 2], [2, 1]], "Tokyo-month boundary includes only October clicks");
  assert.equal(projection.currentMonth, "2026-10");
  assert.equal(projection.currentMonthHasRows, true);
  assert.deepEqual(projection.totals, { salesCount: 3, salesAmount: 700, commissionAmount: 180 });
  assert.deepEqual(projection.non990Totals, { salesCount: 8, salesAmount: 1200, commissionAmount: 120, rows: 3 });
  assert.deepEqual(projection.monthly, [
    { key: "2026-09", salesCount: 4, salesAmount: 1000, commissionAmount: 250 },
    { key: "2026-10", salesCount: 3, salesAmount: 700, commissionAmount: 180 },
  ]);
  assert.equal(projection.topProducts[0]?.work_id, 1);
  assert.equal(projection.topProducts[0]?.rank, 1);

  const clickedSale = projection.performance.find((row) => row.workId === 1);
  assert.equal(clickedSale?.title, "クリック作品1");
  assert.equal(clickedSale?.salesCount, 2);
  assert.equal(clickedSale?.clicks, 2);
  assert.equal(clickedSale?.conversionRate, 100);
  assert.equal(clickedSale?.earningsPerClick, 50);

  const non990Sale = projection.performance.find((row) => row.workId === 2);
  assert.equal(non990Sale?.salesCount, 0, "026 sales are not blended into 990 per-work performance");
  assert.equal(non990Sale?.action, "observe");

  const priorOnlyGrowthWork = projection.performance.find((row) => row.workId === 6);
  assert.equal(priorOnlyGrowthWork?.title, "作品6");
  assert.equal(priorOnlyGrowthWork?.salesCount, 0);
  assert.equal(priorOnlyGrowthWork?.salesAmount, 0);
  assert.equal(projection.latestImport?.file, "scope:990|report-2.csv");
});
