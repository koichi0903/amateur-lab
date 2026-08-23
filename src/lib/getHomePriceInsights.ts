import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { unstable_cache } from "next/cache";

const HOME_PRICE_REVALIDATE_SECONDS = 1800;
const HOME_PRICE_HISTORY_LIMIT = 240;
const HOME_PRICE_WORK_LIMIT = 60;
const HOME_PRICE_SPARKLINE_POINTS = 8;

type PriceHistoryRow = {
  product_id: string;
  changed_at: string;
  display_name: string;
  normal_price: number | null;
  sale_price: number | null;
};

export type HomePriceInsightWork = Pick<
  Work,
  | "id"
  | "product_id"
  | "title"
  | "image_url"
  | "price"
  | "sale_price"
  | "list_price"
  | "discount_rate"
  | "lowest_price"
  | "is_bottom_price"
> & {
  currentPrice: number;
  previousPrice: number | null;
  dropAmount: number;
  dropRate: number;
  low90Price: number;
  buyScore: number;
  badge: "急落" | "過去最安" | "90日安値" | "買い時";
  sparkline: number[];
};

const effectivePrice = (row: PriceHistoryRow) =>
  row.sale_price && row.sale_price > 0
    ? row.sale_price
    : row.normal_price && row.normal_price > 0
      ? row.normal_price
      : null;

const currentWorkPrice = (work: Pick<Work, "price" | "sale_price">) =>
  work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;

function scoreBuyTiming(input: {
  currentPrice: number;
  previousPrice: number | null;
  low90Price: number;
  dropRate: number;
  discountRate: number;
  isBottomPrice: boolean;
}) {
  let score = 50;

  if (input.previousPrice && input.previousPrice > input.currentPrice) {
    score += Math.min(24, Math.round(input.dropRate * 0.6));
  }

  if (input.low90Price > 0) {
    const nearLow = input.currentPrice <= input.low90Price ? 18 : Math.max(0, 14 - Math.round(((input.currentPrice - input.low90Price) / input.low90Price) * 100));
    score += nearLow;
  }

  score += Math.min(14, Math.round(input.discountRate / 5));
  if (input.isBottomPrice) score += 12;

  return Math.max(0, Math.min(100, score));
}

function buildInsight(work: HomePriceInsightWork, rows: PriceHistoryRow[]): HomePriceInsightWork | null {
  const sorted = rows
    .map((row) => ({ ...row, value: effectivePrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => row.value !== null)
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  if (!sorted.length) return null;

  const latestByType = new Map<string, (typeof sorted)[number]>();
  for (const row of sorted) {
    if (!latestByType.has(row.display_name)) latestByType.set(row.display_name, row);
  }

  const latest = [...latestByType.values()].sort((a, b) => a.value - b.value)[0];
  const typeRows = sorted.filter((row) => row.display_name === latest.display_name);
  const currentPrice = currentWorkPrice(work) || latest.value;
  const previous = typeRows.find((row) => row.value !== currentPrice && new Date(row.changed_at).getTime() < new Date(latest.changed_at).getTime());
  const historicalPrices = typeRows.map((row) => row.value);
  const low90Price = Math.min(...historicalPrices, currentPrice);
  const previousPrice = previous?.value ?? null;
  const dropAmount = previousPrice && previousPrice > currentPrice ? previousPrice - currentPrice : 0;
  const dropRate = previousPrice && previousPrice > currentPrice ? Math.round((dropAmount / previousPrice) * 100) : 0;
  const discountRate = work.discount_rate > 0 ? work.discount_rate : work.list_price && work.list_price > currentPrice ? Math.round((1 - currentPrice / work.list_price) * 100) : 0;
  const isBottomPrice = work.is_bottom_price || currentPrice <= low90Price;
  const buyScore = scoreBuyTiming({
    currentPrice,
    previousPrice,
    low90Price,
    dropRate,
    discountRate,
    isBottomPrice,
  });
  const badge = dropRate >= 25 ? "急落" : isBottomPrice ? "過去最安" : currentPrice <= low90Price * 1.05 ? "90日安値" : "買い時";
  const sparkline = [...typeRows]
    .reverse()
    .map((row) => row.value)
    .slice(-HOME_PRICE_SPARKLINE_POINTS);

  return {
    ...work,
    currentPrice,
    previousPrice,
    dropAmount,
    dropRate,
    low90Price,
    buyScore,
    badge,
    sparkline: sparkline.length >= 2 ? sparkline : [previousPrice ?? currentPrice, currentPrice],
  };
}

async function fetchHomePriceInsights() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from("price_history")
    .select("product_id,changed_at,display_name,normal_price,sale_price")
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(HOME_PRICE_HISTORY_LIMIT);

  const rows = (history ?? []) as PriceHistoryRow[];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))].slice(0, HOME_PRICE_WORK_LIMIT);

  if (!productIds.length) {
    return { priceDrops: [], lowestUpdates: [], buyTiming: [] };
  }

  const { data: works } = await supabase
    .from("works")
    .select("id,product_id,title,image_url,price,sale_price,list_price,discount_rate,lowest_price,is_bottom_price")
    .in("product_id", productIds)
    .gt("price", 0)
    .limit(HOME_PRICE_WORK_LIMIT);

  const rowsByProduct = new Map<string, PriceHistoryRow[]>();
  for (const row of rows) {
    rowsByProduct.set(row.product_id, [...(rowsByProduct.get(row.product_id) ?? []), row]);
  }

  const insights = ((works ?? []) as HomePriceInsightWork[])
    .map((work) => buildInsight(work, rowsByProduct.get(work.product_id) ?? []))
    .filter((work): work is HomePriceInsightWork => work !== null);

  const priceDrops = insights
    .filter((work) => work.dropAmount > 0)
    .sort((a, b) => b.dropAmount - a.dropAmount || b.dropRate - a.dropRate)
    .slice(0, 5);

  const lowestUpdates = insights
    .filter((work) => work.badge === "過去最安" || work.badge === "90日安値")
    .sort((a, b) => b.buyScore - a.buyScore)
    .slice(0, 5);

  const buyTiming = insights
    .sort((a, b) => b.buyScore - a.buyScore || b.dropRate - a.dropRate)
    .slice(0, 5);

  return { priceDrops, lowestUpdates, buyTiming };
}

export const getHomePriceInsights = unstable_cache(
  fetchHomePriceInsights,
  ["home-price-insights"],
  { revalidate: HOME_PRICE_REVALIDATE_SECONDS }
);
