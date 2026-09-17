import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
export {
  ENTITY_INDEX_THRESHOLDS,
  isEntityIndexable,
} from "./entityIndexQuality";

export type EntityIndexKind = "actress" | "maker" | "series" | "genre";

type EntitySummaryRow = {
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

async function loadEntityIndexSummaries(kind: EntityIndexKind): Promise<EntityIndexSummary[]> {
  const { data, error } = await supabase.rpc("get_entity_index_summaries");
  if (error) {
    throw error;
  }

  const grouped = (data ?? {}) as Partial<Record<EntityIndexKind, EntitySummaryRow[]>>;

  return (grouped[kind] ?? []).map((row) => ({
    name: row.name,
    count: Number(row.work_count),
    maxScore: Number(row.max_score),
    imageUrl: row.image_url,
  }));
}

const getCachedEntityIndexSummaries = unstable_cache(
  loadEntityIndexSummaries,
  ["entity-index-summaries-v2"],
  { revalidate: 3600 }
);

export async function getEntityIndexSummaries(kind: EntityIndexKind) {
  return getCachedEntityIndexSummaries(kind);
}

export async function getEntityIndexSummary(
  kind: EntityIndexKind,
  name: string,
) {
  const summaries = await getEntityIndexSummaries(kind);
  return summaries.find((summary) => summary.name === name) ?? null;
}
