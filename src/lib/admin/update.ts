import { supabase } from "../supabase";
import { calculateScore } from "../score";

import type { DmmItem } from "../../types/dmm";
import type { RankingItem } from "../../types/ranking";

export async function updateDmmItem(
  item: DmmItem
) {
  const { data: actressRanking } =
    await supabase
      .from("actress_rankings")
      .select("*");

  const { data: genreRanking } =
    await supabase
      .from("genre_rankings")
      .select("*");

  const { data: makerRanking } =
    await supabase
      .from("maker_rankings")
      .select("*");

  const { data: seriesRanking } =
    await supabase
      .from("series_rankings")
      .select("*");

  let actressScore = 0;
  let genreScore = 0;
  let makerScore = 0;
  let seriesScore = 0;

  const actresses =
    item.iteminfo?.actress?.map((a) => a.name) || [];

  const genres =
    item.iteminfo?.genre?.map((g) => g.name) || [];

  const makers =
    item.iteminfo?.maker?.map((m) => m.name) || [];

  const series =
    item.iteminfo?.series?.map((s) => s.name) || [];
      actresses.forEach((name: string) => {
    const found = actressRanking?.find(
      (a: RankingItem) => name.includes(a.name)
    );

    if (found) {
      actressScore = Math.max(
        actressScore,
        found.score
      );
    }
  });

  genres.forEach((name: string) => {
    const found = genreRanking?.find(
      (g: RankingItem) => g.name === name
    );

    if (found) {
      genreScore += found.score;
    }
  });

  makers.forEach((name: string) => {
    const found = makerRanking?.find(
      (m: RankingItem) => m.name === name
    );

    if (found) {
      makerScore += found.score;
    }
  });

  series.forEach((name: string) => {
    const found = seriesRanking?.find(
      (s: RankingItem) => s.name === name
    );

    if (found) {
      seriesScore += found.score;
    }
  });

  const reviewAverage =
    Number(item.review?.average || 0);

  const reviewCount =
    Number(item.review?.count || 0);

  const discountRate =
    parseInt(item.prices?.list_price || "0")
      ? Math.round(
          (
            1 -
            parseInt(item.prices?.price || "0") /
              parseInt(item.prices?.list_price || "1")
          ) * 100
        )
      : 0;

  /*
const {
  score,
  makerPoint,
  seriesPoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  rankingPoint,
  newReleaseBonus,
} = calculateScore({
  reviewAverage,
  reviewCount,
  discountRate,
  actressScore,
  genreScore,
  makerScore,
  seriesScore,
  ranking: item.rank,
  releaseDate: item.date,
});
*/

  const { error } = await supabase
    .from("works")
    .update({
  actress_score: actressScore,
  genre_score: genreScore,
  maker_score: makerScore,
  series_score: seriesScore,

  release_date: item.date || null,

  maker: item.iteminfo?.maker?.[0]?.name || "",

  series: item.iteminfo?.series?.[0]?.name || "",

  price:
    Number(
      item.prices?.list_price?.replace("~", "")
    ) || 0,

  sale_price:
    Number(
      item.prices?.price?.replace("~", "")
    ) || 0,

  review_count:
    item.review?.count || 0,

  review_average:
    Number(item.review?.average) || 0,

  discount_rate: discountRate,

  last_updated:
    new Date().toISOString(),
})
    .eq("product_id", item.content_id);

  if (error) {
    console.error(error);
  }
}
