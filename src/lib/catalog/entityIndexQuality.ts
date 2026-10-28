import { GSC_TARGET_ACTRESS_NAMES } from "./actressGsc635Manifest";

export type EntityQualityKind = "actress" | "maker" | "series" | "genre";

export const ENTITY_INDEX_THRESHOLDS: Record<
  EntityQualityKind,
  { minWorks: number; minScore: number }
> = {
  actress: { minWorks: 10, minScore: 60 },
  genre: { minWorks: 10, minScore: 60 },
  maker: { minWorks: 5, minScore: 50 },
  series: { minWorks: 5, minScore: 50 },
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
    (summary.maxScore >= threshold.minScore ||
      (kind === "actress" && GSC_TARGET_ACTRESS_NAMES.has(summary.name))) &&
    Boolean(summary.imageUrl?.trim())
  );
}
