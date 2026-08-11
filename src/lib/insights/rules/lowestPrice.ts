import { InsightType, type Insight } from "../types";
import type { InsightContext } from "../context";
import type { InsightRule } from "../InsightRule";

export class LowestPriceRule implements InsightRule {
  readonly type = InsightType.LOWEST_PRICE;

  generate(context: InsightContext): Insight[] {
    if (context.lowestPrice == null) {
      return [];
    }

    if (context.currentPrice !== context.lowestPrice) {
      return [];
    }

    return [
      {
        workId: context.workId,
        type: InsightType.LOWEST_PRICE,
        title: "過去最安値",
        description: "この作品は現在、過去最安値で購入できます。",
        priority: 95,
        score: 95,
        payload: {
          currentPrice: context.currentPrice,
          lowestPrice: context.lowestPrice,
        },
      },
    ];
  }
}