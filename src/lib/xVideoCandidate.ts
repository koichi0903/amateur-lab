export type XVideoCandidateLike = {
  mediaType?: unknown;
  sampleMovieUrl?: unknown;
  recommendedMediaUrl?: unknown;
  mediaAsset?: {
    media_type?: string | null;
    source_url?: string | null;
  } | null;
};

/** The single source of truth for whether a candidate actually carries video media. */
export function isVideoCandidate(candidate: XVideoCandidateLike | null | undefined) {
  if (!candidate) return false;
  const mediaType = candidate.mediaType;
  const assetType = candidate.mediaAsset?.media_type;
  const isVideoType = typeof mediaType === "string"
    ? mediaType === "sample_movie"
    : assetType === "video" || assetType === "sample_movie";
  const sourceUrl = candidate.mediaAsset?.source_url
    ?? (typeof candidate.sampleMovieUrl === "string" ? candidate.sampleMovieUrl : null)
    ?? (typeof candidate.recommendedMediaUrl === "string" ? candidate.recommendedMediaUrl : null);
  return isVideoType && typeof sourceUrl === "string" && sourceUrl.trim().length > 0;
}
