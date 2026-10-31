import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { XPostCandidate } from "../xPostPlanner";

export const X_POST_PLANNER_DAY_MS = 86_400_000;
const DAY_MS = X_POST_PLANNER_DAY_MS;
export type CandidateWork = {
  id: number; product_id: string; title: string; actress: string | null; genre: string | null; maker: string | null; series: string | null;
  score: number | null; price: number | null; sale_price: number | null; list_price: number | null;
  discount_rate: number | null; review_average: number | null; review_count: number | null;
  ranking: number | null; lowest_price: number | null; is_bottom_price: boolean | null; release_date: string | null; image_url: string | null;
  stage: string | null; is_on_sale: boolean | null; sale_end_at: string | null; sample_movie_url: string | null;
};

export type PriceHistoryRow = {
  product_id: string; changed_at: string; display_name: string; period: string | null;
  normal_price: number | null; sale_price: number | null;
};

export type FunnelStat = {
  pageViews: number;
  fanzaClicks: number;
  ctr: number;
};

type FunnelEventCount = "pageViews" | "fanzaClicks";
type FunnelEventRow = { work_id: number };

const HISTORY_BATCH_SIZE = 20;
const HISTORY_PAGE_SIZE = 1000;
const CATEGORY_FUNNEL_WEIGHTS: Record<XPostCandidate["category"], number> = {
  sales: 18,
  hidden_gem: 14,
  today_discovery: 14,
  deal: 12,
  today_buy: 12,
  score: 8,
  actress_best: 8,
  genre_best: 8,
  new: 5,
  market_scan: 5,
  comparison_pick: 5,
  judgment_pick: 5,
  review_gap: 5,
  discovery_gap: 5,
  maker_best: 5,
  series_best: 5,
};

export function buildFunnelScore(
  work: CandidateWork,
  category: XPostCandidate["category"],
  chart: { hadPriceDrop: boolean } | null,
  funnel: FunnelStat,
) {
  const score = Math.max(0, work.score ?? 0);
  const reviewWeight = Math.min(Math.max(work.review_count ?? 0, 0), 200) / 20;
  const priceDropWeight = chart?.hadPriceDrop ? 18 : 0;
  const categoryWeight = CATEGORY_FUNNEL_WEIGHTS[category];
  const ctrWeight = funnel.pageViews >= 3 ? Math.min(funnel.ctr * 1.8, 45) : 0;
  const clickWeight = Math.min(funnel.fanzaClicks * 6, 30);
  const explorationWeight = funnel.pageViews === 0 ? 6 : funnel.pageViews < 3 ? 3 : 0;
  return Math.round(score + reviewWeight + priceDropWeight + categoryWeight + ctrWeight + clickWeight + explorationWeight);
}

export function accumulateXWorkFunnelEvents(
  stats: Map<number, FunnelStat>,
  rows: readonly FunnelEventRow[],
  count: FunnelEventCount,
) {
  for (const row of rows) {
    const current = stats.get(row.work_id);
    if (current) current[count] += 1;
  }
}

export async function fetchXWorkFunnels(workIds: number[]) {
  const uniqueIds = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const empty = new Map<number, FunnelStat>();
  if (!uniqueIds.length) return empty;

  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [viewResult, clickResult] = await Promise.all([
    supabaseAdmin
      .from("work_page_views")
      .select("work_id")
      .eq("source_page", "x")
      .in("work_id", uniqueIds)
      .gte("viewed_at", cutoff)
      .limit(50_000),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("work_id")
      .eq("source_page", "x")
      .in("work_id", uniqueIds)
      .gte("clicked_at", cutoff)
      .limit(50_000),
  ]);

  const stats = new Map<number, FunnelStat>();
  for (const id of uniqueIds) stats.set(id, { pageViews: 0, fanzaClicks: 0, ctr: 0 });

  if (!viewResult.error) accumulateXWorkFunnelEvents(stats, (viewResult.data ?? []) as Array<{ work_id: number }>, "pageViews");
  if (!clickResult.error) accumulateXWorkFunnelEvents(stats, (clickResult.data ?? []) as Array<{ work_id: number }>, "fanzaClicks");

  for (const current of stats.values()) {
    current.ctr = current.pageViews > 0
      ? Math.round((current.fanzaClicks / current.pageViews) * 1000) / 10
      : 0;
  }

  return stats;
}

export async function fetchHistory(productIds: string[]) {
  const rows: PriceHistoryRow[] = [];
  for (let start = 0; start < productIds.length; start += HISTORY_BATCH_SIZE) {
    const ids = productIds.slice(start, start + HISTORY_BATCH_SIZE);
    for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("price_history")
        .select("product_id,changed_at,display_name,period,normal_price,sale_price")
        .in("product_id", ids)
        .order("product_id", { ascending: true })
        .order("changed_at", { ascending: false })
        .range(offset, offset + HISTORY_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as PriceHistoryRow[]));
      if (!data?.length || data.length < HISTORY_PAGE_SIZE) break;
    }
  }
  return rows;
}

