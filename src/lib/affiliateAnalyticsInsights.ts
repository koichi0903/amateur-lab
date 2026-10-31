import type { AffiliateClickRow, TrafficInsight, XPostCategoryRevenueRow } from "./affiliateAnalytics";
import type { AffiliateSource } from "./affiliateTracking";

export const AFFILIATE_ANALYTICS_DAY_MS = 24 * 60 * 60 * 1000;
const DAY_MS = AFFILIATE_ANALYTICS_DAY_MS;
export type WorkPageViewRow = {
  id: number;
  work_id: number;
  source_page: AffiliateSource;
  price: number | null;
  discount_rate: number | null;
  discovery_score: number | null;
  ranking: number | null;
  x_post_key: string | null;
  viewed_at: string;
};

export const X_CATEGORY_LABELS: Record<XPostCategoryRevenueRow["category"], string> = {
  bijyo_reserved: "予約作品投稿 / @bijyo1010",
  today_buy: "今日の買い時",
  today_discovery: "今日の発掘",
  market_scan: "市場メモ",
  comparison_pick: "比較メモ",
  judgment_pick: "見送り判断",
  review_gap: "レビューギャップ",
  discovery_gap: "発掘ギャップ",
  hidden_gem: "埋もれ名作",
  actress_best: "女優別おすすめ",
  genre_best: "ジャンル別おすすめ",
  maker_best: "メーカー別おすすめ",
  series_best: "シリーズ別おすすめ",
  deal: "値下げ・セール",
  score: "高スコア",
  new: "新作",
  sales: "実売上",
  unknown: "未分類",
};

export function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

export function inferXPostKeyFromPageViews(
  click: AffiliateClickRow,
  pageViewsByWork: Map<number, WorkPageViewRow[]>,
) {
  if (click.x_post_key) return click.x_post_key;

  const clickedAt = new Date(click.clicked_at).getTime();
  const candidates = pageViewsByWork.get(click.work_id) ?? [];
  const matched = candidates.find((view) => {
    const viewedAt = new Date(view.viewed_at).getTime();
    return viewedAt <= clickedAt && clickedAt - viewedAt <= DAY_MS;
  });
  return matched?.x_post_key ?? null;
}

export function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function classifyTrafficInsight({
  total,
  lastSevenDays,
  previousSevenDays,
  growthRate,
}: Pick<
  TrafficInsight,
  "total" | "lastSevenDays" | "previousSevenDays" | "growthRate"
>): Pick<TrafficInsight, "action" | "actionReason"> {
  if (total < 5) {
    return {
      action: "observe",
      actionReason: "30日間のクリックが5件未満のため、判断材料を蓄積します。",
    };
  }

  if (previousSevenDays >= 5 && growthRate !== null && growthRate <= -30) {
    return {
      action: "recover",
      actionReason: `前の7日間より${Math.abs(growthRate)}%減少。掲載位置や訴求文を確認します。`,
    };
  }

  if (
    lastSevenDays >= 5 &&
    (previousSevenDays === 0 || (growthRate !== null && growthRate >= 30))
  ) {
    return {
      action: "expand",
      actionReason:
        previousSevenDays === 0
          ? "直近7日で新たにクリックが集まっています。露出拡大候補です。"
          : `前の7日間より${growthRate}%増加。露出拡大候補です。`,
    };
  }

  return {
    action: "maintain",
    actionReason: "一定のクリックを維持しています。現状を継続して推移を確認します。",
  };
}

export function buildTrafficInsights(
  rows: AffiliateClickRow[],
  getKey: (row: AffiliateClickRow) => string,
  getLabel: (key: string) => string,
  sevenDayCutoff: number,
  previousSevenDayCutoff: number,
): TrafficInsight[] {
  const counts = new Map<
    string,
    { total: number; lastSevenDays: number; previousSevenDays: number }
  >();

  for (const row of rows) {
    const key = getKey(row);
    const current = counts.get(key) ?? {
      total: 0,
      lastSevenDays: 0,
      previousSevenDays: 0,
    };
    const clickedAt = new Date(row.clicked_at).getTime();
    current.total += 1;
    if (clickedAt >= sevenDayCutoff) current.lastSevenDays += 1;
    else if (clickedAt >= previousSevenDayCutoff) current.previousSevenDays += 1;
    counts.set(key, current);
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const growthRate = count.previousSevenDays > 0
        ? Math.round(
            ((count.lastSevenDays - count.previousSevenDays) /
              count.previousSevenDays) *
              100,
          )
        : null;
      const classification = classifyTrafficInsight({
        ...count,
        growthRate,
      });
      return {
        key,
        label: getLabel(key),
        ...count,
        share: rows.length > 0 ? Math.round((count.total / rows.length) * 100) : 0,
        growthRate,
        ...classification,
      };
    })
    .sort((a, b) => b.total - a.total);
}

