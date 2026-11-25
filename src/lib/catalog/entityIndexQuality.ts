export type EntityQualityKind = "actress" | "maker" | "series" | "genre";

export const ENTITY_INDEX_THRESHOLDS: Record<
  EntityQualityKind,
  { minWorks: number }
> = {
  actress: { minWorks: 1 },
  genre: { minWorks: 10 },
  maker: { minWorks: 5 },
  series: { minWorks: 5 },
};

type EntityQualitySummary = {
  name: string;
  count: number;
  maxScore: number;
  imageUrl: string | null;
};

export function isEntityIndexable(
  kind: EntityQualityKind,
  summary: EntityQualitySummary,
) {
  const threshold = ENTITY_INDEX_THRESHOLDS[kind];
  return (
    summary.count >= threshold.minWorks &&
    Boolean(summary.imageUrl?.trim())
  );
}
