import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unstable_cache } from "next/cache";

const DAY_MS = 86_400_000;
const MIN_RELIABLE_PAGE_VIEWS = 20;
const CTR_CAP = 18;
const PRIOR_PAGE_VIEWS = 12;
const PRIOR_CTR = 4;

export type BuyTimingPriceHistoryItem = {
  changed_at?: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

export type BuyTimingWork = {
  id: number;
  score?: number | null;
  price?: number | null;
  sale_price?: number | null;
  list_price?: number | null;
  discount_rate?: number | null;
  is_on_sale?: boolean | null;
  sale_end_at?: string | null;
  lowest_price?: number | null;
  review_average?: number | null;
  review_count?: number | null;
  ranking?: number | null;
  release_date?: string | null;
};

export type BuyTimingFunnelStats = {
  pageViews: number;
  fanzaClicks: number;
  rawCtr: number;
  adjustedCtr: number;
  confidence: number;
};

export type BuyTimingResult = {
  score: number;
  label: string;
  labelTone: "strong" | "good" | "watch";
  currentPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
  reviewAverage: number | null;
  reviewCount: number;
  lowestPrice: number | null;
  historyDays: number | null;
  lowestPriceComparison: "lowest" | "near_lowest" | "above_lowest" | "unknown";
  lowestPriceText: string;
  reasons: string[];
  funnel: BuyTimingFunnelStats;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function validPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function getEffectivePrice(item: BuyTimingPriceHistoryItem) {
  return validPrice(item.sale_price) ?? validPrice(item.normal_price);
}

export function calculateAdjustedCtr(pageViews: number, fanzaClicks: number) {
  const safeViews = Math.max(0, pageViews);
  const safeClicks = Math.max(0, fanzaClicks);
  const rawCtr = safeViews > 0 ? (safeClicks / safeViews) * 100 : 0;
  const smoothedCtr =
    ((safeClicks + (PRIOR_PAGE_VIEWS * PRIOR_CTR) / 100) /
      (safeViews + PRIOR_PAGE_VIEWS)) *
    100;
  const confidence = clamp(safeViews / MIN_RELIABLE_PAGE_VIEWS, 0, 1);
  const adjustedCtr = clamp(smoothedCtr * confidence, 0, CTR_CAP);

  return {
    rawCtr: Math.round(rawCtr * 10) / 10,
    adjustedCtr: Math.round(adjustedCtr * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
  };
}

const getCachedBuyTimingFunnelStats = unstable_cache(
  async (workId: number, days: number) => {
    const cutoff = new Date(Date.now() - Math.max(1, days) * DAY_MS).toISOString();
    const [viewResult, clickResult] = await Promise.all([
      supabaseAdmin
        .from("work_page_views")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId)
        .gte("viewed_at", cutoff),
      supabaseAdmin
        .from("affiliate_clicks")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId)
        .gte("clicked_at", cutoff),
    ]);

    const pageViews = viewResult.error ? 0 : viewResult.count ?? 0;
    const fanzaClicks = clickResult.error ? 0 : clickResult.count ?? 0;
    const ctr = calculateAdjustedCtr(pageViews, fanzaClicks);

    return {
      pageViews,
      fanzaClicks,
      ...ctr,
    };
  },
  ["buy-timing-funnel-v1"],
  { revalidate: 300 },
);

export function getBuyTimingFunnelStats(workId: number, days = 30) {
  return getCachedBuyTimingFunnelStats(workId, Math.max(1, days));
}

type CurrentPriceState = {
  currentPrice: number | null;
  regularPrice: number | null;
  discountRate: number;
};

function hasSaleEvidence(work: BuyTimingWork) {
  const saleActive = !work.sale_end_at || Date.parse(work.sale_end_at) > Date.now();
  return saleActive && (
    work.is_on_sale || validPrice(work.sale_price) !== null || validPrice(work.discount_rate) !== null
  );
}

function resolveRegularPrice(hasSale: boolean, work: BuyTimingWork, salePrice: number | null, basePrice: number | null) {
  if (!hasSale) return null;
  const listPrice = validPrice(work.list_price);
  if (listPrice !== null) return listPrice;
  return salePrice && basePrice && basePrice > salePrice ? basePrice : null;
}

function calculateActiveDiscount(
  hasSale: boolean,
  currentPrice: number | null,
  regularPrice: number | null,
  salePrice: number | null,
) {
  if (!hasSale || !salePrice || !currentPrice || !regularPrice || regularPrice <= currentPrice) return 0;
  return Math.round((1 - currentPrice / regularPrice) * 100);
}

function resolveCurrentPrice(work: BuyTimingWork): CurrentPriceState {
  const hasSale = hasSaleEvidence(work);
  const salePrice = hasSale ? validPrice(work.sale_price) : null;
  const basePrice = validPrice(work.price);
  const currentPrice = salePrice ?? basePrice;
  const regularPrice = resolveRegularPrice(hasSale, work, salePrice, basePrice);
  const calculatedDiscount = calculateActiveDiscount(hasSale, currentPrice, regularPrice, salePrice);

  return {
    currentPrice,
    regularPrice,
    discountRate: clamp(hasSale ? Math.max(work.discount_rate ?? 0, calculatedDiscount) : 0, 0, 95),
  };
}

function summarizePriceHistory(
  work: BuyTimingWork,
  priceHistory: BuyTimingPriceHistoryItem[],
): { historyDays: number | null; lowestPrice: number | null } {
  const historyPrices = priceHistory.map(getEffectivePrice).filter((price): price is number => price !== null);
  const historyTimes = priceHistory
    .map((item) => item.changed_at ? Date.parse(item.changed_at) : Number.NaN)
    .filter((time): time is number => Number.isFinite(time));
  const historyDays = historyTimes.length
    ? Math.max(0, Math.floor((Date.now() - Math.min(...historyTimes)) / DAY_MS))
    : null;

  return {
    historyDays,
    lowestPrice: validPrice(work.lowest_price) ?? (historyPrices.length ? Math.min(...historyPrices) : null),
  };
}

function compareLowestPrice(
  currentPrice: number | null,
  lowestPrice: number | null,
): { comparison: BuyTimingResult["lowestPriceComparison"]; gap: number | null } {
  const gap = currentPrice && lowestPrice ? (currentPrice - lowestPrice) / lowestPrice : null;
  const comparison = !currentPrice || !lowestPrice
    ? "unknown"
    : currentPrice <= lowestPrice
      ? "lowest"
      : gap !== null && gap <= 0.08
        ? "near_lowest"
        : "above_lowest";

  return { comparison, gap };
}

function calculatePriceScore(
  discountRate: number,
  comparison: BuyTimingResult["lowestPriceComparison"],
  lowestGap: number | null,
) {
  const lowestPriceScore = comparison === "lowest"
    ? 16
    : comparison === "near_lowest"
      ? 11
      : comparison === "above_lowest" && lowestGap !== null
        ? clamp(8 - lowestGap * 20, 0, 8)
        : 4;
  return clamp(discountRate * 0.42, 0, 30) + lowestPriceScore;
}

function calculateReviewScore(work: BuyTimingWork) {
  const reviewAverage = clamp(work.review_average ?? 0, 0, 5);
  const reviewCount = Math.max(0, work.review_count ?? 0);
  const reviewConfidence = clamp(Math.log10(reviewCount + 1) / 2.3, 0, 1);
  const score = reviewAverage > 0
    ? clamp(((reviewAverage - 3) / 2) * 12, 0, 12) * reviewConfidence + clamp(reviewCount / 80, 0, 1) * 6
    : 2;
  return { reviewAverage, reviewCount, score };
}

function calculateRankingScore(work: BuyTimingWork) {
  const ranking = work.ranking && work.ranking > 0 && work.ranking < 9999 ? work.ranking : null;
  return { ranking, score: ranking ? clamp(12 - (ranking - 1) * 0.45, 0, 12) : 4 };
}

function calculateFreshnessScore(releaseDate?: string | null) {
  const releaseAgeDays = releaseDate ? (Date.now() - new Date(releaseDate).getTime()) / DAY_MS : null;
  const score = releaseAgeDays !== null && Number.isFinite(releaseAgeDays)
    ? releaseAgeDays <= 30
      ? 6
      : releaseAgeDays <= 180
        ? 4
        : 2
    : 2;
  return { releaseAgeDays, score };
}

function getLabelTone(score: number): BuyTimingResult["labelTone"] {
  return score >= 82 ? "strong" : score >= 68 ? "good" : "watch";
}

function getLabel(labelTone: BuyTimingResult["labelTone"]) {
  return labelTone === "strong"
    ? "今買う価値が高い"
    : labelTone === "good"
      ? "条件が合えば買い"
      : "もう少し比較したい";
}

function getLowestPriceText(
  comparison: BuyTimingResult["lowestPriceComparison"],
  currentPrice: number | null,
  lowestPrice: number | null,
) {
  return comparison === "lowest"
    ? "過去最安値と同額または更新"
    : comparison === "near_lowest"
      ? "過去最安値にかなり近い価格"
      : comparison === "above_lowest" && lowestPrice
        ? `過去最安値より¥${Math.max(0, (currentPrice ?? 0) - lowestPrice).toLocaleString("ja-JP")}高い`
        : "過去最安値データを蓄積中";
}

function buildPriceReasons(discountRate: number, comparison: BuyTimingResult["lowestPriceComparison"]) {
  return [
    discountRate >= 45 ? `${discountRate}%OFFで割引幅が大きい` : null,
    comparison === "lowest" ? "過去最安値クラスの価格" : null,
    comparison === "near_lowest" ? "過去最安値に近い水準" : null,
  ];
}

function buildEvidenceReasons(
  work: BuyTimingWork,
  reviewAverage: number,
  reviewCount: number,
  ranking: number | null,
  funnel: BuyTimingFunnelStats,
  releaseAgeDays: number | null,
) {
  return [
    reviewAverage >= 4.2 && reviewCount >= 20
      ? `レビュー${reviewAverage.toFixed(2)}・${reviewCount}件で評価が安定`
      : null,
    ranking && ranking <= 20 ? `ランキング${ranking}位で注目度が高い` : null,
    (work.score ?? 0) >= 80 ? `発掘スコア${Math.round(work.score ?? 0)}の有力候補` : null,
    funnel.pageViews >= MIN_RELIABLE_PAGE_VIEWS && funnel.adjustedCtr >= 6
      ? `直近30日のFANZA CTRが${funnel.adjustedCtr}%`
      : null,
    releaseAgeDays !== null && releaseAgeDays <= 30 ? "発売から日が浅い新作" : null,
  ];
}

function buildReasonCandidates(input: {
  work: BuyTimingWork;
  discountRate: number;
  lowestPriceComparison: BuyTimingResult["lowestPriceComparison"];
  reviewAverage: number;
  reviewCount: number;
  ranking: number | null;
  funnel: BuyTimingFunnelStats;
  releaseAgeDays: number | null;
}) {
  return [
    ...buildPriceReasons(input.discountRate, input.lowestPriceComparison),
    ...buildEvidenceReasons(input.work, input.reviewAverage, input.reviewCount, input.ranking, input.funnel, input.releaseAgeDays),
  ].filter((reason): reason is string => Boolean(reason));
}

export function calculateBuyTimingScore({
  work,
  priceHistory,
  funnel,
}: {
  work: BuyTimingWork;
  priceHistory: BuyTimingPriceHistoryItem[];
  funnel: BuyTimingFunnelStats;
}): BuyTimingResult {
  const price = resolveCurrentPrice(work);
  const history = summarizePriceHistory(work, priceHistory);
  const lowestPrice = compareLowestPrice(price.currentPrice, history.lowestPrice);
  const review = calculateReviewScore(work);
  const ranking = calculateRankingScore(work);
  const freshness = calculateFreshnessScore(work.release_date);
  const discoveryScore = clamp((work.score ?? 0) / 100, 0, 1) * 12;
  const ctrScore = clamp(funnel.adjustedCtr / CTR_CAP, 0, 1) * 14;

  const score = Math.round(
    clamp(
      calculatePriceScore(price.discountRate, lowestPrice.comparison, lowestPrice.gap)
        + review.score + ranking.score + freshness.score + discoveryScore + ctrScore,
      0,
      100,
    ),
  );

  const labelTone = getLabelTone(score);
  const reasonCandidates = buildReasonCandidates({
    work,
    discountRate: price.discountRate,
    lowestPriceComparison: lowestPrice.comparison,
    reviewAverage: review.reviewAverage,
    reviewCount: review.reviewCount,
    ranking: ranking.ranking,
    funnel,
    releaseAgeDays: freshness.releaseAgeDays,
  });
  const reasons = [...new Set(reasonCandidates)].slice(0, 4);
  if (reasons.length < 2 && price.discountRate > 0) reasons.push(`${price.discountRate}%OFFで通常価格より安い`);
  if (reasons.length < 2 && price.currentPrice) reasons.push("価格・レビューを確認して判断しやすい");

  return {
    score,
    label: getLabel(labelTone),
    labelTone,
    currentPrice: price.currentPrice,
    regularPrice: price.regularPrice,
    discountRate: price.discountRate,
    reviewAverage: work.review_average ?? null,
    reviewCount: review.reviewCount,
    lowestPrice: history.lowestPrice,
    historyDays: history.historyDays,
    lowestPriceComparison: lowestPrice.comparison,
    lowestPriceText: getLowestPriceText(lowestPrice.comparison, price.currentPrice, history.lowestPrice),
    reasons: reasons.slice(0, 4),
    funnel,
  };
}
