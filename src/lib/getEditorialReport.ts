import { unstable_cache } from "next/cache";
import type { DealWork } from "@/components/deals/DealWorkCard";
import type { ReportSlug } from "@/lib/editorialContent";
import { DEAL_COLUMNS } from "@/lib/getDeals";
import { supabase } from "@/lib/supabase";

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
  if (slug === "ranking-movers") return getRankingMovers();
  return getSaleEnding();
}
