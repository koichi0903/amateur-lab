// 発掘スコア Ver.3
// 「人気作品」ではなく「評価の信頼できる、まだ見つかりきっていない良作」を上げる。

type ScoreParams = {
  reviewAverage: number;
  reviewCount: number;

  maxDiscountRate: number;
  currentPrice?: number | null;
  lowestPrice?: number | null;
  hasSampleMovie?: boolean;
  sampleImageCount?: number;
  hasImage?: boolean;

  actressPoint: number;
  genrePoint: number;
  makerPoint: number;
  seriesPoint: number;

  realtimeRank?: number | null;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;

  longHitRank?: number | null;

  releaseDate: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function validPrice(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function getBestRank(...ranks: Array<number | null | undefined>) {
  const values = ranks.filter(
    (rank): rank is number => typeof rank === "number" && rank > 0 && rank < 9999,
  );
  return values.length ? Math.min(...values) : null;
}

function getBayesianRating(reviewAverage: number, reviewCount: number) {
  const priorRating = 4.05;
  const priorCount = 20;

  return ((reviewAverage * reviewCount) + (priorRating * priorCount)) /
    (reviewCount + priorCount);
}

function getHiddenPotential(rank: number | null, qualityTrustPoint: number) {
  let hiddenPoint = 10;

  if (rank) {
    const peakRank = 220;
    const distance = Math.abs(Math.log(rank) - Math.log(peakRank));
    hiddenPoint = clamp(25 - distance * 12, 3, 25);

    if (rank <= 30) hiddenPoint = Math.min(hiddenPoint, 8);
    else if (rank <= 80) hiddenPoint = Math.min(hiddenPoint, 16);
    else if (rank >= 1001) hiddenPoint = Math.min(hiddenPoint, 6);
  }

  if (qualityTrustPoint < 25) return Math.min(hiddenPoint, 12);
  if (qualityTrustPoint < 35) return Math.min(hiddenPoint, 18);

  return hiddenPoint;
}

function getLowestPricePoint(currentPrice: number | null, lowestPrice: number | null) {
  if (!currentPrice || !lowestPrice) return 2;

  const gap = (currentPrice - lowestPrice) / lowestPrice;
  if (currentPrice <= lowestPrice) return 8;
  if (gap <= 0.1) return 8 - (gap / 0.1) * 3;
  if (gap <= 0.3) return 5 - ((gap - 0.1) / 0.2) * 4;

  return 0;
}

function getNewReleasePoint(releaseDate: string | null) {
  if (!releaseDate) return 0;

  const release = new Date(releaseDate);
  const today = new Date();
  const daysFromRelease = Math.floor(
    (today.getTime() - release.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysFromRelease < 0) return 0;
  if (daysFromRelease <= 15) return 10;
  if (daysFromRelease <= 30) return 9;
  if (daysFromRelease <= 45) return 8;
  if (daysFromRelease <= 60) return 7;
  if (daysFromRelease <= 75) return 6;
  if (daysFromRelease <= 90) return 5;
  if (daysFromRelease <= 105) return 4;
  if (daysFromRelease <= 120) return 3;
  if (daysFromRelease <= 135) return 2;
  if (daysFromRelease <= 150) return 1;

  return 0;
}

function getLongHitPoint(rank?: number | null) {
  if (!rank) return 0;
  if (rank <= 50) return 10;
  if (rank <= 100) return 9;
  if (rank <= 150) return 8;
  if (rank <= 200) return 7;
  if (rank <= 300) return 6;
  if (rank <= 400) return 5;
  if (rank <= 500) return 4;
  if (rank <= 600) return 3;
  if (rank <= 700) return 2;
  if (rank <= 1000) return 1;

  return 0;
}

function applyTrustCaps({
  score,
  reviewCount,
  bayesianRating,
  rank,
}: {
  score: number;
  reviewCount: number;
  bayesianRating: number;
  rank: number | null;
}) {
  let cap = 100;

  if (reviewCount === 0) cap = Math.min(cap, 45);
  else if (reviewCount <= 4) cap = Math.min(cap, 60);
  else if (reviewCount <= 9) cap = Math.min(cap, 72);

  if (bayesianRating < 4) cap = Math.min(cap, 70);

  if (rank && rank <= 10) cap = Math.min(cap, 78);
  else if (rank && rank <= 30) cap = Math.min(cap, 82);

  return Math.min(score, cap);
}

export function calculateScore({
  reviewAverage,
  reviewCount,
  maxDiscountRate,
  currentPrice,
  lowestPrice,
  hasSampleMovie = false,
  sampleImageCount = 0,
  hasImage = false,
  actressPoint,
  genrePoint,
  makerPoint,
  seriesPoint,
  realtimeRank,
  dailyRank,
  weeklyRank,
    monthlyRank,
  longHitRank,
  releaseDate,
}: ScoreParams) {
  const safeReviewAverage = clamp(reviewAverage ?? 0, 0, 5);
  const safeReviewCount = Math.max(0, reviewCount ?? 0);
  const safeDiscountRate = clamp(maxDiscountRate ?? 0, 0, 95);
  const effectivePrice = validPrice(currentPrice);
  const effectiveLowestPrice = validPrice(lowestPrice);
  const bestRank = getBestRank(realtimeRank, dailyRank, weeklyRank, monthlyRank);
  const bayesianRating = getBayesianRating(safeReviewAverage, safeReviewCount);

  const reviewPoint = clamp((bayesianRating - 3.55) / 1.15, 0, 1) * 43;
  const reviewCountPoint =
    clamp(Math.log10(safeReviewCount + 1) / Math.log10(201), 0, 1) * 12;
  const qualityTrustPoint = reviewPoint + reviewCountPoint;

  const popularityPoint = getHiddenPotential(bestRank, qualityTrustPoint);

  const lowestPricePoint = getLowestPricePoint(effectivePrice, effectiveLowestPrice);
  const discountPoint =
    clamp(lowestPricePoint + (safeDiscountRate / 50) * 5, 0, 13) +
    (effectivePrice && effectivePrice <= 500 ? 2 : effectivePrice && effectivePrice <= 1000 ? 1 : 0);
  const cappedDiscountPoint = clamp(discountPoint, 0, 15);

  const enoughInfoCount = [
    actressPoint > 0,
    genrePoint > 0,
    makerPoint > 0,
    releaseDate,
    effectivePrice,
  ].filter(Boolean).length;
  const decisionSupportPoint =
    (hasSampleMovie ? 3 : 0) +
    (sampleImageCount > 0 || hasImage ? 1 : 0) +
    (enoughInfoCount >= 4 ? 1 : 0);

  const rawScore =
    qualityTrustPoint + popularityPoint + cappedDiscountPoint + decisionSupportPoint;
  const score = Math.round(
    applyTrustCaps({
      score: rawScore,
      reviewCount: safeReviewCount,
      bayesianRating,
      rank: bestRank,
    }),
  );

  return {
    score,
    actressPoint,
    genrePoint,
    reviewPoint,
    reviewCountPoint,
    discountPoint: cappedDiscountPoint,
    popularityPoint,
    makerPoint,
    seriesPoint,
    newReleaseBonus: getNewReleasePoint(releaseDate),
    longHitPoint: getLongHitPoint(longHitRank),
    decisionSupportPoint,
  };
}
