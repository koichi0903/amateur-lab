import { calculateAdjustedCtr, calculateBuyTimingScore, type BuyTimingResult } from "@/lib/buyTiming";
import { calculateDiscoveryScore, type DiscoveryScoreResult } from "@/lib/discoveryScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Work } from "@/types/work";

type TodayDiscoveryWork = Pick<
  Work,
  | "id"
  | "product_id"
  | "title"
  | "image_url"
  | "score"
  | "price"
  | "sale_price"
  | "list_price"
  | "discount_rate"
  | "lowest_price"
  | "review_average"
  | "review_count"
  | "ranking"
  | "release_date"
  | "affiliate_url"
>;

type PriceHistoryRow = {
  product_id: string;
  normal_price: number | null;
  sale_price: number | null;
};

type FunnelCount = {
  pageViews: number;
  fanzaClicks: number;
};

export type TodayDiscoveryItem = TodayDiscoveryWork & {
  buyTiming: BuyTimingResult;
  discovery: DiscoveryScoreResult;
};

const DAY_MS = 86_400_000;

async function getFunnelCounts(workIds: number[], days = 30) {
  const counts = new Map<number, FunnelCount>();
  for (const id of workIds) counts.set(id, { pageViews: 0, fanzaClicks: 0 });
  if (!workIds.length) return counts;

  const cutoff = new Date(Date.now() - days * DAY_MS).toISOString();
  const [viewResult, clickResult] = await Promise.all([
    supabaseAdmin
      .from("work_page_views")
      .select("work_id")
      .in("work_id", workIds)
      .gte("viewed_at", cutoff)
      .limit(50_000),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("work_id")
      .in("work_id", workIds)
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

export async function getTodayDiscovery(limit = 30) {
  const { data, error } = await supabaseAdmin
    .from("works")
    .select([
      "id",
      "product_id",
      "title",
      "image_url",
      "score",
      "price",
      "sale_price",
      "list_price",
      "discount_rate",
      "lowest_price",
      "review_average",
      "review_count",
      "ranking",
      "release_date",
      "affiliate_url",
    ].join(","))
    .not("affiliate_url", "is", null)
    .not("product_id", "is", null)
    .gt("review_count", 0)
    .or("price.gt.0,sale_price.gt.0")
    .order("score", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .limit(320);

  if (error) {
    console.warn(`[today-discovery] failed to load works: ${error.message}`);
    return [];
  }

  const works = ((data ?? []) as unknown as TodayDiscoveryWork[])
    .filter((work) => (work.price > 0 || work.sale_price > 0) && work.review_count >= 8);
  const productIds = [...new Set(works.map((work) => work.product_id).filter(Boolean))];
  const workIds = works.map((work) => work.id);

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

  return works
    .map((work) => {
      const counts = funnelCounts.get(work.id) ?? { pageViews: 0, fanzaClicks: 0 };
      const ctr = calculateAdjustedCtr(counts.pageViews, counts.fanzaClicks);
      const funnel = {
        pageViews: counts.pageViews,
        fanzaClicks: counts.fanzaClicks,
        ...ctr,
      };
      const priceHistory = histories.get(work.product_id) ?? [];
      const buyTiming = calculateBuyTimingScore({ work, priceHistory, funnel });
      const discovery = calculateDiscoveryScore({
        work,
        priceHistory,
        buyTimingScore: buyTiming.score,
        funnel,
      });

      return { ...work, buyTiming, discovery };
    })
    .sort((a, b) =>
      b.discovery.score - a.discovery.score ||
      b.buyTiming.score - a.buyTiming.score ||
      (b.review_count ?? 0) - (a.review_count ?? 0),
    )
    .slice(0, limit);
}
