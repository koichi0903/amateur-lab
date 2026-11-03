import type { XCreativeVariant } from "@/lib/xCreativeEngine";
import {
  isOfficialEligibleVideoCandidate,
  isSoftQualityEligible,
  isStrongSafeVideoCandidate,
  officialSampleVideoAllowed,
  videoEligibilityReasons,
} from "./xGrowthEligibility";
import { isVideoCandidate } from "../xVideoCandidate";
import type { XDailyTopPick, XGrowthOpportunity, XGrowthVariantDiagnostic } from "../xGrowthOS";

function rawVideoEligibilityReasons(item: XGrowthOpportunity) {
  const reasons: string[] = [];
  if (!isVideoCandidate({ ...item, mediaType: "sample_movie" })) reasons.push("video media/sample_movie_urlなし");
  if (!officialSampleVideoAllowed(item)) reasons.push("official sample / fetchability / media safety gate NG");
  return [...new Set(reasons)];
}

function selectedDiagnosticPick(item: XGrowthOpportunity, variant: XCreativeVariant, picks: readonly XDailyTopPick[]) {
  return {
    selectedPick: picks.find((pick) => pick.workId === item.workId && pick.creativeVariantId === variant.id),
    sameWorkSelected: picks.some((pick) => pick.workId === item.workId),
  };
}

function finalVideoCandidate(variant: XCreativeVariant, isVideo: boolean, officialEligible: boolean) {
  return isVideo
    && officialEligible
    && variant.quality.passed
    && variant.quality.dimensions.adSmell <= (variant.intent === "MONEY" ? 48 : 30);
}

function qualityRejectionReason(variant: XCreativeVariant) {
  return `quality gate NG: ${variant.quality.gate.failed.join(", ") || variant.quality.lastMile.reasons.join(" / ") || variant.quality.recommendation}`;
}

function videoRejectionReason(videoReasons: string[]) {
  return `動画供給候補外: ${videoReasons.join(" / ") || "official/soft-quality条件未達"}`;
}

function selectedDiagnosticReason(
  selected: boolean,
  selectedPick: XDailyTopPick | undefined,
  sameWorkSelected: boolean,
  variant: XCreativeVariant,
  isVideo: boolean,
  finalCandidate: boolean,
  videoReasons: string[],
) {
  if (selected) return selectedPick?.alternativeReason || selectedPick?.whyBuzz || "最終候補として選定";
  if (sameWorkSelected) return "同一workの別variant/roleを選定";
  if (!variant.quality.passed) return qualityRejectionReason(variant);
  if (isVideo && !finalCandidate) return videoRejectionReason(videoReasons);
  return "枠・多様性・重複・スコアによる最終選定で非選択（個別reject codeなし）";
}

function sampleMovieFacts(item: XGrowthOpportunity, isVideo: boolean) {
  return {
    isSampleMovie: isVideo,
    mediaAssetId: isVideo && Number.isSafeInteger(Number(item.mediaAsset?.id)) ? Number(item.mediaAsset?.id) : null,
    sourceUrl: isVideo ? item.mediaAsset?.source_url ?? item.sampleMovieUrl ?? null : null,
  };
}

function lastMileFacts(variant: XCreativeVariant) {
  return {
    passed: variant.quality.lastMile.passed,
    verdict: variant.quality.lastMile.verdict,
    checks: {
      humanVoice: variant.quality.lastMile.humanVoice.passed,
      nativeXVoice: variant.quality.lastMile.nativeXVoice.passed,
      noReasons: variant.quality.lastMile.reasons.length === 0,
    },
    reasons: variant.quality.lastMile.reasons,
  };
}

function qualityFacts(variant: XCreativeVariant) {
  return {
    passed: variant.quality.passed,
    recommendation: variant.quality.recommendation,
    score: variant.quality.total,
    failedReasons: [...variant.quality.gate.failed, ...variant.quality.lastMile.reasons],
  };
}

function videoSupplyFacts(
  isVideo: boolean,
  officialEligible: boolean,
  strongSafeEligible: boolean,
  finalCandidate: boolean,
  selected: boolean,
  videoReasons: string[],
) {
  if (!isVideo) return null;
  const reason = selected
    ? "最終動画候補としてselected"
    : officialEligible && finalCandidate
      ? "official/soft-quality条件は通過したが最終枠では非選択"
      : videoReasons.join(" / ") || "official/soft-quality条件未達";
  return { officialEligible, strongSafeEligible, finalCandidate, selected, reason };
}

