import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildRevenueStats,
  normalizeRevenueWorkIds,
  type RevenueEvent,
  type RevenueStat,
} from "./revenueWeightedWorksProjection";

type WorkLike = {
  id: number;
  score?: number | null;
  discount_rate?: number | null;
  review_count?: number | null;
  sale_price?: number | null;
};

const DAY_MS = 86_400_000;

function baseMerit(work: WorkLike) {
  const score = Math.max(0, work.score ?? 0);
  const discount = Math.max(0, work.discount_rate ?? 0);
  const reviews = Math.min(Math.max(work.review_count ?? 0, 0), 200);
  const saleBonus = work.sale_price && work.sale_price > 0 ? 8 : 0;
  return score + Math.min(discount / 2, 18) + reviews / 20 + saleBonus;
}

function revenueMerit(stat: RevenueStat | undefined) {
  if (!stat) return 4;
  const ctrBonus = stat.pageViews >= 3 ? Math.min(stat.ctr * 1.6, 40) : 0;
  const clickBonus = Math.min(stat.fanzaClicks * 7, 35);
  const explorationBonus = stat.pageViews === 0 ? 4 : stat.pageViews < 3 ? 2 : 0;
  return ctrBonus + clickBonus + explorationBonus;
}

export async function getRevenueStats(workIds: number[], days = 30) {
  const uniqueIds = normalizeRevenueWorkIds(workIds);
  if (!uniqueIds.length) return buildRevenueStats(uniqueIds, [], []);

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

  if (viewResult.error || clickResult.error) return buildRevenueStats(uniqueIds, [], []);

  return buildRevenueStats(
    uniqueIds,
    (viewResult.data ?? []) as RevenueEvent[],
    (clickResult.data ?? []) as RevenueEvent[],
  );
}

export async function sortByRevenuePotential<T extends WorkLike>(
  works: T[],
  options: { days?: number; limit?: number } = {},
) {
  const stats = await getRevenueStats(works.map((work) => work.id), options.days ?? 30);
  const ranked = [...works].sort((a, b) => {
    const aScore = baseMerit(a) + revenueMerit(stats.get(a.id));
    const bScore = baseMerit(b) + revenueMerit(stats.get(b.id));
    return bScore - aScore || (b.score ?? 0) - (a.score ?? 0) || a.id - b.id;
  });
  return typeof options.limit === "number" ? ranked.slice(0, options.limit) : ranked;
}
