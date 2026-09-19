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

function verifiedMediaStrength(evidence: PersistedQuoteMediaEvidence) {
  if (evidence.media_type === "video" && evidence.media_permalink_validation_status === "verified_video_permalink" && evidence.media_permalink) return 3;
  if (evidence.media_type === "image" && evidence.media_permalink && evidence.quote_visual_ready) return 3;
  if ((evidence.media_type === "video" && evidence.has_video) || (evidence.media_type === "image" && evidence.has_image)) return 2;
  if (evidence.media_type === "video" || evidence.media_type === "image") return 1;
  return 0;
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
