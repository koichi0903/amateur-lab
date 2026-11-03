import type { XMediaAsset } from "@/lib/xMediaAssets";

function isSelectableVideoAsset(asset: XMediaAsset): asset is XMediaAsset & { work_id: number } {
  return Boolean(asset.work_id)
    && (asset.media_type === "sample_movie" || asset.media_type === "video");
}

function hasStrongOpening(asset: XMediaAsset | undefined) {
  return asset?.media_quality === "strong" && (asset.manual_tags ?? []).includes("first_seconds_strong");
}

function shouldPreferNextAsset(
  current: XMediaAsset | undefined,
  currentUsable: boolean,
  nextUsable: boolean,
  currentStrong: boolean,
  nextStrong: boolean,
) {
  return !current
    || (nextUsable && !currentUsable)
    || (nextUsable === currentUsable && nextStrong && !currentStrong);
}

export function selectPreferredXMediaAssetsByWork(
  assets: XMediaAsset[],
  isTechnicalSampleUsable: (asset: XMediaAsset | undefined) => boolean,
) {
  const byWork = new Map<number, XMediaAsset>();
  for (const asset of assets) {
    if (!isSelectableVideoAsset(asset)) continue;
    const current = byWork.get(asset.work_id);
    const currentUsable = isTechnicalSampleUsable(current);
    const nextUsable = isTechnicalSampleUsable(asset);
    const currentStrong = hasStrongOpening(current);
    const nextStrong = hasStrongOpening(asset);
    if (shouldPreferNextAsset(current, currentUsable, nextUsable, currentStrong, nextStrong)) {
      byWork.set(asset.work_id, asset);
    }
  }
  return byWork;
}
