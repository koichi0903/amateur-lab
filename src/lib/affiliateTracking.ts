export const AFFILIATE_SOURCES = [
  "direct",
  "home",
  "ranking",
  "new",
  "sale",
  "deals",
  "discovery",
  "features",
  "comparison",
  "search",
  "favorites",
  "actress",
  "genre",
  "maker",
  "series",
  "related",
  "x",
] as const;

export type AffiliateSource = (typeof AFFILIATE_SOURCES)[number];

const affiliateSourceSet = new Set<string>(AFFILIATE_SOURCES);

export function normalizeAffiliateSource(
  value: string | string[] | null | undefined,
): AffiliateSource {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && affiliateSourceSet.has(candidate)
    ? (candidate as AffiliateSource)
    : "direct";
}

export function workDetailHref(
  workId: number | string,
  source: AffiliateSource,
) {
  return `/works/${encodeURIComponent(String(workId))}?from=${source}`;
}

export const AFFILIATE_SOURCE_LABELS: Record<AffiliateSource, string> = {
  direct: "直接・不明",
  home: "TOP",
  ranking: "ランキング",
  new: "新着",
  sale: "セール",
  deals: "お得作品",
  discovery: "今日の発掘",
  features: "特集",
  comparison: "詳細・買い比べ",
  search: "検索",
  favorites: "お気に入り",
  actress: "女優詳細",
  genre: "ジャンル詳細",
  maker: "メーカー詳細",
  series: "シリーズ詳細",
  related: "関連作品",
  x: "X",
};
