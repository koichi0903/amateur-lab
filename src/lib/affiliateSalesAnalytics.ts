import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAffiliateClicks } from "@/lib/affiliateAnalytics";

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

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

export async function getAffiliateSalesAnalytics() {
  const now = new Date();
  const currentMonth = monthKey(now);
  const monthKeys = Array.from({ length: 12 }, (_, index) =>
    monthKey(addMonths(now, index - 11)),
  );
  const cutoff = `${monthKeys[0]}-01`;
  const rows: AffiliateSaleRow[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("affiliate_sales")
      .select("id,report_month,work_id,product_id,title,sales_count,sales_amount,commission_amount,source_file,imported_at")
      .gte("report_month", cutoff)
      .order("report_month", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return {
        error: error.message,
        currentMonth,
        totals: { salesCount: 0, salesAmount: 0, commissionAmount: 0 },
        monthly: monthKeys.map((key) => ({ key, salesCount: 0, salesAmount: 0, commissionAmount: 0 })),
        topProducts: [] as Array<AffiliateSaleRow & { rank: number }>,
        performance: [] as Array<{
          workId: number;
          title: string;
          clicks: number;
          salesCount: number;
          commissionAmount: number;
          conversionRate: number | null;
          earningsPerClick: number | null;
        }>,
        performanceClickError: null as string | null,
        latestImport: null as null | { file: string; importedAt: string },
      };
    }

    const page = (data ?? []) as AffiliateSaleRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const currentRows = rows.filter((row) => row.report_month.slice(0, 7) === currentMonth);
  const clickResult = await fetchAffiliateClicks(35);
  const currentMonthClicks = clickResult.rows.filter(
    (row) => monthKey(new Date(row.clicked_at)) === currentMonth,
  );
  const clickCountByWork = new Map<number, number>();
  for (const click of currentMonthClicks) {
    clickCountByWork.set(
      click.work_id,
      (clickCountByWork.get(click.work_id) ?? 0) + 1,
    );
  }

  const performanceByWork = new Map<
    number,
    {
      workId: number;
      title: string;
      clicks: number;
      salesCount: number;
      commissionAmount: number;
    }
  >();
  for (const row of currentRows) {
    if (row.work_id === null) continue;
    const current = performanceByWork.get(row.work_id) ?? {
      workId: row.work_id,
      title: row.title,
      clicks: clickCountByWork.get(row.work_id) ?? 0,
      salesCount: 0,
      commissionAmount: 0,
    };
    current.salesCount += row.sales_count;
    current.commissionAmount += row.commission_amount;
    performanceByWork.set(row.work_id, current);
  }
  const totals = currentRows.reduce(
    (sum, row) => ({
      salesCount: sum.salesCount + row.sales_count,
      salesAmount: sum.salesAmount + row.sales_amount,
      commissionAmount: sum.commissionAmount + row.commission_amount,
    }),
    { salesCount: 0, salesAmount: 0, commissionAmount: 0 },
  );
  const monthly = monthKeys.map((key) => {
    const monthRows = rows.filter((row) => row.report_month.slice(0, 7) === key);
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
  const latest = [...rows].sort(
    (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime(),
  )[0];

  return {
    error: null as string | null,
    currentMonth,
    totals,
    monthly,
    topProducts: [...currentRows]
      .sort((a, b) => b.commission_amount - a.commission_amount)
      .slice(0, 10)
      .map((row, index) => ({ ...row, rank: index + 1 })),
    performance: [...performanceByWork.values()]
      .map((row) => ({
        ...row,
        conversionRate: row.clicks > 0
          ? Math.round((row.salesCount / row.clicks) * 10_000) / 100
          : null,
        earningsPerClick: row.clicks > 0
          ? Math.round(row.commissionAmount / row.clicks)
          : null,
      }))
      .sort((a, b) => b.commissionAmount - a.commissionAmount)
      .slice(0, 20),
    performanceClickError: clickResult.error,
    latestImport: latest
      ? { file: latest.source_file, importedAt: latest.imported_at }
      : null,
  };
}
