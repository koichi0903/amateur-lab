import { InsightType, type Insight } from "../types";
import type { InsightContext } from "../context";
import type { InsightRule } from "../InsightRule";

export class PriceDropRule implements InsightRule {
  readonly type = InsightType.PRICE_DROP;

  generate(context: InsightContext): Insight[] {
    if (context.currentPrice >= context.listPrice) {
      return [];
    }

    const discountRate = Math.round(
      (1 - context.currentPrice / context.listPrice) * 100,
    );

    return [
      {
        workId: context.workId,
        type: InsightType.PRICE_DROP,
        title: `${discountRate}%OFF`,
        description: "通常価格より安く購入できます。",
        priority: 100,
        score: discountRate,
        payload: {
          listPrice: context.listPrice,
          currentPrice: context.currentPrice,
          discountRate,
        },
      },
    ];
  }
}