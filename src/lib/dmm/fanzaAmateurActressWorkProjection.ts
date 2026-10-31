import { mergeStoredCatalogMedia } from "@/lib/dmm/fanzaAmateurCatalogDetailProjection";
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

export function projectFanzaAmateurActressWorkRow(
  row: FanzaAmateurActressWorkRow,
  normalize: CatalogItemNormalizer,
) {
  const item = normalize(row.raw_item);
  if (!item) return null;

  const itemWithMedia = mergeStoredCatalogMedia(item, row.image_url, row.sample_image_url);
  itemWithMedia.confirmedPerformers = row.confirmed_performers ?? [];
  return { item: itemWithMedia, fetchedAt: row.fetched_at };
}
