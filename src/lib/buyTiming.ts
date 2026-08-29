import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 86_400_000;
const MIN_RELIABLE_PAGE_VIEWS = 20;
const CTR_CAP = 18;
const PRIOR_PAGE_VIEWS = 12;
const PRIOR_CTR = 4;

export type BuyTimingPriceHistoryItem = {
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
  lowestPrice: number | null;
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

export async function getBuyTimingFunnelStats(workId: number, days = 30) {
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
  const salePrice = validPrice(work.sale_price);
  const basePrice = validPrice(work.price);
  const currentPrice = salePrice ?? basePrice;
  const regularPrice =
    validPrice(work.list_price) ??
    (salePrice && basePrice && basePrice > salePrice ? basePrice : null);
  const calculatedDiscount =
    currentPrice && regularPrice && regularPrice > currentPrice
      ? Math.round((1 - currentPrice / regularPrice) * 100)
      : 0;
  const discountRate = clamp(
    Math.max(work.discount_rate ?? 0, calculatedDiscount),
    0,
    95,
  );
  const historyPrices = priceHistory
    .map(getEffectivePrice)
    .filter((price): price is number => price !== null);
  const lowestPrice =
    validPrice(work.lowest_price) ??
    (historyPrices.length ? Math.min(...historyPrices) : null);
  const lowestGap =
    currentPrice && lowestPrice ? (currentPrice - lowestPrice) / lowestPrice : null;
  const lowestPriceComparison =
    !currentPrice || !lowestPrice
      ? "unknown"
      : currentPrice <= lowestPrice
        ? "lowest"
        : lowestGap !== null && lowestGap <= 0.08
          ? "near_lowest"
          : "above_lowest";

  const priceScore =
    clamp(discountRate * 0.42, 0, 30) +
    (lowestPriceComparison === "lowest"
      ? 16
      : lowestPriceComparison === "near_lowest"
        ? 11
        : lowestPriceComparison === "above_lowest" && lowestGap !== null
          ? clamp(8 - lowestGap * 20, 0, 8)
          : 4);
  const reviewAverage = clamp(work.review_average ?? 0, 0, 5);
  const reviewCount = Math.max(0, work.review_count ?? 0);
  const reviewConfidence = clamp(Math.log10(reviewCount + 1) / 2.3, 0, 1);
  const reviewScore = reviewAverage > 0
    ? clamp(((reviewAverage - 3) / 2) * 12, 0, 12) * reviewConfidence +
      clamp(reviewCount / 80, 0, 1) * 6
    : 2;
  const ranking = work.ranking && work.ranking > 0 && work.ranking < 9999
    ? work.ranking
    : null;
  const rankingScore = ranking ? clamp(12 - (ranking - 1) * 0.45, 0, 12) : 4;
  const releaseAgeDays = work.release_date
    ? (Date.now() - new Date(work.release_date).getTime()) / DAY_MS
    : null;
  const freshnessScore =
    releaseAgeDays !== null && Number.isFinite(releaseAgeDays)
      ? releaseAgeDays <= 30
        ? 6
        : releaseAgeDays <= 180
          ? 4
          : 2
      : 2;
  const discoveryScore = clamp((work.score ?? 0) / 100, 0, 1) * 12;
  const ctrScore = clamp(funnel.adjustedCtr / CTR_CAP, 0, 1) * 14;

  const score = Math.round(
    clamp(
      priceScore + reviewScore + rankingScore + freshnessScore + discoveryScore + ctrScore,
      0,
      100,
    ),
  );

  const labelTone = score >= 82 ? "strong" : score >= 68 ? "good" : "watch";
  const label =
    labelTone === "strong"
      ? "今買う価値が高い"
      : labelTone === "good"
        ? "条件が合えば買い"
        : "もう少し比較したい";
  const lowestPriceText =
    lowestPriceComparison === "lowest"
      ? "過去最安値と同額または更新"
      : lowestPriceComparison === "near_lowest"
        ? "過去最安値にかなり近い価格"
        : lowestPriceComparison === "above_lowest" && lowestPrice
          ? `過去最安値より¥${Math.max(0, (currentPrice ?? 0) - lowestPrice).toLocaleString("ja-JP")}高い`
          : "過去最安値データを蓄積中";

  const reasonCandidates = [
    discountRate >= 45 ? `${discountRate}%OFFで割引幅が大きい` : null,
    lowestPriceComparison === "lowest" ? "過去最安値クラスの価格" : null,
    lowestPriceComparison === "near_lowest" ? "過去最安値に近い水準" : null,
    reviewAverage >= 4.2 && reviewCount >= 20
      ? `レビュー${reviewAverage.toFixed(2)}・${reviewCount}件で評価が安定`
      : null,
    ranking && ranking <= 20 ? `ランキング${ranking}位で注目度が高い` : null,
    (work.score ?? 0) >= 80 ? `発掘スコア${Math.round(work.score ?? 0)}の有力候補` : null,
    funnel.pageViews >= MIN_RELIABLE_PAGE_VIEWS && funnel.adjustedCtr >= 6
      ? `直近30日のFANZA CTRが${funnel.adjustedCtr}%`
      : null,
    releaseAgeDays !== null && releaseAgeDays <= 30 ? "発売から日が浅い新作" : null,
  ].filter((reason): reason is string => Boolean(reason));

  const reasons = [...new Set(reasonCandidates)].slice(0, 4);
  if (reasons.length < 2 && discountRate > 0) reasons.push(`${discountRate}%OFFで通常価格より安い`);
  if (reasons.length < 2 && currentPrice) reasons.push("価格・レビューを確認して判断しやすい");

  return {
    score,
    label,
    labelTone,
    currentPrice,
    regularPrice,
    discountRate,
    lowestPrice,
    lowestPriceComparison,
    lowestPriceText,
    reasons: reasons.slice(0, 4),
    funnel,
  };
}
