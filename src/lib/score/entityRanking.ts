export function getBestStoredRank(
  first: number | null | undefined,
  second: number | null | undefined,
): number | null {
  const ranks = [first, second].filter(
    (rank): rank is number => rank != null && rank > 0,
  );

  return ranks.length ? Math.min(...ranks) : null;
}

const ACTRESS_RANK_POINTS = [
  { maxRank: 5, points: 20 },
  { maxRank: 10, points: 19 },
  { maxRank: 15, points: 18 },
  { maxRank: 20, points: 17 },
  { maxRank: 25, points: 16 },
  { maxRank: 30, points: 15 },
  { maxRank: 35, points: 14 },
  { maxRank: 40, points: 13 },
  { maxRank: 45, points: 12 },
  { maxRank: 50, points: 11 },
  { maxRank: 60, points: 10 },
  { maxRank: 70, points: 8 },
  { maxRank: 80, points: 6 },
  { maxRank: 90, points: 4 },
  { maxRank: 100, points: 2 },
] as const;

export function getActressPoint(rank: number | null): number {
  if (!rank) return 0;
  return ACTRESS_RANK_POINTS.find(({ maxRank }) => rank <= maxRank)?.points ?? 0;
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
