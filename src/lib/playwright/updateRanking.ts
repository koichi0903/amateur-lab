import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { RANKING_UPDATE_CONFIG } from "@/config/update";
import { getRealtimeRanking } from "./getRealtimeRanking";
import { getDailyRanking } from "./getDailyRanking";
import { getWeeklyRanking } from "./getWeeklyRanking";
import { getMonthlyRanking } from "./getMonthlyRanking";
import { generateAndSaveTrendingInsight } from "@/lib/insights/generateAndSaveTrending";
import type { RankingProduct } from "./getRankingProducts";
import { buildRankingUpdate } from "./rankingCoverage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PopularityRankingProgress = (
  processed: number,
  total: number,
  productId: string,
) => Promise<void>;

export async function updateRanking(
  onProgress?: PopularityRankingProgress,
  prefetchedRealtime?: RankingProduct[],
) {
  const realtime = prefetchedRealtime ?? (await getRealtimeRanking());
  const realtimeComplete = realtime.length >= RANKING_UPDATE_CONFIG.targetCount;
  const daily = await getDailyRanking();
  const weekly = await getWeeklyRanking();
  const monthly = await getMonthlyRanking();

  const fetchedRankings = [
    ["リアルタイム", realtime],
    ["日次", daily],
    ["週次", weekly],
    ["月次", monthly],
  ] as const;
  for (const [label, items] of fetchedRankings) {
    if (items.length === 0) {
      throw new Error(`${label}ランキングの取得結果が0件です`);
    }
  }

  console.log(
  `Ranking fetched: realtime=${realtime.length}, daily=${daily.length}, weekly=${weekly.length}, monthly=${monthly.length}`
);

const realtimeMap = new Map(
  realtime.map((item) => [item.productId, item.ranking])
);

const dailyMap = new Map(
  daily.map((item) => [item.productId, item.ranking])
);

const weeklyMap = new Map(
  weekly.map((item) => [item.productId, item.ranking])
);

const monthlyMap = new Map(
  monthly.map((item) => [item.productId, item.ranking])
);

const targetProductIds = [
  ...new Set([
    ...realtimeMap.keys(),
    ...dailyMap.keys(),
    ...weeklyMap.keys(),
    ...monthlyMap.keys(),
  ]),
];

const allWorks: {
  id: number;
  product_id: string;
  title: string;
  realtime_rank: number | null;
  daily_rank: number | null;
  weekly_rank: number | null;
  monthly_rank: number | null;
}[] = [];

for (let i = 0; i < targetProductIds.length; i += 1000) {
  const chunk = targetProductIds.slice(i, i + 1000);

  const { data, error } = await supabase
    .from("works")
    .select(`
  id,
  product_id,
  title,
  realtime_rank,
  daily_rank,
  weekly_rank,
  monthly_rank
`)
    .in("product_id", chunk);

  if (error) {
    throw error;
  }

  if (data) {
    allWorks.push(...data);
  }
}

const resetValues = realtimeComplete
  ? {
      realtime_rank: null,
      daily_rank: null,
      weekly_rank: null,
      monthly_rank: null,
    }
  : {
      daily_rank: null,
      weekly_rank: null,
      monthly_rank: null,
    };
const resetFilter = realtimeComplete
  ? "realtime_rank.not.is.null,daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null"
  : "daily_rank.not.is.null,weekly_rank.not.is.null,monthly_rank.not.is.null";
const { error: resetError } = await supabase
  .from("works")
  .update(resetValues)
  .or(
    resetFilter,
  );

if (resetError) {
  throw resetError;
}

for (let index = 0; index < allWorks.length; index += 1) {
  const work = allWorks[index];

  const dailyRank = dailyMap.get(work.product_id);
  const realtimeRank = realtimeMap.get(work.product_id);
  const rankingUpdate = buildRankingUpdate({
    existingRealtimeRank: work.realtime_rank,
    realtimeRank,
    dailyRank,
    weeklyRank: weeklyMap.get(work.product_id),
    monthlyRank: monthlyMap.get(work.product_id),
    realtimeComplete,
  });

  const { error: updateError } = await supabase
    .from("works")
    .update(rankingUpdate)
    .eq("id", work.id);

  if (updateError) {
    throw updateError;
  }

  if (realtimeRank != null) {
    await generateAndSaveTrendingInsight({
      workId: work.id,
      title: work.title,
      previousRealtimeRank: work.realtime_rank,
      realtimeRank,
    });
  }

  const processed = index + 1;
  if (processed % 10 === 0 || processed === allWorks.length) {
    await onProgress?.(processed, allWorks.length, work.product_id);
  }
}

console.log("Ranking update completed.");
}
