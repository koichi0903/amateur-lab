import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalPickProfile,
  rankPersonalPickCandidates,
} from "./fanzaAmateurPersonalPick";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalogNormalize";

function item(input: {
  id: string;
  makers?: string[];
  series?: string[];
  genres?: string[];
  price?: number | null;
  rating?: number | null;
  reviewCount?: number;
}): FanzaAmateurCatalogItem {
  return {
    content_id: input.id,
    title: input.id,
    date: "2026-10-30",
    prices: { price: String(input.price ?? ""), list_price: "" },
    iteminfo: {
      maker: (input.makers ?? []).map((name) => ({ name })),
      series: (input.series ?? []).map((name) => ({ name })),
      genre: (input.genres ?? []).map((name) => ({ name })),
    },
    review: input.reviewCount === undefined ? undefined : { average: String(input.rating ?? 0), count: input.reviewCount },
    affiliateURL: `https://example.test/${input.id}`,
    imageUrl: null,
    currentPrice: input.price ?? null,
    reviewAverage: input.rating ?? null,
    campaigns: [],
  };
}

test("buildPersonalPickProfile deduplicates names and averages positive favorite prices", () => {
  const profile = buildPersonalPickProfile([
    item({ id: "fav-1", makers: [" Maker A ", "Maker A"], series: ["Series X"], genres: ["Drama"], price: 1000 }),
    item({ id: "fav-2", makers: ["Maker A"], series: ["Series X"], price: 2000 }),
    item({ id: "fav-3", price: 0 }),
  ]);

  assert.deepEqual([...profile.favoriteIds], ["fav-1", "fav-2", "fav-3"]);
  assert.deepEqual(profile.preferenceTokens, [
    { kind: "maker", name: "Maker A", count: 2 },
    { kind: "series", name: "Series X", count: 2 },
    { kind: "genre", name: "Drama", count: 1 },
  ]);
  assert.equal(profile.averagePrice, 1500);
});

test("rankPersonalPickCandidates excludes favorites and preserves relevance reasons", () => {
  const profile = buildPersonalPickProfile([
    item({ id: "fav", makers: ["Maker A"], series: ["Series X"], genres: ["Drama"], price: 1000 }),
    item({ id: "fav-2", makers: ["Maker A"], series: ["Series X"], price: 2000 }),
  ]);
  const ranked = rankPersonalPickCandidates([
    item({ id: "fav", makers: ["Maker A"], price: 1600 }),
    item({ id: "strong", makers: ["Maker A"], series: ["Series X"], genres: ["Drama"], price: 1700, rating: 4, reviewCount: 10 }),
    item({ id: "genre", genres: ["Drama"], price: null, rating: 5, reviewCount: 0 }),
    item({ id: "rating", price: 5000, rating: 4.5, reviewCount: 20 }),
    item({ id: "price", price: 1300, reviewCount: 0 }),
    item({ id: "unmatched", price: 5000, rating: 0, reviewCount: 0 }),
  ], profile);

  assert.deepEqual(ranked.map(({ item: candidate }) => candidate.content_id), ["strong", "genre", "rating", "price"]);
  assert.deepEqual(ranked.map(({ reason }) => reason), [
    "Maker Aが好きなあなたへ",
    "Dramaが好きなあなたへ",
    "高評価レビューから選んだ一作品",
    "いつもの価格帯から選んだ一作品",
  ]);
  assert.deepEqual(Object.keys(ranked[0] ?? {}).sort(), ["item", "reason"]);
});

test("rankPersonalPickCandidates retains the explicit top-15 cap and rating tie-break", () => {
  const profile = buildPersonalPickProfile([item({ id: "favorite", makers: ["Common Maker"] })]);
  const candidates = Array.from({ length: 18 }, (_, index) => item({
    id: `candidate-${index + 1}`,
    makers: ["Common Maker"],
    rating: index + 1,
    reviewCount: 0,
  }));
  const ranked = rankPersonalPickCandidates(candidates, profile);

  assert.equal(ranked.length, 15);
  assert.equal(ranked[0]?.item.content_id, "candidate-18");
  assert.equal(ranked[14]?.item.content_id, "candidate-4");
});
