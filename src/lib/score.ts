// ======================
// 発掘スコア係数
// Ver1.0
// ======================

const SCORE = {
  // =========================
  // 最大点
  // =========================

  REVIEW_MAX: 15,
  REVIEW_COUNT_MAX: 5,
  DISCOUNT_MAX: 5,
  RANKING_MAX: 20,

  ACTRESS_MAX: 20,
  GENRE_MAX: 15,
  MAKER_MAX: 5,
  SERIES_MAX: 5,

  NEW_RELEASE_MAX: 20,
  NEW_RELEASE_30: 14,
  NEW_RELEASE_90: 8,
  NEW_RELEASE_180: 4,

  // ========= 基本評価 =========

  // レビュー評価
  REVIEW: 3,

  // レビュー件数
  REVIEW_COUNT_LIMIT: 20,
  REVIEW_COUNT_DIV: 4,

  // セール
  DISCOUNT_DIV: 5,

  // FANZAランキング
  RANKING_DIV: 50,

  // 人気ランキング
  ACTRESS_DIV: 700,
  GENRE_DIV: 50000,
  MAKER_DIV: 20000,
  SERIES_DIV: 1000,
};

type ScoreParams = {
  reviewAverage: number;
  reviewCount: number;
  discountRate: number;
  actressScore: number;
  genreScore: number;
  ranking: number | undefined;
  makerScore: number;
  seriesScore:number;
  releaseDate: string | null;
};

export function calculateScore({
  reviewAverage,
  reviewCount,
  discountRate,
  actressScore,
  genreScore,
  ranking,
  makerScore,
  seriesScore,
  releaseDate,
  
  
}: ScoreParams) {

const reviewPoint = Math.min(
  SCORE.REVIEW_MAX,
  reviewAverage * SCORE.REVIEW
);

const reviewCountPoint = Math.min(
  SCORE.REVIEW_COUNT_MAX,
  Math.min(
    reviewCount,
    SCORE.REVIEW_COUNT_LIMIT
  ) / SCORE.REVIEW_COUNT_DIV
);

const discountPoint = Math.min(
  SCORE.DISCOUNT_MAX,
  discountRate / SCORE.DISCOUNT_DIV
);

const actressPoint = Math.min(
  SCORE.ACTRESS_MAX,
  actressScore / SCORE.ACTRESS_DIV
);

const genrePoint = Math.min(
  SCORE.GENRE_MAX,
  genreScore / SCORE.GENRE_DIV
);

const makerPoint = Math.min(
  SCORE.MAKER_MAX,
  makerScore / SCORE.MAKER_DIV
);

const seriesPoint = Math.min(
  SCORE.SERIES_MAX,
  seriesScore / SCORE.SERIES_DIV
);

const rankingPoint =
  ranking
    ? Math.min(
        SCORE.RANKING_MAX,
        Math.max(
          0,
          (1000 - ranking) /
            SCORE.RANKING_DIV
        )
      )
    : 0;

let newReleaseBonus = 0;

if (releaseDate) {
  const release = new Date(releaseDate);
  const today = new Date();

  const daysFromRelease = Math.floor(
    (today.getTime() - release.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysFromRelease <= 7) {
  newReleaseBonus = SCORE.NEW_RELEASE_MAX;
} else if (daysFromRelease <= 30) {
  newReleaseBonus = SCORE.NEW_RELEASE_30;
} else if (daysFromRelease <= 90) {
  newReleaseBonus = SCORE.NEW_RELEASE_90;
} else if (daysFromRelease <= 180) {
  newReleaseBonus = SCORE.NEW_RELEASE_180;
}
}
  

  const rawScore =
  actressPoint +
  genrePoint +
  makerPoint +
  reviewPoint +
  reviewCountPoint +
  discountPoint +
  rankingPoint +
  seriesPoint;

// ======================
// ボーナス
// ======================

let bonus = 0;

bonus += newReleaseBonus;

if (reviewAverage >= 4.7 && reviewCount >= 100) {
  bonus += 5;
}

if (discountRate >= 50) {
  bonus += 3;
}

if (reviewAverage >= 4.5 && discountRate >= 50) {
  bonus += 2;
}

// 最終スコア
const score = Math.min(
  100,
  Math.round(rawScore + bonus)
);

return {
  score,
  actressPoint,
  genrePoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  rankingPoint,
  makerPoint,
  seriesPoint,
  newReleaseBonus,
};
}