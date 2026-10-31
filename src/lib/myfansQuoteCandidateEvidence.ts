export type PersistedQuoteMediaEvidence = {
  media_type?: string | null;
  media_permalink?: string | null;
  media_count?: number | null;
  quote_visual_ready?: boolean | null;
  media_permalink_validation_status?: string | null;
  media_permalink_verified_at?: string | null;
  visual_score?: number | null;
  has_image?: boolean | null;
  has_video?: boolean | null;
};

function isVideoEvidence(evidence: PersistedQuoteMediaEvidence) {
  return evidence.media_type === "video";
}

function isImageEvidence(evidence: PersistedQuoteMediaEvidence) {
  return evidence.media_type === "image";
}

function hasVerifiedVideoPermalink(evidence: PersistedQuoteMediaEvidence) {
  return isVideoEvidence(evidence)
    && evidence.media_permalink_validation_status === "verified_video_permalink"
    && Boolean(evidence.media_permalink);
}

function hasReadyImagePermalink(evidence: PersistedQuoteMediaEvidence) {
  return isImageEvidence(evidence)
    && Boolean(evidence.media_permalink)
    && Boolean(evidence.quote_visual_ready);
}

function hasSavedMediaForType(evidence: PersistedQuoteMediaEvidence) {
  if (isVideoEvidence(evidence)) return Boolean(evidence.has_video);
  if (isImageEvidence(evidence)) return Boolean(evidence.has_image);
  return false;
}

function hasSupportedMediaType(evidence: PersistedQuoteMediaEvidence) {
  return isVideoEvidence(evidence) || isImageEvidence(evidence);
}

function verifiedMediaStrength(evidence: PersistedQuoteMediaEvidence) {
  if (hasVerifiedVideoPermalink(evidence)) return 3;
  if (hasReadyImagePermalink(evidence)) return 3;
  if (hasSavedMediaForType(evidence)) return 2;
  return hasSupportedMediaType(evidence) ? 1 : 0;
}

export function mergePersistedQuoteMediaEvidence<T extends PersistedQuoteMediaEvidence>(
  existing: PersistedQuoteMediaEvidence,
  incoming: T,
) {
  const existingStrength = verifiedMediaStrength(existing);
  const incomingStrength = verifiedMediaStrength(incoming);
  if (existingStrength <= incomingStrength) return incoming;

  return {
    ...incoming,
    media_type: existing.media_type,
    media_permalink: existing.media_permalink,
    media_count: existing.media_count,
    quote_visual_ready: existing.quote_visual_ready,
    media_permalink_validation_status: existing.media_permalink_validation_status,
    media_permalink_verified_at: existing.media_permalink_verified_at,
    visual_score: existing.visual_score,
    has_image: existing.has_image,
    has_video: existing.has_video,
  } as T;
}
