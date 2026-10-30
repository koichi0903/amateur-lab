import type { DmmItem } from "@/types/dmm";

export type RankedDmmItem = DmmItem & { rank: number };
export type EntityScoreRow = { name: string; score: number; rank: number };

function getRankingPoint(rank: number) {
  return Math.max(1, Math.floor(500 / Math.sqrt(rank)));
}

function addScore(target: Record<string, number>, name: string, point: number) {
  const normalized = name.trim();
  if (!normalized) return;
  target[normalized] = (target[normalized] ?? 0) + point;
}

function toRankedRows(scores: Record<string, number>, limit: number): EntityScoreRow[] {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score], index) => ({ name, score, rank: index + 1 }))
    .slice(0, limit);
}

export function projectEntityRankingItems(rankingItems: RankedDmmItem[], ignoredGenres: string[]) {
  const genreScores: Record<string, number> = {};
  const actressScores: Record<string, number> = {};
  const makerScores: Record<string, number> = {};
  const seriesScores: Record<string, number> = {};

  for (const item of rankingItems) {
    const point = getRankingPoint(item.rank);
    for (const genre of item.iteminfo?.genre ?? []) {
      if (!ignoredGenres.includes(genre.name)) addScore(genreScores, genre.name, point);
    }
    for (const actress of item.iteminfo?.actress ?? []) addScore(actressScores, actress.name, point);
    for (const maker of item.iteminfo?.maker ?? []) addScore(makerScores, maker.name, point);
    for (const series of item.iteminfo?.series ?? []) addScore(seriesScores, series.name, point);
  }

  return {
    actressRows: toRankedRows(actressScores, 100),
    genreRows: toRankedRows(genreScores, 30),
    makerRows: toRankedRows(makerScores, 50),
    seriesRows: toRankedRows(seriesScores, 100),
  };
}

export function mergeActressRankingRows(
  actressRows: EntityScoreRow[],
  fanzaActressRows: Array<{ name: string; rank: number }>,
  updatedAt: string,
) {
  const originalRanks = new Map(actressRows.map((row) => [row.name, row.rank]));
  const fanzaRanks = new Map(fanzaActressRows.map((row) => [row.name, row.rank]));
  const names = new Set([...originalRanks.keys(), ...fanzaRanks.keys()]);
  return [...names].map((name) => ({
    name,
    original_rank: originalRanks.get(name) ?? null,
    fanza_rank: fanzaRanks.get(name) ?? null,
    updated_at: updatedAt,
  }));
}

export function mergeSeriesRankingRows(
  seriesRows: EntityScoreRow[],
  fanzaSeriesRows: Array<{ name: string; rank: number }>,
  updatedAt: string,
) {
  const originalRows = new Map(seriesRows.map((row) => [row.name, row]));
  const fanzaRanks = new Map(fanzaSeriesRows.map((row) => [row.name, row.rank]));
  const names = new Set([...originalRows.keys(), ...fanzaRanks.keys()]);
  return [...names].map((name) => ({
    name,
    original_rank: originalRows.get(name)?.rank ?? null,
    fanza_rank: fanzaRanks.get(name) ?? null,
    score: originalRows.get(name)?.score ?? 0,
    updated_at: updatedAt,
  }));
}
