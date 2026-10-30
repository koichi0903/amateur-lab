import { asText, isRecord } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";

export type FanzaAmateurActressWorkRow = {
  raw_item: unknown;
  fetched_at: string;
  image_url: unknown;
  sample_image_url: unknown;
  confirmed_performers: string[] | null;
  total_count: number | string;
};

type CatalogItemNormalizer = (rawItem: unknown) => FanzaAmateurCatalogItem | null;

function mergeSavedCatalogImages(item: FanzaAmateurCatalogItem, value: unknown) {
  const savedImages = isRecord(value) ? value : {};
  item.imageURL = {
    ...(item.imageURL ?? {}),
    large: asText(savedImages.large) || item.imageURL?.large,
    small: asText(savedImages.small) || item.imageURL?.small,
    list: asText(savedImages.list) || item.imageURL?.list,
  };
}

function readSampleImageList(value: unknown): string[] {
  return isRecord(value) && Array.isArray(value.image)
    ? value.image.filter((url): url is string => typeof url === "string")
    : [];
}

function mergeSavedSampleImages(item: FanzaAmateurCatalogItem, value: unknown) {
  const savedSamples = isRecord(value) ? value : {};
  const largeSampleImages = readSampleImageList(isRecord(savedSamples.sample_l) ? savedSamples.sample_l : null);
  const smallSampleImages = readSampleImageList(isRecord(savedSamples.sample_s) ? savedSamples.sample_s : null);
  if (!largeSampleImages.length && !smallSampleImages.length) return;

  item.sampleImageURL = {
    ...(item.sampleImageURL ?? {}),
    sample_l: largeSampleImages.length ? { image: largeSampleImages } : item.sampleImageURL?.sample_l,
    sample_s: smallSampleImages.length ? { image: smallSampleImages } : item.sampleImageURL?.sample_s,
  };
}

export function projectFanzaAmateurActressWorkRow(
  row: FanzaAmateurActressWorkRow,
  normalize: CatalogItemNormalizer,
) {
  const item = normalize(row.raw_item);
  if (!item) return null;

  mergeSavedCatalogImages(item, row.image_url);
  mergeSavedSampleImages(item, row.sample_image_url);
  item.confirmedPerformers = row.confirmed_performers ?? [];
  return { item, fetchedAt: row.fetched_at };
}
