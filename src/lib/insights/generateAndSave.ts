import { insightGenerator } from "./index";
import { InsightRepository } from "./repository";
import type { Work } from "@/types/work";

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

  if (insights.length === 0) {
    return;
  }

  const repository =
    new InsightRepository();

  await repository.save(insights);
}