import {
  isFanzaXGrowthTechnicalSampleMovie,
  isOfficialFanzaDmmSampleUrl,
  isUsableXMediaAsset,
  sourceDomain,
  sourceKindFor,
  X_GROWTH_ACCOUNT,
  type XMediaAsset,
} from "../xMediaAssets";
import type { XGrowthOpportunity } from "../xGrowthOS";

function createVirtualSampleAsset(item: XGrowthOpportunity): Partial<XMediaAsset> | null {
  if (item.mediaType !== "sample_movie" || !item.sampleMovieUrl) return null;
  return {
    id: undefined,
    account_handle: X_GROWTH_ACCOUNT,
    work_id: item.workId,
    product_id: item.productId,
    media_type: "sample_movie",
    source_url: item.sampleMovieUrl,
    source_domain: sourceDomain(item.sampleMovieUrl),
    source_kind: sourceKindFor(item.sampleMovieUrl),
    fetch_status: null,
    rights_status: "unknown",
    x_usage_allowed: false,
    can_reupload: false,
    can_modify: false,
    quote_only: true,
    commercial_use_allowed: false,
    media_quality: "unreviewed",
    manual_tags: [],
    trim_start_seconds: 0,
    trim_modify_confirmed: false,
    notes: "virtual official sample_movie_url candidate",
  };
}

function hasOfficialRecommendedFallback(
  item: XGrowthOpportunity,
  storedAsset: XMediaAsset | undefined,
) {
  return item.mediaType === "sample_movie"
    && !item.sampleMovieUrl
    && !storedAsset
    && isOfficialFanzaDmmSampleUrl(item.recommendedMediaUrl);
}

function getMediaVerdict(
  item: XGrowthOpportunity,
  asset: Partial<XMediaAsset> | null,
  recommendedUrlFallback: boolean,
) {
  if (item.mediaType !== "sample_movie") return isUsableXMediaAsset(asset);
  if (recommendedUrlFallback) {
    return { usable: true, reasons: ["official recommendedMediaUrl fallback; HTTP/MIME未確認"] };
  }
  return isFanzaXGrowthTechnicalSampleMovie(asset, item.sampleMovieUrl);
}

function describeMediaDecision(
  recommendedUrlFallback: boolean,
  verdict: { usable: boolean; reasons: string[] },
) {
  if (recommendedUrlFallback) return "公式recommendedMediaUrlのフォールバック（HTTP/MIME未確認）";
  if (verdict.usable) return "公式FANZA/DMM sample_movie_url。HTTP/MIME/取得可能性を確認済み";
  return `動画は${verdict.reasons.join(" / ") || "technical条件未確認"}のため未使用`;
}

export function projectXGrowthMediaEligibility(
  item: XGrowthOpportunity,
  assets: Map<number, XMediaAsset>,
) {
  const storedAsset = assets.get(item.workId);
  const asset = storedAsset ?? createVirtualSampleAsset(item);
  const recommendedUrlFallback = hasOfficialRecommendedFallback(item, storedAsset);
  const verdict = getMediaVerdict(item, asset, recommendedUrlFallback);

  if (item.mediaType !== "sample_movie") {
    return { ...item, mediaUsage: "allowed" as const, canNativeVideo: verdict.usable, mediaAsset: asset ?? null };
  }

  return {
    ...item,
    mediaUsage: verdict.usable ? "allowed" as const : "not_available" as const,
    canNativeVideo: verdict.usable,
    mediaAsset: asset ?? null,
    mediaDecision: describeMediaDecision(recommendedUrlFallback, verdict),
  };
}
