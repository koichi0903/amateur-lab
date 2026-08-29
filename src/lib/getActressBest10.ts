import { calculateAdjustedCtr, calculateBuyTimingScore, type BuyTimingResult } from "@/lib/buyTiming";
import { calculateDiscoveryScore, type DiscoveryScoreResult } from "@/lib/discoveryScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Work } from "@/types/work";

type PriceHistoryRow = {
  product_id: string;
  normal_price: number | null;
  sale_price: number | null;
};

type FunnelCount = {
  pageViews: number;
  fanzaClicks: number;
};

export type EntityBest10Item = Work & {
  buyTiming: BuyTimingResult;
  discovery: DiscoveryScoreResult;
  best10Score: number;
  best10Reasons: string[];
};

export type EntityBest10Sections = {
  overall: EntityBest10Item[];
  hiddenGems: EntityBest10Item[];
  buyNow: EntityBest10Item[];
  summary: string;
};

export type ActressBest10Item = EntityBest10Item;
export type ActressBest10Sections = EntityBest10Sections;

const DAY_MS = 86_400_000;
const CTR_CAP = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function getFunnelCounts(workIds: number[], days = 30) {
  const uniqueIds = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const counts = new Map<number, FunnelCount>();
  for (const id of uniqueIds) counts.set(id, { pageViews: 0, fanzaClicks: 0 });
  if (!uniqueIds.length) return counts;

  const cutoff = new Date(Date.now() - Math.max(1, days) * DAY_MS).toISOString();
  const [viewResult, clickResult] = await Promise.all([
    supabaseAdmin
      .from("work_page_views")
      .select("work_id")
      .in("work_id", uniqueIds)
      .gte("viewed_at", cutoff)
      .limit(50_000),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("work_id")
      .in("work_id", uniqueIds)
      .gte("clicked_at", cutoff)
      .limit(50_000),
  ]);

  if (!viewResult.error) {
    for (const row of (viewResult.data ?? []) as Array<{ work_id: number }>) {
      const current = counts.get(row.work_id);
      if (current) current.pageViews += 1;
    }
  }

  if (!clickResult.error) {
    for (const row of (clickResult.data ?? []) as Array<{ work_id: number }>) {
      const current = counts.get(row.work_id);
      if (current) current.fanzaClicks += 1;
    }
  }

  return counts;
}

function getBest10Score(work: Work, buyTiming: BuyTimingResult, discovery: DiscoveryScoreResult) {
  const reviewAverage = clamp(work.review_average ?? 0, 0, 5);
  const reviewCount = Math.max(0, work.review_count ?? 0);
  const reviewConfidence = clamp(Math.log10(reviewCount + 1) / 2.2, 0, 1);
  const reviewScore = reviewAverage > 0
    ? clamp(((reviewAverage - 3) / 2) * 100, 0, 100) * reviewConfidence
    : 0;
  const baseScore = clamp(work.score ?? 0, 0, 100);
  const funnel = buyTiming.funnel;
  const funnelConfidence = clamp(funnel.pageViews / 20, 0, 1);
  const revenueScore =
    clamp(funnel.adjustedCtr / CTR_CAP, 0, 1) * 55 * funnelConfidence +
    clamp(funnel.fanzaClicks / 8, 0, 1) * 35 +
    (funnel.pageViews === 0 ? 10 : 0);

  return Math.round(
    clamp(
      baseScore * 0.22 +
        discovery.score * 0.28 +
        buyTiming.score * 0.24 +
        reviewScore * 0.16 +
        revenueScore * 0.1,
      0,
      100,
    ),
  );
}

