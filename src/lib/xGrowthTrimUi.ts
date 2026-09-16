export type TrimUiCandidate = {
  mediaType: string;
  mediaUrl?: string | null;
  assetId?: number | null;
};

export function shouldShowTopPickTrimControls(candidate: TrimUiCandidate) {
  // The card owns the same-origin preview URL, even when the persisted
  // candidate's recommendedMediaUrl was written by an older plan shape.
  return candidate.mediaType === "sample_movie"
    && Boolean(candidate.mediaUrl)
    && Number.isSafeInteger(candidate.assetId)
    && Number(candidate.assetId) > 0;
}

export function trimPostButtonLabel(trimStartSeconds: number) {
  return trimStartSeconds > 0 ? "トリム済み動画を使ってX投稿" : "動画を使ってX投稿";
}
