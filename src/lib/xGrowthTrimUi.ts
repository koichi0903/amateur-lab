import { isVideoCandidate } from "./xVideoCandidate";

export type TrimUiCandidate = {
  mediaType: string;
  mediaUrl?: string | null;
  assetId?: number | null;
  mediaAsset?: { media_type?: string | null; source_url?: string | null } | null;
  sampleMovieUrl?: string | null;
};

export function shouldShowTopPickTrimControls(candidate: TrimUiCandidate) {
  // The card owns the same-origin preview URL, even when the persisted
  // candidate's recommendedMediaUrl was written by an older plan shape.
  return isVideoCandidate({
    mediaType: candidate.mediaType,
    recommendedMediaUrl: candidate.mediaUrl,
    sampleMovieUrl: candidate.sampleMovieUrl,
    mediaAsset: candidate.mediaAsset ? {
      media_type: candidate.mediaAsset.media_type ?? undefined,
      source_url: candidate.mediaAsset.source_url ?? undefined,
    } : null,
  })
    && Number.isSafeInteger(candidate.assetId)
    && Number(candidate.assetId) > 0;
}

export function trimPostButtonLabel(trimStartSeconds: number) {
  return trimStartSeconds > 0 ? "トリム済み動画を使ってX投稿" : "動画を使ってX投稿";
}
