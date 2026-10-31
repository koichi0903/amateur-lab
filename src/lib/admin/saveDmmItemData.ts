import { IGNORE_GENRES } from "../genre.ts";
import { calculateScore } from "../score.ts";
import {
  getActressPoint,
  getBestStoredRank,
  getGenrePoint,
  getMakerPoint,
  getSeriesPoint,
} from "../score/entityRanking.ts";
import { formatDmmActresses } from "../dmm/actresses.ts";
import type { DmmItem } from "../../types/dmm";
import type { ActressRankingItem, RankingItem } from "../../types/ranking";

export type DmmItemRankingData = {
  actressRanking: ActressRankingItem[];
  genreRanking: RankingItem[];
  makerRanking: RankingItem[];
  seriesRanking: ActressRankingItem[];
};

export type DmmItemEntityScores = {
  actressScore: number;
  genreScore: number;
  makerScore: number;
  seriesScore: number;
};

export type DmmItemScore = ReturnType<typeof calculateScore>;

export function getDmmItemSampleImages(item: DmmItem) {
  return item.sampleImageURL?.sample_l?.image ?? [];
}

function actressScoreFor(item: DmmItem, rankings: ActressRankingItem[]) {
  let score = 0;
  for (const actress of item.iteminfo?.actress ?? []) {
    const found = rankings.find((ranked) => actress.name.includes(ranked.name));
    if (!found) continue;
    const rank = getBestStoredRank(found.original_rank, found.fanza_rank);
    score = Math.max(score, getActressPoint(rank));
  }
  return score;
}

function genreScoreFor(item: DmmItem, rankings: RankingItem[]) {
  let score = 0;
  for (const genre of item.iteminfo?.genre ?? []) {
    const found = rankings.find((ranked) => ranked.name === genre.name);
    if (found) score = Math.max(score, getGenrePoint(found.rank ?? null));
  }
  return score;
}

function makerScoreFor(item: DmmItem, rankings: RankingItem[]) {
  let score = 0;
  for (const maker of item.iteminfo?.maker ?? []) {
    const found = rankings.find((ranked) => ranked.name === maker.name);
    if (found) score = Math.max(score, getMakerPoint(found.rank ?? null));
  }
  return score;
}

function seriesScoreFor(item: DmmItem, rankings: ActressRankingItem[]) {
  let score = 0;
  for (const series of item.iteminfo?.series ?? []) {
    const found = rankings.find((ranked) => ranked.name === series.name);
    if (!found) continue;
    const rank = getBestStoredRank(found.original_rank, found.fanza_rank);
    score = Math.max(score, getSeriesPoint(rank));
  }
  return score;
}

export function scoreDmmItemEntities(item: DmmItem, rankings: DmmItemRankingData): DmmItemEntityScores {
  return {
    actressScore: actressScoreFor(item, rankings.actressRanking),
    genreScore: genreScoreFor(item, rankings.genreRanking),
    makerScore: makerScoreFor(item, rankings.makerRanking),
    seriesScore: seriesScoreFor(item, rankings.seriesRanking),
  };
}

export function getDmmItemDiscountRate(item: DmmItem) {
  return item.prices?.list_price
    ? Math.round((1 - Number(item.prices.price) / Number(item.prices.list_price)) * 100)
    : 0;
}

export function scoreDmmItem(
  item: DmmItem,
  entityScores: DmmItemEntityScores,
  sampleImageCount: number,
): DmmItemScore {
  const currentPrice = Number(item.prices?.price || 0);
  return calculateScore({
    reviewAverage: Number(item.review?.average || 0),
    reviewCount: Number(item.review?.count || 0),
    maxDiscountRate: getDmmItemDiscountRate(item),
    currentPrice,
    lowestPrice: currentPrice,
    hasImage: Boolean(item.imageURL?.large || item.imageURL?.list),
    sampleImageCount,
    actressPoint: entityScores.actressScore,
    genrePoint: entityScores.genreScore,
    makerPoint: entityScores.makerScore,
    seriesPoint: entityScores.seriesScore,
    realtimeRank: item.rank,
    releaseDate: item.date,
  });
}

