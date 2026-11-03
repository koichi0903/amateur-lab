import type { DmmItem } from "@/types/dmm";

export type RankedDmmItem = DmmItem & { rank: number };
export type EntityScoreRow = { name: string; score: number; rank: number };
type NamedEntity = { name: string };

function getRankingPoint(rank: number) {
  return Math.max(1, Math.floor(500 / Math.sqrt(rank)));
}

function addScore(target: Record<string, number>, name: string, point: number) {
  const normalized = name.trim();
  if (!normalized) return;
  target[normalized] = (target[normalized] ?? 0) + point;
}

function addNamedEntityScores(
  target: Record<string, number>,
  entities: NamedEntity[] | undefined,
  point: number,
) {
  for (const entity of entities ?? []) addScore(target, entity.name, point);
}

function addGenreScores(
  target: Record<string, number>,
  genres: NamedEntity[] | undefined,
  ignoredGenres: string[],
  point: number,
) {
  for (const genre of genres ?? []) {
    if (!ignoredGenres.includes(genre.name)) addScore(target, genre.name, point);
  }
}

function toRankedRows(scores: Record<string, number>, limit: number): EntityScoreRow[] {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score], index) => ({ name, score, rank: index + 1 }))
    .slice(0, limit);
}

export function projectEntityRankingItems(rankingItems: RankedDmmItem[], ignoredGenres: string[]) {
  const scores = {
    genre: {} as Record<string, number>,
    actress: {} as Record<string, number>,
    maker: {} as Record<string, number>,
    series: {} as Record<string, number>,
  };

  for (const item of rankingItems) {
    const point = getRankingPoint(item.rank);
    addGenreScores(scores.genre, item.iteminfo?.genre, ignoredGenres, point);
    addNamedEntityScores(scores.actress, item.iteminfo?.actress, point);
    addNamedEntityScores(scores.maker, item.iteminfo?.maker, point);
    addNamedEntityScores(scores.series, item.iteminfo?.series, point);
  }

  return {
    actressRows: toRankedRows(scores.actress, 100),
    genreRows: toRankedRows(scores.genre, 30),
    makerRows: toRankedRows(scores.maker, 50),
    seriesRows: toRankedRows(scores.series, 100),
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
