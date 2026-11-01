export type RevenueDashboardSummaryInput = {
  daily: Array<{ count: number }>;
  totals: {
    thirtyDays: number;
    growthRate: number | null;
  };
  placements: Array<{ key: string; count: number }>;
};

export type ConfirmedDailyMetric = {
  report_status: string;
  click_count: number;
  direct_reward_yen: number;
  category_reward_yen: number;
  service_reward_yen: number;
};

export function buildRevenueDashboardSummary(
  analytics: RevenueDashboardSummaryInput,
  id990Rows: ConfirmedDailyMetric[],
) {
  const id990ConfirmedDaily = id990Rows.filter((row) => row.report_status === "confirmed");
  const id990Confirmed = {
    dayCount: id990ConfirmedDaily.length,
    clickCount: id990ConfirmedDaily.reduce((sum, row) => sum + row.click_count, 0),
    rewardYen: id990ConfirmedDaily.reduce(
      (sum, row) => sum + row.direct_reward_yen + row.category_reward_yen + row.service_reward_yen,
      0,
    ),
  };
  const maxDaily = Math.max(...analytics.daily.map((item) => item.count), 1);
  const thirtyDayTotal = analytics.totals.thirtyDays;
  const mobileClicks = analytics.placements.find((item) => item.key === "mobile-sticky")?.count ?? 0;
  const mobileShare = thirtyDayTotal > 0
    ? Math.round((mobileClicks / thirtyDayTotal) * 100)
    : 0;
  const growthNote = analytics.totals.growthRate === null
    ? "比較データがまだありません"
    : `前の7日間比 ${analytics.totals.growthRate >= 0 ? "+" : ""}${analytics.totals.growthRate}%`;

  return { id990Confirmed, maxDaily, thirtyDayTotal, mobileClicks, mobileShare, growthNote };
}
