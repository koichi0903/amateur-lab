import { insightGenerator } from "./index";
import { InsightRepository } from "./repository";
import type { Work } from "@/types/work";
import { InsightType } from "./types";

export async function generateAndSaveInsight(
  work: Work
) {
  const insights = insightGenerator.generate({
  workId: work.id,
  title: work.title,
  listPrice: work.list_price ?? work.price,
  currentPrice: work.sale_price ?? work.price,
  lowestPrice: work.lowest_price,

  previousRealtimeRank:
    work.previous_realtime_rank,

  realtimeRank:
    work.realtime_rank,
});

  const repository =
    new InsightRepository();

  const generatedTypes = new Set(
    insights.map((insight) => insight.type)
  );
  const stateTypes = [
    InsightType.PRICE_DROP,
    InsightType.LOWEST_PRICE,
  ];

  await repository.removeTypes(
    work.id,
    stateTypes.filter((type) => !generatedTypes.has(type))
  );

  if (insights.length === 0) {
    return;
  }

  await repository.save(insights);
}
