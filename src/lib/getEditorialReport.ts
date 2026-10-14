import { unstable_cache } from "next/cache";
import type { DealWork } from "@/components/deals/DealWorkCard";
import type { ReportSlug } from "@/lib/editorialContent";
import { DEAL_COLUMNS } from "@/lib/getDeals";
import { supabase } from "@/lib/supabase";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

export type EditorialReportWork = DealWork & {
  previous_realtime_rank?: number | null;
  realtime_rank?: number | null;
};

const getPriceDrops = unstable_cache(async () => {
  const { data, error } = await supabase
    .from("works")
    .select(DEAL_COLUMNS)
    .eq("is_bottom_price", true)
    .gt("price", 0)
    .order("discount_rate", { ascending: false, nullsFirst: false })
    .limit(30);
  return { works: (data ?? []) as unknown as EditorialReportWork[], error };
}, ["editorial-report-price-drops-v1"], { revalidate: 1800 });

const getRankingMovers = unstable_cache(async () => {
  const { data, error } = await supabase
    .from("works")
    .select(`${DEAL_COLUMNS},previous_realtime_rank,realtime_rank`)
    .not("previous_realtime_rank", "is", null)
    .not("realtime_rank", "is", null)
    .lte("realtime_rank", 200)
    .order("realtime_rank", { ascending: true })
    .limit(150);
  const works = ((data ?? []) as unknown as EditorialReportWork[])
    .filter((work) => (work.previous_realtime_rank ?? 0) > (work.realtime_rank ?? 0))
    .sort((a, b) => ((b.previous_realtime_rank ?? 0) - (b.realtime_rank ?? 0)) - ((a.previous_realtime_rank ?? 0) - (a.realtime_rank ?? 0)))
    .slice(0, 30);
  return { works, error };
}, ["editorial-report-ranking-movers-v1"], { revalidate: 1800 });

async function fetchPriceBandSide(min: number, max: number, onSale: boolean) {
  let query = supabase
    .from("works")
    .select(DEAL_COLUMNS)
    .gt("price", 0)
    .gte("review_count", 1)
    .not("image_url", "is", null)
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%");

  if (onSale) {
    query = query.gt("sale_price", 0).gte("sale_price", min);
    if (Number.isFinite(max)) query = query.lt("sale_price", max);
  } else {
    query = query.or("sale_price.is.null,sale_price.eq.0").gte("price", min);
    if (Number.isFinite(max)) query = query.lt("price", max);
  }

  return query
    .order("review_average", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .limit(40);
}

const getPriceBands = unstable_cache(async () => {
  const bands = [
    { min: 0, max: 1000 },
    { min: 1000, max: 3000 },
    { min: 3000, max: Number.POSITIVE_INFINITY },
  ] as const;
  const results = await Promise.all(bands.map(({ min, max }) => Promise.all([
    fetchPriceBandSide(min, max, true),
    fetchPriceBandSide(min, max, false),
  ])));
  const error = results.flat().find((result) => result.error)?.error ?? null;
  const works = results.flatMap((sideResults) => {
    const candidates = sideResults.flatMap((result) => result.data ?? []) as unknown as EditorialReportWork[];
    return candidates
      .filter(isNonVrWork)
      .sort((a, b) =>
        (b.review_average ?? 0) - (a.review_average ?? 0)
        || (b.review_count ?? 0) - (a.review_count ?? 0)
        || ((a.sale_price > 0 ? a.sale_price : a.price) - (b.sale_price > 0 ? b.sale_price : b.price))
      )
      .slice(0, 10);
  });
  return { works, error };
}, ["editorial-report-price-bands-v1"], { revalidate: 1800 });

const getSaleEnding = unstable_cache(async () => {
  const now = new Date();
  const limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("works")
    .select(DEAL_COLUMNS)
    .eq("is_on_sale", true)
    .gt("sale_end_at", now.toISOString())
    .lte("sale_end_at", limit.toISOString())
    .order("sale_end_at", { ascending: true })
    .limit(30);
  return { works: (data ?? []) as unknown as EditorialReportWork[], error };
}, ["editorial-report-sale-ending-v1"], { revalidate: 1800 });

export async function getEditorialReport(slug: ReportSlug) {
  if (slug === "price-drops") return getPriceDrops();
  if (slug === "price-bands") return getPriceBands();
  if (slug === "ranking-movers") return getRankingMovers();
  return getSaleEnding();
}
