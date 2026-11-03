import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";

export type PersonalPickToken = { kind: "maker" | "series" | "genre"; name: string; count: number };

export type PersonalPickProfile = {
  favoriteIds: Set<string>;
  tokenCounts: Map<string, PersonalPickToken>;
  preferenceTokens: PersonalPickToken[];
  averagePrice: number;
};

export type PersonalPick = {
  item: FanzaAmateurCatalogItem;
  reason: string;
};

type ScoredPersonalPick = Omit<PersonalPick, "reason"> & {
  relevance: number;
  matchedTokens: PersonalPickToken[];
  priceMatch: boolean;
};

function names(values: Array<{ name: string }> | undefined): string[] {
  return [...new Set((values ?? []).map(({ name }) => name.trim()).filter(Boolean))];
}

export function buildPersonalPickProfile(favorites: FanzaAmateurCatalogItem[]): PersonalPickProfile {
  const favoriteIds = new Set(favorites.map((item) => item.content_id));
  const tokenCounts = new Map<string, PersonalPickToken>();
  for (const item of favorites) {
    const groups = [
      { kind: "maker" as const, values: names(item.iteminfo?.maker) },
      { kind: "series" as const, values: names(item.iteminfo?.series) },
      { kind: "genre" as const, values: names(item.iteminfo?.genre) },
    ];
    for (const { kind, values } of groups) {
      for (const name of values) {
        const key = `${kind}:${name}`;
        const current = tokenCounts.get(key);
        tokenCounts.set(key, { kind, name, count: (current?.count ?? 0) + 1 });
      }
    }
  }
  const priceValues = favorites.map((item) => item.currentPrice ?? 0).filter((price) => price > 0);
  const averagePrice = priceValues.length ? priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length : 0;
  const preferenceTokens = [...tokenCounts.values()].sort((a, b) => b.count - a.count).slice(0, 15);

  return { favoriteIds, tokenCounts, preferenceTokens, averagePrice };
}

function matchedPreferenceTokens(item: FanzaAmateurCatalogItem, profile: PersonalPickProfile): PersonalPickToken[] {
  return [
    ...names(item.iteminfo?.maker).map((name) => `maker:${name}`),
    ...names(item.iteminfo?.series).map((name) => `series:${name}`),
    ...names(item.iteminfo?.genre).map((name) => `genre:${name}`),
  ]
    .filter((token) => profile.tokenCounts.has(token))
    .map((token) => profile.tokenCounts.get(token)!)
    .sort((a, b) => b.count - a.count);
}

function scoreCandidate(item: FanzaAmateurCatalogItem, profile: PersonalPickProfile): ScoredPersonalPick | null {
  const matchedTokens = matchedPreferenceTokens(item, profile);
  const price = item.currentPrice ?? 0;
  const priceMatch = profile.averagePrice > 0 && price > 0 && Math.abs(price - profile.averagePrice) <= Math.max(500, profile.averagePrice * 0.5);
  const rating = item.reviewAverage ?? 0;
  const relevance = matchedTokens.reduce((sum, token) => sum + token.count * 10, 0)
    + (priceMatch ? 3 : 0)
    + (item.review?.count && rating > 0 ? Math.max(0, Math.min(5, rating)) * 2 : 0);
  return relevance > 0 ? { item, relevance, matchedTokens, priceMatch } : null;
}

export function rankPersonalPickCandidates(
  candidates: FanzaAmateurCatalogItem[],
  profile: PersonalPickProfile,
): PersonalPick[] {
  return candidates
    .filter((item) => !profile.favoriteIds.has(item.content_id))
    .flatMap((item) => {
      const scored = scoreCandidate(item, profile);
      return scored ? [scored] : [];
    })
    .sort((a, b) => b.relevance - a.relevance || (b.item.reviewAverage ?? 0) - (a.item.reviewAverage ?? 0))
    .slice(0, 15)
    .map(({ item, matchedTokens, priceMatch }) => ({
      item,
      reason: matchedTokens[0]
        ? `${matchedTokens[0].name}が好きなあなたへ`
        : priceMatch
          ? "いつもの価格帯から選んだ一作品"
          : "高評価レビューから選んだ一作品",
    }));
}
