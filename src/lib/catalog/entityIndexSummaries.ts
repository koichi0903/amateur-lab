import { unstable_cache } from "next/cache";
import { getAllWorks } from "@/lib/supabase/getAllWorks";

export type EntityIndexKind = "actress" | "maker" | "series" | "genre";

type EntitySource = {
  actress: string | null;
  maker: string | null;
  series: string | null;
  genre: string | null;
  image_url: string | null;
  score: number | null;
};

export type EntityIndexSummary = {
  name: string;
  count: number;
  maxScore: number;
  imageUrl: string | null;
};

type EntityIndexSummaryMap = Record<EntityIndexKind, EntityIndexSummary[]>;

const kinds: EntityIndexKind[] = ["actress", "maker", "series", "genre"];

function namesFor(work: EntitySource, kind: EntityIndexKind) {
  const values = kind === "actress" || kind === "genre"
    ? work[kind]?.split(" / ") ?? []
    : [work[kind]];

  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

async function loadEntityIndexSummaries(): Promise<EntityIndexSummaryMap> {
  const works = await getAllWorks<EntitySource>(
    "actress,maker,series,genre,image_url,score"
  );

  const result = {} as EntityIndexSummaryMap;

  for (const kind of kinds) {
    const summaries = new Map<string, EntityIndexSummary>();

    for (const work of works) {
      for (const name of namesFor(work, kind)) {
        const score = work.score ?? 0;
        const current = summaries.get(name);

        if (!current) {
          summaries.set(name, {
            name,
            count: 1,
            maxScore: score,
            imageUrl: work.image_url,
          });
          continue;
        }

        current.count += 1;
        if (score > current.maxScore) {
          current.maxScore = score;
          current.imageUrl = work.image_url;
        }
      }
    }

    result[kind] = [...summaries.values()].sort(
      (a, b) => b.count - a.count || b.maxScore - a.maxScore || a.name.localeCompare(b.name, "ja")
    );
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
