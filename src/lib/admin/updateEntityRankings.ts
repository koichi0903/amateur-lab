import type { DmmItem } from "@/types/dmm";
import { IGNORE_GENRES } from "@/lib/genre";
import { getActressRanking } from "@/lib/playwright/getActressRanking";
import { getSeriesRanking } from "@/lib/playwright/getSeriesRanking";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export type RankedDmmItem = DmmItem & { rank: number };

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

function getRankingPoint(rank: number) {
  return Math.max(1, Math.floor(500 / Math.sqrt(rank)));
}

function addScore(target: Record<string, number>, name: string, point: number) {
  const normalized = name.trim();
  if (!normalized) return;
  target[normalized] = (target[normalized] ?? 0) + point;
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

  const idsByName = new Map<string, Array<number | string>>();
  for (const existingRow of existingRows) {
    const ids = idsByName.get(existingRow.name) ?? [];
    ids.push(existingRow.id);
    idsByName.set(existingRow.name, ids);
  }

  const rowsToUpdate = rows.flatMap((row) =>
    (idsByName.get(row.name) ?? []).map((id) => ({ id, ...row })),
  );
  const rowsToInsert = rows.filter((row) => !idsByName.has(row.name));

  console.log(`[entity-ranking] ${table}`, {
    target: rows.length,
    existing: existingRows.length,
    update: rowsToUpdate.length,
    insert: rowsToInsert.length,
  });

  // Production does not guarantee UNIQUE(name) on every ranking table, and id
  // is GENERATED ALWAYS. Update known ids explicitly instead of using upsert,
  // which PostgreSQL treats as an INSERT and rejects for identity columns.
  if (rowsToUpdate.length > 0) {
    const chunkSize = 20;
    for (let offset = 0; offset < rowsToUpdate.length; offset += chunkSize) {
      const results = await Promise.all(
        rowsToUpdate.slice(offset, offset + chunkSize).map(({ id, ...row }) =>
          supabase.from(table).update(row).eq("id", id),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }
  }
  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from(table).insert(rowsToInsert);
    if (insertError) throw insertError;
  }

  const currentNames = new Set(rows.map((row) => row.name));
  const staleIds = existingRows
    .filter((row) => !currentNames.has(row.name))
    .map((row) => row.id);

  if (staleIds.length > 0 && options.deleteStale) {
    const chunkSize = 100;
    for (let offset = 0; offset < staleIds.length; offset += chunkSize) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .in("id", staleIds.slice(offset, offset + chunkSize));
      if (deleteError) throw deleteError;
    }
  }

  console.log(`[entity-ranking] ${table} completed`, {
    staleDeleted: options.deleteStale ? staleIds.length : 0,
  });
}

export async function updateEntityRankings(
  rankingItems: RankedDmmItem[],
  onProgress?: EntityRankingProgress,
) {
  const genreScores: Record<string, number> = {};
  const actressScores: Record<string, number> = {};
  const makerScores: Record<string, number> = {};
  const seriesScores: Record<string, number> = {};

  for (const item of rankingItems) {
    const point = getRankingPoint(item.rank);
    item.iteminfo?.genre?.forEach((genre) => {
      if (!IGNORE_GENRES.includes(genre.name)) addScore(genreScores, genre.name, point);
    });
    item.iteminfo?.actress?.forEach((actress) =>
      addScore(actressScores, actress.name, point),
    );
    item.iteminfo?.maker?.forEach((maker) => addScore(makerScores, maker.name, point));
    item.iteminfo?.series?.forEach((series) =>
      addScore(seriesScores, series.name, point),
    );
  }

  const toRankedRows = (scores: Record<string, number>) =>
    Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, score], index) => ({ name, score, rank: index + 1 }));

  const actressRows = toRankedRows(actressScores).slice(0, 100);
  const genreRows = toRankedRows(genreScores).slice(0, 30);
  const makerRows = toRankedRows(makerScores).slice(0, 50);
  const seriesRows = toRankedRows(seriesScores).slice(0, 100);
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
  const actressOriginalRanks = new Map(
    actressRows.map((row) => [row.name, row.rank]),
  );
  const actressFanzaRanks = new Map(
    fanzaActressRows.map((row) => [row.name, row.rank]),
  );
  const actressNames = new Set([
    ...actressOriginalRanks.keys(),
    ...actressFanzaRanks.keys(),
  ]);
  await syncRankingByName(
    "actress_rankings",
    [...actressNames].map((name) => ({
      name,
      original_rank: actressOriginalRanks.get(name) ?? null,
      fanza_rank: actressFanzaRanks.get(name) ?? null,
      updated_at: updatedAt,
    })),
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

  const seriesOriginalRows = new Map(
    seriesRows.map((row) => [row.name, row]),
  );
  const seriesFanzaRanks = new Map(
    fanzaSeriesRows.map((row) => [row.name, row.rank]),
  );
  const seriesNames = new Set([
    ...seriesOriginalRows.keys(),
    ...seriesFanzaRanks.keys(),
  ]);
  await syncRankingByName(
    "series_rankings",
    [...seriesNames].map((name) => ({
      name,
      original_rank: seriesOriginalRows.get(name)?.rank ?? null,
      fanza_rank: seriesFanzaRanks.get(name) ?? null,
      score: seriesOriginalRows.get(name)?.score ?? 0,
      updated_at: updatedAt,
    })),
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