export function buildXGrowthVariantDiagnostic(
  item: XGrowthOpportunity,
  variant: XCreativeVariant,
  picks: readonly XDailyTopPick[] = [],
): XGrowthVariantDiagnostic {
  const { selectedPick, sameWorkSelected } = selectedDiagnosticPick(item, variant, picks);
  const isVideo = variant.mediaType === "sample_movie";
  const officialEligible = isVideo && isOfficialEligibleVideoCandidate(item);
  const strongSafeEligible = isVideo && isStrongSafeVideoCandidate(item, variant);
  const finalCandidate = finalVideoCandidate(variant, isVideo, officialEligible);
  const videoReasons = isVideo ? videoEligibilityReasons({ ...item, mediaType: "sample_movie" }, variant) : [];
  const selected = Boolean(selectedPick);
  const selectedReason = selectedDiagnosticReason(selected, selectedPick, sameWorkSelected, variant, isVideo, finalCandidate, videoReasons);
  return {
    workId: item.workId,
    slot: selectedPick?.slotId ?? null,
    role: variant.intent,
    variantId: variant.id,
    mediaType: variant.mediaType,
    sampleMovie: sampleMovieFacts(item, isVideo),
    factTypes: item.visualFacts.facts.map((fact) => fact.kind),
    videoEligibility: isVideo ? { eligible: officialEligible, reasons: rawVideoEligibilityReasons(item) } : null,
    postText: variant.bodyText,
    humanVoice: variant.quality.lastMile.humanVoice,
    nativeXVoice: variant.quality.lastMile.nativeXVoice,
    lastMile: lastMileFacts(variant),
    quality: qualityFacts(variant),
    isSoftQualityEligible: isSoftQualityEligible(variant),
    videoSupply: videoSupplyFacts(isVideo, officialEligible, strongSafeEligible, finalCandidate, selected, videoReasons),
    selected,
    selectedReason,
  };
}

function incrementCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function countFailedChecks(counts: Record<string, number>, checks: object) {
  for (const [check, passed] of Object.entries(checks)) if (!passed) incrementCount(counts, check);
}

function countReasons(counts: Record<string, number>, reasons: readonly string[]) {
  for (const reason of reasons) incrementCount(counts, reason);
}

function countVideoRejections(counts: Record<string, number>, diagnostic: XGrowthVariantDiagnostic) {
  if (!diagnostic.videoSupply || diagnostic.videoSupply.finalCandidate) return;
  countReasons(counts, diagnostic.videoSupply.reason.split(" / ").filter(Boolean));
}

export function summarizeXGrowthVariantDiagnostics(diagnostics: readonly XGrowthVariantDiagnostic[]) {
  const humanVoiceNgByCheck: Record<string, number> = {};
  const nativeXVoiceNgByCheck: Record<string, number> = {};
  const lastMileNgReasons: Record<string, number> = {};
  const qualityNgReasons: Record<string, number> = {};
  const factTypeCounts: Record<string, number> = {};
  const videoRejectionReasons: Record<string, number> = {};
  const mediaTypeCounts: Record<string, number> = {};
  const selectedByMediaType: Record<string, number> = {};
  for (const diagnostic of diagnostics) {
    incrementCount(mediaTypeCounts, diagnostic.mediaType);
    if (diagnostic.selected) incrementCount(selectedByMediaType, diagnostic.mediaType);
    countReasons(factTypeCounts, diagnostic.factTypes);
    countFailedChecks(humanVoiceNgByCheck, diagnostic.humanVoice.checks);
    countFailedChecks(nativeXVoiceNgByCheck, diagnostic.nativeXVoice.checks);
    countReasons(lastMileNgReasons, diagnostic.lastMile.reasons);
    countReasons(qualityNgReasons, diagnostic.quality.failedReasons);
    countVideoRejections(videoRejectionReasons, diagnostic);
  }
  return {
    totalVariants: diagnostics.length,
    mediaTypeCounts,
    selectedByMediaType,
    humanVoiceNgByCheck,
    nativeXVoiceNgByCheck,
    lastMileNgReasons,
    qualityNgReasons,
    factTypeCounts,
    videoRejectionReasons,
  };
}
