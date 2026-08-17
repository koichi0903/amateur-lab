import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

export type AffiliateClickRow = {
  id: number;
  work_id: number;
  placement: string;
  source_page: AffiliateSource;
  cta_variant: CtaVariant | null;
  clicked_at: string;
};

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

type AffiliateImpressionRow = {
  cta_variant: CtaVariant;
  viewed_at: string;
};

export const AFFILIATE_PLACEMENT_LABELS: Record<string, string> = {
  "detail-sidebar": "PC・詳細サイド",
  "mobile-sticky": "スマホ固定バー",
  "compare-card": "比較カード",
};

type WorkSummary = {
  id: number;
  title: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

function jstDayKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function fetchClickPage(
  cutoff: string,
  from: number,
  includeSource: boolean,
  includeVariant: boolean,
) {
  const columns = [
    "id",
    "work_id",
    "placement",
    includeSource ? "source_page" : null,
    includeVariant ? "cta_variant" : null,
    "clicked_at",
  ].filter(Boolean).join(",");
  return supabaseAdmin
    .from("affiliate_clicks")
    .select(columns)
    .gte("clicked_at", cutoff)
    .order("clicked_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
}

export async function fetchAffiliateClicks(days = 30) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const rows: AffiliateClickRow[] = [];
  let sourceAttributionEnabled = true;
  let ctaExperimentEnabled = true;

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let result = await fetchClickPage(
      cutoff,
      from,
      sourceAttributionEnabled,
      ctaExperimentEnabled,
    );

    if (result.error && ctaExperimentEnabled && result.error.message.includes("cta_variant")) {
      ctaExperimentEnabled = false;
      result = await fetchClickPage(cutoff, from, sourceAttributionEnabled, false);
    }

    if (result.error && sourceAttributionEnabled && result.error.message.includes("source_page")) {
      sourceAttributionEnabled = false;
      result = await fetchClickPage(cutoff, from, false, ctaExperimentEnabled);
    }

    if (result.error) {
      return {
        rows: [] as AffiliateClickRow[],
        sourceAttributionEnabled,
        ctaExperimentEnabled,
        error: result.error.message,
      };
    }

    const page = (result.data ?? []) as unknown as Array<{
      id: number;
      work_id: number;
      placement: string;
      source_page?: string | null;
      cta_variant?: string | null;
      clicked_at: string;
    }>;
    rows.push(
      ...page.map((row) => ({
        ...row,
        source_page: normalizeAffiliateSource(row.source_page),
        cta_variant: row.cta_variant
          ? normalizeCtaVariant(row.cta_variant)
          : null,
      })),
    );

    if (page.length < PAGE_SIZE) break;
  }

  return {
    rows,
    sourceAttributionEnabled,
    ctaExperimentEnabled,
    error: null as string | null,
  };
}

async function fetchAffiliateImpressions(days = 30) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const rows: AffiliateImpressionRow[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from("affiliate_cta_impressions")
      .select("cta_variant,viewed_at")
      .gte("viewed_at", cutoff)
      .order("viewed_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) {
      return {
        rows: [] as AffiliateImpressionRow[],
        enabled: false,
        error: result.error.message,
      };
    }

    const page = (result.data ?? []) as Array<{
      cta_variant: string;
      viewed_at: string;
    }>;
    rows.push(...page.map((row) => ({
      cta_variant: normalizeCtaVariant(row.cta_variant),
      viewed_at: row.viewed_at,
    })));
    if (page.length < PAGE_SIZE) break;
  }

  return { rows, enabled: true, error: null as string | null };
}

