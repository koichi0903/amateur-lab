export type XCreativeLearningDimension = "hook_type" | "image_strategy" | "link_strategy" | "cta_strategy";

export type XCreativeLearningRow = {
  dimension: XCreativeLearningDimension;
  value: string;
  label: string;
  posts: number;
  xPageViews: number;
  xFanzaClicks: number;
  rawCtr: number;
  adjustedCtr: number;
  clicksPerPost: number;
  confidence: "low" | "medium" | "high";
  recommendation: string;
};

export type XCreativeLearningLog = {
  post_key: string;
  hook_type?: string | null;
  image_strategy?: string | null;
  link_strategy?: string | null;
  cta_strategy?: string | null;
};

type XCreativeLearningEvent = { x_post_key: string | null };
type CreativeLearningGroup = { posts: number; pageViews: number; clicks: number };

const DIMENSIONS: XCreativeLearningDimension[] = ["hook_type", "image_strategy", "link_strategy", "cta_strategy"];

function creativeLabel(dimension: XCreativeLearningDimension, value: string) {
  const labels: Record<string, string> = {
    price_anomaly: "価格フック",
    rating_anomaly: "評価異常フック",
    ranking_anomaly: "異常値フック",
    review_proof: "レビュー証明",
    discovery_anomaly: "発掘指数フック",
    buy_timing: "買い時フック",
    original_work_image: "作品画像",
    branded_data_card: "データカード",
    body_link: "本文リンク",
    reply_link: "自己リプリンク",
    price_cta: "価格CTA",
    reason_cta: "理由を見るCTA",
  };
  return labels[value] ?? `${dimension}:${value}`;
}

function adjustedCtr(pageViews: number, clicks: number) {
  const priorViews = 30;
  const priorCtr = 0.06;
  return ((clicks + priorViews * priorCtr) / (pageViews + priorViews)) * 100;
}

function confidence(posts: number, pageViews: number, clicks: number): XCreativeLearningRow["confidence"] {
  if (posts >= 6 && pageViews >= 120 && clicks >= 8) return "high";
  if (posts >= 3 && pageViews >= 50 && clicks >= 3) return "medium";
  return "low";
}

function countEvents(rows: XCreativeLearningEvent[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.x_post_key) counts.set(row.x_post_key, (counts.get(row.x_post_key) ?? 0) + 1);
  }
  return counts;
}

function aggregateDimension(
  dimension: XCreativeLearningDimension,
  logs: XCreativeLearningLog[],
  views: Map<string, number>,
  clicks: Map<string, number>,
): XCreativeLearningRow[] {
  const groups = new Map<string, CreativeLearningGroup>();
  for (const log of logs) {
    const value = log[dimension] ?? "unknown";
    if (value === "unknown") continue;
    const stats = groups.get(value) ?? { posts: 0, pageViews: 0, clicks: 0 };
    stats.posts += 1;
    stats.pageViews += views.get(log.post_key) ?? 0;
    stats.clicks += clicks.get(log.post_key) ?? 0;
    groups.set(value, stats);
  }

  return [...groups].map(([value, stats]) => {
    const rawCtr = stats.pageViews ? (stats.clicks / stats.pageViews) * 100 : 0;
    const correctedCtr = adjustedCtr(stats.pageViews, stats.clicks);
    const trust = confidence(stats.posts, stats.pageViews, stats.clicks);
    return {
      dimension,
      value,
      label: creativeLabel(dimension, value),
      posts: stats.posts,
      xPageViews: stats.pageViews,
      xFanzaClicks: stats.clicks,
      rawCtr: Math.round(rawCtr * 10) / 10,
      adjustedCtr: Math.round(correctedCtr * 10) / 10,
      clicksPerPost: Math.round((stats.clicks / Math.max(stats.posts, 1)) * 10) / 10,
      confidence: trust,
      recommendation: trust === "low"
        ? "サンプル不足。まだ断定しない"
        : correctedCtr >= 8
          ? "勝ち寄り。配分を少し増やす"
          : correctedCtr <= 3
            ? "弱め。別フックを試す"
            : "継続テスト",
    };
  });
}

export function aggregateXCreativeLearning(
  logs: XCreativeLearningLog[],
  viewRows: XCreativeLearningEvent[],
  clickRows: XCreativeLearningEvent[],
): XCreativeLearningRow[] {
  const views = countEvents(viewRows);
  const clicks = countEvents(clickRows);
  return DIMENSIONS.flatMap((dimension) => aggregateDimension(dimension, logs, views, clicks))
    .sort((a, b) => b.adjustedCtr - a.adjustedCtr || b.xFanzaClicks - a.xFanzaClicks);
}
