// ======================
// 発掘スコア係数
// Ver1.0
// ======================

const SCORE = {
  // ======================
  // 基本スコア（100点）
  // ======================

  REVIEW_MAX: 25,
  POPULARITY_MAX: 25,

  ACTRESS_MAX: 20,
  MAKER_MAX: 10,
  GENRE_MAX: 10,
  SERIES_MAX: 10,

  // ======================
// ボーナス（20点）
// ======================

NEW_RELEASE_MAX: 10,
LONG_HIT_MAX: 10,

  // ======================
  // 計算係数
  // ======================

  REVIEW: 3,

  REVIEW_COUNT_LIMIT: 20,
  REVIEW_COUNT_DIV: 4,

  DISCOUNT_DIV: 5,

} as const;

// ======================
// 人気度ポイント（Ver.2）
// ======================

function getRealtimePoint(rank?: number | null): number {
  if (!rank) return 0;

  if (rank <= 10) return 25;
  if (rank <= 20) return 24;
  if (rank <= 30) return 23;
  if (rank <= 40) return 22;
  if (rank <= 50) return 21;
  if (rank <= 60) return 20;
  if (rank <= 70) return 19;
  if (rank <= 80) return 18;
  if (rank <= 90) return 17;
  if (rank <= 100) return 16;

  return 0;
}

function getDailyPoint(rank?: number | null): number {
  if (!rank) return 0;

  if (rank === 1) return 25;
  if (rank === 2) return 24;
  if (rank === 3) return 23;
  if (rank === 4) return 22;
  if (rank === 5) return 21;
  if (rank === 6) return 20;
  if (rank === 7) return 19;
  if (rank === 8) return 18;
  if (rank === 9) return 17;
  if (rank === 10) return 16;
  if (rank <= 12) return 15;
  if (rank <= 14) return 14;
  if (rank <= 16) return 13;
  if (rank <= 18) return 12;
  if (rank <= 20) return 11;

  return 0;
}

function getWeeklyMonthlyPoint(rank?: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 25;
  if (rank <= 10) return 24;
  if (rank <= 15) return 23;
  if (rank <= 20) return 22;
  if (rank <= 25) return 21;
  if (rank <= 30) return 20;
  if (rank <= 35) return 19;
  if (rank <= 40) return 18;
  if (rank <= 45) return 17;
  if (rank <= 50) return 16;
  if (rank <= 55) return 15;
  if (rank <= 60) return 14;
  if (rank <= 65) return 13;
  if (rank <= 70) return 12;
  if (rank <= 75) return 11;
  if (rank <= 80) return 10;
  if (rank <= 85) return 9;
  if (rank <= 90) return 8;
  if (rank <= 95) return 7;
  if (rank <= 100) return 6;

  return 0;
}

