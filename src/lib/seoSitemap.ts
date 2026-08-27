import { unstable_cache } from "next/cache";
import {
  getEntityIndexSummaries,
  type EntityIndexKind,
} from "@/lib/catalog/entityIndexSummaries";
import { SITE_URL } from "@/lib/seo";
import {
  WORK_INDEX_MIN_PRICE,
  WORK_INDEX_MIN_SCORE,
} from "@/lib/seoQuality";
import { supabase } from "@/lib/supabase";

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
};

const PAGE_SIZE = 1000;
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const staticEntries: SitemapEntry[] = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  ...["ranking", "new", "sale", "deals", "discover", "price-insights"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "daily" as const,
    priority: 0.9,
  })),
  ...["actress", "genre", "maker", "series", "features"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
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
  ...["affiliate-disclosure", "privacy", "terms"].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
];

const getQualityWorkCount = unstable_cache(
  async () => {
    const { count, error } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .gte("score", WORK_INDEX_MIN_SCORE)
      .gte("price", WORK_INDEX_MIN_PRICE)
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
  const from = (chunkNumber - 1) * PAGE_SIZE;
  const getChunk = unstable_cache(
    async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id, created_at, updated_at")
        .gte("score", WORK_INDEX_MIN_SCORE)
        .gte("price", WORK_INDEX_MIN_PRICE)
        .not("image_url", "is", null)
        .neq("image_url", "")
        .not("affiliate_url", "is", null)
        .neq("affiliate_url", "")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      return (data ?? []) as SitemapWork[];
    },
    ["seo-sitemap-quality-work-chunk-v2", String(chunkNumber)],
    { revalidate: 3600 },
  );
  const works = await getChunk();

  return works.map((work) => ({
    url: `${SITE_URL}/works/${work.id}`,
    lastModified: work.updated_at ?? work.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}

export async function getCatalogSitemapEntries(): Promise<SitemapEntry[]> {
  const kinds: EntityIndexKind[] = ["actress", "genre", "maker", "series"];
  const entries: SitemapEntry[] = [];

  // These calls share one cached RPC result. Keeping them sequential also avoids
  // duplicate database requests when the cache is cold.
  for (const kind of kinds) {
    const summaries = await getEntityIndexSummaries(kind);
    entries.push(
      ...summaries
        .filter(
          (summary) =>
            summary.count >= 3 && summary.maxScore > 0 && summary.imageUrl,
        )
        .map((summary) => ({
          url: `${SITE_URL}/${kind}/${encodeURIComponent(summary.name)}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    );
  }

  return entries;
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
