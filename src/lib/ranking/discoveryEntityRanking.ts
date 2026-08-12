import { unstable_cache } from "next/cache";
import { getAllWorks } from "@/lib/supabase/getAllWorks";

export type DiscoveryEntityKind = "actress" | "genre" | "maker" | "series";

type RankingWork = {
  id: number;
  title: string;
  actress: string | null;
  genre: string | null;
  maker: string | null;
  series: string | null;
  image_url: string | null;
  score: number | null;
};

type EntityAccumulator = {
  name: string;
  works: Array<{ id: number; title: string; imageUrl: string | null; score: number }>;
};

export type DiscoveryEntityRankingItem = {
  name: string;
  rank: number;
  discoveryScore: number;
  topWorkAverage: number;
  strongWorkAverage: number;
  workCount: number;
  imageUrl: string | null;
  representativeWorkId: number;
  representativeWorkTitle: string;
};

const minimumWorkCounts: Record<DiscoveryEntityKind, number> = {
  actress: 3,
  genre: 5,
  maker: 3,
  series: 2,
};

function entityNames(work: RankingWork, kind: DiscoveryEntityKind) {
  const rawValues = kind === "actress" || kind === "genre" ? work[kind]?.split("/") ?? [] : [work[kind]];
  return [...new Set(rawValues.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

export function calculateDiscoveryEntityRankings(works: RankingWork[], kind: DiscoveryEntityKind): DiscoveryEntityRankingItem[] {
  const entities = new Map<string, EntityAccumulator>();

  for (const work of works) {
    for (const name of entityNames(work, kind)) {
      const current = entities.get(name) ?? { name, works: [] };
      current.works.push({
        id: work.id,
        title: work.title,
        imageUrl: work.image_url,
        score: Math.max(0, Math.min(100, work.score ?? 0)),
      });
      entities.set(name, current);
    }
  }

  const eligible = [...entities.values()].filter((entity) => entity.works.length >= minimumWorkCounts[kind]);
  const maxWorkCount = Math.max(1, ...eligible.map((entity) => entity.works.length));

  return eligible
    .map((entity) => {
      const sortedWorks = [...entity.works].sort((a, b) => b.score - a.score || b.id - a.id);
      const topWorkAverage = average(sortedWorks.slice(0, 5).map((work) => work.score));
      const strongWorkAverage = average(sortedWorks.slice(0, 20).map((work) => work.score));
      const volumeScore = Math.log1p(entity.works.length) / Math.log1p(maxWorkCount) * 100;
      const discoveryScore = roundScore(topWorkAverage * 0.6 + strongWorkAverage * 0.25 + volumeScore * 0.15);
      const representative = sortedWorks.find((work) => work.imageUrl) ?? sortedWorks[0];

      return {
        name: entity.name,
        rank: 0,
        discoveryScore,
        topWorkAverage: roundScore(topWorkAverage),
        strongWorkAverage: roundScore(strongWorkAverage),
        workCount: entity.works.length,
        imageUrl: representative.imageUrl,
        representativeWorkId: representative.id,
        representativeWorkTitle: representative.title,
      };
    })
    .sort((a, b) =>
      b.discoveryScore - a.discoveryScore
      || b.topWorkAverage - a.topWorkAverage
      || b.strongWorkAverage - a.strongWorkAverage
      || b.workCount - a.workCount
      || a.name.localeCompare(b.name, "ja")
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

async function loadDiscoveryEntityRankings(kind: DiscoveryEntityKind) {
  const works = await getAllWorks<RankingWork>("id,title,actress,genre,maker,series,image_url,score");
  return calculateDiscoveryEntityRankings(works, kind);
}

export const getDiscoveryEntityRankings = unstable_cache(
  loadDiscoveryEntityRankings,
  ["discovery-entity-rankings-v1"],
  { revalidate: 300 }
);
