import { unstable_cache } from "next/cache";
import {
  getEntityIndexSummaries,
  isEntityIndexable,
  type EntityIndexKind,
} from "@/lib/catalog/entityIndexSummaries";
import { SITE_URL } from "@/lib/seo";
import {
  getSeoIndexedWorkIds,
  isWorkIndexable,
} from "@/lib/seoQuality";
import { supabase } from "@/lib/supabase";
import { analyzerGuideArticles } from "@/lib/analyzerGuideContent";
import { editorialGuides, reportDefinitions } from "@/lib/editorialContent";
import { getFanzaAmateurActressIndex } from "@/lib/dmm/fanzaAmateurCatalog";
import { getAmateurActressSitemapPaths as buildAmateurActressSitemapPaths, getAmateurActressSitemapUrls } from "@/lib/amateurActressSitemap";

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
const WORK_QUERY_BATCH_SIZE = 200;
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

const getQualityWorks = unstable_cache(
  async (): Promise<SitemapWork[]> => {
    const indexedIds = getSeoIndexedWorkIds();
    const candidates: SitemapWork[] = [];
    for (let from = 0; from < indexedIds.length; from += WORK_QUERY_BATCH_SIZE) {
      const { data, error } = await supabase
        .from("works")
        .select(QUALITY_WORK_COLUMNS)
        .in("id", indexedIds.slice(from, from + WORK_QUERY_BATCH_SIZE))
        .neq("stage", "DISCONTINUED")
        .gte("price", 1)
        .not("image_url", "is", null)
        .neq("image_url", "")
        .not("affiliate_url", "is", null)
        .neq("affiliate_url", "")
        .order("id", { ascending: true })

      if (error) throw error;
      const rows = (data ?? []) as unknown as SitemapWork[];
      candidates.push(...rows);
    }

    return candidates.filter(isWorkIndexable).sort((a, b) => a.id - b.id);
  },
  ["seo-sitemap-work-index-pilot-2026-10-20-v1"],
  { revalidate: 3600 },
);

export function getStaticSitemapEntries(): SitemapEntry[] {
  return staticEntries;
}

export async function getWorkSitemapPaths(): Promise<string[]> {
  const count = (await getQualityWorks()).length;
  return Array.from(
    { length: Math.ceil(count / PAGE_SIZE) },
    (_, index) => `/sitemaps/works-${index + 1}.xml`,
  );
}

export async function getWorkSitemapEntries(
  chunkNumber: number,
): Promise<SitemapEntry[]> {
  const from = (chunkNumber - 1) * PAGE_SIZE;
  const works = (await getQualityWorks()).slice(from, from + PAGE_SIZE);

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
        .filter((summary) =>
          (kind === "genre" || kind === "maker")
            ? summary.count > 0 && Boolean(summary.imageUrl?.trim())
            : isEntityIndexable(kind, summary),
        )
        .map((summary) => ({
          url: `${SITE_URL}/${kind}/${encodeURIComponent(summary.name)}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    );
  }

  // Include only substantial amateur taxonomy landing pages. Product URLs stay
  // out of the sitemap while their copy and price-history coverage remain thin.
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

