import { calculateScore } from "@/lib/score";
import { updateStatistics } from "@/lib/statistics/updateStatistics";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  beginJob,
  failJob,
  finishJob,
  JOBS,
  updateJobProgress,
} from "@/lib/jobs";

type ScoreUpdateWork = {
  id: number;
  product_id: string;
  actress: string | null;
  genre: string | null;
  maker: string | null;
  series: string | null;
  review_average: number | null;
  review_count: number | null;
  discount_rate: number | null;
  release_date: string | null;
  realtime_rank: number | null;
  daily_rank: number | null;
  weekly_rank: number | null;
  monthly_rank: number | null;
  long_hit_rank: number | null;
};

const SELECT_COLUMNS = `
  id,
  product_id,
  actress,
  genre,
  maker,
  series,
  review_average,
  review_count,
  discount_rate,
  release_date,
  realtime_rank,
  daily_rank,
  weekly_rank,
  monthly_rank,
  long_hit_rank
`;
const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 500;

function getActressPoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 5) return 20;
  if (rank <= 10) return 19;
  if (rank <= 15) return 18;
  if (rank <= 20) return 17;
  if (rank <= 25) return 16;
  if (rank <= 30) return 15;
  if (rank <= 35) return 14;
  if (rank <= 40) return 13;
  if (rank <= 45) return 12;
  if (rank <= 50) return 11;
  if (rank <= 60) return 10;
  if (rank <= 70) return 8;
  if (rank <= 80) return 6;
  if (rank <= 90) return 4;
  if (rank <= 100) return 2;
  return 0;
}

function getMakerPoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 5) return 10;
  if (rank <= 10) return 9;
  if (rank <= 15) return 8;
  if (rank <= 20) return 7;
  if (rank <= 25) return 6;
  if (rank <= 30) return 5;
  if (rank <= 35) return 4;
  if (rank <= 40) return 3;
  if (rank <= 45) return 2;
  if (rank <= 50) return 1;
  return 0;
}

function getGenrePoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 3) return 10;
  if (rank <= 6) return 9;
  if (rank <= 9) return 8;
  if (rank <= 12) return 7;
  if (rank <= 15) return 6;
  if (rank <= 18) return 5;
  if (rank <= 21) return 4;
  if (rank <= 24) return 3;
  if (rank <= 27) return 2;
  if (rank <= 30) return 1;
  return 0;
}

function getSeriesPoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 3) return 10;
  if (rank <= 8) return 9;
  if (rank <= 13) return 8;
  if (rank <= 18) return 7;
  if (rank <= 23) return 6;
  if (rank <= 28) return 5;
  if (rank <= 33) return 4;
  if (rank <= 38) return 3;
  if (rank <= 44) return 2;
  if (rank <= 50) return 1;
  return 0;
}

function splitNames(value: string | null): string[] {
  return value
    ?.split("/")
    .map((name) => name.trim())
    .filter(Boolean) ?? [];
}

function bestPoint(
  names: string[],
  rankMap: Map<string, number | null>,
  toPoint: (rank: number | null) => number,
) {
  return names.reduce(
    (best, name) => Math.max(best, toPoint(rankMap.get(name) ?? null)),
    0,
  );
}

