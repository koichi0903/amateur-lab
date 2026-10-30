export type RankingPageHrefOptions = {
  type: string;
  targetPage: number;
  saleOnly: boolean;
  sampleOnly: boolean;
  maxPrice: number | null;
};

export function buildRankingPageHref({
  type,
  targetPage,
  saleOnly,
  sampleOnly,
  maxPrice,
}: RankingPageHrefOptions) {
  const query = new URLSearchParams();
  if (type !== "overall") query.set("type", type);
  if (targetPage > 1) query.set("page", String(targetPage));
  if (saleOnly) query.set("sale", "1");
  if (sampleOnly) query.set("sample", "1");
  if (maxPrice) query.set("maxPrice", String(maxPrice));
  return query.size ? `/ranking?${query}` : "/ranking";
}
