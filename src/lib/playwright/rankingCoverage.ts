export const MINIMUM_PARTIAL_RANKING_RATIO = 0.9;

export type RankingCoverage = {
  actualCount: number;
  expectedCount: number;
  ratio: number;
  complete: boolean;
  acceptable: boolean;
};

type RankingUpdateInput = {
  existingRealtimeRank: number | null;
  realtimeRank: number | undefined;
  dailyRank: number | undefined;
  weeklyRank: number | undefined;
  monthlyRank: number | undefined;
  realtimeComplete: boolean;
};

export function assessRankingCoverage(
  actualCount: number,
  expectedCount: number,
  minimumRatio = MINIMUM_PARTIAL_RANKING_RATIO,
): RankingCoverage {
  const safeExpectedCount = Math.max(1, expectedCount);
  const ratio = Math.max(0, actualCount) / safeExpectedCount;

  return {
    actualCount,
    expectedCount,
    ratio,
    complete: actualCount >= expectedCount,
    acceptable: actualCount >= expectedCount || ratio >= minimumRatio,
  };
}

export function buildRankingUpdate(input: RankingUpdateInput) {
  const update: Record<string, number | null> = {
    daily_rank: input.dailyRank ?? null,
    weekly_rank: input.weeklyRank ?? null,
    monthly_rank: input.monthlyRank ?? null,
  };

  if (input.realtimeRank != null) {
    update.previous_realtime_rank = input.existingRealtimeRank;
    update.realtime_rank = input.realtimeRank;
  } else if (input.realtimeComplete) {
    update.previous_realtime_rank = input.existingRealtimeRank;
    update.realtime_rank = null;
  }

  return update;
}
