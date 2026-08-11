type Insight = {
  id: string;
  type: string;
  title: string;
  description: string;
};

export type InsightViewModel = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export function analyzeInsights(
  insights: Insight[]
): InsightViewModel[] {
  return insights.map((insight) => ({
    id: insight.id,
    icon: getIcon(insight.type),
    title: insight.title,
    description: insight.description,
  }));
}

function getIcon(type: string) {
  switch (type) {
    case "TRENDING":
      return "📈";

    case "PRICE_DROP":
      return "💰";

    case "LOWEST_PRICE":
      return "🏷️";

    case "REVIEW_GROWTH":
      return "⭐";

    default:
      return "💡";
  }
}