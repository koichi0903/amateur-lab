import {
  AFFILIATE_SOURCE_LABELS,
  normalizeAffiliateSource,
  type AffiliateSource,
} from "@/lib/affiliateTracking";
import {
  CTA_VARIANTS,
  CTA_VARIANT_LABELS,
  normalizeCtaVariant,
  type CtaVariant,
} from "@/lib/ctaExperiment";
import {
  isOperatorLandingPath,
  type ExternalAttributionChannel,
} from "@/lib/externalAttribution";
import type { XPostCandidate } from "@/lib/xPostPlanner";
import { buildXPostCategoryRevenue } from "./affiliateAnalyticsPostCategories";
import { buildWorkFunnelRows } from "./affiliateAnalyticsFunnels";
import { fetchAffiliateClicks, fetchAffiliateImpressions, fetchLatestXPostTimes, fetchWorkPageViews, fetchWorkSummaries, fetchXPostLogMap } from "./affiliateAnalyticsQueries";
export { fetchAffiliateClicks } from "./affiliateAnalyticsQueries";
export type { AffiliateClickRow } from "./affiliateAnalyticsQueries";
import {
  AFFILIATE_ANALYTICS_DAY_MS as DAY_MS,
  buildTrafficInsights,
  countBy,
} from "./affiliateAnalyticsInsights";
import {
  affiliateAnalyticsJstDayKey as jstDayKey,
  buildAffiliateClickTimeMetrics,
  buildAffiliateDailyClickCounts,
} from "./affiliateAnalyticsTime";

export type TrafficInsightAction =
  | "expand"
  | "maintain"
  | "recover"
  | "observe";

export type TrafficInsight = {
  key: string;
  label: string;
  total: number;
  share: number;
  lastSevenDays: number;
  previousSevenDays: number;
  growthRate: number | null;
  action: TrafficInsightAction;
  actionReason: string;
};

