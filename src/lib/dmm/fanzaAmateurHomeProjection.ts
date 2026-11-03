import {
  asText,
  isRecord,
  priceNumber,
  type FanzaAmateurCatalogItem,
} from "@/lib/dmm/fanzaAmateurCatalogNormalize";

export type FanzaAmateurHomeEntry = {
  item: FanzaAmateurCatalogItem;
  rank?: number;
};

export type FanzaAmateurHomePricePoint = {
  price: number;
  changedAt: string;
  priceKind: "regular" | "sale" | null;
  isCurrent?: boolean;
};

export type FanzaAmateurHomeCard = {
  item: FanzaAmateurCatalogItem;
  rank?: number;
  priceHistory: FanzaAmateurHomePricePoint[];
  priceWindowStartAt: string;
  priceWindowEndAt: string;
  lowestObservedPrice: number | null;
};

type SummaryPriceHistoryRow = {
  content_id: string;
  observed_at: string;
  price: unknown;
};

type StoredMediaRow = {
  content_id: string;
  image_url: unknown;
  sample_image_url: unknown;
};

export function buildFanzaAmateurHomeEntries(
  rankedCatalog: readonly FanzaAmateurCatalogItem[],
  latestCatalog: readonly FanzaAmateurCatalogItem[],
  isCampaign: (item: FanzaAmateurCatalogItem) => boolean,
) {
  const popular = rankedCatalog.slice(0, 12).map((item, index) => ({ item, rank: index + 1 }));
  const campaign = rankedCatalog.filter(isCampaign).slice(0, 12).map((item) => ({ item }));
  const latest = latestCatalog.slice(0, 12).map((item) => ({ item }));
  const all = [...popular, ...campaign, ...latest];
  return { popular, campaign, latest, all, contentIds: [...new Set(all.map(({ item }) => item.content_id))] };
}

export function applyStoredMediaToHomeEntries(entries: readonly FanzaAmateurHomeEntry[], storedMedia: readonly StoredMediaRow[]) {
  const mediaByContentId = new Map(storedMedia.map((row) => [row.content_id, row]));
  for (const { item } of entries) {
    const saved = mediaByContentId.get(item.content_id);
    if (!saved) continue;
    applyStoredCoverImages(item, saved.image_url);
    applyStoredSampleImages(item, saved.sample_image_url);
  }
}

function applyStoredCoverImages(item: FanzaAmateurCatalogItem, storedImageValue: unknown) {
  const savedImages = isRecord(storedImageValue) ? storedImageValue : {};
  item.imageURL = {
    ...(item.imageURL ?? {}),
    large: asText(savedImages.large) || item.imageURL?.large,
    small: asText(savedImages.small) || item.imageURL?.small,
    list: asText(savedImages.list) || item.imageURL?.list,
  };
}

function applyStoredSampleImages(item: FanzaAmateurCatalogItem, storedSampleValue: unknown) {
  const savedSamples = isRecord(storedSampleValue) ? storedSampleValue : {};
  const savedLargeSamples = isRecord(savedSamples.sample_l) ? savedSamples.sample_l : {};
  const savedSmallSamples = isRecord(savedSamples.sample_s) ? savedSamples.sample_s : {};
  const largeSampleImages = stringImageUrls(savedLargeSamples.image);
  const smallSampleImages = stringImageUrls(savedSmallSamples.image);
  if (!largeSampleImages.length && !smallSampleImages.length) return;
  item.sampleImageURL = {
    ...(item.sampleImageURL ?? {}),
    sample_l: largeSampleImages.length ? { image: largeSampleImages } : item.sampleImageURL?.sample_l,
    sample_s: smallSampleImages.length ? { image: smallSampleImages } : item.sampleImageURL?.sample_s,
  };
}

function stringImageUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string") : [];
}

export function buildAmateurHomePriceHistoryIndex(histories: readonly SummaryPriceHistoryRow[]) {
  const historyByContentId = new Map<string, Array<{ price: number; changedAt: string; priceKind: "regular" | "sale" | null }>>();
  for (const row of histories) {
    const price = priceNumber(row.price);
    if (price == null) continue;
    const history = historyByContentId.get(row.content_id) ?? [];
    history.push({ price, changedAt: row.observed_at, priceKind: null });
    historyByContentId.set(row.content_id, history);
  }
  return historyByContentId;
}

export function withAmateurHomePriceChart(
  entry: FanzaAmateurHomeEntry,
  historyByContentId: ReadonlyMap<string, readonly FanzaAmateurHomePricePoint[]>,
  windowStartAt: string,
  windowEndAt: string,
): FanzaAmateurHomeCard {
  const history = [...(historyByContentId.get(entry.item.content_id) ?? [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const currentPrice = entry.item.currentPrice;
  const priceHistory = currentPrice == null ? history : [
    ...history,
    { price: currentPrice, changedAt: windowEndAt, priceKind: null, isCurrent: true },
  ];
  return {
    item: entry.item,
    rank: entry.rank,
    priceHistory,
    priceWindowStartAt: windowStartAt,
    priceWindowEndAt: windowEndAt,
    lowestObservedPrice: priceHistory.length ? Math.min(...priceHistory.map((point) => point.price)) : null,
  };
}
