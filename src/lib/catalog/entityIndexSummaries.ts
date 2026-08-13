import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export type EntityIndexKind = "actress" | "maker" | "series" | "genre";

type EntitySummaryRow = {
  kind: EntityIndexKind;
  name: string;
  work_count: number;
  max_score: number;
  image_url: string | null;
};

export type EntityIndexSummary = {
  name: string;
  count: number;
  maxScore: number;
  imageUrl: string | null;
};

type EntityIndexSummaryMap = Record<EntityIndexKind, EntityIndexSummary[]>;

const kinds: EntityIndexKind[] = ["actress", "maker", "series", "genre"];

async function loadEntityIndexSummaries(): Promise<EntityIndexSummaryMap> {
  const { data, error } = await supabase.rpc("get_entity_index_summaries");
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as EntitySummaryRow[];
  const result: EntityIndexSummaryMap = {
    actress: [],
    maker: [],
    series: [],
    genre: [],
  };

  for (const row of rows) {
    if (!kinds.includes(row.kind)) continue;
    result[row.kind].push({
      name: row.name,
      count: Number(row.work_count),
      maxScore: Number(row.max_score),
      imageUrl: row.image_url,
    });
  }

  return result;
}

const getCachedEntityIndexSummaries = unstable_cache(
  loadEntityIndexSummaries,
  ["entity-index-summaries-v1"],
  { revalidate: 3600 }
);

export async function getEntityIndexSummaries(kind: EntityIndexKind) {
  const summaries = await getCachedEntityIndexSummaries();
  return summaries[kind];
}
