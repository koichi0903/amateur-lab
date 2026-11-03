export type RevenueStat = {
  pageViews: number;
  fanzaClicks: number;
  ctr: number;
};

export type RevenueEvent = { work_id: number };

type RevenueCountKey = "pageViews" | "fanzaClicks";

export function normalizeRevenueWorkIds(workIds: number[]) {
  return [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
}

function createEmptyRevenueStats(workIds: number[]) {
  return new Map(workIds.map((id) => [id, { pageViews: 0, fanzaClicks: 0, ctr: 0 }]));
}

function addRevenueCounts(
  stats: Map<number, RevenueStat>,
  rows: RevenueEvent[],
  key: RevenueCountKey,
) {
  for (const row of rows) {
    const current = stats.get(row.work_id);
    if (current) current[key] += 1;
  }
}

function calculateRevenueCtrs(stats: Map<number, RevenueStat>) {
  for (const current of stats.values()) {
    current.ctr = current.pageViews > 0
      ? Math.round((current.fanzaClicks / current.pageViews) * 1000) / 10
      : 0;
  }
  return stats;
}

export function buildRevenueStats(workIds: number[], views: RevenueEvent[], clicks: RevenueEvent[]) {
  const stats = createEmptyRevenueStats(normalizeRevenueWorkIds(workIds));
  addRevenueCounts(stats, views, "pageViews");
  addRevenueCounts(stats, clicks, "fanzaClicks");
  return calculateRevenueCtrs(stats);
}