function createDmmItemGenreFields(item: DmmItem, score: number) {
  const genres = item.iteminfo?.genre?.filter((genre) => !IGNORE_GENRES.includes(genre.name));
  const genreLabel = genres?.slice(0, 5).map((genre) => genre.name).join(" / ") || "未分類";
  const memoActresses = item.iteminfo?.actress?.map((actress) => actress.name).slice(0, 3).join("・") || "人気女優";
  const memoGenres = genres?.slice(0, 4).map((genre) => genre.name).join("・") || "人気ジャンル";
  return {
    genre: genreLabel,
    memo: `${memoActresses}出演作品。\n\n${memoGenres}を楽しめる作品。\n\n発掘スコア${score}の注目作品。`,
  };
}

function createDmmItemIdentityFields(item: DmmItem) {
  return {
    ...createDmmItemMediaIdentityFields(item),
    ...createDmmItemLinkIdentityFields(item),
    ...createDmmItemCatalogIdentityFields(item),
    ...createDmmItemEntityIdentityFields(item),
  };
}

function createDmmItemMediaIdentityFields(item: DmmItem) {
  return {
    actress: formatDmmActresses(item) ?? "",
    image_url: item.imageURL?.large || item.imageURL?.list || "",
  };
}

function createDmmItemLinkIdentityFields(item: DmmItem) {
  return {
    affiliate_url: item.affiliateURL || "",
    url: item.URL || "",
  };
}

function createDmmItemCatalogIdentityFields(item: DmmItem) {
  return {
    title: item.title,
    product_id: item.content_id || "",
    release_date: item.date || null,
  };
}

function createDmmItemEntityIdentityFields(item: DmmItem) {
  return {
    maker: item.iteminfo?.maker?.[0]?.name || "",
    series: item.iteminfo?.series?.[0]?.name || "",
  };
}

function createDmmItemDisplayFields(item: DmmItem, result: DmmItemScore) {
  return {
    ...createDmmItemGenreFields(item, result.score),
    ...createDmmItemIdentityFields(item),
  };
}

function createDmmItemScoreFields(entityScores: DmmItemEntityScores, result: DmmItemScore) {
  return {
    score: result.score,
    actress_score: entityScores.actressScore,
    genre_score: entityScores.genreScore,
    maker_score: entityScores.makerScore,
    series_score: entityScores.seriesScore,
    actress_point: entityScores.actressScore,
    genre_point: entityScores.genreScore,
    maker_point: entityScores.makerScore,
    series_point: entityScores.seriesScore,
    review_score: Math.round(result.reviewPoint),
    review_count_score: Math.round(result.reviewCountPoint),
    discount_score: Math.round(result.discountPoint),
    ranking_score: Math.round(result.popularityPoint),
    new_release_score: result.newReleaseBonus,
  };
}

function createDmmItemPriceFields(item: DmmItem) {
  return {
    price: parseInt(item.prices?.list_price || "0"),
    sale_price: parseInt(item.prices?.price || "0"),
    list_price: parseInt(item.prices?.list_price || "0"),
    discount_rate: getDmmItemDiscountRate(item),
  };
}

function createDmmItemReviewFields(item: DmmItem) {
  return {
    review_count: item.review?.count || 0,
    review_average: item.review?.average || 0,
  };
}

export function createDmmItemInsertRecord(
  item: DmmItem,
  stage: string,
  entityScores: DmmItemEntityScores,
  result: DmmItemScore,
) {
  return {
    ...createDmmItemDisplayFields(item, result),
    ...createDmmItemScoreFields(entityScores, result),
    ...createDmmItemPriceFields(item),
    ...createDmmItemReviewFields(item),
    playwright_status: "PENDING",
    stage,
  };
}