function getLongHitPoint(rank?: number | null): number {
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

function getActressPoint(rank?: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 20;
  if (rank <= 10) return 19;
  if (rank <= 15) return 18;
  if (rank <= 20) return 17;
  if (rank <= 25) return 16;
  if (rank <= 30) return 15;
  if (rank <= 35) return 14;
  if (rank <= 40) return 13;
  if (rank <= 45) return 12;
  if (rank <= 50) return 11;
  if (rank <= 60) return 10;
  if (rank <= 70) return 8;
  if (rank <= 80) return 6;
  if (rank <= 90) return 4;
  if (rank <= 100) return 2;

  return 0;
}

function getMakerPoint(rank?: number | null): number {
  if (!rank) return 0;

  if (rank <= 5) return 10;
  if (rank <= 10) return 9;
  if (rank <= 15) return 8;
  if (rank <= 20) return 7;
  if (rank <= 25) return 6;
  if (rank <= 30) return 5;
  if (rank <= 35) return 4;
  if (rank <= 40) return 3;
  if (rank <= 45) return 2;
  if (rank <= 50) return 1;

  return 0;
}

type ScoreParams = {
  reviewAverage: number;
  reviewCount: number;

  // スコア用（全プラン中の最大割引率）
  maxDiscountRate: number;

  // updateScore.tsで順位→ポイントへ変換済み
actressPoint: number;
  genrePoint: number;
  // updateScore.tsで順位→ポイントへ変換済み
makerPoint: number;
  seriesPoint: number;

  // 発掘LAB Ver.2 人気度ランキング
  realtimeRank?: number | null;
  dailyRank?: number | null;
  weeklyRank?: number | null;
  monthlyRank?: number | null;

  longHitRank?: number | null;

  releaseDate: string | null;
};

export function calculateScore({
  reviewAverage,
  reviewCount,
  maxDiscountRate,
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
}: ScoreParams)
{

  reviewAverage = reviewAverage ?? 0;
reviewCount = reviewCount ?? 0;
maxDiscountRate = maxDiscountRate ?? 0;
const finalActressPoint = actressPoint ?? 0;
const finalGenrePoint = genrePoint ?? 0;
const finalMakerPoint = makerPoint ?? 0;
const finalSeriesPoint = seriesPoint ?? 0;

let reviewPoint = 0;

if (reviewAverage >= 5.0) reviewPoint = 15;
else if (reviewAverage >= 4.9) reviewPoint = 14;
else if (reviewAverage >= 4.8) reviewPoint = 13;
else if (reviewAverage >= 4.7) reviewPoint = 12;
else if (reviewAverage >= 4.6) reviewPoint = 11;
else if (reviewAverage >= 4.5) reviewPoint = 10;
else if (reviewAverage >= 4.4) reviewPoint = 9;
else if (reviewAverage >= 4.3) reviewPoint = 8;
else if (reviewAverage >= 4.2) reviewPoint = 7;
else if (reviewAverage >= 4.1) reviewPoint = 6;
else if (reviewAverage >= 4.0) reviewPoint = 5;
else if (reviewAverage >= 3.9) reviewPoint = 4;
else if (reviewAverage >= 3.8) reviewPoint = 3;
else if (reviewAverage >= 3.5) reviewPoint = 2;
else if (reviewAverage >= 3.0) reviewPoint = 1;

let reviewCountPoint = 0;

if (reviewCount >= 80) reviewCountPoint = 10;
else if (reviewCount >= 61) reviewCountPoint = 9;
else if (reviewCount >= 51) reviewCountPoint = 8;
else if (reviewCount >= 31) reviewCountPoint = 7;
else if (reviewCount >= 21) reviewCountPoint = 6;
else if (reviewCount >= 11) reviewCountPoint = 5;
else if (reviewCount >= 6) reviewCountPoint = 4;
else if (reviewCount >= 4) reviewCountPoint = 3;
else if (reviewCount >= 2) reviewCountPoint = 2;
else if (reviewCount >= 1) reviewCountPoint = 1;

let discountPoint = 0;

if (maxDiscountRate >= 50) discountPoint = 10;
else if (maxDiscountRate >= 40) discountPoint = 8;
else if (maxDiscountRate >= 30) discountPoint = 6;
else if (maxDiscountRate >= 20) discountPoint = 4;
else if (maxDiscountRate >= 10) discountPoint = 2;
else if (maxDiscountRate > 0) discountPoint = 1;


const calculatedGenrePoint = finalGenrePoint;

const calculatedMakerPoint = finalMakerPoint;

const calculatedSeriesPoint = finalSeriesPoint;

const popularityPoint = Math.min(
  SCORE.POPULARITY_MAX,
  Math.max(
    getRealtimePoint(realtimeRank),
    getDailyPoint(dailyRank),
    getWeeklyMonthlyPoint(weeklyRank),
    getWeeklyMonthlyPoint(monthlyRank)
  )
);

const longHitPoint = getLongHitPoint(longHitRank);

let newReleaseBonus = 0;

if (releaseDate) {
  const release = new Date(releaseDate);
  const today = new Date();

  const daysFromRelease = Math.floor(
    (today.getTime() - release.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysFromRelease <= 15) {
    newReleaseBonus = 10;
  } else if (daysFromRelease <= 30) {
    newReleaseBonus = 9;
  } else if (daysFromRelease <= 45) {
    newReleaseBonus = 8;
  } else if (daysFromRelease <= 60) {
    newReleaseBonus = 7;
  } else if (daysFromRelease <= 75) {
    newReleaseBonus = 6;
  } else if (daysFromRelease <= 90) {
    newReleaseBonus = 5;
  } else if (daysFromRelease <= 105) {
    newReleaseBonus = 4;
  } else if (daysFromRelease <= 120) {
    newReleaseBonus = 3;
  } else if (daysFromRelease <= 135) {
    newReleaseBonus = 2;
  } else if (daysFromRelease <= 150) {
    newReleaseBonus = 1;
  } else {
    newReleaseBonus = 0;
  }
}
  

  const rawScore =
  finalActressPoint +
  calculatedGenrePoint +
  calculatedMakerPoint +
  calculatedSeriesPoint +
  reviewPoint +
  reviewCountPoint +
  discountPoint +
  popularityPoint;

// ======================
// ボーナス
// ======================

let bonus = 0;

bonus += newReleaseBonus;
bonus += longHitPoint;



// 最終スコア
const score = Math.min(
  100,
  Math.round(rawScore + bonus)
);

return {
  score,
  actressPoint,
  genrePoint: calculatedGenrePoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  popularityPoint,
  makerPoint: calculatedMakerPoint,
  seriesPoint: calculatedSeriesPoint,

  newReleaseBonus,
  longHitPoint,
};
}