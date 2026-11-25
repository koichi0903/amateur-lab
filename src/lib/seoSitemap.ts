import { unstable_cache } from "next/cache";
import {
  getEntityIndexSummaries,
  isEntityIndexable,
  type EntityIndexKind,
} from "@/lib/catalog/entityIndexSummaries";
import { SITE_URL } from "@/lib/seo";
import { isWorkIndexable } from "@/lib/seoQuality";
import { supabase } from "@/lib/supabase";
import { analyzerGuideArticles } from "@/lib/analyzerGuideContent";
import { editorialGuides, reportDefinitions } from "@/lib/editorialContent";
import { getFanzaAmateurActressIndex } from "@/lib/dmm/fanzaAmateurCatalog";
import { getAmateurActressSitemapPaths as buildAmateurActressSitemapPaths, getAmateurActressSitemapUrls } from "@/lib/amateurActressSitemap";
import { getAmateurWorkPrice, getAmateurWorkSitemapPaths as buildAmateurWorkSitemapPaths, isAmateurWorkIndexable } from "@/lib/amateurWorkIndexability";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SitemapEntry = {
  url: string;
  lastModified?: string | null;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
};

type SitemapWork = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  stage: string | null;
  price: number | null;
  image_url: string | null;
  affiliate_url: string | null;
};

