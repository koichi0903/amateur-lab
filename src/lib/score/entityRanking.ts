export function getBestStoredRank(
  first: number | null | undefined,
  second: number | null | undefined,
): number | null {
  const ranks = [first, second].filter(
    (rank): rank is number => rank != null && rank > 0,
  );

  return ranks.length ? Math.min(...ranks) : null;
}

export function getActressPoint(rank: number | null): number {
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

export function getMakerPoint(rank: number | null): number {
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

export function getGenrePoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 3) return 10;
  if (rank <= 6) return 9;
  if (rank <= 9) return 8;
  if (rank <= 12) return 7;
  if (rank <= 15) return 6;
  if (rank <= 18) return 5;
  if (rank <= 21) return 4;
  if (rank <= 24) return 3;
  if (rank <= 27) return 2;
  if (rank <= 30) return 1;
  return 0;
}

export function getSeriesPoint(rank: number | null): number {
  if (!rank) return 0;
  if (rank <= 3) return 10;
  if (rank <= 8) return 9;
  if (rank <= 13) return 8;
  if (rank <= 18) return 7;
  if (rank <= 23) return 6;
  if (rank <= 28) return 5;
  if (rank <= 33) return 4;
  if (rank <= 38) return 3;
  if (rank <= 44) return 2;
  if (rank <= 50) return 1;
  return 0;
}
