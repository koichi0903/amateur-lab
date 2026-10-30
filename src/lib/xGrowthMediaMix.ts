import type { DecisionType } from "./domain/decisionFacts";

export type RankedMediaMixCandidate = {
  workId: number;
  mediaKey: string;
  /** All identity keys that must not collide with another selected work. */
  mediaKeys?: readonly string[];
  mediaType: "sample_movie" | "existing_link_image";
  score: number;
  decisionTypes: DecisionType[];
};

export type RankedDuplicateBreakdown = {
  sameWorkVariants: number;
  sameMediaVariants: number;
  sameDestinationUrlVariants: number;
  sameImageVariants: number;
  sameSampleMovieVariants: number;
  sameBodyVariants: number;
  sameFingerprintVariants: number;
  lostUniqueWorks: number;
};

function mediaKeysFor(item: RankedMediaMixCandidate) {
  return item.mediaKeys?.length ? item.mediaKeys : [item.mediaKey];
}

function rankRepresentatives<T extends RankedMediaMixCandidate>(sorted: readonly T[]) {
  const byWork = new Map<number, T[]>();
  for (const item of sorted) byWork.set(item.workId, [...(byWork.get(item.workId) ?? []), item]);
  const videoSupplyWorks = new Set(sorted.filter((item) => item.mediaType === "sample_movie").map((item) => item.workId));
  const preferVideo = videoSupplyWorks.size > 0;
  const rankedPool: T[] = [];
  const seenMedia = new Set<string>();
  for (const workItems of byWork.values()) {
    const candidates = preferVideo && workItems.some((item) => item.mediaType === "sample_movie")
      ? workItems.filter((item) => item.mediaType === "sample_movie")
      : workItems;
    const representative = candidates.find((item) => mediaKeysFor(item).every((key) => !seenMedia.has(key)));
    if (!representative) continue;
    rankedPool.push(representative);
    for (const key of mediaKeysFor(representative)) seenMedia.add(key);
  }
  return { rankedPool, byWork };
}

function rankedDuplicates<T extends RankedMediaMixCandidate>(sorted: readonly T[], uniqueWorkCount: number, rankedWorkCount: number): RankedDuplicateBreakdown {
  const seenWorkIds = new Set<number>();
  const seenKeys = new Set<string>();
  const breakdown: RankedDuplicateBreakdown = {
    sameWorkVariants: 0,
    sameMediaVariants: 0,
    sameDestinationUrlVariants: 0,
    sameImageVariants: 0,
    sameSampleMovieVariants: 0,
    sameBodyVariants: 0,
    sameFingerprintVariants: 0,
    lostUniqueWorks: Math.max(0, uniqueWorkCount - rankedWorkCount),
  };
  for (const item of sorted) {
    if (seenWorkIds.has(item.workId)) breakdown.sameWorkVariants += 1;
    seenWorkIds.add(item.workId);
    const keys = mediaKeysFor(item);
    if (keys.some((key) => /^(media_asset|sample_movie_url|image_url):/.test(key) && seenKeys.has(key))) breakdown.sameMediaVariants += 1;
    if (keys.some((key) => key.startsWith("destination_url:") && seenKeys.has(key))) breakdown.sameDestinationUrlVariants += 1;
    if (keys.some((key) => key.startsWith("image_url:") && seenKeys.has(key))) breakdown.sameImageVariants += 1;
    if (keys.some((key) => key.startsWith("sample_movie_url:") && seenKeys.has(key))) breakdown.sameSampleMovieVariants += 1;
    if (keys.some((key) => key.startsWith("body:") && seenKeys.has(key))) breakdown.sameBodyVariants += 1;
    if (keys.some((key) => key.startsWith("fingerprint:") && seenKeys.has(key))) breakdown.sameFingerprintVariants += 1;
    for (const key of keys) seenKeys.add(key);
  }
  return breakdown;
}

function targetVideoCount(videoEligible: number, limit: number) {
  if (videoEligible >= 5) return 5;
  if (videoEligible >= 4) return 4;
  return Math.min(videoEligible, Math.max(0, limit - 4));
}

function selectWithMediaQuotas<T extends RankedMediaMixCandidate>(rankedPool: readonly T[], limit: number, targetVideos: number, targetImages: number) {
  const selected: T[] = [];
  const selectedWorks = new Set<number>();
  const selectedMedia = new Set<string>();
  let videos = 0;
  let images = 0;
  const add = (item: T, enforceQuota: boolean) => {
    if (selected.length >= limit || selectedWorks.has(item.workId) || selectedMedia.has(item.mediaKey)) return false;
    if (enforceQuota && item.mediaType === "sample_movie" && videos >= targetVideos) return false;
    if (enforceQuota && item.mediaType === "existing_link_image" && images >= targetImages) return false;
    selected.push(item);
    selectedWorks.add(item.workId);
    selectedMedia.add(item.mediaKey);
    if (item.mediaType === "sample_movie") videos += 1;
    else images += 1;
    return true;
  };
  for (const item of rankedPool) add(item, true);
  for (const item of rankedPool) add(item, false);
  return selected;
}

/** Deterministic ranking/skip/quota primitive used by the X Growth allocator. */
export function selectRankedMediaMix<T extends RankedMediaMixCandidate>(items: readonly T[], limit = 9, postedWorkIds: ReadonlySet<number> = new Set()) {
  const sorted = [...items].filter((item) => !postedWorkIds.has(item.workId)).sort((a, b) => b.score - a.score || a.workId - b.workId || a.mediaKey.localeCompare(b.mediaKey));
  // Keep video representatives available for quota allocation before selecting a single work variant.
  const { rankedPool, byWork } = rankRepresentatives(sorted);
  const duplicateBreakdown = rankedDuplicates(sorted, byWork.size, rankedPool.length);
  const videoEligible = rankedPool.filter((item) => item.mediaType === "sample_movie").length;
  const targetVideos = targetVideoCount(videoEligible, limit);
  const targetImages = Math.max(0, limit - targetVideos);
  const selected = selectWithMediaQuotas(rankedPool, limit, targetVideos, targetImages);
  return { rankedPool, selected, targetVideos, targetImages, coverageAdjustments: 0, duplicateBreakdown };
}
