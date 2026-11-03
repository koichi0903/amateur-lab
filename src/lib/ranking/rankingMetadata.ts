export type RankingMetadataParams = {
  type?: string;
  page?: string;
  sale?: string;
  sample?: string;
  maxPrice?: string;
};

function resolveRankingType<T extends string>(value: string | undefined, types: readonly T[], fallback: T): T {
  return value && types.includes(value as T) ? value as T : fallback;
}

function resolveRankingPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function buildRankingCanonical(type: string, page: number) {
  const query = new URLSearchParams();
  if (type !== "overall") query.set("type", type);
  if (page > 1) query.set("page", String(page));
  return query.size ? `/ranking?${query}` : "/ranking";
}

export function resolveRankingMetadata<T extends string>(
  params: RankingMetadataParams,
  types: readonly T[],
  fallback: T,
) {
  const type = resolveRankingType(params.type, types, fallback);
  const page = resolveRankingPage(params.page);
  return {
    type,
    page,
    canonical: buildRankingCanonical(type, page),
    noIndex: Boolean(params.sale || params.sample || params.maxPrice),
  };
}
