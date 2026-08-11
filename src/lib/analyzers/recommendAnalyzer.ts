type Work = {
  review_average: number | null;
  discount_rate: number | null;
  ranking: number | null;
  new_release_score: number | null;
  actress_point: number | null;
};

export type RecommendReason = {
  icon: string;
  title: string;
  description: string;
  color: string;
};

export function analyzeRecommendation(
  work: Work
): RecommendReason[] {
  const reasons: RecommendReason[] = [];

  if ((work.discount_rate ?? 0) >= 30) {
    reasons.push({
      icon: "💰",
      title: "セール中",
      description: `通常価格より${work.discount_rate}%安く購入できます。`,
      color: "green",
    });
  }

  if ((work.review_average ?? 0) >= 4.7) {
    reasons.push({
      icon: "⭐",
      title: "高評価",
      description: `レビュー評価${work.review_average}点の人気作品です。`,
      color: "yellow",
    });
  }

  if ((work.ranking ?? 9999) <= 50) {
    reasons.push({
      icon: "📈",
      title: "ランキング上位",
      description: `現在FANZAランキング${work.ranking}位です。`,
      color: "red",
    });
  }

  if ((work.new_release_score ?? 0) >= 8) {
    reasons.push({
      icon: "🆕",
      title: "新作注目",
      description: "発売直後の注目作品です。",
      color: "blue",
    });
  }

  if ((work.actress_point ?? 0) >= 18) {
    reasons.push({
      icon: "👩",
      title: "人気女優",
      description: "人気女優出演作品です。",
      color: "pink",
    });
  }

  return reasons;
}