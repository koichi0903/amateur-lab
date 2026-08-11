import { InsightRepository } from "./repository";

type TrendingInsightInput = {
  workId: number;
  title: string;
  previousRealtimeRank: number | null;
  realtimeRank: number | null;
};

export async function generateAndSaveTrendingInsight(
  input: TrendingInsightInput
) {
  if (
    input.previousRealtimeRank == null ||
    input.realtimeRank == null
  ) {
    return;
  }

  const diff =
    input.previousRealtimeRank -
    input.realtimeRank;

  if (diff < 30) {
    return;
  }

  const repository = new InsightRepository();

  await repository.save([
    {
      workId: input.workId,
      type: "TRENDING",
      title: "ランキング急上昇",
      description:
        `リアルタイムランキングが ` +
        `${input.previousRealtimeRank}位 → ` +
        `${input.realtimeRank}位へ上昇しました。`,
      priority: 80,
      score: diff,
      payload: {
        previousRank: input.previousRealtimeRank,
        currentRank: input.realtimeRank,
        diff,
      },
    },
  ]);
}