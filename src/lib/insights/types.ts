export const InsightType = {
  PRICE_DROP: "PRICE_DROP",
  LOWEST_PRICE: "LOWEST_PRICE",
  REVIEW_GROWTH: "REVIEW_GROWTH",
  TRENDING: "TRENDING",
  AI_RECOMMEND: "AI_RECOMMEND",
} as const;

export type InsightType =
  (typeof InsightType)[keyof typeof InsightType];

export interface Insight {
  workId: number;

  type: InsightType;

  title: string;

  description: string;

  priority: number;

  score: number;

  payload: Record<string, unknown>;
}