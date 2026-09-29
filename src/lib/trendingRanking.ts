type TrendingFields = {
  ranking?: number | null;
  realtime_rank?: number | null;
  previous_realtime_rank?: number | null;
  review_average?: number | null;
  review_count?: number | null;
};

const rankQuality = (rank: number | null | undefined) => {
  if (!rank || rank <= 0) return 0;
  return Math.max(0, 100 - (Math.min(rank, 1000) / 10));
};

export const trendingScore = (work: TrendingFields) => {
  const currentRealtimeRank = work.realtime_rank ?? null;
  const previousRealtimeRank = work.previous_realtime_rank ?? null;
  const rise = currentRealtimeRank && previousRealtimeRank && previousRealtimeRank > currentRealtimeRank
    ? Math.min(100, ((previousRealtimeRank - currentRealtimeRank) / previousRealtimeRank) * 100)
    : 0;
  const reviewAverage = Math.min(100, Math.max(0, ((work.review_average ?? 0) / 5) * 100));
  const reviewVolume = Math.min(100, (Math.log10((work.review_count ?? 0) + 1) / Math.log10(501)) * 100);

  return (
    rise * 0.3
    + rankQuality(currentRealtimeRank) * 0.3
    + rankQuality(work.ranking) * 0.2
    + reviewAverage * 0.1
    + reviewVolume * 0.1
  );
};

export function sortTrendingWorks<T extends TrendingFields>(works: T[]) {
  return [...works].sort((a, b) => {
    const scoreDifference = trendingScore(b) - trendingScore(a);
    if (Math.abs(scoreDifference) > 0.001) return scoreDifference;
    return (a.realtime_rank ?? a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.realtime_rank ?? b.ranking ?? Number.MAX_SAFE_INTEGER);
  });
}