async function fetchWorkSummaries(workIds: number[]) {
  if (!workIds.length) return new Map<number, WorkSummary>();

  const { data } = await supabaseAdmin
    .from("works")
    .select("id,title")
    .in("id", workIds);
  const works = (data ?? []) as WorkSummary[];
  return new Map(works.map((work) => [work.id, work]));
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function classifyTrafficInsight({
  total,
  lastSevenDays,
  previousSevenDays,
  growthRate,
}: Pick<
  TrafficInsight,
  "total" | "lastSevenDays" | "previousSevenDays" | "growthRate"
>): Pick<TrafficInsight, "action" | "actionReason"> {
  if (total < 5) {
    return {
      action: "observe",
      actionReason: "30日間のクリックが5件未満のため、判断材料を蓄積します。",
    };
  }

  if (previousSevenDays >= 5 && growthRate !== null && growthRate <= -30) {
    return {
      action: "recover",
      actionReason: `前の7日間より${Math.abs(growthRate)}%減少。掲載位置や訴求文を確認します。`,
    };
  }

  if (
    lastSevenDays >= 5 &&
    (previousSevenDays === 0 || (growthRate !== null && growthRate >= 30))
  ) {
    return {
      action: "expand",
      actionReason:
        previousSevenDays === 0
          ? "直近7日で新たにクリックが集まっています。露出拡大候補です。"
          : `前の7日間より${growthRate}%増加。露出拡大候補です。`,
    };
  }

  return {
    action: "maintain",
    actionReason: "一定のクリックを維持しています。現状を継続して推移を確認します。",
  };
}

function buildTrafficInsights(
  rows: AffiliateClickRow[],
  getKey: (row: AffiliateClickRow) => string,
  getLabel: (key: string) => string,
  sevenDayCutoff: number,
  previousSevenDayCutoff: number,
): TrafficInsight[] {
  const counts = new Map<
    string,
    { total: number; lastSevenDays: number; previousSevenDays: number }
  >();

  for (const row of rows) {
    const key = getKey(row);
    const current = counts.get(key) ?? {
      total: 0,
      lastSevenDays: 0,
      previousSevenDays: 0,
    };
    const clickedAt = new Date(row.clicked_at).getTime();
    current.total += 1;
    if (clickedAt >= sevenDayCutoff) current.lastSevenDays += 1;
    else if (clickedAt >= previousSevenDayCutoff) current.previousSevenDays += 1;
    counts.set(key, current);
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const growthRate = count.previousSevenDays > 0
        ? Math.round(
            ((count.lastSevenDays - count.previousSevenDays) /
              count.previousSevenDays) *
              100,
          )
        : null;
      const classification = classifyTrafficInsight({
        ...count,
        growthRate,
      });
      return {
        key,
        label: getLabel(key),
        ...count,
        share: rows.length > 0 ? Math.round((count.total / rows.length) * 100) : 0,
        growthRate,
        ...classification,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function getAffiliateAnalytics() {
  const [result, impressionResult] = await Promise.all([
    fetchAffiliateClicks(30),
    fetchAffiliateImpressions(30),
  ]);
  const now = new Date();
  const todayKey = jstDayKey(now);
  const sevenDayCutoff = now.getTime() - 7 * DAY_MS;
  const previousSevenDayCutoff = now.getTime() - 14 * DAY_MS;

  const today = result.rows.filter(
    (row) => jstDayKey(new Date(row.clicked_at)) === todayKey,
  ).length;
  const lastSevenDays = result.rows.filter(
    (row) => new Date(row.clicked_at).getTime() >= sevenDayCutoff,
  ).length;
  const previousSevenDays = result.rows.filter((row) => {
    const time = new Date(row.clicked_at).getTime();
    return time >= previousSevenDayCutoff && time < sevenDayCutoff;
  }).length;
  const growthRate = previousSevenDays > 0
    ? Math.round(((lastSevenDays - previousSevenDays) / previousSevenDays) * 100)
    : null;

  const workCounts = countBy(result.rows.map((row) => String(row.work_id)))
    .slice(0, 10);
  const workIds = workCounts.map((item) => Number(item.key));
  const recentWorkIds = result.rows.slice(0, 20).map((row) => row.work_id);
  const works = await fetchWorkSummaries([...new Set([...workIds, ...recentWorkIds])]);

  const dailyKeys = Array.from({ length: 14 }, (_, index) =>
    jstDayKey(new Date(now.getTime() - (13 - index) * DAY_MS)),
  );
  const dailyCounts = new Map(dailyKeys.map((key) => [key, 0]));
  for (const row of result.rows) {
    const key = jstDayKey(new Date(row.clicked_at));
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

  const sourcePlacementMap = new Map<AffiliateSource, { total: number; desktop: number; mobile: number }>();
  for (const row of result.rows) {
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
    result.rows,
    (row) => row.source_page,
    (key) => AFFILIATE_SOURCE_LABELS[normalizeAffiliateSource(key)],
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const placementInsights = buildTrafficInsights(
    result.rows,
    (row) => row.placement,
    (key) => AFFILIATE_PLACEMENT_LABELS[key] ?? key,
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const ctaVariantInsights = buildTrafficInsights(
    result.rows.filter((row) =>
      row.cta_variant !== null &&
      (row.placement === "detail-sidebar" || row.placement === "mobile-sticky")
    ),
    (row) => row.cta_variant ?? "control",
    (key) => CTA_VARIANT_LABELS[normalizeCtaVariant(key)],
    sevenDayCutoff,
    previousSevenDayCutoff,
  );
  const experimentStartedAt = impressionResult.rows.length
    ? Math.min(...impressionResult.rows.map((row) => new Date(row.viewed_at).getTime()))
    : null;
  const experimentClicks = result.rows.filter((row) =>
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

  return {
    error: result.error,
    sourceAttributionEnabled: result.sourceAttributionEnabled,
    ctaExperimentEnabled: result.ctaExperimentEnabled,
    ctaImpressionTrackingEnabled: impressionResult.enabled,
    totals: {
      today,
      sevenDays: lastSevenDays,
      thirtyDays: result.rows.length,
      uniqueWorks: new Set(result.rows.map((row) => row.work_id)).size,
      growthRate,
    },
    daily: dailyKeys.map((key) => ({ key, count: dailyCounts.get(key) ?? 0 })),
    sources: countBy(result.rows.map((row) => row.source_page)).map((item) => ({
      ...item,
      label: AFFILIATE_SOURCE_LABELS[item.key],
    })),
    placements: countBy(result.rows.map((row) => row.placement)),
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
    sourceInsights,
    placementInsights,
    ctaVariantInsights,
    ctaVariantPerformance,
    topWorks: workCounts.map((item) => ({
      workId: Number(item.key),
      title: works.get(Number(item.key))?.title ?? `作品ID ${item.key}`,
      clicks: item.count,
    })),
    recent: result.rows.slice(0, 20).map((row) => ({
      ...row,
      title: works.get(row.work_id)?.title ?? `作品ID ${row.work_id}`,
    })),
  };
}
