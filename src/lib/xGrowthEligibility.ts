import type { XCreativeVariant } from "@/lib/xCreativeEngine";
import { isFanzaXGrowthTechnicalSampleMovie, isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { isVideoCandidate } from "@/lib/xVideoCandidate";
import type { XGrowthOpportunity } from "./xGrowthOS";

export const VIDEO_QUALITY_EVALUATION_WORK_LIMIT = 500;

/** User-confirmed pinned evaluation candidate; change only after an explicit decision. */
export const X_GROWTH_PINNED_EVALUATION_WORK_IDS: ReadonlySet<number> = new Set([56714]);

export function isSoftQualityEligible(variant: XCreativeVariant) {
  return variant.quality.passed
    || (variant.quality.recommendation === "revise"
      && variant.quality.lastMile.passed
      && variant.quality.lastMile.humanVoice.passed
      && variant.quality.lastMile.nativeXVoice.passed);
}

export function isMediaVariantSelectionEligible(variant: XCreativeVariant) {
  return variant.mediaType === "sample_movie" ? variant.quality.passed : isSoftQualityEligible(variant);
}

export function isAllowedXGrowthMediaType(mediaType: XGrowthOpportunity["mediaType"]) {
  return mediaType === "sample_movie" || mediaType === "existing_link_image" || mediaType === "data_card";
}
export function officialSampleVideoAllowed(item: Pick<XGrowthOpportunity, "mediaAsset" | "sampleMovieUrl" | "recommendedMediaUrl">) {
  const sourceUrl = item.mediaAsset?.source_url ?? item.sampleMovieUrl ?? item.recommendedMediaUrl;
  if (!item.mediaAsset && !item.sampleMovieUrl && item.recommendedMediaUrl) {
    return isOfficialFanzaDmmSampleUrl(item.recommendedMediaUrl);
  }
  return Boolean(sourceUrl) && isFanzaXGrowthTechnicalSampleMovie(item.mediaAsset, sourceUrl).usable;
}

/** A video is strong only when the existing safety, quality, and visual evidence agree. */
export function isStrongSafeVideoCandidate(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "visualFacts" | "visualScoring" | "mediaType" | "recommendedMediaUrl" | "decisionFacts">,
  variant?: Pick<XCreativeVariant, "mediaType" | "quality"> | null,
) {
  return videoEligibilityReasons(item, variant).length === 0;
}

/** Official sample movies remain selectable when automated strong/safe evidence is incomplete. */
export function isOfficialEligibleVideoCandidate(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "mediaType" | "recommendedMediaUrl">,
) {
  return isVideoCandidate({ ...item, mediaType: "sample_movie" })
    && officialSampleVideoAllowed(item);
}

export function officialVideoWorkIds<TItem extends Pick<
  XGrowthOpportunity,
  "workId" | "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "mediaType" | "recommendedMediaUrl"
>>(items: readonly TItem[]) {
  return new Set(items.filter(isOfficialEligibleVideoCandidate).map((item) => item.workId));
}

export function videoEligibilityReasons(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "visualFacts" | "visualScoring" | "mediaType" | "recommendedMediaUrl" | "decisionFacts">,
  variant?: Pick<XCreativeVariant, "mediaType" | "quality"> | null,
) {
  const tags = item.mediaAsset?.manual_tags ?? [];
  const reasons = [
    ...videoCandidateReasons(item, variant),
    ...videoMediaSafetyReasons(item, tags),
    ...videoQualityReasons(variant),
  ];
  if (!hasVideoHookEvidence(item, tags)) reasons.push("video hook / fact strength不足");
  return [...new Set(reasons)];
}

function videoCandidateReasons(
  item: Pick<XGrowthOpportunity, "canNativeVideo" | "mediaAsset" | "sampleMovieUrl" | "mediaType" | "recommendedMediaUrl">,
  variant?: Pick<XCreativeVariant, "mediaType"> | null,
) {
  const reasons: string[] = [];
  const candidate = { ...item, mediaType: variant?.mediaType ?? item.mediaType };
  if (!isVideoCandidate(candidate)) reasons.push("video media/sample_movie_urlなし");
  if (variant?.mediaType !== "sample_movie") reasons.push("creative variantが動画ではない");
  return reasons;
}

function videoMediaSafetyReasons(
  item: Pick<XGrowthOpportunity, "mediaAsset" | "sampleMovieUrl" | "recommendedMediaUrl">,
  tags: string[],
) {
  const reasons: string[] = [];
  // Rights and technical review are hard gates. An official URL alone is not
  // permission to repost it to X.
  if (!officialSampleVideoAllowed(item)) reasons.push("official sample / fetchability / media safety gate NG");
  if (item.mediaAsset?.media_quality === "weak") reasons.push("media_quality=weak");
  // null/undefined and unreviewed are intentionally not weak.
  if (tags.includes("too_explicit_for_reach")) reasons.push("too_explicit_for_reach");
  if (tags.includes("weak_visual")) reasons.push("weak_visual");
  return reasons;
}

function videoQualityReasons(variant?: Pick<XCreativeVariant, "quality"> | null) {
  const reasons: string[] = [];
  if (!variant?.quality.passed) reasons.push("creative quality gate NG");
  if (variant && !variant.quality.lastMile.humanVoice.passed) reasons.push("human voice gate NG");
  if (variant && !variant.quality.lastMile.nativeXVoice.passed) reasons.push("native X voice gate NG");
  return reasons;
}

function hasVideoHookEvidence(
  item: Pick<XGrowthOpportunity, "visualScoring" | "visualFacts" | "decisionFacts">,
  tags: string[],
) {
  const hasUsableVideoFact = (item.visualFacts?.usableFacts ?? []).some((fact) =>
    fact.source === "sample_video" || fact.source === "manual_tag" || fact.kind === "notable_video_hook",
  );
  const hasDecisionFactProof = Boolean(item.decisionFacts?.decisionType && item.decisionFacts?.currentPrice != null);
  return item.visualScoring.videoHookStrength >= 80 || hasUsableVideoFact || hasDecisionFactProof || tags.some((tag) =>
    ["first_seconds_strong", "scene_surprise", "actress_fit", "visual_mismatch", "safe_preview"].includes(tag),
  );
}

function cheapPrefilterScore(candidate: XGrowthOpportunity) {
  const visualScore = candidate.visualScoring.videoHookStrength + candidate.visualScoring.visualSpecificity;
  const audienceScore = Math.max(candidate.reachScore, candidate.followScore, candidate.authorityScore, candidate.revenueScore);
  return audienceScore + visualScore * 0.08;
}

function addPrefilterCandidate(
  selected: Map<string, XGrowthOpportunity>,
  item: XGrowthOpportunity,
  limit: number,
) {
  if (selected.size < limit) selected.set(item.key, item);
}

function reserveTopVideoCandidates(
  ranked: XGrowthOpportunity[],
  selected: Map<string, XGrowthOpportunity>,
  limit: number,
) {
  const reservedVideoWorks = new Set<number>();
  for (const item of ranked) {
    if (reservedVideoWorks.size >= Math.min(VIDEO_QUALITY_EVALUATION_WORK_LIMIT, limit)) break;
    if (!isVideoCandidate({ ...item, mediaType: "sample_movie" }) || !officialSampleVideoAllowed(item) || reservedVideoWorks.has(item.workId)) continue;
    addPrefilterCandidate(selected, item, limit);
    reservedVideoWorks.add(item.workId);
  }
}

function reserveTopCandidatesByRole(
  ranked: XGrowthOpportunity[],
  selected: Map<string, XGrowthOpportunity>,
  limit: number,
) {
  for (const role of ["REACH", "FOLLOW", "AUTHORITY", "MONEY"] as const) {
    [...ranked].sort((a, b) => {
      const score = (item: XGrowthOpportunity) => role === "REACH" ? item.reachScore : role === "FOLLOW" ? item.followScore : role === "AUTHORITY" ? item.authorityScore : item.revenueScore;
      return score(b) - score(a);
    }).slice(0, 30).forEach((item) => addPrefilterCandidate(selected, item, limit));
  }
}

function reserveFirstCandidatesPerSource(
  ranked: XGrowthOpportunity[],
  selected: Map<string, XGrowthOpportunity>,
  limit: number,
) {
  const perSource = new Map<string, number>();
  for (const item of ranked) {
    if ((perSource.get(item.sourceType) ?? 0) >= 3) continue;
    addPrefilterCandidate(selected, item, limit);
    perSource.set(item.sourceType, (perSource.get(item.sourceType) ?? 0) + 1);
  }
}

/** Cheap, deterministic narrowing before the expensive Human Voice matrix. */
export function cheapCandidatePrefilter(items: XGrowthOpportunity[], limit = 300) {
  const ranked = [...items].sort((a, b) => cheapPrefilterScore(b) - cheapPrefilterScore(a));
  const selected = new Map<string, XGrowthOpportunity>();
  reserveTopVideoCandidates(ranked, selected, limit);
  for (const item of ranked.filter((candidate) => candidate.sourceType === "MONEY").slice(0, 30)) {
    addPrefilterCandidate(selected, item, limit);
  }
  reserveTopCandidatesByRole(ranked, selected, limit);
  reserveFirstCandidatesPerSource(ranked, selected, limit);
  return ranked.filter((item) => selected.has(item.key)).slice(0, limit);
}

/** Keep Decision Facts lanes alive before applying the bounded score window. */
export function preserveDecisionLanesBeforeLimit(
  items: XGrowthOpportunity[],
  limit = 500,
  mustKeepWorkIds: ReadonlySet<number> = new Set(),
) {
  const selected = new Map<string, XGrowthOpportunity>();
  const add = (item: XGrowthOpportunity) => {
    if (selected.size < limit) selected.set(item.key, item);
  };
  for (const item of items) if (mustKeepWorkIds.has(item.workId)) add(item);
  const reservedVideoWorks = new Set<number>();
  for (const item of items) {
    if (reservedVideoWorks.size >= Math.min(VIDEO_QUALITY_EVALUATION_WORK_LIMIT, limit)) break;
    if (!isVideoCandidate({ ...item, mediaType: "sample_movie" }) || !officialSampleVideoAllowed(item) || reservedVideoWorks.has(item.workId)) continue;
    add(item);
    reservedVideoWorks.add(item.workId);
  }
  for (const item of items) add(item);
  return [...selected.values()];
}