export type CtaVariantPerformance = {
  variant: CtaVariant;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type WorkFunnelRow = {
  workId: number;
  title: string;
  sourcePage: AffiliateSource;
  pageViews: number;
  fanzaClicks: number;
  ctr: number;
  price: number | null;
  discountRate: number | null;
  discoveryScore: number | null;
  ranking: number | null;
  latestPostedAt: string | null;
};

export type XPostCategoryRevenueRow = {
  category: XPostCandidate["category"] | "bijyo_reserved" | "unknown";
  label: string;
  posts: number;
  xPageViews: number;
  xFanzaClicks: number;
  xCtr: number;
  pvPerPost: number;
  clicksPerPost: number;
  topWorks: Array<{
    workId: number;
    title: string;
    xPageViews: number;
    xFanzaClicks: number;
    xCtr: number;
  }>;
};

export const AFFILIATE_PLACEMENT_LABELS: Record<string, string> = {
  "detail-sidebar": "詳細ページ・サイドCTA",
  "buy-timing-panel": "買い時判定パネル",
  "mobile-sticky": "スマホ固定バー配置",
  "compare-card": "比較カード",
  "sample-movie-fallback": "公式サンプル誘導",
  "listing-card": "一覧カード",
};


export async function getAffiliateAnalytics(categoryDays = 7) {
  const safeCategoryDays = categoryDays === 30 ? 30 : 7;
  const categoryCutoff = Date.now() - safeCategoryDays * DAY_MS;
  const [result, impressionResult, pageViewResult, categoryLogResult] = await Promise.all([
    fetchAffiliateClicks(30),
    fetchAffiliateImpressions(30),
    fetchWorkPageViews(30),
    fetchXPostLogMap(safeCategoryDays),
  ]);
  const now = new Date();
  const reportingRows = result.rows.filter(
    (row) => !isOperatorLandingPath(row.landing_path),
  );
  const clickTimeMetrics = buildAffiliateClickTimeMetrics(reportingRows, now);
  const {
    todayKey,
    sevenDayCutoff,
    previousSevenDayCutoff,
    today,
    lastSevenDays,
    growthRate,
  } = clickTimeMetrics;

  const workCounts = countBy(reportingRows.map((row) => String(row.work_id)))
    .slice(0, 10);
  const xRows = reportingRows.filter((row) => row.source_page === "x");
  const xWorkCounts = countBy(xRows.map((row) => String(row.work_id)))
    .slice(0, 8);
  const workIds = workCounts.map((item) => Number(item.key));
  const xWorkIds = xWorkCounts.map((item) => Number(item.key));
  const recentWorkIds = reportingRows.slice(0, 20).map((row) => row.work_id);
  const recentXWorkIds = xRows.slice(0, 10).map((row) => row.work_id);
  const pageViewWorkIds = pageViewResult.rows.map((row) => row.work_id);
  const works = await fetchWorkSummaries([
    ...new Set([...workIds, ...xWorkIds, ...recentWorkIds, ...recentXWorkIds]),
    ...pageViewWorkIds,
  ]);
  const xPostTimes = await fetchLatestXPostTimes([
    ...new Set(pageViewResult.rows.map((row) => row.x_post_key).filter((key): key is string => Boolean(key))),
  ]);

  const daily = buildAffiliateDailyClickCounts(reportingRows, now);

  const sourcePlacementMap = new Map<AffiliateSource, { total: number; desktop: number; mobile: number }>();
  for (const row of reportingRows) {
    const current = sourcePlacementMap.get(row.source_page) ?? {
      total: 0,
      desktop: 0,
      mobile: 0,
    };
    current.total += 1;
    if (row.placement === "mobile-sticky") current.mobile += 1;
    if (row.placement === "detail-sidebar") current.desktop += 1;
    sourcePlacementMap.set(row.source_page, current);
  }

  const sourceInsights = buildTrafficInsights(
    reportingRows,
    (row) => row.source_page,
    (key) => AFFILIATE_SOURCE_LABELS[normalizeAffiliateSource(key)],
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const placementInsights = buildTrafficInsights(
    reportingRows,
    (row) => row.placement,
    (key) => AFFILIATE_PLACEMENT_LABELS[key] ?? key,
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const ctaVariantInsights = buildTrafficInsights(
    reportingRows.filter((row) =>
      row.cta_variant !== null &&
      (row.placement === "detail-sidebar" || row.placement === "mobile-sticky")
    ),
    (row) => row.cta_variant ?? "control",
    (key) => CTA_VARIANT_LABELS[normalizeCtaVariant(key)],
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const externalChannelLabels: Record<ExternalAttributionChannel, string> = {
    direct: "直接流入として記録",
    organic_search: "検索流入として記録",
    social: "SNS流入として記録",
    referral: "参照流入として記録",
    internal: "サイト内として記録",
  };
  const externallyAttributedRows = reportingRows.filter(
    (row) => row.external_channel !== null,
  );
  const externalChannelInsights = buildTrafficInsights(
    externallyAttributedRows,
    (row) => row.external_channel ?? "direct",
    (key) => externalChannelLabels[key as ExternalAttributionChannel] ?? key,
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const organicRows = reportingRows.filter(
    (row) => row.external_channel === "organic_search" && row.landing_path,
  );
  const organicLandingInsights = buildTrafficInsights(
    organicRows,
    (row) => row.landing_path ?? "/",
    (key) => key,
    sevenDayCutoff,
    previousSevenDayCutoff,
  ).slice(0, 12);
  const experimentStartedAt = impressionResult.rows.length
    ? Math.min(...impressionResult.rows.map((row) => new Date(row.viewed_at).getTime()))
    : null;
  const experimentClicks = reportingRows.filter((row) =>
    row.cta_variant !== null &&
    experimentStartedAt !== null &&
    new Date(row.clicked_at).getTime() >= experimentStartedAt &&
    (row.placement === "detail-sidebar" || row.placement === "mobile-sticky")
  );
  const ctaVariantPerformance: CtaVariantPerformance[] = CTA_VARIANTS.map((variant) => {
    const impressions = impressionResult.rows.filter(
      (row) => row.cta_variant === variant,
    ).length;
    const clicks = experimentClicks.filter(
      (row) => row.cta_variant === variant,
    ).length;
    return {
      variant,
      label: CTA_VARIANT_LABELS[variant],
      impressions,
      clicks,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    };
  });
  const workFunnels: WorkFunnelRow[] = buildWorkFunnelRows({
    clicks: reportingRows,
    pageViews: pageViewResult.rows,
    works,
    xPostTimes,
  });

  const xPostCategoryRevenue: XPostCategoryRevenueRow[] = await buildXPostCategoryRevenue({
    categoryCutoff,
    pageViews: pageViewResult.rows,
    clicks: reportingRows,
    logs: categoryLogResult.logs,
    works,
    fetchWorks: fetchWorkSummaries,
  });

  return {
    error: result.error,
    sourceAttributionEnabled: result.sourceAttributionEnabled,
    ctaExperimentEnabled: result.ctaExperimentEnabled,
    ctaImpressionTrackingEnabled: impressionResult.enabled,
    pageViewTrackingEnabled: pageViewResult.enabled,
    xPostLogTrackingEnabled: categoryLogResult.enabled,
    xPostLogError: categoryLogResult.error,
    categoryDays: safeCategoryDays,
    externalAttributionEnabled: result.externalAttributionEnabled,
    totals: {
      today,
      sevenDays: lastSevenDays,
      thirtyDays: reportingRows.length,
      workPageViewsThirtyDays: pageViewResult.rows.length,
      uniqueWorks: new Set(reportingRows.map((row) => row.work_id)).size,
      growthRate,
    },
    daily,
    sources: countBy(reportingRows.map((row) => row.source_page)).map((item) => ({
      ...item,
      label: AFFILIATE_SOURCE_LABELS[item.key],
    })),
    placements: countBy(reportingRows.map((row) => row.placement)),
    sourcePlacements: [...sourcePlacementMap.entries()]
      .map(([key, counts]) => ({
        key,
        label: AFFILIATE_SOURCE_LABELS[key],
        ...counts,
        mobileShare: counts.total > 0
          ? Math.round((counts.mobile / counts.total) * 100)
          : 0,
      }))
      .sort((a, b) => b.total - a.total),
    xTraffic: {
      today: xRows.filter(
        (row) => jstDayKey(new Date(row.clicked_at)) === todayKey,
      ).length,
      sevenDays: xRows.filter(
        (row) => new Date(row.clicked_at).getTime() >= sevenDayCutoff,
      ).length,
      thirtyDays: xRows.length,
      share: reportingRows.length > 0
        ? Math.round((xRows.length / reportingRows.length) * 100)
        : 0,
      topWorks: xWorkCounts.map((item) => ({
        workId: Number(item.key),
        title: works.get(Number(item.key))?.title ?? `作品ID ${item.key}`,
        clicks: item.count,
      })),
      recent: xRows.slice(0, 10).map((row) => ({
        ...row,
        title: works.get(row.work_id)?.title ?? `作品ID ${row.work_id}`,
      })),
    },
    sourceInsights,
    placementInsights,
    ctaVariantInsights,
    externalChannelInsights,
    organicLandingInsights,
    ctaVariantPerformance,
    workFunnels,
    xPostCategoryRevenue,
    topWorks: workCounts.map((item) => ({
      workId: Number(item.key),
      title: works.get(Number(item.key))?.title ?? `作品ID ${item.key}`,
      clicks: item.count,
    })),
    recent: reportingRows.slice(0, 20).map((row) => ({
      ...row,
      title: works.get(row.work_id)?.title ?? `作品ID ${row.work_id}`,
    })),
  };
}