const PAGE_SIZE = 1000;
const AMATEUR_ACTRESS_PAGE_SIZE = 1000;
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
const staticEntries: SitemapEntry[] = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  ...["ranking", "new", "sale", "deals", "discovery", "price-insights", "vr"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "daily" as const,
    priority: 0.9,
  })),
  ...["actress", "genre", "maker", "features"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  })),
  { url: `${SITE_URL}/amateur`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/amateur/actress`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE_URL}/amateur/genre`, changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE_URL}/amateur/maker`, changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/compare-guide`, changeFrequency: "monthly", priority: 0.9 },
  ...analyzerGuideArticles.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  })),
  ...editorialGuides.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  })),
  { url: `${SITE_URL}/reports`, changeFrequency: "daily", priority: 0.9 },
  ...reportDefinitions.map((report) => ({
    url: `${SITE_URL}/reports/${report.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.9,
  })),
  ...[
    "ending-soon",
    "lowest-price",
    "under-1000",
    "high-rated",
    "sample-available",
    "best-discount",
  ].map((category) => ({
    url: `${SITE_URL}/deals/${category}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  })),
  ...[
    "beginners",
    "under-500",
    "trusted-reviews",
    "actress-discovery",
    "hidden-gems",
  ].map((feature) => ({
    url: `${SITE_URL}/features/${feature}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  })),
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/editorial-policy`, changeFrequency: "monthly", priority: 0.5 },
  ...["affiliate-disclosure", "privacy", "terms"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
];

const QUALITY_WORK_COLUMNS = [
  "id", "created_at", "updated_at", "stage", "price", "image_url", "affiliate_url",
].join(",");

const getQualityWorkCount = unstable_cache(
  async (): Promise<number> => {
    const { count, error } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .or("stage.is.null,stage.neq.DISCONTINUED")
      .gte("price", 1)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .not("affiliate_url", "is", null)
      .neq("affiliate_url", "");

    if (error) throw error;
    return count ?? 0;
  },
  ["seo-sitemap-quality-work-count-v2"],
  { revalidate: 3600 },
);

const getQualityWorkPage = unstable_cache(
  async (chunkNumber: number): Promise<SitemapWork[]> => {
    const from = (chunkNumber - 1) * PAGE_SIZE;
    const { data, error } = await supabase
      .from("works")
      .select(QUALITY_WORK_COLUMNS)
      .or("stage.is.null,stage.neq.DISCONTINUED")
      .gte("price", 1)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .not("affiliate_url", "is", null)
      .neq("affiliate_url", "")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    return ((data ?? []) as unknown as SitemapWork[]).filter(isWorkIndexable);
  },
  ["seo-sitemap-quality-work-page-v2"],
  { revalidate: 3600 },
);

type AmateurWorkSitemapRow = {
  content_id: string;
  is_listed: boolean;
  missing_since: string | null;
  image_url: unknown;
  affiliate_url: string | null;
  prices: unknown;
  fetched_at: string | null;
};

const getQualityAmateurWorks = unstable_cache(
  async (): Promise<Array<{ content_id: string; fetched_at: string | null }>> => {
    const candidates: Array<{ content_id: string; fetched_at: string | null }> = [];
    const queryPage = async (from: number) => {
      const { data, error } = await supabaseAdmin
        .from("fanza_amateur_works")
        .select("content_id,is_listed,missing_since,image_url,affiliate_url,prices,fetched_at")
        .eq("is_listed", true)
        .is("missing_since", null)
        .order("content_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as AmateurWorkSitemapRow[];
    };

    // Fetch at most eight 1000-row pages concurrently to keep cold sitemap
    // generation bounded without loading raw API payloads.
    const batchSize = PAGE_SIZE * 8;
    for (let from = 0; ; from += batchSize) {
      const pages = await Promise.all(Array.from({ length: 8 }, (_, index) => queryPage(from + index * PAGE_SIZE)));
      for (const rows of pages) {
        for (const row of rows) {
          const image = row.image_url && typeof row.image_url === "object" && !Array.isArray(row.image_url)
            ? row.image_url as Record<string, unknown>
            : {};
          const imageUrl = [image.large, image.small, image.list]
            .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
          if (!isAmateurWorkIndexable({
            contentId: row.content_id,
            isListed: row.is_listed,
            missingSince: row.missing_since,
            imageUrl,
            affiliateUrl: row.affiliate_url,
            price: getAmateurWorkPrice(row.prices),
          })) continue;
          candidates.push({ content_id: row.content_id, fetched_at: row.fetched_at });
        }
      }
      if (pages.some((rows) => rows.length < PAGE_SIZE)) break;
    }
    return candidates;
  },
  ["seo-sitemap-amateur-works-quality-v1"],
  { revalidate: 3600, tags: ["fanza-amateur-catalog"] },
);

export function getStaticSitemapEntries(): SitemapEntry[] {
  return staticEntries;
}

export async function getWorkSitemapPaths(): Promise<string[]> {
  const count = await getQualityWorkCount();
  return Array.from(
    { length: Math.ceil(count / PAGE_SIZE) },
    (_, index) => `/sitemaps/works-${index + 1}.xml`,
  );
}

export async function getWorkSitemapEntries(
  chunkNumber: number,
): Promise<SitemapEntry[]> {
  if (!Number.isInteger(chunkNumber) || chunkNumber < 1) return [];

  const works = await getQualityWorkPage(chunkNumber);

  return works.map((work) => ({
    url: `${SITE_URL}/works/${work.id}`,
    lastModified: work.updated_at ?? work.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}

export async function getCatalogSitemapEntries(): Promise<SitemapEntry[]> {
  const kinds: EntityIndexKind[] = ["actress", "genre", "maker"];
  const entries: SitemapEntry[] = [];

  // These calls share one cached RPC result. Keeping them sequential also avoids
  // duplicate database requests when the cache is cold.
  for (const kind of kinds) {
    const summaries = await getEntityIndexSummaries(kind);
    entries.push(
      ...summaries
        .filter((summary) => isEntityIndexable(kind, summary))
        .map((summary) => ({
          url: `${SITE_URL}/${kind}/${encodeURIComponent(summary.name)}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    );
  }

  // Amateur product URLs are emitted in separate 1000-URL sitemap shards when
  // their metadata satisfies the same four publication quality conditions.
  const { getFanzaAmateurTaxonomy } = await import("@/lib/dmm/fanzaAmateurCatalog");
  for (const kind of ["genre", "maker"] as const) {
    const entities = await getFanzaAmateurTaxonomy(kind);
    entries.push(
      ...entities
        .filter((entity) => entity.count >= 24)
        .map((entity) => ({
          url: `${SITE_URL}/amateur/${kind}/${encodeURIComponent(entity.name)}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    );
  }

  return entries;
}

export async function getAmateurActressSitemapPaths(): Promise<string[]> {
  const firstPage = await getFanzaAmateurActressIndex({ sort: "count-desc", page: 1 });
  return buildAmateurActressSitemapPaths(firstPage.totalPages);
}

export async function getAmateurActressSitemapEntries(chunkNumber: number): Promise<SitemapEntry[]> {
  if (!Number.isInteger(chunkNumber) || chunkNumber < 1) return [];

  const { items } = await getFanzaAmateurActressIndex({ sort: "count-desc", page: chunkNumber });
  return getAmateurActressSitemapUrls(items, SITE_URL).map((url) => ({
    url,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
}

export async function getAmateurWorkSitemapPaths(): Promise<string[]> {
  return buildAmateurWorkSitemapPaths((await getQualityAmateurWorks()).length);
}

export async function getAmateurWorkSitemapEntries(chunkNumber: number): Promise<SitemapEntry[]> {
  if (!Number.isInteger(chunkNumber) || chunkNumber < 1) return [];
  const works = await getQualityAmateurWorks();
  const from = (chunkNumber - 1) * PAGE_SIZE;
  return works.slice(from, from + PAGE_SIZE).map((work) => ({
    url: `${SITE_URL}/amateur/${encodeURIComponent(work.content_id)}`,
    lastModified: work.fetched_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemap(entries: SitemapEntry[]): Response {
  const urls = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(new Date(entry.lastModified).toISOString())}</lastmod>`
        : "";
      const changeFrequency = entry.changeFrequency
        ? `<changefreq>${entry.changeFrequency}</changefreq>`
        : "";
      const priority = entry.priority
        ? `<priority>${entry.priority.toFixed(1)}</priority>`
        : "";

      return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    })
    .join("");

  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
  );
}

export function renderSitemapIndex(paths: string[]): Response {
  const sitemaps = paths
    .map((path) => `<sitemap><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></sitemap>`)
    .join("");

  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`,
  );
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

