import { InsightRepository } from "./repository";
import { InsightType } from "./types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const repository = new InsightRepository(supabaseAdmin);

export async function saveLowestPriceEvent(params: {
  workId: number;
  currentPrice: number;
  previousLowestPrice: number | null;
  lowestPrice: number;
}) {
  await repository.save([
    {
      workId: params.workId,
      type: InsightType.LOWEST_PRICE,
      title: "過去最安値を更新",
      description: "過去最安値を更新しました。",
      priority: 95,
      score: 95,
      payload: {
        currentPrice: params.currentPrice,
        previousLowestPrice: params.previousLowestPrice,
        lowestPrice: params.lowestPrice,
      },
    },
  ]);
}

export async function saveReviewGrowthEvent(params: {
  workId: number;
  previousReviewCount: number;
  currentReviewCount: number;
}) {
  await repository.save([
    {
      workId: params.workId,
      type: InsightType.REVIEW_GROWTH,
      title: "レビュー件数が増加",
      description: `レビューが ${params.previousReviewCount} 件から ${params.currentReviewCount} 件に増えました。`,
      priority: 75,
      score: 75,
      payload: {
        previousReviewCount: params.previousReviewCount,
        currentReviewCount: params.currentReviewCount,
      },
    },
  ]);
}
