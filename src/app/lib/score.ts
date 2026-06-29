type ScoreParams = {
  reviewAverage: number;
  reviewCount: number;
  discountRate: number;
  actressScore: number;
  genreScore: number;
  ranking: number;
  releaseDate: string | null;
};

export function calculateScore({
  reviewAverage,
  reviewCount,
  discountRate,
  actressScore,
  genreScore,
  ranking,
  releaseDate,
  
}: ScoreParams) {

  const reviewPoint = reviewAverage * 5;

  const reviewCountPoint =
    Math.min(reviewCount, 50) / 5;

  const discountPoint =
  discountRate / 2;

  const actressPoint =
  actressScore / 20;

  const genrePoint =
  genreScore / 500;

  const rankingPoint =
  ranking
    ? Math.max(0, (1000 - ranking) / 40)
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
    newReleaseBonus = 20;
  } else if (daysFromRelease <= 30) {
    newReleaseBonus = 12;
  } else if (daysFromRelease <= 90) {
    newReleaseBonus = 6;
  } else if (daysFromRelease <= 180) {
    newReleaseBonus = 3;
  }
}

  const score = Math.min(
  100,
  Math.round(
    actressPoint +
      genrePoint +
      reviewPoint +
      reviewCountPoint +
      discountPoint +
      rankingPoint +
      newReleaseBonus
  )
);

return {
  score,
  actressPoint,
  genrePoint,
  reviewPoint,
  reviewCountPoint,
  discountPoint,
  rankingPoint,
  newReleaseBonus,
};
}