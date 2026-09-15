import { InsightRepository } from "./repository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const repository = new InsightRepository(supabaseAdmin);

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
      // Keep the sortable insight score within the legacy numeric(5,2)
      // schema as well. The exact rank movement remains in payload.diff.
      score: Math.min(diff, 999.99),
      payload: {
        previousRank: input.previousRealtimeRank,
        currentRank: input.realtimeRank,
        diff,
      },
    },
  ]);
}
