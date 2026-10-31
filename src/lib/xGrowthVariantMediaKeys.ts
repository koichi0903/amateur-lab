import type { XCreativeVariant } from "./xCreativeEngine";
import type { XMediaAsset } from "./xMediaAssets";

export type VariantMediaKeyItem = {
  workId: number;
  mediaAsset?: Partial<XMediaAsset> | null;
  sampleMovieUrl?: string | null;
  imageUrl?: string | null;
};

type VariantMediaKeyVariant = Pick<XCreativeVariant, "url" | "bodyText" | "creativeGenome" | "mediaType">;

function commonVariantMediaKeys(variant: VariantMediaKeyVariant) {
  return [
    variant.url?.trim() ? `destination_url:${variant.url.trim()}` : null,
    variant.bodyText.trim() ? `body:${variant.bodyText.trim()}` : null,
    variant.creativeGenome ? `fingerprint:${JSON.stringify(variant.creativeGenome)}` : null,
  ].filter((key): key is string => Boolean(key));
}

export function buildVariantMediaKeys(item: VariantMediaKeyItem, variant: VariantMediaKeyVariant) {
  const commonKeys = commonVariantMediaKeys(variant);
  if (variant.mediaType === "sample_movie") {
    const mediaAssetId = Number(item.mediaAsset?.id);
    const keys = [
      Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0 ? `media_asset:${mediaAssetId}` : null,
      item.sampleMovieUrl?.trim() ? `sample_movie_url:${item.sampleMovieUrl.trim()}` : null,
    ];
    return [...keys.filter((key): key is string => Boolean(key)), ...commonKeys];
  }

  const imageUrl = item.imageUrl?.trim();
  return [...(imageUrl ? [`image_url:${imageUrl}`] : [`work:${item.workId}`]), ...commonKeys];
}
