import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { RANKING_UPDATE_CONFIG } from "@/config/update";
import { getRealtimeRanking } from "./getRealtimeRanking";
import { getDailyRanking } from "./getDailyRanking";
import { getWeeklyRanking } from "./getWeeklyRanking";
import { getMonthlyRanking } from "./getMonthlyRanking";
import { generateAndSaveTrendingInsight } from "@/lib/insights/generateAndSaveTrending";
import type { RankingProduct } from "./getRankingProducts";
import { buildRankingUpdate } from "./rankingCoverage";
import {
  buildRankingMaps,
  buildRankingResetRequest,
  changedStaleRankingProductIds,
  type RankingMaps,
  type RankingProductValue,
} from "./rankingUpdateProjection";

type PopularityRankingProgress = (
  processed: number,
  total: number,
  productId: string,
) => Promise<void>;

type RankingSources = {
  realtime: RankingProductValue[];
  daily: RankingProductValue[];
  weekly: RankingProductValue[];
  monthly: RankingProductValue[];
  realtimeComplete: boolean;
};

type RankingWorkRow = {
  id: number;
  product_id: string;
  title: string;
  realtime_rank: number | null;
  daily_rank: number | null;
  weekly_rank: number | null;
  monthly_rank: number | null;
};

async function fetchRankingSources(prefetchedRealtime?: RankingProduct[]): Promise<RankingSources> {
  const realtime = prefetchedRealtime ?? await getRealtimeRanking();
  const realtimeComplete = realtime.length >= RANKING_UPDATE_CONFIG.popularRankingTargetCount;
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
    if (items.length === 0) throw new Error(`${label}ランキングの取得結果が0件です`);
  }
  console.log(
    `Ranking fetched: realtime=${realtime.length}, daily=${daily.length}, weekly=${weekly.length}, monthly=${monthly.length}`,
  );
  return { realtime, daily, weekly, monthly, realtimeComplete };
}

async function loadRankingWorks(targetProductIds: string[]): Promise<RankingWorkRow[]> {
  const allWorks: RankingWorkRow[] = [];
  for (let index = 0; index < targetProductIds.length; index += 1000) {
    const { data, error } = await supabase
      .from("works")
      .select("id,product_id,title,realtime_rank,daily_rank,weekly_rank,monthly_rank")
      .in("product_id", targetProductIds.slice(index, index + 1000));
    if (error) throw error;
    if (data) allWorks.push(...data);
  }
  return allWorks;
}

async function resetStaleRankingRows(maps: RankingMaps, realtimeComplete: boolean) {
  const changedProductIds = new Set<string>();
  const { values, filter } = buildRankingResetRequest(realtimeComplete);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id,realtime_rank,daily_rank,weekly_rank,monthly_rank")
      .or(filter)
      .range(from, from + 999);
    if (error) throw error;
    for (const productId of changedStaleRankingProductIds(data ?? [], maps, realtimeComplete)) {
      changedProductIds.add(productId);
    }
    if (!data || data.length < 1000) break;
  }

  const { error } = await supabase.from("works").update(values).or(filter);
  if (error) throw error;
  return changedProductIds;
}

async function saveRankingUpdates(
  allWorks: RankingWorkRow[],
  maps: RankingMaps,
  realtimeComplete: boolean,
  onProgress: PopularityRankingProgress | undefined,
  changedProductIds: Set<string>,
) {
  for (let index = 0; index < allWorks.length; index += 100) {
    const batch = allWorks.slice(index, index + 100);
    const updates = batch.map((work) => {
      const realtimeRank = maps.realtimeMap.get(work.product_id);
      const rankingUpdate = buildRankingUpdate({
        existingRealtimeRank: work.realtime_rank,
        realtimeRank,
        dailyRank: maps.dailyMap.get(work.product_id),
        weeklyRank: maps.weeklyMap.get(work.product_id),
        monthlyRank: maps.monthlyMap.get(work.product_id),
        realtimeComplete,
      });
      if (
        rankingUpdate.realtime_rank !== work.realtime_rank
        || rankingUpdate.daily_rank !== work.daily_rank
        || rankingUpdate.weekly_rank !== work.weekly_rank
        || rankingUpdate.monthly_rank !== work.monthly_rank
      ) changedProductIds.add(work.product_id);
      return { id: work.id, ...rankingUpdate };
    });

    const { error } = await supabase.from("works").upsert(updates);
    if (error) throw error;

    for (const work of batch) {
      const realtimeRank = maps.realtimeMap.get(work.product_id);
      if (realtimeRank != null) {
        await generateAndSaveTrendingInsight({
          workId: work.id,
          title: work.title,
          previousRealtimeRank: work.realtime_rank,
          realtimeRank,
        });
      }
    }

    const processed = Math.min(index + batch.length, allWorks.length);
    if (processed % 10 === 0 || processed === allWorks.length) {
      await onProgress?.(processed, allWorks.length, batch[batch.length - 1].product_id);
    }
  }
}

export async function updateRanking(
  onProgress?: PopularityRankingProgress,
  prefetchedRealtime?: RankingProduct[],
) {
  const changedProductIds = new Set<string>();
  const sources = await fetchRankingSources(prefetchedRealtime);
  const maps = buildRankingMaps(sources);
  const allWorks = await loadRankingWorks(maps.targetProductIds);
  const staleChangedProductIds = await resetStaleRankingRows(maps, sources.realtimeComplete);
  for (const productId of staleChangedProductIds) changedProductIds.add(productId);
  await saveRankingUpdates(allWorks, maps, sources.realtimeComplete, onProgress, changedProductIds);

  console.log("Ranking update completed.");
  return [...changedProductIds];
}
