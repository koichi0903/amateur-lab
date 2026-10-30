import type { FanzaAmateurPriceHistoryEntry } from "@/lib/dmm/fanzaAmateurCatalog";

const priceTypeOrder = ["stream", "download", "hd", "iosdl", "androiddl"];

export function formatFanzaAmateurPriceType(type: string) {
  const labels: Record<string, string> = {
    stream: "ストリーミング",
    download: "ダウンロード",
    hd: "HD",
    iosdl: "iOS",
    androiddl: "Android",
  };
  return labels[type] ?? type;
}

function parsePrice(value: string | null | undefined) {
  const digits = value?.match(/[0-9]+/)?.[0];
  return digits ? Number(digits) : null;
}

type FanzaAmateurDeliveryPrice = { type: string; price?: string | null; list_price?: string | null };

export function buildFanzaAmateurDetailPriceProjection({
  priceHistory,
  currentPrice,
  listPrice: rawListPrice,
  deliveries,
  selectedPriceType,
  fetchedAt,
}: {
  priceHistory: FanzaAmateurPriceHistoryEntry[];
  currentPrice: number | null;
  listPrice: string | null | undefined;
  deliveries: FanzaAmateurDeliveryPrice[] | undefined;
  selectedPriceType: string;
  fetchedAt: string;
}) {
  const priceTypes = [...new Set(priceHistory.map((entry) => entry.price_type).filter((type) => type !== "summary"))].sort((a, b) => {
    const aIndex = priceTypeOrder.indexOf(a);
    const bIndex = priceTypeOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  const representativePriceType = priceTypes.find((type) => parsePrice(deliveries?.find((delivery) => delivery.type === type)?.price) === currentPrice) ?? priceTypes[0] ?? "";
  const activePriceType = priceTypes.includes(selectedPriceType) ? selectedPriceType : representativePriceType;
  const listPrice = parsePrice(rawListPrice);
  const discount = currentPrice != null && listPrice != null && listPrice > currentPrice
    ? Math.round((1 - currentPrice / listPrice) * 100)
    : 0;
  const activeHistory = priceHistory
    .filter((entry) => entry.price_type === activePriceType)
    .map((entry) => ({ entry, price: parsePrice(entry.price) }))
    .filter((entry): entry is { entry: FanzaAmateurPriceHistoryEntry; price: number } => entry.price != null)
    .sort((a, b) => a.entry.observed_at.localeCompare(b.entry.observed_at));
  const currentDeliveryPrice = deliveries?.find((delivery) => delivery.type === activePriceType);
  const currentChartPrice = parsePrice(currentDeliveryPrice?.price);
  const chartHistory = [...activeHistory];
  if (currentChartPrice != null && fetchedAt) {
    const latest = chartHistory.at(-1);
    if (latest?.entry.observed_at === fetchedAt) {
      chartHistory[chartHistory.length - 1] = { ...latest, price: currentChartPrice };
    } else {
      chartHistory.push({
        entry: {
          observed_at: fetchedAt,
          price_type: activePriceType,
          price: String(currentChartPrice),
          list_price: currentDeliveryPrice?.list_price ?? null,
        },
        price: currentChartPrice,
      });
    }
  }
  const chartData = chartHistory.map(({ entry, price }) => ({
    date: new Date(entry.observed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price,
  }));
  const lowestPrice = activeHistory.length ? Math.min(...activeHistory.map(({ price }) => price)) : null;

  return { priceTypes, activePriceType, listPrice, discount, activeHistory, chartHistory, chartData, lowestPrice };
}

type FanzaAmateurDetailEntity = {
  imageURL?: { large?: string | null; small?: string | null; list?: string | null } | null;
  imageUrl?: string | null;
  confirmedPerformers?: string[] | null;
  iteminfo?: {
    maker?: Array<{ name: string }> | null;
    series?: Array<{ name: string }> | null;
    genre?: Array<{ name: string }> | null;
  } | null;
};

function detailCoverUrl(item: FanzaAmateurDetailEntity) {
  return item.imageURL?.large || item.imageURL?.small || item.imageURL?.list || item.imageUrl;
}

function detailEntityNames(entries: Array<{ name: string }> | null | undefined) {
  return entries?.map((entry) => entry.name).filter(Boolean) ?? [];
}

export function buildFanzaAmateurDetailEntityProjection(item: FanzaAmateurDetailEntity) {
  return {
    coverUrl: detailCoverUrl(item),
    performers: item.confirmedPerformers ?? [],
    makers: detailEntityNames(item.iteminfo?.maker),
    seriesList: detailEntityNames(item.iteminfo?.series),
    genres: detailEntityNames(item.iteminfo?.genre),
  };
}

type CatalogDetailMedia = {
  imageURL?: { large?: string; small?: string; list?: string };
  sampleImageURL?: {
    sample_l?: { image: string[] };
    sample_s?: { image: string[] };
  };
};

type TimedPriceRow = { observed_at: string; price_type: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringImages(value: unknown) {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string") : [];
}

function mergeStoredCatalogImages(item: CatalogDetailMedia, savedImagesValue: unknown): CatalogDetailMedia {
  const savedImages = isRecord(savedImagesValue) ? savedImagesValue : {};
  return {
    ...item,
    imageURL: {
      ...(item.imageURL ?? {}),
      large: asText(savedImages.large) || item.imageURL?.large,
      small: asText(savedImages.small) || item.imageURL?.small,
      list: asText(savedImages.list) || item.imageURL?.list,
    },
  };
}

function mergeStoredCatalogSamples(item: CatalogDetailMedia, savedSamplesValue: unknown): CatalogDetailMedia {
  const savedSamples = isRecord(savedSamplesValue) ? savedSamplesValue : {};
  const savedLargeSamples = isRecord(savedSamples.sample_l) ? savedSamples.sample_l : {};
  const savedSmallSamples = isRecord(savedSamples.sample_s) ? savedSamples.sample_s : {};
  const savedLargeSampleImages = stringImages(savedLargeSamples.image);
  const savedSmallSampleImages = stringImages(savedSmallSamples.image);

  return savedLargeSampleImages.length || savedSmallSampleImages.length
    ? {
      ...item,
      sampleImageURL: {
        ...(item.sampleImageURL ?? {}),
        sample_l: savedLargeSampleImages.length
          ? { image: savedLargeSampleImages }
          : item.sampleImageURL?.sample_l,
        sample_s: savedSmallSampleImages.length
          ? { image: savedSmallSampleImages }
          : item.sampleImageURL?.sample_s,
      },
    }
    : item;
}

export function mergeStoredCatalogMedia<T extends CatalogDetailMedia>(
  item: T,
  savedImagesValue: unknown,
  savedSamplesValue: unknown,
): T {
  const withStoredImages = mergeStoredCatalogImages(item, savedImagesValue);
  return mergeStoredCatalogSamples(withStoredImages, savedSamplesValue) as T;
}

export function mergeCatalogDetailPriceHistory<TRow extends TimedPriceRow, TSnapshot>(
  history: TRow[],
  weeklySnapshots: TSnapshot[],
  expandSnapshot: (snapshot: TSnapshot) => TRow[],
) {
  const byTimestampAndType = new Map<string, TRow>();
  for (const snapshot of weeklySnapshots) {
    for (const entry of expandSnapshot(snapshot)) {
      byTimestampAndType.set(`${entry.observed_at}\u0000${entry.price_type}`, entry);
    }
  }
  for (const row of history) {
    byTimestampAndType.set(`${row.observed_at}\u0000${row.price_type}`, row);
  }
  return [...byTimestampAndType.values()].sort(
    (a, b) => b.observed_at.localeCompare(a.observed_at) || a.price_type.localeCompare(b.price_type),
  );
}
