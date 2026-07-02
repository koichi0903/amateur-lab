import { createClient } from "@supabase/supabase-js";
import { calculateScore } from "@/lib/score";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {

  const works: any[] = [];

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

    ranking: work.ranking,

    releaseDate: work.release_date,
  });

  if (work.ranking <= 5) {
  console.log({
    ranking: work.ranking,
    rankingPoint: result.rankingPoint,
    discountPoint: result.discountPoint,
    newReleaseBonus: result.newReleaseBonus,
  });
}

  workUpdates.push({
    id: work.id,

    score: result.score,

    review_score: Math.round(result.reviewPoint),

    review_count_score:
      Math.round(result.reviewCountPoint),

    discount_score:
      Math.round(result.discountPoint),

    ranking_score:
      Math.round(result.rankingPoint),

    new_release_score:
      result.newReleaseBonus,

    actress_point: Math.round(result.actressPoint),

genre_point: Math.round(result.genrePoint),

maker_point: Math.round(result.makerPoint),

series_point: Math.round(result.seriesPoint),
  });
}

console.log("更新件数:", workUpdates.length);

  const { error } = await supabase
  .from("works")
  .upsert(workUpdates);

console.log(error);

console.log("スコア更新完了");

  return Response.json({
  count: works.length,
  updates: workUpdates.length,
  message: "スコア更新完了",
});

}