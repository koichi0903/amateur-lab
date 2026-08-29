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
import {
  EXTERNAL_ATTRIBUTION_CHANNELS,
  isOperatorLandingPath,
  type ExternalAttributionChannel,
} from "@/lib/externalAttribution";
import type { XPostCandidate } from "@/lib/xPostPlanner";

export type AffiliateClickRow = {
  id: number;
  work_id: number;
  placement: string;
  source_page: AffiliateSource;
  cta_variant: CtaVariant | null;
  x_post_key: string | null;
  external_channel: ExternalAttributionChannel | null;
  external_source: string | null;
  landing_path: string | null;
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
  category: XPostCandidate["category"] | "unknown";
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

type AffiliateImpressionRow = {
  cta_variant: CtaVariant;
  viewed_at: string;
};

type WorkPageViewRow = {
  id: number;
  work_id: number;
  source_page: AffiliateSource;
  price: number | null;
  discount_rate: number | null;
  discovery_score: number | null;
  ranking: number | null;
  x_post_key: string | null;
  viewed_at: string;
};

export const AFFILIATE_PLACEMENT_LABELS: Record<string, string> = {
  "detail-sidebar": "PC・詳細サイド",
  "buy-timing-panel": "買い時判定パネル",
  "mobile-sticky": "スマホ固定バー",
  "compare-card": "比較カード",
  "sample-movie-fallback": "公式サンプル誘導",
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
  includeExternalAttribution: boolean,
) {
  const columns = [
    "id",
    "work_id",
    "placement",
    includeSource ? "source_page" : null,
    includeVariant ? "cta_variant" : null,
    includeExternalAttribution ? "x_post_key" : null,
    includeExternalAttribution ? "external_channel" : null,
    includeExternalAttribution ? "external_source" : null,
    includeExternalAttribution ? "landing_path" : null,
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
  let externalAttributionEnabled = true;

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let result = await fetchClickPage(
      cutoff,
      from,
      sourceAttributionEnabled,
      ctaExperimentEnabled,
      externalAttributionEnabled,
    );

    if (result.error && ctaExperimentEnabled && result.error.message.includes("cta_variant")) {
      ctaExperimentEnabled = false;
      result = await fetchClickPage(
        cutoff,
        from,
        sourceAttributionEnabled,
        false,
        externalAttributionEnabled,
      );
    }

    if (result.error && sourceAttributionEnabled && result.error.message.includes("source_page")) {
      sourceAttributionEnabled = false;
      result = await fetchClickPage(
        cutoff,
        from,
        false,
        ctaExperimentEnabled,
        externalAttributionEnabled,
      );
    }

    if (
      result.error &&
      externalAttributionEnabled &&
      ["external_channel", "external_source", "landing_path"].some((column) =>
        result.error?.message.includes(column)
      )
    ) {
      externalAttributionEnabled = false;
      result = await fetchClickPage(
        cutoff,
        from,
        sourceAttributionEnabled,
        ctaExperimentEnabled,
        false,
      );
    }

    if (result.error) {
      return {
        rows: [] as AffiliateClickRow[],
        sourceAttributionEnabled,
        ctaExperimentEnabled,
        externalAttributionEnabled,
        error: result.error.message,
      };
    }

    const page = (result.data ?? []) as unknown as Array<{
      id: number;
      work_id: number;
      placement: string;
      source_page?: string | null;
      cta_variant?: string | null;
      x_post_key?: string | null;
      external_channel?: string | null;
      external_source?: string | null;
      landing_path?: string | null;
      clicked_at: string;
    }>;
    rows.push(
      ...page.map((row) => ({
        ...row,
        source_page: normalizeAffiliateSource(row.source_page),
        cta_variant: row.cta_variant
          ? normalizeCtaVariant(row.cta_variant)
          : null,
        x_post_key: row.x_post_key ?? null,
        external_channel: EXTERNAL_ATTRIBUTION_CHANNELS.includes(
          row.external_channel as ExternalAttributionChannel,
        )
          ? (row.external_channel as ExternalAttributionChannel)
          : null,
        external_source: row.external_source ?? null,
        landing_path: row.landing_path ?? null,
      })),
    );

    if (page.length < PAGE_SIZE) break;
  }

  return {
    rows,
    sourceAttributionEnabled,
    ctaExperimentEnabled,
    externalAttributionEnabled,
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

async function fetchWorkPageViews(days = 30) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const rows: WorkPageViewRow[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from("work_page_views")
      .select("id,work_id,source_page,price,discount_rate,discovery_score,ranking,x_post_key,viewed_at")
      .gte("viewed_at", cutoff)
      .order("viewed_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) {
      return {
        rows: [] as WorkPageViewRow[],
        enabled: false,
        error: result.error.message,
      };
    }

    const page = (result.data ?? []) as Array<{
      id: number;
      work_id: number;
      source_page?: string | null;
      price: number | null;
      discount_rate: number | null;
      discovery_score: number | null;
      ranking: number | null;
      x_post_key: string | null;
      viewed_at: string;
    }>;
    rows.push(...page.map((row) => ({
      ...row,
      source_page: normalizeAffiliateSource(row.source_page),
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

async function fetchLatestXPostTimes(keys: string[]) {
  if (!keys.length) return new Map<string, string>();

  const { data } = await supabaseAdmin
    .from("x_post_logs")
    .select("post_key,posted_at")
    .in("post_key", keys)
    .order("posted_at", { ascending: false });

  const latest = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ post_key: string; posted_at: string }>) {
    if (!latest.has(row.post_key)) latest.set(row.post_key, row.posted_at);
  }
  return latest;
}

async function fetchXPostLogMap(days: number) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("x_post_logs")
    .select("post_key,work_id,category,posted_at")
    .gte("posted_at", cutoff);

  if (error) {
    return {
      logs: new Map<string, {
        postKey: string;
        workId: number;
        category: XPostCandidate["category"];
        postedAt: string;
      }>(),
      enabled: false,
      error: error.message,
    };
  }

  return {
    logs: new Map((data ?? []).map((row) => [
      row.post_key,
      {
        postKey: row.post_key,
        workId: row.work_id,
        category: row.category as XPostCandidate["category"],
        postedAt: row.posted_at,
      },
    ])),
    enabled: true,
    error: null as string | null,
  };
}

const X_CATEGORY_LABELS: Record<XPostCategoryRevenueRow["category"], string> = {
  today_buy: "今日の買い時",
  today_discovery: "今日の発掘",
  hidden_gem: "埋もれ名作",
  actress_best: "女優別おすすめ",
  genre_best: "ジャンル別おすすめ",
  maker_best: "メーカー別おすすめ",
  series_best: "シリーズ別おすすめ",
  deal: "値下げ・セール",
  score: "高スコア",
  new: "新作",
  sales: "実売上",
  unknown: "未分類",
};

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function inferXPostKeyFromPageViews(
  click: AffiliateClickRow,
  pageViewsByWork: Map<number, WorkPageViewRow[]>,
) {
  if (click.x_post_key) return click.x_post_key;

  const clickedAt = new Date(click.clicked_at).getTime();
  const candidates = pageViewsByWork.get(click.work_id) ?? [];
  const matched = candidates.find((view) => {
    const viewedAt = new Date(view.viewed_at).getTime();
    return viewedAt <= clickedAt && clickedAt - viewedAt <= DAY_MS;
  });
  return matched?.x_post_key ?? null;
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
  const todayKey = jstDayKey(now);
  const sevenDayCutoff = now.getTime() - 7 * DAY_MS;
  const previousSevenDayCutoff = now.getTime() - 14 * DAY_MS;
  const reportingRows = result.rows.filter(
    (row) => !isOperatorLandingPath(row.landing_path),
  );

  const today = reportingRows.filter(
    (row) => jstDayKey(new Date(row.clicked_at)) === todayKey,
  ).length;
  const lastSevenDays = reportingRows.filter(
    (row) => new Date(row.clicked_at).getTime() >= sevenDayCutoff,
  ).length;
  const previousSevenDays = reportingRows.filter((row) => {
    const time = new Date(row.clicked_at).getTime();
    return time >= previousSevenDayCutoff && time < sevenDayCutoff;
  }).length;
  const growthRate = previousSevenDays > 0
    ? Math.round(((lastSevenDays - previousSevenDays) / previousSevenDays) * 100)
    : null;

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

  const dailyKeys = Array.from({ length: 14 }, (_, index) =>
    jstDayKey(new Date(now.getTime() - (13 - index) * DAY_MS)),
  );
  const dailyCounts = new Map(dailyKeys.map((key) => [key, 0]));
  for (const row of reportingRows) {
    const key = jstDayKey(new Date(row.clicked_at));
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

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
    direct: "直接流入",
    organic_search: "Google等の自然検索",
    social: "X等のSNS",
    referral: "外部サイト",
    internal: "サイト内",
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
  const clickCountsByWorkSource = new Map<string, number>();
  for (const row of reportingRows) {
    const key = `${row.work_id}:${row.source_page}`;
    clickCountsByWorkSource.set(key, (clickCountsByWorkSource.get(key) ?? 0) + 1);
  }
  const funnelGroups = new Map<string, {
    workId: number;
    sourcePage: AffiliateSource;
    pageViews: number;
    price: number | null;
    discountRate: number | null;
    discoveryScore: number | null;
    ranking: number | null;
    latestPostedAt: string | null;
  }>();
  for (const row of pageViewResult.rows) {
    const key = `${row.work_id}:${row.source_page}`;
    const current = funnelGroups.get(key) ?? {
      workId: row.work_id,
      sourcePage: row.source_page,
      pageViews: 0,
      price: row.price,
      discountRate: row.discount_rate,
      discoveryScore: row.discovery_score,
      ranking: row.ranking,
      latestPostedAt: null,
    };
    current.pageViews += 1;
    current.price ??= row.price;
    current.discountRate ??= row.discount_rate;
    current.discoveryScore ??= row.discovery_score;
    current.ranking ??= row.ranking;
    const postedAt = row.x_post_key ? xPostTimes.get(row.x_post_key) ?? null : null;
    if (
      postedAt &&
      (!current.latestPostedAt || new Date(postedAt).getTime() > new Date(current.latestPostedAt).getTime())
    ) {
      current.latestPostedAt = postedAt;
    }
    funnelGroups.set(key, current);
  }
  const workFunnels: WorkFunnelRow[] = [...funnelGroups.entries()]
    .map(([key, group]) => {
      const fanzaClicks = clickCountsByWorkSource.get(key) ?? 0;
      return {
        ...group,
        title: works.get(group.workId)?.title ?? `作品ID ${group.workId}`,
        fanzaClicks,
        ctr: group.pageViews > 0 ? Math.round((fanzaClicks / group.pageViews) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.fanzaClicks - a.fanzaClicks || b.pageViews - a.pageViews)
    .slice(0, 25);

  const categoryPageViews = pageViewResult.rows.filter((row) =>
    row.source_page === "x" && new Date(row.viewed_at).getTime() >= categoryCutoff
  );
  const xPageViewsByWork = new Map<number, WorkPageViewRow[]>();
  for (const row of categoryPageViews.filter((view) => view.x_post_key)) {
    const views = xPageViewsByWork.get(row.work_id) ?? [];
    views.push(row);
    xPageViewsByWork.set(row.work_id, views);
  }
  for (const views of xPageViewsByWork.values()) {
    views.sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());
  }
  const categoryClicks = reportingRows.filter((row) =>
    row.source_page === "x" && new Date(row.clicked_at).getTime() >= categoryCutoff
  );
  const categoryGroups = new Map<XPostCategoryRevenueRow["category"], {
    posts: Set<string>;
    xPageViews: number;
    xFanzaClicks: number;
    workViews: Map<number, number>;
    workClicks: Map<number, number>;
  }>();
  const ensureCategory = (category: XPostCategoryRevenueRow["category"]) => {
    const current = categoryGroups.get(category) ?? {
      posts: new Set<string>(),
      xPageViews: 0,
      xFanzaClicks: 0,
      workViews: new Map<number, number>(),
      workClicks: new Map<number, number>(),
    };
    categoryGroups.set(category, current);
    return current;
  };
  for (const log of categoryLogResult.logs.values()) {
    ensureCategory(log.category).posts.add(log.postKey);
  }
  for (const row of categoryPageViews) {
    const category = row.x_post_key
      ? categoryLogResult.logs.get(row.x_post_key)?.category ?? "unknown"
      : "unknown";
    const current = ensureCategory(category);
    current.xPageViews += 1;
    if (row.x_post_key) current.posts.add(row.x_post_key);
    current.workViews.set(row.work_id, (current.workViews.get(row.work_id) ?? 0) + 1);
  }
  for (const row of categoryClicks) {
    const xPostKey = inferXPostKeyFromPageViews(row, xPageViewsByWork);
    const category = xPostKey
      ? categoryLogResult.logs.get(xPostKey)?.category ?? "unknown"
      : "unknown";
    const current = ensureCategory(category);
    current.xFanzaClicks += 1;
    if (xPostKey) current.posts.add(xPostKey);
    current.workClicks.set(row.work_id, (current.workClicks.get(row.work_id) ?? 0) + 1);
  }
  const categoryWorkIds = [...categoryGroups.values()].flatMap((group) => [
    ...group.workViews.keys(),
    ...group.workClicks.keys(),
  ]);
  const categoryWorks = await fetchWorkSummaries([...new Set(categoryWorkIds)]);
  const xPostCategoryRevenue: XPostCategoryRevenueRow[] = [...categoryGroups.entries()]
    .map(([category, group]) => {
      const workIds = [...new Set([...group.workViews.keys(), ...group.workClicks.keys()])];
      return {
        category,
        label: X_CATEGORY_LABELS[category],
        posts: group.posts.size,
        xPageViews: group.xPageViews,
        xFanzaClicks: group.xFanzaClicks,
        xCtr: group.xPageViews > 0 ? roundOne((group.xFanzaClicks / group.xPageViews) * 100) : 0,
        pvPerPost: group.posts.size > 0 ? roundOne(group.xPageViews / group.posts.size) : 0,
        clicksPerPost: group.posts.size > 0 ? roundOne(group.xFanzaClicks / group.posts.size) : 0,
        topWorks: workIds
          .map((workId) => {
            const xPageViews = group.workViews.get(workId) ?? 0;
            const xFanzaClicks = group.workClicks.get(workId) ?? 0;
            return {
              workId,
              title: categoryWorks.get(workId)?.title ?? works.get(workId)?.title ?? `作品ID ${workId}`,
              xPageViews,
              xFanzaClicks,
              xCtr: xPageViews > 0 ? roundOne((xFanzaClicks / xPageViews) * 100) : 0,
            };
          })
          .sort((a, b) => b.xFanzaClicks - a.xFanzaClicks || b.xPageViews - a.xPageViews)
          .slice(0, 5),
      };
    })
    .sort((a, b) => b.xFanzaClicks - a.xFanzaClicks || b.xPageViews - a.xPageViews);

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
      uniqueWorks: new Set(reportingRows.map((row) => row.work_id)).size,
      growthRate,
    },
    daily: dailyKeys.map((key) => ({ key, count: dailyCounts.get(key) ?? 0 })),
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
