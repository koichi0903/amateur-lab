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

type EntityIndexSummaryMap = Record<EntityIndexKind, EntityIndexSummary[]>;

const kinds: EntityIndexKind[] = ["actress", "maker", "series", "genre"];

async function loadEntityIndexSummaries(): Promise<EntityIndexSummaryMap> {
  const { data, error } = await supabase.rpc("get_entity_index_summaries");
  if (error) {
    throw error;
  }

  const result: EntityIndexSummaryMap = {
    actress: [],
    maker: [],
    series: [],
    genre: [],
  };

  const grouped = (data ?? {}) as Partial<Record<EntityIndexKind, EntitySummaryRow[]>>;

  for (const kind of kinds) {
    result[kind] = (grouped[kind] ?? []).map((row) => ({
      name: row.name,
      count: Number(row.work_count),
      maxScore: Number(row.max_score),
      imageUrl: row.image_url,
    }));
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

export async function getEntityIndexSummary(
  kind: EntityIndexKind,
  name: string,
) {
  const summaries = await getEntityIndexSummaries(kind);
  return summaries.find((summary) => summary.name === name) ?? null;
}
