import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

    const BASE_URL = "https://amateur-lab.vercel.app";
  
  const { data: works, error } = await supabase
  .from("works")
  .select(`
    id,
    created_at,
    actress,
    genre,
    maker,
    series
  `)
  .order("created_at", { ascending: false });

if (error) {
  throw error;
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
    url: `${BASE_URL}/search`,
    changeFrequency: "weekly",
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
    url: `${BASE_URL}/new`,
    changeFrequency: "daily",
    priority: 0.9,
  },
];

 const workPages: MetadataRoute.Sitemap =
  works?.map((work) => ({
    url: `${BASE_URL}/works/${work.id}`,
    lastModified: work.created_at
  ? new Date(work.created_at)
  : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  })) ?? [];

  const actressPages = createPages(
  works?.flatMap((work) =>
    work.actress
      ? work.actress
          .split(" / ")
          .map((name: string) => name.trim())
          .filter(Boolean)
      : []
  ) ?? [],
  "actress"
);

  const genrePages = createPages(
  works?.flatMap((work) =>
    work.genre
      ? work.genre
          .split(" / ")
          .map((name: string) => name.trim())
          .filter(Boolean)
      : []
  ) ?? [],
  "genre"
);

   const makerPages = createPages(
  works
    ?.map((work) => work.maker?.trim())
    .filter((maker): maker is string => !!maker) ?? [],
  "maker"
);

   const seriesPages = createPages(
  works
    ?.map((work) => work.series?.trim())
    .filter((series): series is string => !!series) ?? [],
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