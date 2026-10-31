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
  let { data, error } = await supabase.rpc(
    "get_entity_index_summaries_by_kind",
    { p_kind: kind },
  );

  // Preview deployments can share the Production Supabase project, where the
  // new migration is intentionally not applied. Keep those deployments
  // functional until the RPC is available in their database.
  if (error?.code === "PGRST202") {
    const legacyResult = await supabase.rpc("get_entity_index_summaries");
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data)
    ? (data as EntitySummaryRow[])
    : (((data ?? {}) as Partial<Record<EntityIndexKind, EntitySummaryRow[]>>)[kind] ?? []);

  return rows.map((row) => ({
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

const getCachedActressIndexSummaries = unstable_cache(
  () => loadEntityIndexSummaries("actress"),
  ["actress-index-summaries-v1"],
  { revalidate: 43200 }
);

export async function getEntityIndexSummaries(kind: EntityIndexKind) {
  if (kind === "actress") return getCachedActressIndexSummaries();
  return getCachedEntityIndexSummaries(kind);
}

export async function getEntityIndexSummary(
  kind: EntityIndexKind,
  name: string,
) {
  const summaries = await getEntityIndexSummaries(kind);
  return summaries.find((summary) => summary.name === name) ?? null;
}
