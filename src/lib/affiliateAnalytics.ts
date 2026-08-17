import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AFFILIATE_SOURCE_LABELS,
  normalizeAffiliateSource,
  type AffiliateSource,
} from "@/lib/affiliateTracking";

export type AffiliateClickRow = {
  id: number;
  work_id: number;
  placement: string;
  source_page: AffiliateSource;
  clicked_at: string;
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
) {
  const columns = includeSource
    ? "id,work_id,placement,source_page,clicked_at"
    : "id,work_id,placement,clicked_at";
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

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let result = await fetchClickPage(cutoff, from, sourceAttributionEnabled);

    if (result.error && sourceAttributionEnabled) {
      sourceAttributionEnabled = false;
      result = await fetchClickPage(cutoff, from, false);
    }

    if (result.error) {
      return {
        rows: [] as AffiliateClickRow[],
        sourceAttributionEnabled,
        error: result.error.message,
      };
    }

    const page = (result.data ?? []) as unknown as Array<{
      id: number;
      work_id: number;
      placement: string;
      source_page?: string | null;
      clicked_at: string;
    }>;
    rows.push(
      ...page.map((row) => ({
        ...row,
        source_page: normalizeAffiliateSource(row.source_page),
      })),
    );

    if (page.length < PAGE_SIZE) break;
  }

  return { rows, sourceAttributionEnabled, error: null as string | null };
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

export async function getAffiliateAnalytics() {
  const result = await fetchAffiliateClicks(30);
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

  return {
    error: result.error,
    sourceAttributionEnabled: result.sourceAttributionEnabled,
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
