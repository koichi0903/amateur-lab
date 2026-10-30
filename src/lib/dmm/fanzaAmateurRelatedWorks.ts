import { hasActiveCampaign } from "./fanzaAmateurCatalogBrowseRules";
import { asText, type FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";

export type FanzaAmateurRelatedWorkFilter = {
  kind: "series" | "genre" | "maker";
  value: string;
};

function names(values: Array<{ name: string }> | undefined) {
  return [...new Set((values ?? []).map(({ name }) => asText(name)).filter(Boolean))];
}

export function buildFanzaAmateurRelatedWorkFilters(item: FanzaAmateurCatalogItem): FanzaAmateurRelatedWorkFilter[] {
  const genres = names(item.iteminfo?.genre);
  const makers = names(item.iteminfo?.maker);
  const series = names(item.iteminfo?.series);

  return [
    ...series.slice(0, 3).map((value) => ({ kind: "series" as const, value })),
    ...genres.slice(0, 6).map((value) => ({ kind: "genre" as const, value })),
    ...makers.slice(0, 3).map((value) => ({ kind: "maker" as const, value })),
  ];
}

export function rankFanzaAmateurRelatedWorks(
  item: FanzaAmateurCatalogItem,
  candidateItems: Array<FanzaAmateurCatalogItem | null>,
  limit = 12,
  now = Date.now(),
) {
  const candidates = new Map<string, FanzaAmateurCatalogItem>();
  for (const candidate of candidateItems) {
    if (candidate && candidate.content_id !== item.content_id) candidates.set(candidate.content_id, candidate);
  }

  const currentGenres = new Set(names(item.iteminfo?.genre));
  const currentMakers = new Set(names(item.iteminfo?.maker));
  const currentSeries = new Set(names(item.iteminfo?.series));
  const relevance = (candidate: FanzaAmateurCatalogItem) => {
    const candidateGenres = names(candidate.iteminfo?.genre);
    const candidateMakers = names(candidate.iteminfo?.maker);
    const candidateSeries = names(candidate.iteminfo?.series);
    const genreMatches = candidateGenres.filter((name) => currentGenres.has(name)).length;
    const hasMakerMatch = candidateMakers.some((name) => currentMakers.has(name));
    const hasSeriesMatch = candidateSeries.some((name) => currentSeries.has(name));
    const reviewCount = candidate.review?.count ?? 0;
    const reviewBonus = reviewCount > 0 && candidate.reviewAverage != null
      ? Math.max(0, Math.min(5, candidate.reviewAverage)) * 2
      : 0;

    return (hasSeriesMatch ? 45 : 0)
      + Math.min(50, genreMatches * 25)
      + (hasMakerMatch ? 15 : 0)
      + reviewBonus
      + (hasActiveCampaign(candidate, now) ? 6 : 0);
  };
  const releaseTime = (candidate: FanzaAmateurCatalogItem) => Date.parse(candidate.date || "") || 0;

  return [...candidates.values()]
    .sort((a, b) => relevance(b) - relevance(a)
      || releaseTime(b) - releaseTime(a)
      || (b.review?.count ?? 0) - (a.review?.count ?? 0)
      || a.content_id.localeCompare(b.content_id))
    .slice(0, Math.max(0, limit));
}