async function loadWorks(productIds?: string[]) {
  const works: ScoreUpdateWork[] = [];
  if (productIds?.length) {
    for (let index = 0; index < productIds.length; index += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("works")
        .select(SELECT_COLUMNS)
        .in("product_id", productIds.slice(index, index + PAGE_SIZE));
      if (error) throw error;
      works.push(...((data ?? []) as ScoreUpdateWork[]));
    }
    return works;
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("works")
      .select(SELECT_COLUMNS)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    works.push(...((data ?? []) as ScoreUpdateWork[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return works;
}

async function loadEntityRankMaps() {
  const [actresses, genres, makers, series] = await Promise.all([
    supabase.from("actress_rankings").select("name,original_rank,fanza_rank"),
    supabase.from("genre_rankings").select("name,rank"),
    supabase.from("maker_rankings").select("name,rank"),
    supabase.from("series_rankings").select("name,original_rank,fanza_rank"),
  ]);

  for (const result of [actresses, genres, makers, series]) {
    if (result.error) throw result.error;
  }

  const bestStoredRank = (first: number | null, second: number | null) => {
    const ranks = [first, second].filter((rank): rank is number => rank != null);
    return ranks.length ? Math.min(...ranks) : null;
  };

  return {
    actressRanks: new Map<string, number | null>(
      (actresses.data ?? []).map((row) => [
        row.name,
        bestStoredRank(row.original_rank, row.fanza_rank),
      ]),
    ),
    genreRanks: new Map<string, number | null>(
      (genres.data ?? []).map((row) => [row.name, row.rank]),
    ),
    makerRanks: new Map<string, number | null>(
      (makers.data ?? []).map((row) => [row.name, row.rank]),
    ),
    seriesRanks: new Map<string, number | null>(
      (series.data ?? []).map((row) => [
        row.name,
        bestStoredRank(row.original_rank, row.fanza_rank),
      ]),
    ),
  };
}

export async function updateScore(productIds?: string[]) {
  await beginJob(JOBS.SCORE, 1);

  try {
    await updateJobProgress(JOBS.SCORE, {
      processedCount: 0,
      totalCount: 1,
      detail: { phase: "score_prepare", current: 0, total: 1 },
    });

    const works = await loadWorks(productIds);
    const total = works.length;
    const rankMaps = await loadEntityRankMaps();

    await updateJobProgress(JOBS.SCORE, {
      processedCount: 0,
      totalCount: total,
      detail: {
        phase: "score_calculate",
        current: 0,
        total,
      },
    });

    let completed = 0;
    let updates: Array<Record<string, number>> = [];
    const targets = works;

    for (let index = 0; index < targets.length; index += 1) {
      const work = targets[index];
      const actressPoint = bestPoint(
        splitNames(work.actress),
        rankMaps.actressRanks,
        getActressPoint,
      );
      const genrePoint = bestPoint(
        splitNames(work.genre),
        rankMaps.genreRanks,
        getGenrePoint,
      );
      const makerPoint = bestPoint(
        splitNames(work.maker),
        rankMaps.makerRanks,
        getMakerPoint,
      );
      const seriesPoint = bestPoint(
        splitNames(work.series),
        rankMaps.seriesRanks,
        getSeriesPoint,
      );

      const result = calculateScore({
        reviewAverage: work.review_average ?? 0,
        reviewCount: work.review_count ?? 0,
        maxDiscountRate: work.discount_rate ?? 0,
        actressPoint,
        genrePoint,
        makerPoint,
        seriesPoint,
        realtimeRank: work.realtime_rank,
        dailyRank: work.daily_rank,
        weeklyRank: work.weekly_rank,
        monthlyRank: work.monthly_rank,
        longHitRank: work.long_hit_rank,
        releaseDate: work.release_date,
      });

      updates.push({
        id: work.id,
        actress_score: actressPoint,
        genre_score: genrePoint,
        maker_score: makerPoint,
        series_score: seriesPoint,
        score: result.score,
        review_score: Math.round(result.reviewPoint),
        review_count_score: Math.round(result.reviewCountPoint),
        discount_score: Math.round(result.discountPoint),
        ranking_score: Math.round(result.popularityPoint),
        new_release_score: result.newReleaseBonus,
        long_hit_point: result.longHitPoint,
        actress_point: Math.round(result.actressPoint),
        genre_point: Math.round(result.genrePoint),
        maker_point: Math.round(result.makerPoint),
        series_point: Math.round(result.seriesPoint),
      });

      if (updates.length === UPDATE_BATCH_SIZE || index === targets.length - 1) {
        const batchSize = updates.length;
        const { error } = await supabase.from("works").upsert(updates);
        if (error) throw error;

        completed += batchSize;
        await updateJobProgress(JOBS.SCORE, {
          processedCount: completed,
          totalCount: total,
          detail: {
            phase: "score_calculate",
            current: completed,
            total,
            productId: work.product_id,
          },
        });
        console.log(`[score] ${completed}/${total}`);
        updates = [];
      }
    }

    await updateJobProgress(JOBS.SCORE, {
      processedCount: total,
      totalCount: total,
      detail: { phase: "score_statistics", current: 1, total: 1 },
    });
    await updateStatistics();
    await finishJob(JOBS.SCORE);

    return { success: true, count: total, updates: total };
  } catch (error) {
    await failJob(
      JOBS.SCORE,
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}
