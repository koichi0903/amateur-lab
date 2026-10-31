import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AFFILIATE_ANALYTICS_DAY_MS as DAY_MS, type WorkPageViewRow } from "./affiliateAnalyticsInsights";
import { EXTERNAL_ATTRIBUTION_CHANNELS, type ExternalAttributionChannel } from "@/lib/externalAttribution";
import { normalizeAffiliateSource, type AffiliateSource } from "@/lib/affiliateTracking";
import { normalizeCtaVariant, type CtaVariant } from "@/lib/ctaExperiment";
import type { XPostCandidate } from "@/lib/xPostPlanner";
import {
  nextAffiliateClickFallback,
  type AffiliateClickColumnAvailability,
} from "./affiliateClickQueryFallback";

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

type AffiliateImpressionRow = {
  cta_variant: CtaVariant;
  viewed_at: string;
};

type WorkSummary = {
  id: number;
  title: string;
};

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

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

async function fetchClickPageWithFallback(
  cutoff: string,
  from: number,
  availability: AffiliateClickColumnAvailability,
) {
  let result = await fetchClickPage(
    cutoff,
    from,
    availability.sourceAttributionEnabled,
    availability.ctaExperimentEnabled,
    availability.externalAttributionEnabled,
  );

  while (result.error) {
    const fallback = nextAffiliateClickFallback(result.error.message, availability);
    if (!fallback) break;

    availability[fallback] = false;
    result = await fetchClickPage(
      cutoff,
      from,
      availability.sourceAttributionEnabled,
      availability.ctaExperimentEnabled,
      availability.externalAttributionEnabled,
    );
  }

  return result;
}

export async function fetchAffiliateClicks(days = 30) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const rows: AffiliateClickRow[] = [];
  const availability: AffiliateClickColumnAvailability = {
    sourceAttributionEnabled: true,
    ctaExperimentEnabled: true,
    externalAttributionEnabled: true,
  };

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await fetchClickPageWithFallback(cutoff, from, availability);

    if (result.error) {
      return {
        rows: [] as AffiliateClickRow[],
        ...availability,
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
    ...availability,
    error: null as string | null,
  };
}

export async function fetchAffiliateImpressions(days = 30) {
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

export async function fetchWorkPageViews(days = 30) {
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

export async function fetchWorkSummaries(workIds: number[]) {
  if (!workIds.length) return new Map<number, WorkSummary>();

  const { data } = await supabaseAdmin
    .from("works")
    .select("id,title")
    .in("id", workIds);
  const works = (data ?? []) as WorkSummary[];
  return new Map(works.map((work) => [work.id, work]));
}

export async function fetchLatestXPostTimes(keys: string[]) {
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

export async function fetchXPostLogMap(days: number) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 365);
  const cutoff = new Date(Date.now() - safeDays * DAY_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("x_post_logs")
    .select("post_key,work_id,category,posted_at,account_handle")
    .gte("posted_at", cutoff);

  if (error) {
    return {
      logs: new Map<string, {
        postKey: string;
        workId: number;
        category: XPostCandidate["category"] | "bijyo_reserved";
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
        category: (row.account_handle === "bijyo1010" ? "bijyo_reserved" : row.category) as XPostCandidate["category"] | "bijyo_reserved",
        postedAt: row.posted_at,
      },
    ])),
    enabled: true,
    error: null as string | null,
  };
}
