import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";

const BASE_URL = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const works: Array<{
    id: number;
    created_at: string | null;
    updated_at: string | null;
    actress: string | null;
    genre: string | null;
    maker: string | null;
    series: string | null;
  }> = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("id, created_at, updated_at, actress, genre, maker, series")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Failed to fetch sitemap works", error);
      break;
    }
    const page = data ?? [];
    works.push(...page);
    if (page.length < pageSize) break;
  }
  
  function splitValues(value?: string | null): string[] {
  return value
    ? value
        .split(" / ")
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
}
  
  function createPages(
  values: string[],
  path: string
): MetadataRoute.Sitemap {
  return [...new Set(values)]
    .filter((value) => value.trim() !== "")
    .map((value) => ({
      url: `${BASE_URL}/${path}/${encodeURIComponent(value)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
}

   const staticPages: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${BASE_URL}/ranking`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/actress`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/genre`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/maker`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/series`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/sale`,
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/deals`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  ...[
    "ending-soon",
    "lowest-price",
    "under-1000",
    "high-rated",
    "sample-available",
    "best-discount",
  ].map((category) => ({
    url: `${BASE_URL}/deals/${category}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  })),
  {
    url: `${BASE_URL}/features`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  ...[
    "beginners",
    "under-500",
    "trusted-reviews",
    "actress-discovery",
    "hidden-gems",
  ].map((feature) => ({
    url: `${BASE_URL}/features/${feature}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  })),
  {
    url: `${BASE_URL}/about`,
    changeFrequency: "monthly",
    priority: 0.5,
  },
  ...["affiliate-disclosure", "privacy", "terms"].map((page) => ({
    url: `${BASE_URL}/${page}`,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
  {
    url: `${BASE_URL}/new`,
    changeFrequency: "daily",
    priority: 0.9,
  },
];

 const workPages: MetadataRoute.Sitemap =
  works.map((work) => ({
    url: `${BASE_URL}/works/${work.id}`,
    lastModified: work.updated_at || work.created_at
  ? new Date(work.updated_at || work.created_at!)
  : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const actressPages = createPages(
  works.flatMap((work) => splitValues(work.actress)),
  "actress"
);

  const genrePages = createPages(
  works.flatMap((work) => splitValues(work.genre)),
  "genre"
);

   const makerPages = createPages(
  works.flatMap((work) => splitValues(work.maker)),
  "maker"
);

   const seriesPages = createPages(
  works.flatMap((work) => splitValues(work.series)),
  "series"
);
  
 return [
  ...staticPages,
  ...workPages,
  ...actressPages,
  ...genrePages,
  ...makerPages,
  ...seriesPages,
];
}
