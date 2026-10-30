import type { XMediaAsset } from "@/lib/xMediaAssets";

export function selectPreferredXMediaAssetsByWork(
  assets: XMediaAsset[],
  isTechnicalSampleUsable: (asset: XMediaAsset | undefined) => boolean,
) {
  const byWork = new Map<number, XMediaAsset>();
  for (const asset of assets) {
    if (!asset.work_id || (asset.media_type !== "sample_movie" && asset.media_type !== "video")) continue;
    const current = byWork.get(asset.work_id);
    const currentUsable = isTechnicalSampleUsable(current);
    const nextUsable = isTechnicalSampleUsable(asset);
    const currentStrong = current?.media_quality === "strong" && (current.manual_tags ?? []).includes("first_seconds_strong");
    const nextStrong = asset.media_quality === "strong" && (asset.manual_tags ?? []).includes("first_seconds_strong");
    if (!current || (nextUsable && !currentUsable) || (nextUsable === currentUsable && nextStrong && !currentStrong)) {
      byWork.set(asset.work_id, asset);
    }
  }
  return byWork;
}
