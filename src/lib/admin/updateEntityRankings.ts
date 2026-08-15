import type { DmmItem } from "@/types/dmm";
import { IGNORE_GENRES } from "@/lib/genre";
import { getActressRanking } from "@/lib/playwright/getActressRanking";
import { getSeriesRanking } from "@/lib/playwright/getSeriesRanking";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export type RankedDmmItem = DmmItem & { rank: number };

type EntityRankingProgress = (processed: number, total: number) => Promise<void>;

const ENTITY_STEPS = 7;

function getRankingPoint(rank: number) {
  return Math.max(1, Math.floor(500 / Math.sqrt(rank)));
}

function addScore(target: Record<string, number>, name: string, point: number) {
  const normalized = name.trim();
  if (!normalized) return;
  target[normalized] = (target[normalized] ?? 0) + point;
}

async function syncSimpleRanking(
  table: "genre_rankings" | "maker_rankings",
  rows: Array<{ name: string; rank: number; score: number; updated_at: string }>,
) {
  if (rows.length === 0) {
    throw new Error(`${table} の集計結果が0件のため、既存順位を維持しました`);
  }

  const { error: upsertError } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "name" });
  if (upsertError) throw upsertError;

  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select("id,name");
  if (selectError) throw selectError;

  const currentNames = new Set(rows.map((row) => row.name));
  const staleIds = (existingRows ?? [])
    .filter((row) => !currentNames.has(row.name))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in("id", staleIds);
    if (deleteError) throw deleteError;
  }
}

async function clearRankingColumn(
  table: "actress_rankings" | "series_rankings",
  column: "original_rank" | "fanza_rank",
) {
  const { error } = await supabase
    .from(table)
    .update({ [column]: null })
    .not("id", "is", null);
  if (error) throw error;
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

  // Fetch every external ranking before clearing stored values. A fetch failure
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

  await clearRankingColumn("actress_rankings", "original_rank");
  await clearRankingColumn("actress_rankings", "fanza_rank");
  if (actressRows.length > 0) {
    const { error } = await supabase.from("actress_rankings").upsert(
      actressRows.map((row) => ({
        name: row.name,
        original_rank: row.rank,
        updated_at: updatedAt,
      })),
      { onConflict: "name" },
    );
    if (error) throw error;
  }
  if (fanzaActressRows.length > 0) {
    const { error } = await supabase.from("actress_rankings").upsert(
      fanzaActressRows.map((row) => ({
        name: row.name,
        fanza_rank: row.rank,
        updated_at: updatedAt,
      })),
      { onConflict: "name" },
    );
    if (error) throw error;
  }
  await onProgress?.(4, ENTITY_STEPS);

  await syncSimpleRanking(
    "genre_rankings",
    genreRows.map((row) => ({ ...row, updated_at: updatedAt })),
  );
  await syncSimpleRanking(
    "maker_rankings",
    makerRows.map((row) => ({ ...row, updated_at: updatedAt })),
  );
  await onProgress?.(5, ENTITY_STEPS);

  await clearRankingColumn("series_rankings", "original_rank");
  await clearRankingColumn("series_rankings", "fanza_rank");
  if (fanzaSeriesRows.length > 0) {
    const { error } = await supabase.from("series_rankings").upsert(
      fanzaSeriesRows.map((row) => ({
        name: row.name,
        fanza_rank: row.rank,
        score: 0,
        updated_at: updatedAt,
      })),
      { onConflict: "name" },
    );
    if (error) throw error;
  }
  await onProgress?.(6, ENTITY_STEPS);

  if (seriesRows.length > 0) {
    const { error } = await supabase.from("series_rankings").upsert(
      seriesRows.map((row) => ({
        name: row.name,
        original_rank: row.rank,
        score: row.score,
        updated_at: updatedAt,
      })),
      { onConflict: "name" },
    );
    if (error) throw error;
  }
  await onProgress?.(7, ENTITY_STEPS);

  return {
    actress: actressRows.length,
    genre: genreRows.length,
    maker: makerRows.length,
    series: seriesRows.length,
  };
}
