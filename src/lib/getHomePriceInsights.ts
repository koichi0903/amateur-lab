import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { unstable_cache } from "next/cache";
import { normalizeDisplayName } from "@/lib/createChartData";
import { getAiDiscoveries } from "@/lib/getAiDiscoveries";

const HOME_PRICE_REVALIDATE_SECONDS = 1800;
const HOME_PRICE_HISTORY_LIMIT = 2000;
const HOME_PRICE_SPARKLINE_POINTS = 8;

type PriceHistoryRow = {
  product_id: string;
  changed_at: string;
  display_name: string;
  period: string | null;
  price_kind: "regular" | "sale" | null;
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
  | "sale_end_at"
  | "ranking"
  | "realtime_rank"
  | "review_average"
  | "review_count"
  | "score"
> & {
  currentPrice: number;
  previousPrice: number | null;
  dropAmount: number;
  dropRate: number;
  low90Price: number;
  peak90Price: number;
  buyScore: number;
  badge: "急落" | "過去最安" | "90日安値" | "買い時" | "価格上昇";
  sparkline: number[];
};

const effectivePrice = (row: PriceHistoryRow) =>
  row.sale_price && row.sale_price > 0
    ? row.sale_price
    : row.normal_price && row.normal_price > 0
      ? row.normal_price
      : null;

const currentWorkPrice = (work: Pick<Work, "price" | "sale_price" | "sale_end_at">) =>
  work.sale_price && work.sale_price > 0 && work.sale_end_at && new Date(work.sale_end_at).getTime() > Date.now()
    ? work.sale_price
    : work.price;

type PriceObservation = {
  value: number;
  changed_at: string;
};

// Eligibility uses one displayed price per history timestamp. Whether that
// displayed price came from a sale or a regular price is irrelevant.
const allPriceObservations = (rows: PriceHistoryRow[]): PriceObservation[] =>
  rows.flatMap((row) => {
    const value = effectivePrice(row);
    return value && value > 0 ? [{ value, changed_at: row.changed_at }] : [];
  });

const collapsePriceHistory = (rows: Array<{ value: number }>) => {
  const result: Array<{ value: number }> = [];
  for (const row of [...rows].reverse()) {
    if (result.at(-1)?.value !== row.value) result.push(row);
  }
  return result.reverse();
};

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

function buildHeroInsight(work: HomePriceInsightWork, rows: PriceHistoryRow[]): HomePriceInsightWork | null {
  const sorted = rows
    .map((row) => ({ ...row, value: effectivePrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => row.value !== null)
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  if (!sorted.length) return null;

  const currentPrice = currentWorkPrice(work);
  if (!currentPrice || currentPrice <= 0) return null;

  // A snapshot can contain several sales formats at nearly the same time.
  // Start from a row matching the live displayed price, then validate that
  // the newest row in that exact format and period still has that price.
  const currentRow = sorted.find((row) => row.value === currentPrice);
  if (!currentRow) return null;
  const currentFormat = normalizeDisplayName(currentRow.display_name);
  const currentPeriod = currentRow.period ?? null;
  const chartRows = sorted.filter(
    (row) =>
      normalizeDisplayName(row.display_name) === currentFormat &&
      (row.period ?? null) === currentPeriod,
  );
  if (!chartRows.length || chartRows[0].value !== currentPrice) return null;
  // Compare only with the immediately preceding price of the same format.
  // Looking farther back would incorrectly turn 1,480 -> 250 -> 500 into a
  // current 66% discount, even though the latest movement was an increase.
  const chartHistory = chartRows.length >= 1 ? chartRows : sorted;
  const previous = chartHistory.find(
    (row) =>
      row.value !== currentPrice &&
      new Date(row.changed_at).getTime() < new Date(chartRows[0].changed_at).getTime(),
  );
  const historicalPrices = chartHistory.map((row) => row.value);
  const low90Price = Math.min(...historicalPrices, currentPrice);
  const previousPrice = previous?.value ?? null;
  const dropAmount = previousPrice && previousPrice > currentPrice ? previousPrice - currentPrice : 0;
  const dropRate = previousPrice && previousPrice > currentPrice ? Math.round((dropAmount / previousPrice) * 100) : 0;
  const discountRate = work.discount_rate > 0 ? work.discount_rate : work.list_price && work.list_price > currentPrice ? Math.round((1 - currentPrice / work.list_price) * 100) : 0;
  // Do not trust the denormalized flag after a sale ends; compare with the
  // price history so a price increase cannot still be labeled as a bargain.
  const isBottomPrice = currentPrice <= low90Price * 1.05;
  const buyScore = scoreBuyTiming({
    currentPrice,
    previousPrice,
    low90Price,
    dropRate,
    discountRate,
    isBottomPrice,
  });
  const badge = dropRate >= 25 ? "急落" : isBottomPrice ? "過去最安" : currentPrice <= low90Price * 1.05 ? "90日安値" : currentPrice > low90Price ? "価格上昇" : "買い時";
  const sparkline = collapsePriceHistory(chartRows.length >= 2 ? chartRows : [{ value: currentPrice }])
    .reverse()
    .map((row) => row.value)
    .slice(-HOME_PRICE_SPARKLINE_POINTS);

  if (!previousPrice || previousPrice <= currentPrice || dropAmount <= 0) return null;

  return {
    ...work,
    currentPrice,
    previousPrice,
    dropAmount,
    dropRate,
    low90Price,
    buyScore,
    badge,
    sparkline: sparkline.length >= 2 ? sparkline : [currentPrice, currentPrice],
  };
}

function buildInsight(work: HomePriceInsightWork, rows: PriceHistoryRow[]): HomePriceInsightWork | null {
  const currentPrice = currentWorkPrice(work);
  const displayedRows = rows
    .map((row) => ({ ...row, value: effectivePrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => Boolean(row.value && row.value > 0))
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  if (!displayedRows.length || !currentPrice || currentPrice <= 0) return null;

  const seriesLatest = displayedRows.find((row) => row.value === currentPrice) ?? displayedRows[0];
  const priceRows = displayedRows.filter(
    (row) =>
      normalizeDisplayName(row.display_name) === normalizeDisplayName(seriesLatest.display_name) &&
      (row.period ?? null) === (seriesLatest.period ?? null),
  );
  const observations = allPriceObservations(priceRows).sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );
  if (!observations.some((row) => row.value === currentPrice)) return null;

  // Candidate selection is independent from sale/list status:
  // 1) a higher price existed in the last 90 days, and
  // 2) the live price is no higher than every recorded price.
  const hadHigherPrice = observations.some((row) => row.value > currentPrice);
  const isCurrentLowest = observations.every((row) => row.value >= currentPrice);
  if (!hadHigherPrice || !isCurrentLowest) return null;

  const chartRows = priceRows;
  const previous = observations.find((row) => row.value !== currentPrice);
  const historicalPrices = observations.map((row) => row.value);
  const low90Price = Math.min(...historicalPrices, currentPrice);
  const peak90Price = Math.max(...historicalPrices, currentPrice);
  const previousPrice = previous?.value ?? null;
  const dropAmount = previousPrice && previousPrice > currentPrice ? previousPrice - currentPrice : 0;
  const dropRate = previousPrice && previousPrice > currentPrice ? Math.round((dropAmount / previousPrice) * 100) : 0;
  const discountRate = work.discount_rate > 0 ? work.discount_rate : work.list_price && work.list_price > currentPrice ? Math.round((1 - currentPrice / work.list_price) * 100) : 0;
  const isBottomPrice = currentPrice <= low90Price;
  const buyScore = scoreBuyTiming({ currentPrice, previousPrice, low90Price, dropRate, discountRate, isBottomPrice });
  const badge = dropRate >= 25 ? "急落" : isBottomPrice ? "過去最安" : currentPrice <= low90Price * 1.05 ? "90日安値" : "買い時";
  const sparkline = collapsePriceHistory(chartRows.length >= 2 ? chartRows : [{ value: currentPrice }]).reverse().map((row) => row.value).slice(-HOME_PRICE_SPARKLINE_POINTS);
  return { ...work, currentPrice, previousPrice, dropAmount, dropRate, low90Price, peak90Price, buyScore, badge, sparkline: sparkline.length >= 2 ? sparkline : [currentPrice, currentPrice] };
}

export async function getPriceInsightForWork(work: HomePriceInsightWork) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("price_history")
    .select("product_id,changed_at,display_name,period,price_kind,normal_price,sale_price")
    .eq("product_id", work.product_id)
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(HOME_PRICE_HISTORY_LIMIT);
  if (error || !data?.length) return null;
  return buildInsight(work, data as PriceHistoryRow[]);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const getHeroPriceDrop = unstable_cache(async () => {
  const discoveries = await getAiDiscoveries();
  const works = discoveries.slice(0, 80) as unknown as HomePriceInsightWork[];
  if (!works.length) return null;

  const productIds = works.map((work) => work.product_id).filter(Boolean);
  const { data: history } = await supabase
    .from("price_history")
    .select("product_id,changed_at,display_name,period,price_kind,normal_price,sale_price")
    .in("product_id", productIds)
    .order("changed_at", { ascending: false })
    .limit(HOME_PRICE_HISTORY_LIMIT);
  const rowsByProduct = new Map<string, PriceHistoryRow[]>();
  for (const row of (history ?? []) as PriceHistoryRow[]) {
    rowsByProduct.set(row.product_id, [...(rowsByProduct.get(row.product_id) ?? []), row]);
  }
  const eligible = works
    .map((work) => buildHeroInsight(work, rowsByProduct.get(work.product_id) ?? []))
    .filter((work): work is HomePriceInsightWork => work !== null && work.dropAmount > 0)
    .sort((a, b) => b.score - a.score || b.dropRate - a.dropRate)
    .slice(0, 20);
  if (!eligible.length) return null;

  const newestHistoryAt = (history ?? []).reduce(
    (latest, row) => row.changed_at > latest ? row.changed_at : latest,
    "",
  );
  const seed = `${newestHistoryAt}:${eligible.map((work) => work.product_id).join(",")}`;
  return eligible[stableHash(seed) % eligible.length] ?? null;
}, ["hero-ai-price-drop-v1"], { revalidate: 86400, tags: ["hero-price-drop", "home-daily-discovery"] });

async function fetchHomePriceInsightsSeparated() {
  const columns = "id,product_id,title,image_url,price,sale_price,list_price,discount_rate,lowest_price,is_bottom_price,sale_end_at,ranking,realtime_rank,review_average,review_count,score";
  const allWorks: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("works")
      .select(columns)
      .gt("price", 0)
      .order("score", { ascending: false, nullsFirst: false })
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    allWorks.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) break;
  }
  const candidates = allWorks;
  const productIds = [...new Set(candidates.map((work) => work.product_id).filter(Boolean))];
  if (!productIds.length) return { priceDrops: [], lowestUpdates: [], buyTiming: [], all: [] };
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const insights: HomePriceInsightWork[] = [];
  const batchSize = 250;

  // Process every candidate in bounded batches before ranking the independent
  // result sets. Stopping after 60 buy-timing matches can hide regular-price
  // drops that occur later in the score-ordered works list.
  for (let start = 0; start < candidates.length; start += batchSize) {
    const works = candidates.slice(start, start + batchSize) as unknown as HomePriceInsightWork[];
    const ids = works.map((work) => work.product_id).filter(Boolean);
    const history: PriceHistoryRow[] = [];
    let historyError = false;
    for (let offset = 0; ; offset += 5000) {
      const { data, error } = await supabase
        .from("price_history")
        .select("product_id,changed_at,display_name,period,price_kind,normal_price,sale_price")
        .in("product_id", ids)
        .gte("changed_at", since)
        .order("changed_at", { ascending: false })
        .range(offset, offset + 4999);
      if (error) {
        historyError = true;
        break;
      }
      history.push(...((data ?? []) as PriceHistoryRow[]));
      if (!data?.length || data.length < 5000) break;
    }
    if (historyError) continue;
    const rowsByProduct = new Map<string, PriceHistoryRow[]>();
    for (const row of history) {
      rowsByProduct.set(row.product_id, [...(rowsByProduct.get(row.product_id) ?? []), row]);
    }
    for (const work of works) {
      const insight = buildInsight(work, rowsByProduct.get(work.product_id) ?? []);
      if (insight) insights.push(insight);
    }
  }
  const priceDrops = insights
    .filter((work) => work.sale_price > 0 && (!work.sale_end_at || new Date(work.sale_end_at).getTime() > Date.now()) && work.dropAmount > 0)
    .sort((a, b) => b.dropAmount - a.dropAmount || b.dropRate - a.dropRate)
    .slice(0, 5);
  const buyTiming = insights
    .filter((work) => work.peak90Price > work.currentPrice && work.currentPrice <= work.low90Price)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
  // Select lowest-price updates only after validating every candidate's
  // 90-day history. Limiting `is_bottom_price` rows before validation can
  // leave this section empty when high-score rows contain stale flags from
  // sales that have already ended.
  const lowestUpdates = insights
    .filter(
      (work) =>
        work.lowest_price != null &&
        work.lowest_price > 0 &&
        work.currentPrice <= work.lowest_price,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
  return { priceDrops, lowestUpdates: lowestUpdates.slice(0, 5), buyTiming: buyTiming.slice(0, 100), all: insights };
}

export const getHomePriceInsights = unstable_cache(
  fetchHomePriceInsightsSeparated,
  ["home-price-insights-v25"],
  { revalidate: HOME_PRICE_REVALIDATE_SECONDS }
);
