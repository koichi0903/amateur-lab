import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { projectFanzaXGrowth, type FanzaXAccountMetric, type FanzaXGrowth } from "@/lib/fanzaXAccountGrowthProjection";

export type { FanzaXAccountMetric, FanzaXGrowth } from "@/lib/fanzaXAccountGrowthProjection";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getFanzaXAccountGrowth(accountHandle = "hakkutsu_lab"): Promise<FanzaXGrowth> {
  try {
    const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const cutoffDate = cutoff.slice(0, 10);
    const [metricsResult, xPostResult, xPageViewResult, xClickResult, salesResult] = await Promise.all([
      supabaseAdmin
        .from("fanza_x_account_metrics")
        .select("id,metric_date,account_handle,followers_count,following_count,profile_visits,total_impressions,posts_count,likes,reposts,replies,fanza_clicks,sales_count,commission_amount,notes")
        .eq("account_handle", accountHandle)
        .gte("metric_date", cutoffDate)
        .order("metric_date", { ascending: true })
        .limit(10),
      supabaseAdmin
        .from("x_post_logs")
        .select("id", { count: "exact", head: true })
        .gte("posted_at", cutoff),
      supabaseAdmin
        .from("work_page_views")
        .select("id", { count: "exact", head: true })
        .eq("source_page", "x")
        .gte("viewed_at", cutoff),
      supabaseAdmin
        .from("affiliate_clicks")
        .select("id", { count: "exact", head: true })
        .eq("source_page", "x")
        .gte("clicked_at", cutoff),
      supabaseAdmin
        .from("affiliate_sales")
        .select("sales_count,commission_amount")
        .gte("report_month", cutoffDate)
        .limit(50_000),
    ]);

    const error = [
      metricsResult.error,
      xPostResult.error,
      xPageViewResult.error,
      xClickResult.error,
      salesResult.error,
    ].find(Boolean);
    if (error) throw error;

    return projectFanzaXGrowth({
      metrics: (metricsResult.data ?? []) as FanzaXAccountMetric[],
      xPostsCount: xPostResult.count ?? 0,
      xPageViewsCount: xPageViewResult.count ?? 0,
      xClicksCount: xClickResult.count ?? 0,
      salesRows: (salesResult.data ?? []) as Array<{ sales_count: number; commission_amount: number }>,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Xアカウント成長を読み込めませんでした",
      diagnosis: "露出不足",
      currentFollowers: 0,
      followersDelta30d: 0,
      newFollows30d: 0,
      profileVisits30d: 0,
      impressions30d: 0,
      posts30d: 0,
      avgImpressionsPerPost: null,
      xPageViews30d: 0,
      fanzaClicks30d: 0,
      salesCount30d: 0,
      commission30d: 0,
      ctr30d: null,
      cvr30d: null,
      epc30d: null,
      weeklyRows: [],
    };
  }
}
