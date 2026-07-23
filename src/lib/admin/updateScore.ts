import { createClient } from "@supabase/supabase-js";
import { calculateScore } from "@/lib/score";
import { updateStatistics } from "@/lib/statistics/updateStatistics";
import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

type ScoreUpdateWork = {
  id: number;
  review_average: number | null;
  review_count: number | null;
  discount_rate: number | null;
  ranking: number | null;
  actress_score: number | null;
  genre_score: number | null;
  maker_score: number | null;
  series_score: number | null;
  release_date: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateScore() {
  try {

    const works: ScoreUpdateWork[] = [];

  let from = 0;
  const limit = 1000;

  while (true) {
    const { data } = await supabase
      .from("works")
      .select(`
        id,
        review_average,
        review_count,
        discount_rate,
        ranking,
        actress_score,
        genre_score,
        maker_score,
        series_score,
        release_date
      `)
      .range(from, from + limit - 1);

    if (!data || data.length === 0) {
      break;
    }

    works.push(...data);

    if (data.length < limit) {
      break;
    }

    from += limit;
  }

  console.log("score更新対象:", works.length);

  const job = await beginJob(
  JOBS.SCORE,
  works.length
);

let processed =
  job.processed_count ?? 0;

  const workUpdates = [];

  for (const work of works) {
    const result = calculateScore({
      reviewAverage: work.review_average || 0,
      reviewCount: work.review_count || 0,
      discountRate: work.discount_rate || 0,

      actressScore: work.actress_score || 0,
      genreScore: work.genre_score || 0,
      makerScore: work.maker_score || 0,
      seriesScore: work.series_score || 0,

      ranking: work.ranking ?? undefined,

      releaseDate: work.release_date,
    });

    workUpdates.push({
      id: work.id,

      score: result.score,

      review_score: Math.round(result.reviewPoint),

      review_count_score: Math.round(
        result.reviewCountPoint
      ),

      discount_score: Math.round(
        result.discountPoint
      ),

      ranking_score: Math.round(
        result.rankingPoint
      ),

      new_release_score:
        result.newReleaseBonus,

      actress_point: Math.round(
        result.actressPoint
      ),

      genre_point: Math.round(
        result.genrePoint
      ),

      maker_point: Math.round(
        result.makerPoint
      ),

      series_point: Math.round(
        result.seriesPoint
      ),
    });
        processed++;

    if (
      processed % 50 === 0 ||
      processed === works.length
    ) {
      await updateJob(
        JOBS.SCORE,
        processed,
        String(work.id)
      );
    }
  }

  await supabase
    .from("works")
    .upsert(workUpdates);

  console.log("スコア更新完了");

  await updateStatistics();

  console.log("統計更新完了");

await finishJob(JOBS.SCORE);

return {
  count: works.length,
  updates: workUpdates.length,
};

} catch (error) {
  await failJob(
    JOBS.SCORE,
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

  throw error;
}
}