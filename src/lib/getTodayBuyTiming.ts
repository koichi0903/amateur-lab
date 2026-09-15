import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calculateBuyTimingScore,
  calculateAdjustedCtr,
  type BuyTimingResult,
} from "@/lib/buyTiming";
import type { Work } from "@/types/work";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";
import { normalizeDisplayName } from "@/lib/createChartData";
import { parseDatabaseDate } from "@/lib/dateTime";
import {
  buildPriceInsightFromRows,
  type HomePriceInsightWork,
  type HomePricePoint,
  type PriceHistoryRow,
} from "@/lib/getHomePriceInsights";

type TodayBuyTimingWork = Pick<
  Work,
  | "id"
  | "product_id"
  | "title"
  | "image_url"
  | "genre"
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
  | "is_bottom_price"
  | "realtime_rank"
  | "affiliate_url"
>;

type FunnelCount = {
  pageViews: number;
  fanzaClicks: number;
};

export type TodayBuyTimingItem = TodayBuyTimingWork & {
  buyTiming: BuyTimingResult;
  priceInsight: HomePriceInsightWork | null;
};

const DAY_MS = 86_400_000;

function getCurrentPrice(work: TodayBuyTimingWork) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
}

function effectiveHistoryPrice(row: PriceHistoryRow) {
  return row.sale_price && row.sale_price > 0
    ? row.sale_price
    : row.normal_price && row.normal_price > 0
      ? row.normal_price
      : null;
}

function databaseTime(value: string) {
  return parseDatabaseDate(value)?.getTime() ?? Number.NaN;
}

function buildListPriceInsight(
  work: TodayBuyTimingWork,
  rows: PriceHistoryRow[],
  windowStartAt: string,
  windowEndAt: string,
): HomePriceInsightWork | null {
  const currentPrice = getCurrentPrice(work);
  if (!currentPrice || currentPrice <= 0) return null;

  const displayedRows = rows
    .map((row) => ({ ...row, value: effectiveHistoryPrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => Boolean(row.value && row.value > 0))
    .sort((a, b) => databaseTime(b.changed_at) - databaseTime(a.changed_at));
  if (!displayedRows.length) return null;

  const seriesLatest = displayedRows.find((row) => row.value === currentPrice) ?? displayedRows[0];
  const chartRows = displayedRows.filter(
    (row) =>
      normalizeDisplayName(row.display_name) === normalizeDisplayName(seriesLatest.display_name) &&
      (row.period ?? null) === (seriesLatest.period ?? null),
  );
  const start = Date.parse(windowStartAt);
  const end = Date.parse(windowEndAt);
  const priceHistory: HomePricePoint[] = chartRows
    .filter((row) => {
      const changedAt = databaseTime(row.changed_at);
      return Number.isFinite(changedAt) && changedAt >= start && changedAt <= end;
    })
    .sort((a, b) => databaseTime(a.changed_at) - databaseTime(b.changed_at))
    .map((row) => ({
      price: row.value,
      changedAt: row.changed_at,
      priceKind: row.price_kind,
    }));

  priceHistory.push({
    price: currentPrice,
    changedAt: windowEndAt,
    priceKind: null,
    isCurrent: true,
  });
  if (priceHistory.length < 2) return null;

  const prices = priceHistory.map((point) => point.price);
  const low90Price = Math.min(...prices);
  const peak90Price = Math.max(...prices);
  const previousPrice = [...priceHistory]
    .reverse()
    .find((point) => !point.isCurrent && point.price !== currentPrice)?.price ?? null;
  const dropAmount = previousPrice && previousPrice > currentPrice ? previousPrice - currentPrice : 0;
  const dropRate = previousPrice && previousPrice > currentPrice ? Math.round((dropAmount / previousPrice) * 100) : 0;
  const discountRate = work.discount_rate > 0
    ? work.discount_rate
    : work.list_price && work.list_price > currentPrice
      ? Math.round((1 - currentPrice / work.list_price) * 100)
      : 0;
  const isNearLow = currentPrice <= low90Price * 1.05;
  const buyScore = Math.max(0, Math.min(100, 50 + Math.min(24, Math.round(dropRate * 0.6)) + Math.min(14, Math.round(discountRate / 5)) + (isNearLow ? 18 : 0)));
  const badge = dropRate >= 25 ? "急落" : currentPrice <= low90Price ? "過去最安" : isNearLow ? "90日安値" : currentPrice > low90Price ? "価格上昇" : "買い時";

  return {
    ...(work as unknown as HomePriceInsightWork),
    currentPrice,
    previousPrice,
    dropAmount,
    dropRate,
    low90Price,
    peak90Price,
    buyScore,
    badge,
    priceHistory,
    priceWindowStartAt: windowStartAt,
    priceWindowEndAt: windowEndAt,
  };
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
      "genre",
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
      "is_bottom_price",
      "realtime_rank",
      "affiliate_url",
    ].join(","))
    .not("affiliate_url", "is", null)
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%")
    .or("price.gt.0,sale_price.gt.0")
    .order("discount_rate", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false, nullsFirst: false })
    .limit(220);

  if (error) {
    console.warn(`[today-buy-timing] failed to load works: ${error.message}`);
    return [];
  }

  const works = ((data ?? []) as unknown as TodayBuyTimingWork[])
    .filter(isNonVrWork)
    .filter((work) => getCurrentPrice(work) > 0);
  const productIds = [...new Set(works.map((work) => work.product_id).filter(Boolean))];
  const workIds = works.map((work) => work.id);
  const windowEndAt = new Date().toISOString();
  const windowStartAt = new Date(Date.parse(windowEndAt) - 90 * DAY_MS).toISOString();

  const [historyResult, funnelCounts] = await Promise.all([
    productIds.length
      ? supabaseAdmin
          .from("price_history")
          .select("product_id,changed_at,display_name,period,price_kind,normal_price,sale_price")
          .in("product_id", productIds)
          .gte("changed_at", windowStartAt)
          .order("product_id", { ascending: true })
          .order("display_name", { ascending: true })
          .order("period", { ascending: true, nullsFirst: true })
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
      const priceInsight = buildPriceInsightFromRows(
        work as unknown as HomePriceInsightWork,
        histories.get(work.product_id) ?? [],
        windowStartAt,
        windowEndAt,
      ) ?? buildListPriceInsight(work, histories.get(work.product_id) ?? [], windowStartAt, windowEndAt);

      return { ...work, buyTiming, priceInsight };
    })
    .sort((a, b) =>
      b.buyTiming.score - a.buyTiming.score ||
      (b.discount_rate ?? 0) - (a.discount_rate ?? 0) ||
      (b.score ?? 0) - a.score,
    )
    .slice(0, limit);
}
