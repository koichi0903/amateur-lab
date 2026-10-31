import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAffiliateClicks } from "@/lib/affiliateAnalytics";
import { buildXGrowthSalesEvaluation } from "@/lib/xGrowthSalesSignal";
import {
  addAffiliateMonths,
  affiliateMonthKey,
  buildAffiliateClickCountsByWork,
  buildAffiliateSalesAnalyticsProjection,
  type AffiliatePerformanceRow,
  type AffiliateSaleRow,
} from "./affiliateSalesAnalyticsProjection";
export type { AffiliatePerformanceRow, AffiliateSaleRow, RevenueAction } from "./affiliateSalesAnalyticsProjection";

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

async function fetchAffiliateSaleRows(cutoff: string) {
  const rows: AffiliateSaleRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("affiliate_sales")
      .select("id,report_month,work_id,product_id,title,sales_count,sales_amount,commission_amount,source_file,imported_at")
      .gte("report_month", cutoff)
      .order("report_month", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { rows, error: error.message };
    const page = (data ?? []) as AffiliateSaleRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

function emptyAffiliateSalesAnalytics(
  error: string,
  currentMonth: string,
  monthKeys: string[],
  now: Date,
) {
  return {
    error,
    currentMonth,
    currentMonthHasRows: false,
    totals: { salesCount: 0, salesAmount: 0, commissionAmount: 0 },
    non990Totals: { salesCount: 0, salesAmount: 0, commissionAmount: 0, rows: 0 },
    monthly: monthKeys.map((key) => ({ key, salesCount: 0, salesAmount: 0, commissionAmount: 0 })),
    topProducts: [] as Array<AffiliateSaleRow & { rank: number }>,
    performance: [] as AffiliatePerformanceRow[],
    salesEvaluation: buildXGrowthSalesEvaluation([], now).evaluation,
    performanceClickError: null as string | null,
    latestImport: null as null | { file: string; importedAt: string },
  };
}

export async function getAffiliateSalesAnalytics() {
  const now = new Date();
  const currentMonth = affiliateMonthKey(now);
  const monthKeys = Array.from({ length: 12 }, (_, index) =>
    affiliateMonthKey(addAffiliateMonths(now, index - 11)),
  );
  const cutoff = `${monthKeys[0]}-01`;
  const { rows, error } = await fetchAffiliateSaleRows(cutoff);
  if (error) return emptyAffiliateSalesAnalytics(error, currentMonth, monthKeys, now);

  const { byWork: xGrowthSalesByWork, evaluation: salesEvaluation } = buildXGrowthSalesEvaluation(rows, now);
  const clickResult = await fetchAffiliateClicks(35);
  const clickCountByWork = buildAffiliateClickCountsByWork(clickResult.rows, currentMonth);

  const clickedWorkIds = [...clickCountByWork.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([workId]) => workId);
  const clickedTitles = new Map<number, string>();
  if (clickedWorkIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("works")
      .select("id,title")
      .in("id", clickedWorkIds);
    for (const work of data ?? []) clickedTitles.set(work.id, work.title);
  }

  return buildAffiliateSalesAnalyticsProjection({
    rows,
    currentMonth,
    monthKeys,
    clickCountByWork,
    clickedTitles,
    xGrowthSalesByWork,
    salesEvaluation,
    performanceClickError: clickResult.error,
  });
}
