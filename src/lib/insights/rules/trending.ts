import type { Insight } from "../types";
import type { InsightContext } from "../context";
import type { InsightRule } from "../InsightRule";

export class TrendingRule implements InsightRule {
  readonly type = "TRENDING";

  generate(context: InsightContext): Insight[] {
    if (
      context.previousRealtimeRank == null ||
      context.realtimeRank == null
    ) {
      return [];
    }

    const diff =
      context.previousRealtimeRank -
      context.realtimeRank;

    if (diff < 30) {
      return [];
    }

    return [
      {
        workId: context.workId,
        type: "TRENDING",
        title: "ランキング急上昇",
        description:
          `リアルタイムランキングが ` +
          `${context.previousRealtimeRank}位 → ` +
          `${context.realtimeRank}位へ上昇しました。`,
        priority: 80,
        score: diff,
        payload: {
          previousRank:
            context.previousRealtimeRank,
          currentRank: context.realtimeRank,
          diff,
        },
      },
    ];
  }
}