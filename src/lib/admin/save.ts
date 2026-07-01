import { supabase } from "../supabase";
import { IGNORE_GENRES } from "../genre";
import { calculateScore } from "../score";

import type { DmmItem } from "../../types/dmm";
import type { RankingItem } from "../../types/ranking";

export async function saveDmmItem(
  item: DmmItem
) {

const { data: actressRanking } =
  await supabase
    .from("actress_rankings")
    .select("*");

const actressList =
  (actressRanking ?? []) as RankingItem[];

const { data: genreRanking } =
  await supabase
    .from("genre_rankings")
    .select("*");

const genreList =
  (genreRanking ?? []) as RankingItem[];

const {
  data: makerRanking,
} = await supabase
  .from("maker_rankings")
  .select("*");

const makerList =
  (makerRanking ?? []) as RankingItem[];

const { data: seriesRanking } =
  await supabase
    .from("series_rankings")
    .select("*");

const seriesList =
  (seriesRanking ?? []) as RankingItem[];

let actressScore = 0;
let genreScore = 0;
let makerScore = 0;
let seriesScore = 0;

const actresses =
  item.iteminfo?.actress?.map(
    (a) => a.name
  ) || [];

const genres =
  item.iteminfo?.genre?.map(
    (g) => g.name
  ) || [];

const makers =
  item.iteminfo?.maker?.map(
    (m) => m.name
  ) || [];

const series =
  item.iteminfo?.series?.map(
    (s) => s.name
  ) || [];

actresses.forEach((name: string) => {
  const found =
  actressList.find(
    (a: RankingItem) =>
      name.includes(a.name)
  );

  if (found) {
    actressScore = Math.max(
      actressScore,
      found.score
    );
  }
});

genres.forEach((name: string) => {
  const found =
  genreList.find(
    (g: RankingItem) =>
      g.name === name
  );

  if (found) {
    genreScore += found.score;
  }
});

makers.forEach((name: string) => {
  const found =
  makerList.find(
    (m: RankingItem) => m.name === name
  );

  if (found) {
    makerScore += found.score;
  }
});

series.forEach((name:string)=>{
  const found =
  seriesList.find(
    (s: RankingItem) => s.name === name
  );

  if(found){
    seriesScore += found.score;
  }
});

const reviewAverage =
  Number(item.review?.average || 0);

const reviewCount =
  Number(item.review?.count || 0);

const discountRate =
  item.prices?.list_price
    ? Math.round(
        (
          1 -
          Number(item.prices.price) /
          Number(item.prices.list_price)
        ) * 100
      )
    : 0;

const {
  score,
  actressPoint,
  genrePoint,
  makerPoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  rankingPoint,
  seriesPoint,
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

  const { data: existing } = await supabase
  .from("works")
  .select("id")
  .eq("product_id", item.content_id)
  .maybeSingle();

if (existing) {
  return;
}

  const { error } = await supabase
    .from("works")
    .insert([
      {
        title: item.title,
        actress:
  item.iteminfo?.actress
    ?.slice(0, 10)
    .map((a) => a.name)
    .join(" / ") || "",
        
        genre:
  item.iteminfo?.genre
    ?.filter(
  (g) =>
    !IGNORE_GENRES.includes(g.name)
)
    .slice(0, 5)
    .map((g) => g.name)
    .join(" / ") || "未分類",
        score,

actress_score: actressScore,
genre_score: genreScore,
maker_score: makerScore,
series_score: seriesScore,

review_score: Math.round(reviewPoint),

review_count_score: Math.round(reviewCountPoint),

discount_score: Math.round(discountPoint),

ranking_score: Math.round(rankingPoint),

new_release_score: newReleaseBonus,
        
        memo:
`${item.iteminfo?.actress
  ?.map((a) => a.name)
  .slice(0, 3)
  .join("・") || "人気女優"}出演作品。

${item.iteminfo?.genre
  ?.filter(
  (g) =>
    !IGNORE_GENRES.includes(g.name)
)
  .slice(0, 4)
  .map((g) => g.name)
  .join("・") || "人気ジャンル"}を楽しめる作品。

発掘スコア${score}の注目作品。`,

        image_url:
          item.imageURL?.large ||
          item.imageURL?.list ||

          "",

        affiliate_url:
          item.affiliateURL || "",

          url:
  item.URL || "",
  
    product_id:
  item.content_id || "",

  release_date:
  item.date || null,

maker:
  item.iteminfo?.maker?.[0]?.name || "",

series:
  item.iteminfo?.series?.[0]?.name || "",

  price:
  parseInt(item.prices?.list_price || "0"),

sale_price:
  parseInt(item.prices?.price || "0"),

  review_count:
  item.review?.count || 0,

review_average:
  item.review?.average || 0,

  discount_rate:
  item.prices?.list_price
    ? Math.round(
        (
          1 -
          Number(item.prices.price) /
          Number(item.prices.list_price)
        ) * 100
      )
    : 0,
      },
    ]);
    
  if (error) {
    alert("登録失敗");
    console.log(error);
    return;
  }
}