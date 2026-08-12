import { supabaseAdmin as supabase } from "../supabaseAdmin";
import { IGNORE_GENRES } from "../genre";
import { calculateScore } from "../score";

import type { DmmItem } from "../../types/dmm";
import { formatDmmActresses } from "../dmm/actresses";
import type {
  RankingItem,
  ActressRankingItem,
} from "../../types/ranking";

export async function saveDmmItem(
  item: DmmItem,
  rankingData?: {
    actressRanking: ActressRankingItem[];
    genreRanking: RankingItem[];
    makerRanking: RankingItem[];
    seriesRanking: ActressRankingItem[];
  },
  stage: string = "NEW"
) {

  console.log(
    "sampleImageURL =",
    JSON.stringify(item.sampleImageURL, null, 2)
  );

  const sampleImages =
    item.sampleImageURL?.sample_l?.image ?? [];

  let actressList: ActressRankingItem[];
  let genreList: RankingItem[];
  let makerList: RankingItem[];
  let seriesList: ActressRankingItem[];


if (rankingData) {
  actressList = rankingData.actressRanking;
  genreList = rankingData.genreRanking;
  makerList = rankingData.makerRanking;
  seriesList = rankingData.seriesRanking;
} else {
  const { data: actressRanking } =
    await supabase
      .from("actress_rankings")
      .select("name,original_rank,fanza_rank");

  const { data: genreRanking } =
    await supabase
      .from("genre_rankings")
      .select("name,rank,score");

  const { data: makerRanking } =
    await supabase
      .from("maker_rankings")
      .select("name,rank,score");

  const { data: seriesRanking } =
    await supabase
      .from("series_rankings")
      .select("name,original_rank,fanza_rank");

  actressList =
  (actressRanking ?? []) as ActressRankingItem[];

  genreList =
    (genreRanking ?? []) as RankingItem[];

  makerList =
    (makerRanking ?? []) as RankingItem[];

  seriesList =
  (seriesRanking ?? []) as ActressRankingItem[];
}

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
    (a: ActressRankingItem) =>
      name.includes(a.name)
  );

if (found?.original_rank != null) {
  actressScore = Math.max(
    actressScore,
    found.original_rank
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
    if (found.rank != null) {
  makerScore = Math.max(
    makerScore,
    found.rank
  );
}
  }
});

series.forEach((name: string) => {
  const found =
    seriesList.find(
      (s: ActressRankingItem) => s.name === name
    );

  if (!found) return;

  const ranks = [
    found.original_rank,
    found.fanza_rank,
  ].filter(
    (rank): rank is number => rank != null
  );

  if (ranks.length === 0) return;

  const bestRank = Math.min(...ranks);

  seriesScore = Math.max(
    seriesScore,
    bestRank
  );
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
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  popularityPoint,
  newReleaseBonus,
} = calculateScore({
  reviewAverage,
  reviewCount,
  maxDiscountRate: discountRate,

  actressPoint: actressScore,
  genrePoint: genreScore,
  makerPoint: makerScore,
  seriesPoint: seriesScore,

  realtimeRank: item.rank,
  releaseDate: item.date,
});

  const { data: existing } = await supabase
  .from("works")
  .select("id")
  .eq("product_id", item.content_id)
  .maybeSingle();

if (existing) {
  return false;
}

  const { error } = await supabase
    .from("works")
    .insert([
      {
        title: item.title,
        actress: formatDmmActresses(item) ?? "",
        
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

ranking_score: Math.round(popularityPoint),

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

list_price:
  parseInt(item.prices?.list_price || "0"),

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

playwright_status: "PENDING",

stage,

      },
    ]);
    
  if (error) {
  console.error(
    "INSERT ERROR",
    item.content_id,
    error
  );

  return false;
}

// サンプル画像保存
if (sampleImages.length > 0) {
  await supabase
    .from("work_sample_images")
    .delete()
    .eq("product_id", item.content_id);

  await supabase
    .from("work_sample_images")
    .insert(
      sampleImages.map((url, index) => ({
        product_id: item.content_id,
        image_url: url,
        sort_order: index + 1,
      }))
    );
}

console.log(
  "INSERT OK",
  item.content_id
);

return true;
}