function getBest10Reasons(work: Work, buyTiming: BuyTimingResult, discovery: DiscoveryScoreResult) {
  const reasons = [
    discovery.score >= 70 ? `発掘指数${discovery.score}` : null,
    buyTiming.score >= 70 ? `買い時${buyTiming.score}` : null,
    work.review_average >= 4.1 && work.review_count >= 10
      ? `評価${work.review_average.toFixed(2)}・レビュー${work.review_count}件`
      : null,
    discovery.discountRate >= 25 ? `${discovery.discountRate}%OFF` : null,
    discovery.lowestPriceText.includes("過去最安値") ? discovery.lowestPriceText : null,
    buyTiming.funnel.pageViews >= 20 && buyTiming.funnel.adjustedCtr >= 5
      ? `補正CTR ${buyTiming.funnel.adjustedCtr}%`
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  if (reasons.length < 2 && work.score > 0) reasons.push(`既存スコア${Math.round(work.score)}`);
  if (reasons.length < 2 && work.ranking > 0 && work.ranking < 9999) reasons.push(`ランキング${work.ranking}位`);

  return [...new Set(reasons)].slice(0, 4);
}

function buildSummary(name: string, items: EntityBest10Item[], entityLabel: string) {
  if (!items.length) {
    return `${name}のおすすめ作品、セール作品、埋もれ名作を現在のデータから整理中です。`;
  }

  const reviewed = items.filter((item) => item.review_average > 0);
  const avgReview = reviewed.length
    ? reviewed.reduce((sum, item) => sum + item.review_average, 0) / reviewed.length
    : 0;
  const saleCount = items.filter((item) => item.discovery.discountRate >= 20).length;
  const hiddenCount = items.filter((item) => item.discovery.score >= 65 && item.ranking > 80).length;
  const topBuy = [...items].sort((a, b) => b.buyTiming.score - a.buyTiming.score)[0];

  const parts = [
    reviewed.length >= 3 && avgReview >= 4
      ? `レビュー取得済み作品の平均評価は${avgReview.toFixed(2)}で、高評価作から選びやすい${entityLabel}ページです`
      : `${name}の作品を発掘指数、レビュー、価格条件から比較できます`,
    saleCount > 0
      ? `現在は${saleCount}作品で20%以上の割引条件があり、${name} セール目的でも確認価値があります`
      : "セール条件は日々変動するため、買い時スコアで候補を絞るのがおすすめです",
    hiddenCount > 0
      ? `ランキング上位以外にも埋もれ名作候補が${hiddenCount}作品あります`
      : "ランキング上位だけでなく、評価や価格が強い作品も合わせて確認できます",
    topBuy ? `今買うなら「${topBuy.title}」が買い時スコア${topBuy.buyTiming.score}で有力です` : null,
  ].filter(Boolean);

  return parts.join("。") + "。";
}

export async function getEntityBest10(
  name: string,
  works: Work[],
  options: { entityLabel?: string } = {},
): Promise<EntityBest10Sections> {
  const candidates = works
    .filter((work) => work.id > 0 && work.product_id && (work.price > 0 || work.sale_price > 0))
    .slice(0, 220);
  const productIds = [...new Set(candidates.map((work) => work.product_id).filter(Boolean))];
  const workIds = candidates.map((work) => work.id);

  const [historyResult, funnelCounts] = await Promise.all([
    productIds.length
      ? supabaseAdmin
          .from("price_history")
          .select("product_id,normal_price,sale_price")
          .in("product_id", productIds)
          .order("changed_at", { ascending: false })
          .limit(25_000)
      : Promise.resolve({ data: [] as PriceHistoryRow[], error: null }),
    getFunnelCounts(workIds, 30),
  ]);

  const histories = new Map<string, PriceHistoryRow[]>();
  if (!historyResult.error) {
    for (const row of (historyResult.data ?? []) as PriceHistoryRow[]) {
      histories.set(row.product_id, [...(histories.get(row.product_id) ?? []), row]);
    }
  }

  const enriched = candidates.map((work) => {
    const counts = funnelCounts.get(work.id) ?? { pageViews: 0, fanzaClicks: 0 };
    const funnel = {
      pageViews: counts.pageViews,
      fanzaClicks: counts.fanzaClicks,
      ...calculateAdjustedCtr(counts.pageViews, counts.fanzaClicks),
    };
    const priceHistory = histories.get(work.product_id) ?? [];
    const buyTiming = calculateBuyTimingScore({ work, priceHistory, funnel });
    const discovery = calculateDiscoveryScore({
      work,
      priceHistory,
      buyTimingScore: buyTiming.score,
      funnel,
    });
    const best10Score = getBest10Score(work, buyTiming, discovery);

    return {
      ...work,
      buyTiming,
      discovery,
      best10Score,
      best10Reasons: getBest10Reasons(work, buyTiming, discovery),
    };
  });

  const overall = [...enriched]
    .sort((a, b) =>
      b.best10Score - a.best10Score ||
      b.discovery.score - a.discovery.score ||
      b.buyTiming.score - a.buyTiming.score ||
      b.review_count - a.review_count,
    )
    .slice(0, 10);
  const hiddenGems = [...enriched]
    .filter((work) => work.review_count >= 8 && (!work.ranking || work.ranking > 30))
    .sort((a, b) =>
      b.discovery.score - a.discovery.score ||
      b.buyTiming.score - a.buyTiming.score ||
      b.best10Score - a.best10Score,
    )
    .slice(0, 10);
  const buyNow = [...enriched]
    .filter((work) => work.buyTiming.score >= 45 || work.discovery.discountRate > 0)
    .sort((a, b) =>
      b.buyTiming.score - a.buyTiming.score ||
      b.discovery.discountRate - a.discovery.discountRate ||
      b.discovery.score - a.discovery.score,
    )
    .slice(0, 10);

  return {
    overall,
    hiddenGems,
    buyNow,
    summary: buildSummary(name, enriched, options.entityLabel ?? "カタログ"),
  };
}

export async function getActressBest10(name: string, works: Work[]): Promise<ActressBest10Sections> {
  return getEntityBest10(name, works, { entityLabel: "女優" });
}
