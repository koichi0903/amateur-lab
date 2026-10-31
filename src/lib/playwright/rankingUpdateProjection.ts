export type RankingProductValue = { productId: string; ranking: number };

export type RankingMaps = {
  realtimeMap: Map<string, number>;
  dailyMap: Map<string, number>;
  weeklyMap: Map<string, number>;
  monthlyMap: Map<string, number>;
  targetProductIds: string[];
};

export type RankingValueRow = {
  product_id: string;
  realtime_rank: number | null;
  daily_rank: number | null;
  weekly_rank: number | null;
  monthly_rank: number | null;
};

export function buildRankingMaps(input: {
  realtime: RankingProductValue[];
  daily: RankingProductValue[];
  weekly: RankingProductValue[];
  monthly: RankingProductValue[];
}): RankingMaps {
  const realtimeMap = new Map(input.realtime.map((item) => [item.productId, item.ranking]));
  const dailyMap = new Map(input.daily.map((item) => [item.productId, item.ranking]));
  const weeklyMap = new Map(input.weekly.map((item) => [item.productId, item.ranking]));
  const monthlyMap = new Map(input.monthly.map((item) => [item.productId, item.ranking]));
  const targetProductIds = [...new Set([
    ...realtimeMap.keys(),
    ...dailyMap.keys(),
    ...weeklyMap.keys(),
    ...monthlyMap.keys(),
  ])];
  return { realtimeMap, dailyMap, weeklyMap, monthlyMap, targetProductIds };
}

export function buildRankingResetRequest(realtimeComplete: boolean) {
  const values = realtimeComplete
    ? { realtime_rank: null, daily_rank: null, weekly_rank: null, monthly_rank: null }
    : { daily_rank: null, weekly_rank: null, monthly_rank: null };
  const filter = realtimeComplete
    ? "realtime_rank.not.is.null,daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null"
    : "daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null";
  return { values, filter };
}

export function changedStaleRankingProductIds(
  rows: RankingValueRow[],
  maps: RankingMaps,
  realtimeComplete: boolean,
) {
  const changedProductIds: string[] = [];
  for (const work of rows) {
    const expectedRealtimeRank = realtimeComplete
      ? maps.realtimeMap.get(work.product_id) ?? null
      : work.realtime_rank;
    const changed = expectedRealtimeRank !== work.realtime_rank
      || (maps.dailyMap.get(work.product_id) ?? null) !== work.daily_rank
      || (maps.weeklyMap.get(work.product_id) ?? null) !== work.weekly_rank
      || (maps.monthlyMap.get(work.product_id) ?? null) !== work.monthly_rank;
    if (changed) changedProductIds.push(work.product_id);
  }
  return changedProductIds;
}
