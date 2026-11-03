import { IGNORE_GENRES } from "@/lib/genre";
import { getActressRanking } from "@/lib/playwright/getActressRanking";
import { getSeriesRanking } from "@/lib/playwright/getSeriesRanking";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  mergeActressRankingRows,
  mergeSeriesRankingRows,
  projectEntityRankingItems,
  type RankedDmmItem,
} from "./entityRankingProjection";
import { buildEntityRankingSyncPlan } from "./entityRankingSyncPlan";

export type { RankedDmmItem } from "./entityRankingProjection";

type EntityRankingProgress = (processed: number, total: number) => Promise<void>;
type EntityRankingTable =
  | "actress_rankings"
  | "genre_rankings"
  | "maker_rankings"
  | "series_rankings";
type EntityRankingRow = {
  name: string;
  updated_at: string;
  [key: string]: string | number | null;
};

const ENTITY_STEPS = 7;

async function loadExistingRankingRows(table: EntityRankingTable) {
  const existingRows: Array<{ id: number | string; name: string }> = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("id,name")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    existingRows.push(...((data ?? []) as typeof existingRows));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return existingRows;
}

async function updateExistingRankingRows(table: EntityRankingTable, rows: Array<{ id: number | string } & EntityRankingRow>) {
  const chunkSize = 20;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const results = await Promise.all(
      rows.slice(offset, offset + chunkSize).map(({ id, ...row }) =>
        supabase.from(table).update(row).eq("id", id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }
}

async function insertNewRankingRows(table: EntityRankingTable, rows: EntityRankingRow[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

async function deleteStaleRankingRows(table: EntityRankingTable, staleIds: Array<number | string>) {
  const chunkSize = 100;
  for (let offset = 0; offset < staleIds.length; offset += chunkSize) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in("id", staleIds.slice(offset, offset + chunkSize));
    if (error) throw error;
  }
}

async function syncRankingByName(
  table: EntityRankingTable,
  rows: EntityRankingRow[],
  options: {
    deleteStale?: boolean;
    stalePatch?: Record<string, number | null>;
  } = {},
) {
  if (rows.length === 0) {
    throw new Error(`${table} の集計結果が0件のため、既存順位を維持しました`);
  }

  if (options.stalePatch) {
    const { error: clearError } = await supabase
      .from(table)
      .update(options.stalePatch)
      .not("id", "is", null);
    if (clearError) throw clearError;
  }

  const existingRows = await loadExistingRankingRows(table);
  const { rowsToUpdate, rowsToInsert, staleIds } = buildEntityRankingSyncPlan(rows, existingRows);

  console.log(`[entity-ranking] ${table}`, {
    target: rows.length,
    existing: existingRows.length,
    update: rowsToUpdate.length,
    insert: rowsToInsert.length,
  });

  // Production does not guarantee UNIQUE(name) on every ranking table, and id
  // is GENERATED ALWAYS. Update known ids explicitly instead of using upsert,
  // which PostgreSQL treats as an INSERT and rejects for identity columns.
  await updateExistingRankingRows(table, rowsToUpdate);
  await insertNewRankingRows(table, rowsToInsert);
  if (staleIds.length > 0 && options.deleteStale) await deleteStaleRankingRows(table, staleIds);

  console.log(`[entity-ranking] ${table} completed`, {
    staleDeleted: options.deleteStale ? staleIds.length : 0,
  });
}

export async function updateEntityRankings(
  rankingItems: RankedDmmItem[],
  onProgress?: EntityRankingProgress,
) {
  const { actressRows, genreRows, makerRows, seriesRows } = projectEntityRankingItems(rankingItems, IGNORE_GENRES);
  if (actressRows.length === 0 || seriesRows.length === 0) {
    throw new Error("DMMランキングの人物・シリーズ集計結果が0件です");
  }
  await onProgress?.(1, ENTITY_STEPS);

  // Fetch every external ranking before changing stored values. A fetch failure
  // therefore leaves the last complete ranking set available to score updates.
  const fanzaActressRows = await getActressRanking();
  if (fanzaActressRows.length === 0) {
    throw new Error("FANZA女優ランキングの取得結果が0件です");
  }
  await onProgress?.(2, ENTITY_STEPS);
  const fanzaSeriesRows = await getSeriesRanking();
  if (fanzaSeriesRows.length === 0) {
    throw new Error("FANZAシリーズランキングの取得結果が0件です");
  }
  await onProgress?.(3, ENTITY_STEPS);

  const updatedAt = new Date().toISOString();
  await syncRankingByName(
    "actress_rankings",
    mergeActressRankingRows(actressRows, fanzaActressRows, updatedAt),
    { stalePatch: { original_rank: null, fanza_rank: null } },
  );
  await onProgress?.(4, ENTITY_STEPS);

  await syncRankingByName(
    "genre_rankings",
    genreRows.map((row) => ({ ...row, updated_at: updatedAt })),
    { deleteStale: true },
  );
  await syncRankingByName(
    "maker_rankings",
    makerRows.map((row) => ({ ...row, updated_at: updatedAt })),
    { deleteStale: true },
  );
  await onProgress?.(5, ENTITY_STEPS);

  await syncRankingByName(
    "series_rankings",
    mergeSeriesRankingRows(seriesRows, fanzaSeriesRows, updatedAt),
    { stalePatch: { original_rank: null, fanza_rank: null, score: 0 } },
  );
  await onProgress?.(6, ENTITY_STEPS);
  await onProgress?.(7, ENTITY_STEPS);

  return {
    actress: actressRows.length,
    genre: genreRows.length,
    maker: makerRows.length,
    series: seriesRows.length,
  };
}
