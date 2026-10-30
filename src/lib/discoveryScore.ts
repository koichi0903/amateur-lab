import type { BuyTimingFunnelStats } from "@/lib/buyTiming";

const DAY_MS = 86_400_000;
const CTR_CAP = 18;
const MIN_RELIABLE_PAGE_VIEWS = 20;

export type DiscoveryScoreWork = {
  id: number;
  score?: number | null;
  price?: number | null;
  sale_price?: number | null;
  list_price?: number | null;
  discount_rate?: number | null;
  lowest_price?: number | null;
  review_average?: number | null;
  review_count?: number | null;
  ranking?: number | null;
  release_date?: string | null;
};

export type DiscoveryPriceHistoryItem = {
  normal_price: number | null;
  sale_price: number | null;
};

export type DiscoveryScoreResult = {
  score: number;
  label: string;
  currentPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
  lowestPrice: number | null;
  lowestPriceText: string;
  reasons: string[];
  hiddenRankBonus: number;
  reviewConfidence: number;
  funnelConfidence: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function validPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function effectiveHistoryPrice(item: DiscoveryPriceHistoryItem) {
  return validPrice(item.sale_price) ?? validPrice(item.normal_price);
}

function getRankingBand(ranking: number | null) {
  if (!ranking) return "unknown";
  if (ranking <= 30) return "too_popular";
  if (ranking <= 80) return "visible";
  if (ranking <= 600) return "hidden";
  if (ranking <= 1500) return "deep";
  return "too_deep";
}

function resolveDiscoveryPrice(work: DiscoveryScoreWork) {
  const salePrice = validPrice(work.sale_price);
  const basePrice = validPrice(work.price);
  const currentPrice = salePrice ?? basePrice;
  const regularPrice = validPrice(work.list_price)
    ?? (salePrice && basePrice && basePrice > salePrice ? basePrice : null);
  const calculatedDiscount = currentPrice && regularPrice && regularPrice > currentPrice
    ? Math.round((1 - currentPrice / regularPrice) * 100)
    : 0;
  const discountRate = clamp(Math.max(work.discount_rate ?? 0, calculatedDiscount), 0, 95);
  return { currentPrice, regularPrice, discountRate };
}

function getDiscoveryLowestPrice(
  work: DiscoveryScoreWork,
  priceHistory: DiscoveryPriceHistoryItem[],
  currentPrice: number | null,
) {
  const historyPrices = priceHistory.map(effectiveHistoryPrice).filter((price): price is number => price !== null);
  const lowestPrice = validPrice(work.lowest_price)
    ?? (historyPrices.length ? Math.min(...historyPrices) : null);
  const lowestGap = currentPrice && lowestPrice ? (currentPrice - lowestPrice) / lowestPrice : null;
  const lowestPriceText = !currentPrice || !lowestPrice
    ? "過去最安値データを蓄積中"
    : currentPrice <= lowestPrice
      ? "過去最安値と同額または更新"
      : lowestGap !== null && lowestGap <= 0.08
        ? "過去最安値にかなり近い価格"
        : `過去最安値より¥${Math.max(0, currentPrice - lowestPrice).toLocaleString("ja-JP")}高い`;
  return { lowestPrice, lowestGap, lowestPriceText };
}

function calculateDiscoveryPriceScore(
  discountRate: number,
  currentPrice: number | null,
  lowestPrice: number | null,
  lowestGap: number | null,
) {
  const lowestPriceSignal = currentPrice && lowestPrice
    ? currentPrice <= lowestPrice
      ? 7
      : lowestGap !== null && lowestGap <= 0.08
        ? 5
        : 1
    : 2;
  return clamp(discountRate * 0.22, 0, 13) + lowestPriceSignal;
}

function calculateReviewSignals(work: DiscoveryScoreWork) {
  const reviewAverage = clamp(work.review_average ?? 0, 0, 5);
  const reviewCount = Math.max(0, work.review_count ?? 0);
  const reviewConfidence = clamp(Math.log10(reviewCount + 1) / 2.15, 0, 1);
  const qualityScore = reviewAverage > 0
    ? clamp(((reviewAverage - 3.2) / 1.8) * 28, 0, 28) * reviewConfidence
      + clamp(reviewCount / 120, 0, 1) * 10
    : 0;
  return { reviewAverage, reviewCount, reviewConfidence, qualityScore };
}

function calculateRankingSignals(work: DiscoveryScoreWork, reviewCount: number) {
  const ranking = work.ranking && work.ranking > 0 && work.ranking < 9999 ? work.ranking : null;
  const rankingBand = getRankingBand(ranking);
  const hiddenRankBonus = rankingBand === "hidden"
    ? 18
    : rankingBand === "deep"
      ? 13
      : rankingBand === "visible"
        ? 7
        : rankingBand === "too_deep"
          ? 5
          : 8;
  const topRankPenalty = rankingBand === "too_popular" ? 12 : 0;
  const thinReviewPenalty = reviewCount < 8 ? 14 : reviewCount < 20 ? 7 : 0;
  return { ranking, hiddenRankBonus, topRankPenalty, thinReviewPenalty };
}

function calculateFreshnessScore(releaseDate?: string | null) {
  const releaseAgeDays = releaseDate ? (Date.now() - new Date(releaseDate).getTime()) / DAY_MS : null;
  const score = releaseAgeDays !== null && Number.isFinite(releaseAgeDays)
    ? releaseAgeDays <= 60
      ? 2
      : releaseAgeDays >= 180
        ? 5
        : 3
    : 3;
  return { releaseAgeDays, score };
}

function buildDiscoveryReasons(input: {
  work: DiscoveryScoreWork;
  ranking: number | null;
  reviewAverage: number;
  reviewCount: number;
  buyTimingScore: number;
  discountRate: number;
  currentPrice: number | null;
  lowestPrice: number | null;
  funnel: BuyTimingFunnelStats;
}) {
  return [
    input.ranking && input.ranking > 80 ? `ランキング${input.ranking}位で上位定番に埋もれている` : null,
    input.reviewAverage >= 4.2 && input.reviewCount >= 20
      ? `評価${input.reviewAverage.toFixed(2)}・レビュー${input.reviewCount}件で品質指標が強い`
      : null,
    (input.work.score ?? 0) >= 80 ? `既存発掘スコア${Math.round(input.work.score ?? 0)}の有力作` : null,
    input.buyTimingScore >= 75 ? `買い時スコア${input.buyTimingScore}で価格条件も強い` : null,
    input.discountRate >= 30 ? `${input.discountRate}%OFFで割安感がある` : null,
    input.currentPrice && input.lowestPrice && input.currentPrice <= input.lowestPrice
      ? "過去最安値クラスまで下がっている"
      : null,
    input.funnel.pageViews >= MIN_RELIABLE_PAGE_VIEWS && input.funnel.adjustedCtr >= 5
      ? `直近30日の補正CTRが${input.funnel.adjustedCtr}%`
      : null,
  ].filter((reason): reason is string => Boolean(reason));
}

export function calculateDiscoveryScore({
  work,
  priceHistory,
  buyTimingScore,
  funnel,
}: {
  work: DiscoveryScoreWork;
  priceHistory: DiscoveryPriceHistoryItem[];
  buyTimingScore: number;
  funnel: BuyTimingFunnelStats;
}): DiscoveryScoreResult {
  const price = resolveDiscoveryPrice(work);
  const lowest = getDiscoveryLowestPrice(work, priceHistory, price.currentPrice);
  const review = calculateReviewSignals(work);
  const ranking = calculateRankingSignals(work, review.reviewCount);
  const discoveryBaseScore = clamp((work.score ?? 0) / 100, 0, 1) * 14;
  const buyTimingPart = clamp(buyTimingScore / 100, 0, 1) * 16;
  const priceScore = calculateDiscoveryPriceScore(
    price.discountRate,
    price.currentPrice,
    lowest.lowestPrice,
    lowest.lowestGap,
  );
  const funnelConfidence = clamp(funnel.pageViews / MIN_RELIABLE_PAGE_VIEWS, 0, 1);
  const funnelScore =
    clamp(funnel.adjustedCtr / CTR_CAP, 0, 1) * 8 * funnelConfidence +
    clamp(funnel.fanzaClicks / 6, 0, 1) * 4;
  const freshness = calculateFreshnessScore(work.release_date);

  const score = Math.round(
    clamp(
      review.qualityScore +
        ranking.hiddenRankBonus +
        discoveryBaseScore +
        buyTimingPart +
        priceScore +
        funnelScore +
        freshness.score -
        ranking.topRankPenalty -
        ranking.thinReviewPenalty,
      0,
      100,
    ),
  );

  const reasonCandidates = buildDiscoveryReasons({
    work,
    ranking: ranking.ranking,
    reviewAverage: review.reviewAverage,
    reviewCount: review.reviewCount,
    buyTimingScore,
    discountRate: price.discountRate,
    currentPrice: price.currentPrice,
    lowestPrice: lowest.lowestPrice,
    funnel,
  });
  const reasons = [...new Set(reasonCandidates)].slice(0, 4);
  if (reasons.length < 2 && ranking.ranking) reasons.push(`ランキング${ranking.ranking}位で再評価余地あり`);
  if (reasons.length < 2 && review.reviewCount >= 8) reasons.push(`レビュー${review.reviewCount}件で最低限の判断材料あり`);

  return {
    score,
    label: score >= 82 ? "本日の最有力発掘" : score >= 68 ? "発掘候補" : "比較候補",
    currentPrice: price.currentPrice,
    regularPrice: price.regularPrice,
    discountRate: price.discountRate,
    lowestPrice: lowest.lowestPrice,
    lowestPriceText: lowest.lowestPriceText,
    reasons: reasons.slice(0, 4),
    hiddenRankBonus: ranking.hiddenRankBonus,
    reviewConfidence: Math.round(review.reviewConfidence * 100) / 100,
    funnelConfidence: Math.round(funnelConfidence * 100) / 100,
  };
}
