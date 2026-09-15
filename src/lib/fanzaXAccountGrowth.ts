import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FanzaXAccountMetric = {
  id: number;
  metric_date: string;
  account_handle: string;
  followers_count: number;
  following_count: number | null;
  profile_visits: number;
  total_impressions: number;
  posts_count: number;
  likes: number;
  reposts: number;
  replies: number;
  fanza_clicks: number;
  sales_count: number;
  commission_amount: number;
  notes: string;
};

export type FanzaXGrowth = {
  error: string | null;
  diagnosis: "露出不足" | "露出あり/クリック不足" | "クリックあり/売上不足" | "売上発生・最適化段階";
  currentFollowers: number;
  followersDelta30d: number;
  newFollows30d: number;
  profileVisits30d: number;
  impressions30d: number;
  posts30d: number;
  avgImpressionsPerPost: number | null;
  xPageViews30d: number;
  fanzaClicks30d: number;
  salesCount30d: number;
  commission30d: number;
  ctr30d: number | null;
  cvr30d: number | null;
  epc30d: number | null;
  weeklyRows: Array<{
    metric_date: string;
    followers_count: number;
    posts_count: number;
    impressions: number;
    profile_visits: number;
    fanza_clicks: number;
    sales_count: number;
    commission_amount: number;
    epc: number | null;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function diagnose(impressions: number, clicks: number, sales: number): FanzaXGrowth["diagnosis"] {
  if (sales > 0) return "売上発生・最適化段階";
  if (clicks > 0) return "クリックあり/売上不足";
  if (impressions >= 1000) return "露出あり/クリック不足";
  return "露出不足";
}

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

    const metrics = (metricsResult.data ?? []) as FanzaXAccountMetric[];
    const firstMetric = metrics[0] ?? null;
    const latestMetric = metrics[metrics.length - 1] ?? null;
    const metricImpressions = metrics.reduce((sum, row) => sum + row.total_impressions, 0);
    const metricPosts = metrics.reduce((sum, row) => sum + row.posts_count, 0);
    const metricClicks = metrics.reduce((sum, row) => sum + row.fanza_clicks, 0);
    const metricSales = metrics.reduce((sum, row) => sum + row.sales_count, 0);
    const metricCommission = metrics.reduce((sum, row) => sum + row.commission_amount, 0);
    const salesRows = (salesResult.data ?? []) as Array<{ sales_count: number; commission_amount: number }>;
    const importedSales = salesRows.reduce((sum, row) => sum + row.sales_count, 0);
    const importedCommission = salesRows.reduce((sum, row) => sum + row.commission_amount, 0);
    const posts30d = Math.max(xPostResult.count ?? 0, metricPosts);
    const impressions30d = metricImpressions;
    const fanzaClicks30d = Math.max(xClickResult.count ?? 0, metricClicks);
    const salesCount30d = Math.max(importedSales, metricSales);
    const commission30d = Math.max(importedCommission, metricCommission);

    return {
      error: null,
      diagnosis: diagnose(impressions30d, fanzaClicks30d, salesCount30d),
      currentFollowers: latestMetric?.followers_count ?? 0,
      followersDelta30d: latestMetric && firstMetric ? latestMetric.followers_count - firstMetric.followers_count : 0,
      newFollows30d: latestMetric && firstMetric ? Math.max(0, latestMetric.followers_count - firstMetric.followers_count) : 0,
      profileVisits30d: metrics.reduce((sum, row) => sum + row.profile_visits, 0),
      impressions30d,
      posts30d,
      avgImpressionsPerPost: posts30d > 0 ? Math.round(impressions30d / posts30d) : null,
      xPageViews30d: xPageViewResult.count ?? 0,
      fanzaClicks30d,
      salesCount30d,
      commission30d,
      ctr30d: impressions30d > 0 ? fanzaClicks30d / impressions30d : null,
      cvr30d: fanzaClicks30d > 0 ? salesCount30d / fanzaClicks30d : null,
      epc30d: fanzaClicks30d > 0 ? Math.round(commission30d / fanzaClicks30d) : null,
      weeklyRows: metrics.map((row) => ({
        metric_date: row.metric_date,
        followers_count: row.followers_count,
        posts_count: row.posts_count,
        impressions: row.total_impressions,
        profile_visits: row.profile_visits,
        fanza_clicks: row.fanza_clicks,
        sales_count: row.sales_count,
        commission_amount: row.commission_amount,
        epc: row.fanza_clicks > 0 ? Math.round(row.commission_amount / row.fanza_clicks) : null,
      })),
    };
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
