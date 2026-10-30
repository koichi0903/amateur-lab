import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getDmmFanzaAmateurRankedCatalog } from "@/lib/dmm/fanzaAmateurRankedCatalog";
import { asText } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { addFanzaAmateurTaxonomyRows, type FanzaAmateurTaxonomySummary } from "@/lib/dmm/fanzaAmateurTaxonomySummary";

export async function getFanzaAmateurTaxonomy(kind: "genre" | "maker") {
  const taxonomy = await getCachedFanzaAmateurTaxonomy(kind);
  if (kind !== "genre") return taxonomy.map(({ name, count, imageUrl }) => ({ name, count, imageUrl }));

  const rankedItems = await getDmmFanzaAmateurRankedCatalog();
  const rankedImageByGenre = new Map<string, Array<{ contentId: string; imageUrl: string }>>();
  for (const item of rankedItems) {
    if (!item.imageUrl) continue;
    for (const genre of item.iteminfo?.genre ?? []) {
      const name = asText(genre.name);
      if (!name) continue;
      const candidates = rankedImageByGenre.get(name) ?? [];
      candidates.push({ contentId: item.content_id, imageUrl: item.imageUrl });
      rankedImageByGenre.set(name, candidates);
    }
  }

  const usedContentIds = new Set<string>();
  const usedImageUrls = new Set<string>();
  return taxonomy.map(({ name, count, imageCandidates }) => {
    const rankedCandidate = (rankedImageByGenre.get(name) ?? []).find((candidate) => !usedContentIds.has(candidate.contentId) && !usedImageUrls.has(candidate.imageUrl));
    const fallbackCandidate = imageCandidates.find((candidate) => !usedContentIds.has(candidate.contentId) && !usedImageUrls.has(candidate.imageUrl));
    const selected = rankedCandidate ?? fallbackCandidate;
    if (selected) {
      usedContentIds.add(selected.contentId);
      usedImageUrls.add(selected.imageUrl);
    }
    return { name, count, imageUrl: selected?.imageUrl ?? null };
  });
}

async function loadFanzaAmateurTaxonomy(kind: "genre" | "maker") {
  const summaries = new Map<string, FanzaAmateurTaxonomySummary>();
  const batchSize = 1_000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("fanza_amateur_works")
      .select("iteminfo,image_url,api_date,content_id")
      .order("api_date", { ascending: false, nullsFirst: false })
      .order("content_id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw new Error(`素人作品の${kind === "genre" ? "ジャンル" : "メーカー"}を読み込めませんでした: ${error.message}`);

    addFanzaAmateurTaxonomyRows(summaries, data ?? [], kind);
    if (!data || data.length < batchSize) break;
  }
  return [...summaries.entries()].map(([name, summary]) => ({ name, ...summary })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

const getCachedFanzaAmateurTaxonomy = unstable_cache(loadFanzaAmateurTaxonomy, ["fanza-amateur-taxonomy-v2"], { revalidate: 3600 });
const getCachedFanzaAmateurGenreNames = unstable_cache(async () => {
  const taxonomy = await getCachedFanzaAmateurTaxonomy("genre");
  return taxonomy.map(({ name }) => name);
}, ["fanza-amateur-genre-options-v1"], { revalidate: 3600 });

export async function getFanzaAmateurGenreNames() {
  return getCachedFanzaAmateurGenreNames();
}
