import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calculateBuyTimingScore,
  calculateAdjustedCtr,
  type BuyTimingResult,
} from "@/lib/buyTiming";
import type { Work } from "@/types/work";

type TodayBuyTimingWork = Pick<
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
  | "sale_end_at"
  | "is_on_sale"
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

export type TodayBuyTimingItem = TodayBuyTimingWork & {
  buyTiming: BuyTimingResult;
};

const DAY_MS = 86_400_000;

function getCurrentPrice(work: TodayBuyTimingWork) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
}

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

export async function getTodayBuyTiming(limit = 30) {
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
      "sale_end_at",
      "is_on_sale",
      "affiliate_url",
    ].join(","))
    .not("affiliate_url", "is", null)
    .or("price.gt.0,sale_price.gt.0")
    .order("discount_rate", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false, nullsFirst: false })
    .limit(220);

  if (error) {
    console.warn(`[today-buy-timing] failed to load works: ${error.message}`);
    return [];
  }

  const works = ((data ?? []) as unknown as TodayBuyTimingWork[])
    .filter((work) => getCurrentPrice(work) > 0);
  const productIds = [...new Set(works.map((work) => work.product_id).filter(Boolean))];
  const workIds = works.map((work) => work.id);

  const [historyResult, funnelCounts] = await Promise.all([
    productIds.length
      ? supabaseAdmin
          .from("price_history")
          .select("product_id,normal_price,sale_price")
          .in("product_id", productIds)
          .order("changed_at", { ascending: false })
          .limit(20_000)
      : Promise.resolve({ data: [] as PriceHistoryRow[], error: null }),
    getFunnelCounts(workIds, 30),
  ]);

  const histories = new Map<string, PriceHistoryRow[]>();
  if (!historyResult.error) {
    for (const row of (historyResult.data ?? []) as PriceHistoryRow[]) {
      const items = histories.get(row.product_id) ?? [];
      items.push(row);
      histories.set(row.product_id, items);
    }
  }

  return works
    .map((work) => {
      const counts = funnelCounts.get(work.id) ?? { pageViews: 0, fanzaClicks: 0 };
      const ctr = calculateAdjustedCtr(counts.pageViews, counts.fanzaClicks);
      const buyTiming = calculateBuyTimingScore({
        work,
        priceHistory: histories.get(work.product_id) ?? [],
        funnel: {
          pageViews: counts.pageViews,
          fanzaClicks: counts.fanzaClicks,
          ...ctr,
        },
      });

      return { ...work, buyTiming };
    })
    .sort((a, b) =>
      b.buyTiming.score - a.buyTiming.score ||
      (b.discount_rate ?? 0) - (a.discount_rate ?? 0) ||
      (b.score ?? 0) - (a.score ?? 0),
    )
    .slice(0, limit);
}
