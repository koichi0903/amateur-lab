export type CandidateIdentity = {
  workId: number;
  productId: string;
  sampleMovieUrl: string | null;
  mediaAsset?: { id?: number } | null;
  candidateId?: string | null;
  imageUrl?: string | null;
};

/** Stable identity used by all daily candidate diversity checks. */
export function candidateDedupeKey(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  if (Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0) return `media_asset:${mediaAssetId}`;
  const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
  if (sampleMovieUrl) return `sample_movie_url:${sampleMovieUrl}`;
  if (Number.isSafeInteger(candidate.workId) && candidate.workId > 0) return `work:${candidate.workId}`;
  if (candidate.candidateId) return `candidate:${candidate.candidateId}`;
  return `product:${candidate.productId}`;
}

export function candidateMediaDedupeKey(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  if (Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0) return `media_asset:${mediaAssetId}`;
  const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
  if (sampleMovieUrl) return `sample_movie_url:${sampleMovieUrl}`;
  return candidate.imageUrl?.trim() ? `image_url:${candidate.imageUrl.trim()}` : null;
}

function candidateIdentityKeys(candidate: CandidateIdentity) {
  const mediaAssetId = Number(candidate.mediaAsset?.id);
  return {
    workId: candidate.workId,
    mediaAssetId: Number.isSafeInteger(mediaAssetId) && mediaAssetId > 0 ? mediaAssetId : null,
    sampleMovieUrl: candidate.sampleMovieUrl?.trim() || null,
    imageUrl: candidate.imageUrl?.trim() || null,
  };
}

function trackDuplicate<T>(value: T, seen: Set<T>, duplicates: Set<T>) {
  if (seen.has(value)) duplicates.add(value);
  seen.add(value);
}

function trackMediaUrl(
  url: string,
  categoryUrls: Set<string>,
  duplicateCategoryUrls: Set<string>,
  mediaUrls: Set<string>,
  duplicateMediaUrls: Set<string>,
) {
  trackDuplicate(url, categoryUrls, duplicateCategoryUrls);
  trackDuplicate(url, mediaUrls, duplicateMediaUrls);
}

function validMediaAssetId(candidate: CandidateIdentity) {
  const id = Number(candidate.mediaAsset?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function hasNoCandidateDuplicates(duplicateGroups: ReadonlySet<unknown>[]) {
  return duplicateGroups.every((duplicates) => duplicates.size === 0);
}

/** Enforces media/url uniqueness first, then work uniqueness for a candidate set. */
export function isDistinctCandidate(candidate: CandidateIdentity, selectedSet: CandidateIdentity[]) {
  return !selectedSet.some((selected) => {
    const identity = candidateIdentityKeys(candidate);
    const selectedIdentity = candidateIdentityKeys(selected);
    return selectedIdentity.workId === identity.workId
      || (identity.mediaAssetId !== null && selectedIdentity.mediaAssetId === identity.mediaAssetId)
      || (identity.sampleMovieUrl !== null && selectedIdentity.sampleMovieUrl === identity.sampleMovieUrl)
      || (identity.imageUrl !== null && selectedIdentity.imageUrl === identity.imageUrl);
  });
}

export function auditCandidateUniqueness(candidates: readonly CandidateIdentity[], postedWorkIds: ReadonlySet<number> = new Set()) {
  const workIds = new Set<number>();
  const mediaIds = new Set<number>();
  const mediaUrls = new Set<string>();
  const sampleMovieUrls = new Set<string>();
  const imageUrls = new Set<string>();
  const duplicateWorkIds = new Set<number>();
  const duplicateMediaIds = new Set<number>();
  const duplicateMediaUrls = new Set<string>();
  const duplicateSampleMovieUrls = new Set<string>();
  const duplicateImageUrls = new Set<string>();
  let postedOverlap = 0;
  for (const candidate of candidates) {
    if (postedWorkIds.has(candidate.workId)) postedOverlap += 1;
    trackDuplicate(candidate.workId, workIds, duplicateWorkIds);
    const mediaId = validMediaAssetId(candidate);
    if (mediaId !== null) trackDuplicate(mediaId, mediaIds, duplicateMediaIds);
    const sampleMovieUrl = candidate.sampleMovieUrl?.trim();
    if (sampleMovieUrl) trackMediaUrl(sampleMovieUrl, sampleMovieUrls, duplicateSampleMovieUrls, mediaUrls, duplicateMediaUrls);
    const imageUrl = candidate.imageUrl?.trim();
    if (imageUrl) trackMediaUrl(imageUrl, imageUrls, duplicateImageUrls, mediaUrls, duplicateMediaUrls);
  }
  return {
    workDuplicateCount: duplicateWorkIds.size,
    mediaDuplicateCount: duplicateMediaIds.size,
    urlDuplicateCount: duplicateMediaUrls.size,
    sampleMovieDuplicateCount: duplicateSampleMovieUrls.size,
    imageDuplicateCount: duplicateImageUrls.size,
    postedOverlap,
    duplicateWorkIds: [...duplicateWorkIds],
    duplicateMediaIds: [...duplicateMediaIds],
    duplicateUrls: [...duplicateMediaUrls],
    duplicateSampleMovieUrls: [...duplicateSampleMovieUrls],
    duplicateImageUrls: [...duplicateImageUrls],
    passed: hasNoCandidateDuplicates([duplicateWorkIds, duplicateMediaIds, duplicateMediaUrls, duplicateSampleMovieUrls, duplicateImageUrls])
      && postedOverlap === 0,
  };
}
